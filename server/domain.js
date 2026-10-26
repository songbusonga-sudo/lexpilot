import { settlementFor, yuan } from "./workflow.js";
export const scenarios = {
  rental: "租房",
  parttime: "兼职",
  internship: "实习",
};
export function analyze(materials, scene) {
  const findings = [];
  for (const m of materials) {
    const content = m.text || "";
    const rules =
      scene === "rental"
        ? [
            [
              /押金.*(?:扣除|扣款|不退|视情况)/,
              "押金扣除条件需要明确",
              "建议核实扣款项目、计算标准和证明材料，单方提出扣款不等于事实已确认。",
              "需核实",
            ],
            [
              /维修|损坏|墙面/,
              "房屋损伤与维修责任待核对",
              "对照入住与退租材料，核实是否属于正常使用损耗，以及损伤原因和维修金额。",
              "待补充",
            ],
          ]
        : scene === "parttime"
          ? [
              [
                /押金|培训费|扣.*证件|保证金/,
                "招聘收费或证件保管存在风险信号",
                "核实收费主体、用途及退还规则；保留招聘信息和付款要求，避免在身份与工作安排未核实时付款。",
                "重点关注",
              ],
              [
                /绩效|公司规定|结算/,
                "报酬与结算口径需要书面确认",
                "请确认固定报酬、绩效条件、工时及结算日期。是否适用劳动法律规则，需要结合实际用工情况判断。",
                "需核实",
              ],
            ]
          : [
              [
                /保险|安全/,
                "保险与安全保障责任待明确",
                "确认保险购买主体、险种、保障期间、工作地点和意外处理机制；结合学校安排及实际履行情况核实适用规则。",
                "需核实",
              ],
              [
                /退出|离职|违约/,
                "提前退出条件需要核对",
                "核实通知期限、退出程序及费用依据，不仅依据协议名称判断法律关系。",
                "待补充",
              ],
            ];
    for (const [pattern, title, description, level] of rules) {
      const match = content.match(pattern);
      if (match) {
        const start = Math.max(0, match.index - 16);
        const end = Math.min(
          content.length,
          match.index + match[0].length + 60,
        );
        findings.push({
          id: `${m.id}-${findings.length}`,
          title,
          description,
          level,
          materialId: m.id,
          quote: content.slice(start, end),
        });
      }
    }
  }
  if (scene === "parttime") {
    const advertised = materials.find((m) =>
      /日薪\s*\d+(?:\.\d+)?\s*元/.test(m.text || ""),
    );
    const performance = materials.find((m) => /最高绩效/.test(m.text || ""));
    if (advertised && performance && advertised.id !== performance.id)
      findings.unshift({
        id: "cross-pay",
        title: "招聘广告与聊天中的薪酬表述不一致",
        description: `广告记载${advertised.text.match(/日薪\s*\d+(?:\.\d+)?\s*元/)[0]}，聊天说明包含最高绩效。请书面确认保底金额与绩效条件。`,
        level: "重点关注",
        materialId: advertised.id,
        relatedMaterialId: performance.id,
        quote: advertised.text,
      });
  }
  return findings;
}
export function makeDraft(c, materials) {
  const deposit = settlementFor(c).deposit;
  const intro = `${c.title}\n\n您好，就目前的${scenarios[c.scene]}事项，想与您书面核对以下情况：\n`;
  const body =
    c.scene === "rental"
      ? `1. 请确认已收押金及拟退还金额。${deposit !== null ? `我的记录中押金为${yuan(deposit)}元。` : "具体金额以双方核对的付款记录为准。"}\n2. 请逐项说明扣款项目、金额、合同依据，并提供相应照片、维修或费用凭证。\n3. 对于房屋状态，请结合入住与退租材料共同核对，区分原有情况、正常使用损耗与新增损伤。\n4. 希望双方确认无争议款项及退款时间，其余部分继续协商。`
      : c.scene === "parttime"
        ? "1. 请确认实际岗位、工作时间、固定报酬与绩效条件。\n2. 请确认考勤核对方式、结算周期和付款日期。\n3. 若涉及收费或证件保管，请书面说明用途、依据及退还安排。\n4. 对于报酬表述不一致的部分，希望以书面确认结果为准。"
        : "1. 请确认实习报酬、工作地点和岗位安排。\n2. 请明确保险购买主体、保障范围和意外处理方式。\n3. 请确认提前退出的通知期限及交接程序。\n4. 涉及学校安排的事项，我也会与学校老师共同核实。";
  let details = "";
  if (c.scene === "rental") {
    const s = settlementFor(c);
    details += `\n\n【金额核对】\n押金：${yuan(s.deposit)}${s.deposit === null ? "" : "元"}；已记录退款：${yuan(s.refunded)}元。\n已标记双方确认的扣款：${yuan(s.confirmed)}元；待核实或有争议的扣款：${yuan(s.pending)}元（暂未作为确认扣款扣减）。\n仅按确认项目计算的账面待退余额：${yuan(s.balance)}${s.balance === null ? "" : "元"}。该数值不是对最终应退金额的法律认定。`;
    if (s.warnings.length) details += "\n待核对：" + s.warnings.join("；");
  }
  if (c.disputes?.length)
    details +=
      "\n\n【逐项核对】\n" +
      c.disputes
        .map(
          (d, i) =>
            `${i + 1}. ${d.title}（记录状态：${d.status}；涉及金额：${yuan(d.amountCents)}${d.amountCents === null ? "" : "元"}）\n对方主张：${d.otherClaim || "尚未录入，请补充"}\n我的说明：${d.myStatement || "尚未录入，请补充"}\n请协助核实：${d.missing || "对应事实、金额及材料依据"}`,
        )
        .join("\n\n");
  return (
    intro +
    body +
    details +
    "\n\n以上为待核对事项，希望我们基于实际材料沟通解决。感谢配合。\n\n【使用前请核对人物、金额、日期与事实。本草稿不构成法律意见。】"
  );
}
export function makeAction(c, materials, kind) {
  if (kind === "evidence") {
    return (
      `${c.title}\n证据材料目录\n\n` +
      (materials.length
        ? materials
            .map(
              (m, i) =>
                `${String(i + 1).padStart(2, "0")}. ${m.name}\n类型：${m.type}；来源：${m.source}\n记录日期：${m.date}（${m.dateConfirmed ? "用户已核对" : "待核实，可能为上传日期"}）\n文字核对状态：${m.status}\n关联争议：${
                  c.disputes
                    .filter((d) => d.materialIds.includes(m.id))
                    .map((d) => d.title)
                    .join("、") || "尚未关联"
                }\n`,
            )
            .join("\n")
        : "尚未上传材料，请补充后重新生成。") +
      "\n说明：此目录基于录入信息，不确认材料真实性、完整性或证明效力。"
    );
  }
  if (kind === "questions") {
    const questions =
      c.scene === "rental"
        ? [
            "出租人是否有权出租，如何核实？",
            "押金金额、退款日期与扣款标准是什么？",
            "维修、报修及正常使用损耗如何处理？",
            "入住交接如何记录，提前退租如何结算？",
          ]
        : c.scene === "parttime"
          ? [
              "招聘与实际用工主体分别是谁？",
              "固定报酬、绩效条件及结算日期是什么？",
              "实际工作管理方式、地点和工时如何安排？",
              "是否要求收费或保管证件，具体用途与依据是什么？",
            ]
          : [
              "学校是否参与安排，实际岗位与地点是什么？",
              "实习报酬、保险购买主体与保障范围是什么？",
              "发生意外时如何处理，安全责任如何落实？",
              "提前退出的通知期限、交接程序及费用约定是什么？",
            ];
    return (
      `${c.title}\n签约前提问清单\n\n` +
      questions.map((q, i) => `${i + 1}. ${q}`).join("\n") +
      (c.context.goal ? "\n\n我的重点诉求：" + c.context.goal : "") +
      "\n\n请尽量取得书面答复，与协议逐项核对。兼职和实习需结合实际履行情况判断适用规则。"
    );
  }
  return makeDraft(c, materials);
}
