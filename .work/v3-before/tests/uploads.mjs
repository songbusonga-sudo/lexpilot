import assert from "node:assert/strict";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
const base = "http://127.0.0.1:8266/api";
async function api(route, options) {
  const r = await fetch(base + route, options);
  const data = await r.json();
  assert.ok(r.ok, JSON.stringify(data));
  return data;
}
const title = "文件流程验证-" + Date.now();
const c = await api("/cases", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ title, scene: "rental", stage: "正在履行" }),
});
function pdf() {
  const stream = "BT /F1 12 Tf 50 750 Td (Deposit receipt 2000) Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let content = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((o, i) => {
    offsets.push(Buffer.byteLength(content));
    content += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(content);
  content +=
    "xref\n0 6\n0000000000 65535 f \n" +
    offsets
      .slice(1)
      .map((n) => `${String(n).padStart(10, "0")} 00000 n \n`)
      .join("") +
    `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return content;
}
try {
  const form = new FormData();
  form.append(
    "files",
    new Blob([pdf()], { type: "application/pdf" }),
    "receipt.pdf",
  );
  form.append(
    "files",
    new Blob(
      [
        Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0S0AAAAASUVORK5CYII=",
          "base64",
        ),
      ],
      { type: "image/png" },
    ),
    "room.png",
  );
  const ms = await api(`/cases/${c.id}/materials`, {
    method: "POST",
    body: form,
  });
  assert.equal(ms.length, 2);
  const doc = ms.find((m) => m.name === "receipt.pdf"),
    image = ms.find((m) => m.name === "room.png");
  assert.ok(doc.text.includes("Deposit receipt 2000"));
  assert.equal(image.status, "待人工核对");
  assert.equal(image.text, "");
  const original = await fetch(
    base + `/cases/${c.id}/materials/${image.id}/file`,
  );
  assert.equal(original.headers.get("content-type"), "image/png");
  await api(`/cases/${c.id}/materials/${image.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "墙面损坏情况待核实", date: "2026-09-01" }),
  });
  const detail = await api(`/cases/${c.id}`);
  assert.equal(
    detail.materials.find((m) => m.id === image.id).date,
    "2026-09-01",
  );
  assert.ok(detail.findings.length);
  await api(`/cases/${c.id}/materials/${image.id}`, { method: "DELETE" });
  assert.equal(fs.existsSync("data/uploads/" + image.file), false);
  assert.equal((await api(`/cases/${c.id}`)).materials.length, 1);
  const invalid = await fetch(base + "/cases", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "", scene: "unknown" }),
  });
  assert.equal(invalid.status, 400);
  console.log(
    "PASS: PDF extraction, image upload/original preview, manual text/date confirmation, updated findings, file deletion and invalid-input rejection.",
  );
} finally {
  const db = new DatabaseSync("data/qingdun.sqlite");
  for (const row of db
    .prepare("SELECT body FROM materials WHERE case_id=?")
    .all(c.id)) {
    const m = JSON.parse(row.body);
    if (m.file) fs.rmSync("data/uploads/" + m.file, { force: true });
  }
  db.prepare("DELETE FROM materials WHERE case_id=?").run(c.id);
  db.prepare("DELETE FROM cases WHERE id=?").run(c.id);
  db.close();
}
