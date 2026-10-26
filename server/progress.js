import { randomUUID } from 'node:crypto';
import { moneyToCents } from './workflow.js';

export const checklistItems = [
  ['school', '学校参与方式', '学校是否组织或批准实习，校内联系人是谁？'],
  ['insurance', '保险保障', '由谁购买、保障期间与范围是什么，是否有凭证？'],
  ['safety', '工作与安全安排', '工作地点、岗位、作息及意外联系渠道是否明确？'],
  ['pay', '报酬与结算', '报酬标准、支付主体、周期与扣减条件是否明确？'],
  ['exit', '退出与交接', '提前通知期限、学校沟通与交接程序是否明确？'],
];
export function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
}
export function links(ids, materials) {
  if (!Array.isArray(ids) || ids.some(id => !materials.some(m => m.id === id))) throw Error('关联材料不属于当前事项');
  return [...new Set(ids)];
}
export function validateEvent(raw, materials) {
  if (!raw.title?.trim() || !validDate(raw.date)) throw Error('请填写事件名称和有效日期');
  return { id: raw.id || randomUUID(), title: String(raw.title).trim().slice(0,120), date: raw.date,
    note: String(raw.note || '').slice(0,2000), dateConfirmed: raw.dateConfirmed === true,
    status: ['本人陈述','材料记载','对方主张','双方确认','待核实'].includes(raw.status) ? raw.status : '本人陈述',
    materialIds: links(raw.materialIds || [], materials) };
}
export function validateWork(raw, materials) {
  if (!validDate(raw.date) || !raw.task?.trim()) throw Error('请填写工作日期和任务');
  const hours = String(raw.hours ?? '');
  if (!/^\d{1,2}(?:\.\d{1,2})?$/.test(hours) || Number(hours) <= 0 || Number(hours) > 24) throw Error('工时须大于0且不超过24小时，最多两位小数');
  return { id: raw.id || randomUUID(), date: raw.date, task: raw.task.trim().slice(0,500), minutesHundredths: Math.round(Number(hours)*100),
    agreedCents: moneyToCents(raw.agreed), receivedCents: moneyToCents(raw.received, false),
    status: raw.status === '双方确认' ? '双方确认' : '待核实', materialIds: links(raw.materialIds || [], materials) };
}
export function workSummary(c) {
  const rows=c.worklogs || [];
  const agreed=rows.reduce((n,r)=>n+(r.agreedCents??0),0), received=rows.reduce((n,r)=>n+r.receivedCents,0);
  const unknown=rows.filter(r=>r.agreedCents===null).length;
  return { hours: rows.reduce((n,r)=>n+r.minutesHundredths,0)/100, agreed, received, unknown,
    balance: unknown ? null : agreed-received };
}
export function nextActions(c, ms) {
  const actions=[];
  const add=(title,description,tab,materialId)=>actions.push({title,description,tab,materialId});
  if (!ms.length) add('先上传一份材料','合同、聊天或付款凭证均可，随后逐项核对。','materials');
  if (!ms.some(m=>m.type==='合同协议')) add('补充合同或书面约定','没有正式合同也可保留双方沟通内容。','materials');
  const pendingDate=ms.find(m=>!m.dateConfirmed);
  if(pendingDate) add('核对事件日期',`从「${pendingDate.name}」开始，区分上传时间与事件时间。`,'timeline',pendingDate.id);
  const pendingText=ms.find(m=>!m.text?.trim());
  if(pendingText) add('补充材料文字',`「${pendingText.name}」尚无文字，可先手工录入。`,'materials',pendingText.id);
  if(c.scene==='rental') {
    if(!c.settlement?.depositMaterialIds?.length) add('关联押金付款凭证','把实付金额与原始付款记录关联。','settlement');
    if(c.stage==='准备签约') add('确认押金与维修条款','生成签约前提问清单，向出租方书面确认。','actions');
    if(!['入住','退租'].every(phase=>ms.some(m=>m.phase===phase&&m.mime?.startsWith('image/')))) add('保留入住与退租照片','按同一区域留存原图，拍摄日期和原因仍需核实。','photos');
  } else {
    if(!c.context?.studentStatus || !c.context?.management) add('补充实际工作情况','说明在校状态、学校参与及实际工作管理方式。','context');
    if(c.scene==='parttime' && !(c.worklogs||[]).length) add('登记工时与报酬','逐次记录约定报酬和实际收款，不默认把广告最高金额计为欠款。','scene');
    if(c.scene==='internship' && checklistItems.some(([id])=>c.checklist?.[id]?.status!=='已确认')) add('核对实习保障清单','逐项明确保险、安全、报酬及退出安排。','scene');
  }
  for(const d of c.disputes||[]) if(d.status!=='双方确认' && (d.missing || !d.materialIds.length)) add(`跟进：${d.title}`,d.missing||'为双方主张补充关联材料。','disputes');
  if(!actions.length) add('核对并导出事项报告','基础信息已整理，请检查事实状态和待核实内容。','report');
  return actions;
}
