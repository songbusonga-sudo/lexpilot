import { test } from "node:test";
import assert from "node:assert/strict";
import {
  moneyToCents,
  settlementFor,
  validateDispute,
  validateModelFindings,
  extractCandidates,
} from "../server/workflow.js";
import { makeDraft, makeAction, analyze } from "../server/domain.js";
test("money uses integer cents and rejects negative/ambiguous input", () => {
  assert.equal(moneyToCents("0.10") + moneyToCents("0.20"), 30);
  assert.equal(moneyToCents("1000.01"), 100001);
  assert.equal(moneyToCents(""), null);
  for (const bad of ["-1", "1.001", "NaN", "1e3", "1,000", "Infinity"])
    assert.throws(() => moneyToCents(bad));
});
test("only confirmed monetary items reduce balance, never disputed claims", () => {
  const c = {
    settlement: { depositCents: 200000, refundedCents: 10000 },
    disputes: [
      { status: "有争议", amountCents: 80000 },
      { status: "双方确认", amountCents: 30000 },
      { status: "双方确认", amountCents: null, monetary: false },
    ],
  };
  const s = settlementFor(c);
  assert.equal(s.balance, 160000);
  assert.equal(s.pending, 80000);
  assert.equal(s.confirmed, 30000);
  assert.equal(s.unknownAmounts, 0);
});
test("unknown deposit remains unknown; over-refund is flagged without clamping", () => {
  assert.equal(
    settlementFor({ settlement: { depositCents: null, refundedCents: 0 } })
      .balance,
    null,
  );
  const s = settlementFor({
    settlement: { depositCents: 10000, refundedCents: 20000 },
  });
  assert.equal(s.balance, -10000);
  assert.equal(s.warnings.length, 1);
});
test("dispute evidence must belong to current case", () => {
  const input = {
    title: "墙面扣款",
    status: "有争议",
    amount: "800.25",
    materialIds: ["a"],
  };
  assert.equal(validateDispute(input, [{ id: "a" }]).amountCents, 80025);
  assert.throws(() => validateDispute(input, [{ id: "other" }]));
  assert.equal(
    validateDispute({ ...input, monetary: false }, [{ id: "a" }]).amountCents,
    null,
  );
});
test("model output without exact verifiable citations is dropped", () => {
  const result = validateModelFindings(
    {
      findings: [
        {
          title: "核对",
          description: "检查",
          materialId: "a",
          quote: "押金2000元",
        },
        {
          title: "假引用",
          description: "检查",
          materialId: "a",
          quote: "退还期限三天",
        },
        {
          title: "越权",
          description: "检查",
          materialId: "other",
          quote: "押金2000元",
        },
      ],
    },
    [{ id: "a", text: "约定押金2000元。" }],
  );
  assert.equal(result.findings.length, 1);
  assert.equal(result.rejectedCount, 2);
});
test("extracted candidates remain unconfirmed and deduplicate by source", () => {
  const materials = [{ id: "a", text: "2026年7月1日，押金2000元。" }];
  const first = extractCandidates(materials);
  assert.equal(first.length, 2);
  assert.ok(first.every((f) => f.status === "待核实"));
  assert.equal(extractCandidates(materials, first).length, 0);
});
test("draft includes stored claims without converting disputed deduction to confirmed", () => {
  const c = {
    title: "退押金",
    scene: "rental",
    deposit: 9999,
    context: {},
    settlement: { depositCents: 200000, refundedCents: 0 },
    disputes: [
      {
        title: "墙面扣款",
        amountCents: 80000,
        status: "有争议",
        otherClaim: "对方要求扣800元",
        myStatement: "原有痕迹待核实",
        missing: "维修凭证",
        materialIds: ["a"],
      },
    ],
  };
  const draft = makeDraft(c, []);
  assert.ok(draft.includes("2000.00"));
  assert.ok(!draft.includes("9999"));
  assert.ok(draft.includes("暂未作为确认扣款"));
  assert.ok(draft.includes("维修凭证"));
  assert.ok(
    makeAction(
      c,
      [
        {
          id: "a",
          name: "合同",
          date: "2026-01-01",
          type: "合同协议",
          source: "用户上传",
          status: "已人工核对",
        },
      ],
      "evidence",
    ).includes("关联争议：墙面扣款"),
  );
});
test("cross-material pay check supports amounts other than demo 200", () => {
  const f = analyze(
    [
      { id: "ad", text: "日薪350元" },
      { id: "chat", text: "包含最高绩效" },
    ],
    "parttime",
  );
  assert.ok(f[0].description.includes("350"));
});
