import { randomUUID, createHash } from "node:crypto";

export const disputeStatuses = ["待核实", "有争议", "双方确认"];
export const factStatuses = [
  "材料记载",
  "本人陈述",
  "对方主张",
  "双方确认",
  "待核实",
];
export function sourceFingerprint(c, materials) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        title: c.title,
        scene: c.scene,
        context: c.context,
        settlement: c.settlement,
        disputes: c.disputes,
        facts: c.facts,
        materials: materials.map((m) => ({
          id: m.id,
          name: m.name,
          text: m.text,
          date: m.date,
          dateConfirmed: m.dateConfirmed,
          type: m.type,
          source: m.source,
          room: m.room,
          phase: m.phase,
          caption: m.caption,
        })),
      }),
    )
    .digest("hex");
}
export function moneyToCents(value, allowEmpty = true) {
  if (value === "" || value === null || value === undefined) {
    if (allowEmpty) return null;
    throw Error("请填写金额");
  }
  const text = String(value).trim();
  if (!/^\d{1,9}(?:\.\d{1,2})?$/.test(text))
    throw Error("金额须为非负数字，最多两位小数");
  const [whole, decimals = ""] = text.split(".");
  return Number(whole) * 100 + Number(decimals.padEnd(2, "0"));
}
export const yuan = (cents) =>
  cents === null || cents === undefined ? "未核实" : (cents / 100).toFixed(2);
export function settlementFor(c) {
  const settlement = c.settlement || {};
  const deposit =
    settlement.depositCents ??
    (c.deposit === undefined ? null : moneyToCents(c.deposit));
  const refunded = settlement.refundedCents ?? 0;
  const disputes = (c.disputes || []).filter((d) => d.monetary !== false);
  const confirmed = disputes
    .filter((d) => d.status === "双方确认")
    .reduce((n, d) => n + (d.amountCents ?? 0), 0);
  const pending = disputes
    .filter((d) => d.status !== "双方确认")
    .reduce((n, d) => n + (d.amountCents ?? 0), 0);
  const claimed = confirmed + pending;
  const unknownAmounts = disputes.filter(
    (d) => d.amountCents === null || d.amountCents === undefined,
  ).length;
  const balance = deposit === null ? null : deposit - confirmed - refunded;
  return {
    deposit,
    refunded,
    confirmed,
    pending,
    claimed,
    balance,
    unknownAmounts,
    warnings: [
      balance !== null && balance < 0
        ? "已确认扣款与已退款合计超过押金，请核对是否重复录入。"
        : "",
      deposit !== null && claimed > deposit
        ? "对方主张扣款总额超过押金，请核对金额及扣款范围。"
        : "",
      unknownAmounts
        ? `${unknownAmounts}个项目未填写金额，汇总可能不完整。`
        : "",
    ].filter(Boolean),
  };
}
export function validateDispute(input, materials) {
  if (typeof input.title !== "string" || !input.title.trim())
    throw Error("请填写争议项目名称");
  if (!disputeStatuses.includes(input.status))
    throw Error("请选择有效的核对状态");
  const allowed = new Set(materials.map((m) => m.id));
  if (!Array.isArray(input.materialIds)) throw Error("请选择有效的关联材料");
  const materialIds = [...new Set(input.materialIds)];
  if (materialIds.some((id) => !allowed.has(id)))
    throw Error("关联材料不存在或属于其他事项");
  const monetary = input.monetary !== false;
  return {
    id: input.id || randomUUID(),
    title: input.title.trim().slice(0, 120),
    otherClaim: String(input.otherClaim || "").slice(0, 2000),
    myStatement: String(input.myStatement || "").slice(0, 2000),
    missing: String(input.missing || "").slice(0, 2000),
    status: input.status,
    monetary,
    amountCents: monetary ? moneyToCents(input.amount) : null,
    materialIds,
    updatedAt: new Date().toISOString(),
  };
}
export function extractCandidates(materials, existing = []) {
  const result = [];
  for (const m of materials) {
    if (!m.text) continue;
    const patterns = [
      /(?:押金|日薪|月薪|报酬|扣款|培训费)[^。\n]{0,24}?\d+(?:\.\d{1,2})?\s*元/g,
      /\d{4}年\d{1,2}月\d{1,2}日/g,
    ];
    for (const regex of patterns)
      for (const match of m.text.matchAll(regex)) {
        if (existing.some((f) => f.materialId === m.id && f.quote === match[0]))
          continue;
        result.push({
          id: randomUUID(),
          text: match[0],
          quote: match[0],
          materialId: m.id,
          status: "待核实",
          origin: "文本提取",
        });
        if (result.length >= 50) return result;
      }
  }
  return result;
}
export function validateModelFindings(data, materials) {
  if (!Array.isArray(data?.findings))
    throw Error("模型未返回有效的核对项格式，请重试");
  const findings = [],
    rejected = [];
  for (const raw of data.findings.slice(0, 30)) {
    const m = materials.find((m) => m.id === raw.materialId);
    if (
      !m ||
      typeof raw.quote !== "string" ||
      raw.quote.trim().length < 2 ||
      !m.text?.includes(raw.quote) ||
      typeof raw.title !== "string" ||
      typeof raw.description !== "string"
    ) {
      rejected.push(raw);
      continue;
    }
    findings.push({
      id: randomUUID(),
      title: raw.title.slice(0, 150),
      description: raw.description.slice(0, 1500),
      quote: raw.quote.slice(0, 1500),
      materialId: m.id,
      level: "需核实",
      origin: "模型辅助",
    });
  }
  return { findings, rejectedCount: rejected.length };
}
