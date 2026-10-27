import { settlementFor, yuan, sourceFingerprint, analysisFingerprint, currentModelFindings } from './workflow.js';
import { nextActions, workSummary, checklistItems } from './progress.js';
import { scenarios } from './domain.js';
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function reportHtml(c,ms) {
  const e=escapeHtml, p=t=>`<p>${e(t)}</p>`;
  const names=ids=>(ids||[]).map(id=>{const n=ms.findIndex(m=>m.id===id);return n<0?'材料已删除':`证据${n+1}：${ms[n].name}`;}).join('；')||'未关联材料';
  const table=(heads,rows)=>`<table><thead><tr>${heads.map(h=>`<th>${e(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(cell=>`<td>${e(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  let html=`<h1>${e(c.title)}</h1><p class="meta">青盾事项整理报告 · ${e(scenarios[c.scene])} · ${e(c.stage)}<br>事项编号：${e(c.id)}<br>导出时间：${e(new Date().toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'}))}（北京时间）</p>`;
  html+=p(c.demo?'本报告使用模拟案例，仅用于功能演示。':'本报告根据用户录入材料生成，请逐项核对。');
  html+=p('记录中的单方主张、用户确认和待核实信息均按录入状态呈现，不构成事实真实性、证据效力或最终责任的认定。');
  html+='<h2>一 事项背景与事实摘要</h2>'+p(`地点：${c.location||'未填写'}；建档日期：${c.date}`);
  const labels={studentStatus:'在校状态',schoolArrangement:'学校参与',management:'实际管理',payAgreement:'报酬约定',insurance:'保险安排',goal:'处理目标'};
  Object.assign(labels,{nationality:'国籍或地区（自述）',jurisdiction:'事项发生地',serviceLanguage:'辅助核对语言'});
  for(const [key,label] of Object.entries(labels)) if(c.context?.[key]) html+=p(`${label}：${c.context[key]}`);
  html+=(c.facts||[]).length?table(['录入事实','信息状态','出处'],c.facts.map(f=>[f.text,f.status,names([f.materialId])])):p('尚未整理独立事实条目，请结合下列事件及原材料核对。');
  html+='<h2>二 争议与待确认项目</h2>';
  for(const [i,d] of (c.disputes||[]).entries()) html+=`<h3>${i+1} ${e(d.title)} · ${e(d.status)}</h3>`+p(`涉及金额：${d.monetary===false?'非金额项目':yuan(d.amountCents)+'元'}`)+p('对方主张：'+(d.otherClaim||'未填写'))+p('我的说明：'+(d.myStatement||'未填写'))+p('关联证据：'+names(d.materialIds))+p('待补充：'+(d.missing||'未填写，仍需核对完整性'));
  if(!(c.disputes||[]).length) html+=p('尚未记录争议或待确认项目。');
  html+='<h2>三 事件与材料时间线</h2>';
  const timeline=[...ms.map(m=>({date:m.date,title:m.name,status:m.dateConfirmed?'用户已核对日期':'日期待核实',note:m.text?.slice(0,240)||'尚无文字',ids:[m.id]})),...(c.events||[]).map(ev=>({...ev,status:`${ev.status}；${ev.dateConfirmed?'用户已核对日期':'日期待核实'}`,ids:ev.materialIds}))].sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  html+=table(['记录日期','事件或材料','信息状态','说明与出处'],timeline.map(t=>[t.date,t.title,t.status,`${t.note}\n${names(t.ids)}`]));
  if(c.scene==='rental') {
    const s=settlementFor(c);
    html+='<h2>四 押金核对</h2>'+table(['项目','金额 元'],[['押金实付',yuan(s.deposit)],['双方确认扣款',yuan(s.confirmed)],['待核实或有争议金额 单列',yuan(s.pending)],['已退款',yuan(s.refunded)],['账面待退余额',yuan(s.balance)]]);
    html+=p('账面待退余额＝押金实付－双方确认扣款－已退款。有争议的金额未自动扣减；此处为录入信息的计算，不能代替法律认定。')+p('押金凭证：'+names(c.settlement?.depositMaterialIds))+p('退款凭证：'+names(c.settlement?.refundMaterialIds));
    for(const w of s.warnings) html+=p(w);
  } else if(c.scene==='parttime') {
    const s=workSummary(c);
    html+='<h2>四 工时与报酬核对</h2>'+table(['日期与任务','工时 小时','约定报酬 元','已收 元','状态与出处'],(c.worklogs||[]).map(r=>[`${r.date} ${r.task}`,(r.minutesHundredths/100).toFixed(2),yuan(r.agreedCents),yuan(r.receivedCents),`${r.status}\n${names(r.materialIds)}`]));
    html+=p(`总工时${s.hours}小时；已录约定报酬${yuan(s.agreed)}元；已收${yuan(s.received)}元；账面差额${yuan(s.balance)}元；${s.unknown}条报酬未知。差额不等于已确认欠款，仍需核实约定与实际用工情况。`);
  } else {
    html+='<h2>四 实习保障核对</h2>'+table(['项目','状态','说明','出处'],checklistItems.map(([id,title])=>[title,c.checklist?.[id]?.status||'待确认',c.checklist?.[id]?.note||'未填写',names(c.checklist?.[id]?.materialIds)]));
  }
  html+='<h2>五 待补材料与下一步</h2>'+nextActions(c,ms).map(a=>`<h3>${e(a.title)}</h3>${p(a.description)}`).join('');
  html+='<h2>六 证据目录与原文摘录</h2>'+table(['编号','材料名称与类型','日期状态','来源'],ms.map((m,i)=>[`证据${i+1}`,`${m.name}\n${m.type}`,`${m.date}\n${m.dateConfirmed?'用户已核对':'待核实'}`,m.source||'未填写']));
  for(const [i,m] of ms.entries()) html+=`<h3>证据${i+1} ${e(m.name)}</h3>`+p(m.text||'尚无文字转录。请查阅备份中的原始文件。');
  if(Object.keys(c.drafts||{}).length){
    html+='<h2>七 已保存的行动草稿</h2>';
    const labels={communication:'协商沟通说明',questions:'签约前提问清单',evidence:'证据材料目录'};
    for(const [key,label] of Object.entries(labels)) if(c.drafts?.[key]){
      const draft=c.drafts[key];
      html+=`<h3>${e(label)}</h3>`+p(draft.sourceFingerprint!==sourceFingerprint(c,ms)?'来源已变化或由备份恢复，此草稿需要重新核对。':'请核对草稿内容后再使用。')+p(draft.text);
    }
  }
  if(c.aiAnalysis){
    const a=c.aiAnalysis, stale=a.sourceFingerprint!==analysisFingerprint(c,ms);
    html+='<h2>附录 AI辅助核对与引用校验</h2>'+p(`模型：${a.model}；分析时间：${a.at}；${stale?'材料或背景已更新，上次分析已过期，未纳入本报告问题清单。':'以下为原文匹配通过的模型辅助问题，仍需人工核实。'}`);
    if(!stale){
      if(a.coverage) html+=p(`分析范围：${a.coverage.materialCount}份文字材料，${a.coverage.characterCount}字；未分析无文字材料${a.coverage.skippedCount}份。`);
      for(const f of currentModelFindings(c,ms)) html+=`<h3>${e(f.title)}</h3>`+p(f.description)+(f.titleEn?p(`[English machine translation] ${f.titleEn}`)+p(f.descriptionEn):'')+p(`${names([f.materialId])}：${f.quote}`)+(f.relatedMaterialId?p(`${names([f.relatedMaterialId])}：${f.relatedQuote}`):'');
      html+=p(`${a.rejectedCount||0}项因引用或格式校验未通过而未展示。引用匹配不代表结论正确，未指出问题不代表没有风险。`);
    }
  }
  html+=p('本报告为导出时快照，不包含原始图片与文件。提交或转交前请核对报告内容，并按目录提供原始材料。');
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${e(c.title)} 事项报告</title><style>body{font:15px/1.85 "Microsoft YaHei",sans-serif;color:#171717;background:white;max-width:880px;margin:40px auto;padding:0 28px}h1{font-size:28px}h2{font-size:20px;margin-top:36px;break-after:avoid}h3{font-size:16px;break-after:avoid}p{white-space:pre-wrap;overflow-wrap:anywhere}.meta{color:#555;font-size:13px}table{width:100%;border-collapse:collapse;margin:16px 0;font-size:13px;table-layout:fixed}th,td{border:1px solid #ddd;text-align:left;padding:10px;white-space:pre-wrap;overflow-wrap:anywhere}th{background:#f4f4f4}thead{display:table-header-group}tr{break-inside:avoid}@page{size:A4;margin:20mm}@media print{body{margin:0;padding:0;max-width:none;font-size:11pt}h1{font-size:20pt}h2{font-size:15pt}table{font-size:9pt}}</style></head><body>${html}</body></html>`;
}
