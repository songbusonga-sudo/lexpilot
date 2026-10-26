import test from 'node:test';
import assert from 'node:assert/strict';
import { validateEvent, validateWork, workSummary, nextActions } from '../server/progress.js';
import { reportHtml } from '../server/report.js';
import { makeDemo } from '../server/demo.js';
test('events reject impossible dates and cross-case evidence',()=>{
  assert.throws(()=>validateEvent({title:'报修',date:'2026-02-30'},[]));
  assert.throws(()=>validateEvent({title:'报修',date:'2026-02-28',materialIds:['elsewhere']},[]));
  assert.equal(validateEvent({title:'报修',date:'2026-02-28'},[]).status,'本人陈述');
});
test('pay ledger retains unknown pay and uses integer cents',()=>{
  const a=validateWork({date:'2026-10-26',task:'活动',hours:'0.25',agreed:'100.10',received:'0.20'},[]);
  const b=validateWork({date:'2026-10-27',task:'活动',hours:'8',agreed:'',received:'0'},[]);
  assert.equal(workSummary({worklogs:[a]}).balance,9990);
  assert.equal(workSummary({worklogs:[a,b]}).balance,null);
  assert.equal(workSummary({worklogs:[a,b]}).hours,8.25);
  assert.throws(()=>validateWork({date:'2026-10-26',task:'活动',hours:'25',received:'0'},[]));
});
test('report escapes user materials and separates disputed deductions',()=>{
  const {c,materials}=makeDemo('rental');
  c.title='<script>alert(1)</script>';
  const html=reportHtml(c,materials);
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('2000.00'));
  assert.ok(html.includes('待核实或有争议金额 单列'));
  assert.ok(html.includes('证据1'));
});
test('next actions respond to material dates and scenario data',()=>{
  const {c,materials}=makeDemo('internship');
  assert.ok(nextActions(c,materials).some(a=>a.tab==='scene'));
  assert.ok(!nextActions(c,materials).some(a=>a.title==='核对事件日期'));
  materials[0].dateConfirmed=false;
  assert.equal(nextActions(c,materials).find(a=>a.title==='核对事件日期').materialId,materials[0].id);
});
