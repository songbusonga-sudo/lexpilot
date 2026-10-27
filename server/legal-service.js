import { currentModelFindings } from './workflow.js';

export const serviceResources = [
  { title: '中国法律服务网', titleEn: 'China Legal Service Network', url: 'https://www.12348.gov.cn/',
    description: '查询公共法律服务信息，咨询法律问题。具体受理范围、服务语言与资格由服务机构核实。', descriptionEn: 'Check public legal service information. Confirm service scope, language and eligibility with the provider.' },
  { title: '广西壮族自治区司法厅', titleEn: 'Department of Justice of Guangxi', url: 'https://sft.gxzf.gov.cn/',
    description: '查阅广西司法行政及公共法律服务官方信息，核实当地办理渠道。', descriptionEn: 'Consult official justice and public legal service information for Guangxi.' },
];

export function consultationBrief(c, materials) {
  const profile=c.context||{}, names=ids=>(ids||[]).map(id=>materials.find(m=>m.id===id)?.name||'材料已删除 / Removed material').join('; ');
  const findings=currentModelFindings(c,materials);
  const lines=[
    '青盾 · 法律咨询准备材料 / Qingdun · Legal consultation preparation',
    c.demo?'模拟案例 / SIMULATED CASE':'用户提供的信息 / USER-PROVIDED INFORMATION',
    `事项 / Case: ${c.title}`, `编号 / ID: ${c.id}`,
    `导出时间 / Exported at: ${new Date().toISOString()}`, '',
    '一、咨询背景 / 1. Intake',
    `国籍或地区（自述）/ Nationality or region (self-reported): ${profile.nationality||'待补充 / Not provided'}`,
    `事项发生地 / Location of matter: ${profile.jurisdiction||'待核实 / To verify'}`,
    `具体地点 / Specific location: ${c.location||'待补充 / Not provided'}`,
    `服务语言 / Preferred language: ${profile.serviceLanguage||'zh'}`,
    `处理目标（原文）/ Goal (original): ${profile.goal||'待补充 / Not provided'}`, '',
    '二、双方主张与待核实事项 / 2. Claims and open questions',
  ];
  for(const [i,d] of (c.disputes||[]).entries()) lines.push(
    `${i+1}. ${d.title} [录入状态 / Recorded status: ${d.status}]`,
    `对方主张（原文）/ Other party's claim (original): ${d.otherClaim||'未填写 / Not provided'}`,
    `本人说明（原文）/ My statement (original): ${d.myStatement||'未填写 / Not provided'}`,
    `待核实（原文）/ To verify (original): ${d.missing||'待补充 / Not provided'}`,
    `涉及金额 / Amount involved: ${d.monetary===false?'非金额项目 / Non-monetary':d.amountCents==null?'未知 / Unknown':(d.amountCents/100).toFixed(2)+' CNY（录入值 / Recorded value）'}`,
    `材料 / Materials: ${names(d.materialIds)}`, '');
  lines.push('三、AI辅助问题 / 3. AI-assisted questions');
  if(!findings.length) lines.push('暂无当前有效AI核对结果 / No current validated AI findings.');
  for(const [i,f] of findings.entries()) lines.push(`${i+1}. ${f.title}`,f.description,
    ...(f.titleEn?[`[Machine translation] ${f.titleEn}`, f.descriptionEn]:[]),
    `原文 / Original [${names([f.materialId])}]: ${f.quote}`,
    ...(f.relatedMaterialId?[`对照原文 / Comparison [${names([f.relatedMaterialId])}]: ${f.relatedQuote}`]:[]),'');
  lines.push('', '四、材料目录 / 4. Material index');
  for(const [i,m] of materials.entries()) lines.push(`${i+1}. ${m.name} | ${m.type} | ${m.date} | ${m.dateConfirmed?'日期已由用户核对 / Date checked by user':'日期待核实 / Date to verify'}`);
  lines.push('', '五、咨询渠道 / 5. Service information',...serviceResources.map(r=>`${r.title} / ${r.titleEn}: ${r.url}`),'',
    '本材料不会自动发送。请自行向服务人员提供原件并核对英文机器翻译。国籍不决定准据法或法律援助资格。',
    'Nothing is sent automatically. Provide original documents to your adviser and verify any machine translation. Nationality alone does not determine applicable law or legal aid eligibility.',
    '境外事项应咨询当地合资格服务人员。本材料不提供外国法结论，不代表律师意见或法律援助申请已受理。',
    'For matters outside mainland China, consult a qualified local provider. This document gives no foreign-law conclusion and does not confirm legal representation or acceptance of a legal aid application.');
  return lines.join('\n');
}
