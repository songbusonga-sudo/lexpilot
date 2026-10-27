// Opt-in live checks: fictional demo data only. Run with node --env-file-if-exists=.env tests/model-live.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { makeDemo } from '../server/demo.js';
import { analyzeWithModel, aiStatus } from '../server/ai.js';
assert.ok(aiStatus().textReady,'Configure a text model before running live checks.');
const results=[];
for(const scene of ['rental','parttime','internship']) {
  const {c,materials}=makeDemo(scene);
  const result=await analyzeWithModel(c,materials);
  assert.ok(result.findings.length>0,scene+': no validated findings');
  const content=result.findings.map(f=>f.title+f.description).join('\n');
  for(const word of {rental:['扣款','凭证'],parttime:['保底','结算'],internship:['保险','退出']}[scene])
    assert.ok(content.includes(word),scene+': missing core issue '+word);
  results.push({scene,...result});
  console.log(JSON.stringify({scene,model:result.model,valid:result.findings.length,rejected:result.rejectedCount,durationMs:result.durationMs}));
}
fs.mkdirSync('artifacts',{recursive:true});
fs.writeFileSync('artifacts/model-live-results.json',JSON.stringify({at:new Date().toISOString(),dataType:'fictional demos only',results},null,2));
