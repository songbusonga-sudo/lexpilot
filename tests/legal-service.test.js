import test from 'node:test';
import assert from 'node:assert/strict';
import { validateModelFindings, analysisFingerprint, currentModelFindings } from '../server/workflow.js';
import { makeDemo } from '../server/demo.js';
import { consultationBrief } from '../server/legal-service.js';
import { reportHtml } from '../server/report.js';

const materials=[{id:'a',name:'agreement',text:'Deposit: CNY 2000.'},{id:'b',name:'chat',text:'房东要求扣款800元。'}];
const item={title:'扣款依据待明确',description:'请提供维修明细',materialId:'a',quote:'Deposit: CNY 2000.',relatedMaterialId:'b',relatedQuote:'扣款800元',titleEn:'Clarify the deduction',descriptionEn:'Please provide an itemized repair bill.'};
test('cross-language findings require two valid originals and reject malformed entries',()=>{
  const r=validateModelFindings({findings:[null,{},item,{...item,relatedQuote:'编造原文'},{...item,relatedMaterialId:'a'},{...item,description:'材料不具备法律效力'},item]},materials);
  assert.equal(r.findings.length,1);
  assert.equal(r.rejectedCount,5);
  assert.equal(r.findings[0].descriptionEn,item.descriptionEn);
  assert.equal(r.findings[0].relatedQuote,'扣款800元');
});
test('analysis freshness follows model inputs, including background and secondary evidence',()=>{
  const c={scene:'rental',stage:'已经发生问题',context:{serviceLanguage:'bilingual'},disputes:[]};
  c.aiAnalysis={sourceFingerprint:analysisFingerprint(c,materials),findings:[item]};
  assert.equal(currentModelFindings(c,materials).length,1);
  c.disputes.push({title:'用户新增项目'});
  assert.equal(currentModelFindings(c,materials).length,1);
  assert.equal(currentModelFindings(c,[materials[0],{...materials[1],text:'扣款改为600元'}]).length,0);
  c.context.jurisdiction='东盟国家 ASEAN country';
  assert.equal(currentModelFindings(c,materials).length,0);
});
test('ASEAN demo preserves original language and consultation excludes stale model claims',()=>{
  const {c,materials:ms}=makeDemo('rental','asean');
  assert.equal(c.context.serviceLanguage,'bilingual');
  assert.ok(ms.some(m=>m.text.includes('CNY 2,000')));
  const m=ms.find(m=>m.type==='合同协议');
  c.aiAnalysis={model:'test',at:'2026-10-27',sourceFingerprint:analysisFingerprint(c,ms),findings:[{...item,materialId:m.id,quote:'CNY 2,000',relatedMaterialId:undefined}]};
  assert.ok(consultationBrief(c,ms).includes(item.descriptionEn));
  assert.ok(reportHtml(c,ms).includes(item.descriptionEn));
  c.context.goal='新目标';
  assert.ok(!consultationBrief(c,ms).includes(item.descriptionEn));
  assert.ok(!reportHtml(c,ms).includes(item.descriptionEn));
  assert.ok(reportHtml(c,ms).includes('上次分析已过期'));
});
