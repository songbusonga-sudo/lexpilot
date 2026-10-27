import assert from 'node:assert/strict';
import { createSessionFetch } from './session-fetch.mjs';
const fetch = createSessionFetch();
const base='http://127.0.0.1:8266/api';
const json=(method,body)=>({method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
async function api(p,o){const r=await fetch(base+p,o),d=await r.json();assert.ok(r.ok,JSON.stringify(d));return d;}
const ids=[];
try{
 const rental=await api('/demos/rental',json('POST',{}));ids.push(rental.id);
 assert.equal(rental.materials.filter(m=>m.file&&m.mime==='image/png').length,2);
 assert.equal(rental.events.length,3);assert.equal(rental.settlementSummary.balance,200000);
 const backup=await api('/cases/'+rental.id+'/backup');
 assert.equal(backup.materials.filter(m=>m.original).length,2);
 const corrupt=structuredClone(backup);corrupt.materials.find(m=>m.original).original.sha256='bad';
 assert.equal((await fetch(base+'/restore',json('POST',corrupt))).status,400);
 const copy=await api('/restore',json('POST',backup));ids.push(copy.id);
 assert.notEqual(copy.id,rental.id);assert.equal(copy.materials.length,rental.materials.length);
 assert.equal(copy.disputes[0].materialIds.length,rental.disputes[0].materialIds.length);
 assert.ok(copy.disputes[0].materialIds.every(id=>copy.materials.some(m=>m.id===id)));
 for(let i=0;i<copy.materials.length;i++)if(copy.materials[i].file){
   const buf=await fetch(base+'/cases/'+copy.id+'/materials/'+copy.materials[i].id+'/file').then(r=>r.arrayBuffer());
   assert.deepEqual(Buffer.from(buf),Buffer.from(backup.materials[i].original.base64,'base64'));
 }
 const personal=await api('/cases',json('POST',{title:'验证副本保护',scene:'rental',stage:'准备签约'}));ids.push(personal.id);
 assert.equal((await fetch(base+'/cases/'+personal.id+'/reset-demo',json('POST',{}))).status,400);
 const evBody={title:'补交材料',date:'2026-10-26',status:'本人陈述',materialIds:[rental.materials[0].id]};
 assert.equal((await fetch(base+'/cases/'+personal.id+'/events',json('POST',evBody))).status,400);
 const part=await api('/demos/parttime',json('POST',{}));ids.push(part.id);
 const work={date:'2026-10-26',task:'现场工作',hours:'8',agreed:'100.10',received:'0.20',materialIds:[part.materials[0].id]};
 const logged=await api('/cases/'+part.id+'/worklogs',json('POST',work));assert.equal(logged.workSummary.balance,9990);
 const row=logged.worklogs[0];
 const edited=await api('/cases/'+part.id+'/worklogs/'+row.id,json('PUT',{...work,received:'50.10'}));assert.equal(edited.workSummary.balance,5000);
 const evented=await api('/cases/'+part.id+'/events',json('POST',{...evBody,materialIds:[part.materials[0].id]}));
 const event=evented.events.at(-1);
 await api('/cases/'+part.id+'/events/'+event.id,json('PUT',{...event,title:'已核对沟通日期',dateConfirmed:true}));
 await api('/cases/'+part.id+'/materials/'+part.materials[0].id,{method:'DELETE'});
 const cleaned=await api('/cases/'+part.id);assert.equal(cleaned.worklogs[0].materialIds.length,0);assert.equal(cleaned.events.at(-1).materialIds.length,0);
 const intern=await api('/demos/internship',json('POST',{}));ids.push(intern.id);
 const checked=await api('/cases/'+intern.id+'/checklist',json('PUT',{insurance:{status:'已询问',note:'待书面回复',materialIds:[intern.materials[0].id]}}));
 assert.equal(checked.checklist.insurance.status,'已询问');
 const report=await fetch(base+'/cases/'+rental.id+'/report').then(r=>r.text());assert.ok(report.includes('证据目录'));assert.ok(report.includes('模拟示意图'));
 const reset=await api('/cases/'+rental.id+'/reset-demo',json('POST',{}));assert.equal(reset.events.length,3);assert.notEqual(reset.materials[0].id,rental.materials[0].id);
 assert.equal((await api('/cases/'+copy.id)).materials.length,copy.materials.length);
 console.log('PASS: scenario demos, original-file backup/restore, checksum rejection, ID remapping, protected personal cases, event/worklog edit, integer pay, evidence cleanup, checklist and report.');
}finally{for(const id of ids)await fetch(base+'/cases/'+id,{method:'DELETE'});}
