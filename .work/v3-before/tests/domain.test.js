import { test } from "node:test";
import assert from "node:assert/strict";
import { analyze, makeDraft } from "../server/domain.js";
test("findings cite an exact substring of their source", () => {
  const materials = [
    {
      id: "a",
      text: "第四条：押金2000元，房东视情况扣除相关费用。房屋损坏维修责任另行约定。",
    },
  ];
  const findings = analyze(materials, "rental");
  assert.ok(findings.length >= 2);
  for (const f of findings) {
    assert.equal(f.materialId, "a");
    assert.ok(materials[0].text.includes(f.quote));
  }
});
test("missing text does not produce unsupported findings", () => {
  assert.deepEqual(analyze([{ id: "photo", text: "" }], "rental"), []);
});
test("pay comparison requires two distinct sources", () => {
  const result = analyze(
    [
      { id: "ad", text: "日薪200元" },
      { id: "chat", text: "包含最高绩效，按公司规定结算" },
    ],
    "parttime",
  );
  assert.equal(result[0].id, "cross-pay");
  assert.equal(result[0].relatedMaterialId, "chat");
  assert.ok(
    !analyze(
      [{ id: "single", text: "日薪200元包含最高绩效" }],
      "parttime",
    ).some((f) => f.id === "cross-pay"),
  );
});
test("draft avoids inventing a deposit if it is unknown", () => {
  const draft = makeDraft({ title: "我的退租事项", scene: "rental" }, []);
  assert.ok(draft.includes("付款记录为准"));
  assert.ok(!draft.includes("2000"));
  assert.ok(draft.includes("使用前请核对"));
});
