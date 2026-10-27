import assert from "node:assert/strict";
import fs from "node:fs";
import { createSessionFetch } from './session-fetch.mjs';
const fetch = createSessionFetch();
const base = "http://127.0.0.1:8266/api";
const json = (method, body) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
async function api(path, options) {
  const r = await fetch(base + path, options);
  const data = await r.json();
  assert.ok(r.ok, JSON.stringify(data));
  return data;
}
const c = await api(
  "/cases",
  json("POST", {
    title: "接口验证-" + Date.now(),
    scene: "rental",
    stage: "已经发生问题",
  }),
);
const route = "/cases/" + c.id;
try {
  const form = new FormData();
  form.append(
    "files",
    new Blob(["合同：押金1000.10元，房屋墙面维修扣款。"], {
      type: "text/plain",
    }),
    "contract.txt",
  );
  const [m] = await api(route + "/materials", { method: "POST", body: form });
  const confirmed = await api(
    route + "/disputes",
    json("POST", {
      title: "确认扣款",
      amount: "0.10",
      status: "双方确认",
      materialIds: [m.id],
    }),
  );
  await api(
    route + "/disputes",
    json("POST", {
      title: "争议扣款",
      amount: "800",
      status: "有争议",
      materialIds: [m.id],
    }),
  );
  const data = await api(
    route + "/settlement",
    json("PUT", {
      deposit: "1000.10",
      refunded: "0.20",
      depositMaterialIds: [m.id],
      refundMaterialIds: [],
    }),
  );
  assert.equal(data.settlementSummary.balance, 99980);
  assert.equal(data.settlementSummary.pending, 80000);
  const invalid = await fetch(
    base + route + "/settlement",
    json("PUT", { deposit: "-1", refunded: "0" }),
  );
  assert.equal(invalid.status, 400);
  const cross = await fetch(
    base + route + "/disputes",
    json("POST", {
      title: "非法引用",
      status: "待核实",
      amount: "1",
      materialIds: ["foreign-id"],
    }),
  );
  assert.equal(cross.status, 400);
  const extracted = await api(route + "/facts/extract", json("POST", {}));
  assert.ok(extracted.addedCount);
  assert.ok(extracted.facts.every((f) => f.status === "待核实"));
  await api(route + "/draft", json("POST", { kind: "communication" }));
  const before = await api(route);
  assert.equal(
    before.drafts.communication.sourceFingerprint,
    before.sourceFingerprint,
  );
  await api(
    route + "/materials/" + m.id,
    json("PATCH", { text: "合同：押金1000.10元。补充约定待核实。" }),
  );
  const after = await api(route);
  assert.notEqual(
    after.sourceFingerprint,
    after.drafts.communication.sourceFingerprint,
  );
  await api(route + "/draft", json("POST", { kind: "evidence" }));
  const docs = await api(route);
  assert.ok(docs.drafts.communication.text);
  assert.ok(docs.drafts.evidence.text.includes("contract.txt"));
  const noConsent = await fetch(base + route + "/analysis", json("POST", {}));
  assert.equal(noConsent.status, 400);
  const settings = await api("/settings");
  assert.ok(!("apiKey" in settings));
  if (!settings.textReady) {
    const unavailable = await fetch(
      base + route + "/analysis",
      json("POST", { consent: true }),
    );
    assert.equal(unavailable.status, 503);
  }
  const spoof = new FormData();
  spoof.append(
    "files",
    new Blob(["<script>bad</script>"], { type: "text/html" }),
    "fake.png",
  );
  const bad = await fetch(base + route + "/materials", {
    method: "POST",
    body: spoof,
  });
  assert.equal(bad.status, 400);
  await api(route + "/materials/" + m.id, { method: "DELETE" });
  const cleaned = await api(route);
  assert.equal(cleaned.facts.length, 0);
  assert.ok(cleaned.disputes.every((d) => !d.materialIds.length));
  assert.equal(cleaned.settlement.depositMaterialIds.length, 0);
  assert.ok(!fs.existsSync("data/uploads/" + m.file));
  const foreignOrigin = await fetch(base + "/cases", {
    headers: { Origin: "https://example.org" },
  });
  assert.equal(foreignOrigin.status, 403);
  console.log(
    "PASS: settlement precision, unconfirmed deductions, validation, evidence isolation, fact states, stale-draft detection, separate drafts, missing-key/consent errors, MIME verification and linked-data cleanup.",
  );
} finally {
  await api(route, { method: "DELETE" });
}
