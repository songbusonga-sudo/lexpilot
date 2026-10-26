import fs from 'node:fs';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { makeDemo } from './demo.js';
import { reportHtml } from './report.js';
import { validateEvent, validateWork, links, checklistItems, validDate } from './progress.js';
import { validateDispute, factStatuses, moneyToCents } from './workflow.js';

const text=(v,n=2000)=>String(v||'').slice(0,n);
const cents=v=>v==null?null:(Number.isSafeInteger(v)&&v>=0&&v<=99999999999?v:(()=>{throw Error('备份金额无效')})());
const hash=buf=>createHash('sha256').update(buf).digest('hex');
export function registerExtensions(app,{db,dataDir,getCase,getMaterials,saveCase,saveMaterial,detail}) {
  function persistDemo(c,materials,replace=false) {
    const written=[];
    try{
      for(const m of materials) if(m.demoAsset){
        m.file=randomUUID();
        fs.copyFileSync(fileURLToPath(new URL('./demo-assets/'+m.demoAsset,import.meta.url)),path.join(dataDir,'uploads',m.file));
        written.push(m.file);delete m.demoAsset;
      }
      db.exec('BEGIN');
      try {if(replace) db.prepare('DELETE FROM materials WHERE case_id=?').run(c.id);saveCase(c);materials.forEach(saveMaterial);db.exec('COMMIT');}
      catch(e){db.exec('ROLLBACK');throw e;}
    }catch(e){for(const name of written)fs.rmSync(path.join(dataDir,'uploads',name),{force:true});throw e;}
  }
  app.post('/api/demos/:scene',(req,res)=>{
    const {c,materials}=makeDemo(req.params.scene);
    persistDemo(c,materials);
    res.status(201).json(detail(c));
  });
  app.post('/api/cases/:id/reset-demo',(req,res)=>{
    if(!req.case.demo) return res.status(400).json({error:'仅模拟案例可以重置'});
    const {c,materials}=makeDemo(req.case.scene);
    const old=getMaterials(req.case.id);
    c.id=req.case.id;
    for(const m of materials)m.caseId=c.id;
    persistDemo(c,materials,true);
    for(const m of old)if(m.file)fs.rmSync(path.join(dataDir,'uploads',m.file),{force:true});
    res.json(detail(c));
  });
  app.post('/api/cases/:id/events',(req,res)=>{
    const c=req.case; c.events||=[];
    if(c.events.length>=200) throw Error('每个事项最多200条事件');
    c.events.push(validateEvent({...req.body,id:undefined},getMaterials(c.id)));saveCase(c);res.status(201).json(detail(c));
  });
  app.delete('/api/cases/:id/events/:eid',(req,res)=>{
    const c=req.case;c.events=(c.events||[]).filter(r=>r.id!==req.params.eid);saveCase(c);res.json(detail(c));
  });
  app.put('/api/cases/:id/events/:eid',(req,res)=>{
    const c=req.case,index=(c.events||[]).findIndex(r=>r.id===req.params.eid);
    if(index<0)return res.status(404).json({error:'事件不存在'});
    c.events[index]=validateEvent({...req.body,id:req.params.eid},getMaterials(c.id));saveCase(c);res.json(detail(c));
  });
  app.post('/api/cases/:id/worklogs',(req,res)=>{
    const c=req.case;if(c.scene!=='parttime') throw Error('工时台账仅用于兼职事项');c.worklogs||=[];
    if(c.worklogs.length>=200) throw Error('每个事项最多200条工时记录');
    c.worklogs.push(validateWork({...req.body,id:undefined},getMaterials(c.id)));saveCase(c);res.status(201).json(detail(c));
  });
  app.delete('/api/cases/:id/worklogs/:wid',(req,res)=>{
    const c=req.case;c.worklogs=(c.worklogs||[]).filter(r=>r.id!==req.params.wid);saveCase(c);res.json(detail(c));
  });
  app.put('/api/cases/:id/worklogs/:wid',(req,res)=>{
    const c=req.case,index=(c.worklogs||[]).findIndex(r=>r.id===req.params.wid);
    if(c.scene!=='parttime'||index<0)return res.status(404).json({error:'工作记录不存在'});
    c.worklogs[index]=validateWork({...req.body,id:req.params.wid},getMaterials(c.id));saveCase(c);res.json(detail(c));
  });
  app.put('/api/cases/:id/checklist',(req,res)=>{
    const c=req.case;if(c.scene!=='internship')throw Error('保障清单仅用于实习事项');
    c.checklist=Object.fromEntries(checklistItems.map(([id])=>{
      const r=req.body[id]||{};
      if(!['待确认','已询问','已确认','不适用'].includes(r.status||'待确认'))throw Error('清单状态无效');
      return [id,{status:r.status||'待确认',note:text(r.note),materialIds:links(r.materialIds||[],getMaterials(c.id))}];
    }));saveCase(c);res.json(detail(c));
  });
  app.get('/api/cases/:id/report',(req,res)=>res.type('html').send(reportHtml(req.case,getMaterials(req.case.id))));
  app.get('/api/cases/:id/backup',(req,res)=>{
    const c=req.case;const ms=getMaterials(c.id);let size=0;
    const materials=ms.map(m=>{
      const copy={...m};delete copy.file;
      if(m.file){const buf=fs.readFileSync(path.join(dataDir,'uploads',m.file));size+=buf.length;
        if(size>80*1024*1024)throw Error('事项原文件超过80MB，请分开保管原文件');
        copy.original={base64:buf.toString('base64'),sha256:hash(buf)};}
      return copy;
    });
    res.json({format:'qingdun-case',version:1,createdAt:new Date().toISOString(),case:c,materials});
  });
  app.post('/api/restore',(req,res)=>{
    const b=req.body;
    if(b.format!=='qingdun-case'||b.version!==1||!b.case||!Array.isArray(b.materials)||b.materials.length>100)throw Error('请选择有效的青盾事项备份，最多100份材料');
    const raw=b.case;
    if(!['rental','parttime','internship'].includes(raw.scene)||!text(raw.title).trim())throw Error('备份事项信息无效');
    if(!['准备签约','正在履行','已经发生问题'].includes(raw.stage)||!validDate(raw.date))throw Error('备份阶段或日期无效');
    const id=randomUUID(),map=new Map();
    for(const m of b.materials){if(typeof m.id!=='string'||map.has(m.id))throw Error('材料编号无效或重复');map.set(m.id,randomUUID());}
    const rel=ids=>{
      if(!Array.isArray(ids)||ids.some(id=>!map.has(id)))throw Error('备份中存在失效的材料关联');
      return [...new Set(ids.map(id=>map.get(id)))];
    };
    const files=[];let bytes=0;
    const materials=b.materials.map(m=>{
      if(!validDate(m.date))throw Error('材料日期无效');
      const n={id:map.get(m.id),caseId:id,name:text(m.name,200),text:text(m.text,1000000),type:text(m.type,60),date:m.date,
        dateConfirmed:m.dateConfirmed===true,source:text(m.source,200),status:text(m.status,60),demo:raw.demo===true,
        room:text(m.room,60),phase:text(m.phase,60),caption:text(m.caption),mime:text(m.mime,100)};
      if(m.original){
        if(typeof m.original.base64!=='string'||m.original.base64.length%4!==0||/[^A-Za-z0-9+/=]/.test(m.original.base64))throw Error('备份文件编码无效');
        const buf=Buffer.from(m.original.base64,'base64');bytes+=buf.length;
        if(buf.toString('base64')!==m.original.base64||buf.length>20*1024*1024||bytes>80*1024*1024||hash(buf)!==m.original.sha256)throw Error('备份文件校验失败或超出大小限制');
        const sig=buf.subarray(0,12);
        const png=sig.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
        const jpg=sig[0]===255&&sig[1]===216&&sig[2]===255;
        const webp=sig.toString('ascii',0,4)==='RIFF'&&sig.toString('ascii',8,12)==='WEBP';
        if(n.mime==='image/png'?!png:n.mime==='image/jpeg'?!jpg:n.mime==='image/webp'?!webp:n.mime==='application/pdf'?!buf.subarray(0,1024).includes(Buffer.from('%PDF-')):!['text/plain','text/markdown'].includes(n.mime))throw Error('备份包含不支持或内容不匹配的文件');
        n.file=randomUUID();files.push({name:n.file,buf});
      }else delete n.mime;
      return n;
    });
    const list=(v)=>{if(!Array.isArray(v)||v.length>200)throw Error('备份记录格式或数量无效');return v;};
    const c={id,title:text(raw.title,100)+'（恢复副本）',scene:raw.scene,stage:raw.stage,date:raw.date,location:text(raw.location,100),demo:raw.demo===true,archived:false,workflowVersion:2,
      context:Object.fromEntries(['studentStatus','schoolArrangement','management','payAgreement','insurance','goal'].map(k=>[k,text(raw.context?.[k],1500)])),
      tasks:list(raw.tasks||[]).map(t=>({text:text(t.text,300),done:t.done===true})),
      settlement:{depositCents:cents(raw.settlement?.depositCents),refundedCents:cents(raw.settlement?.refundedCents)??0,depositMaterialIds:rel(raw.settlement?.depositMaterialIds||[]),refundMaterialIds:rel(raw.settlement?.refundMaterialIds||[])},
      disputes:list(raw.disputes||[]).map(d=>validateDispute({...d,id:undefined,amount:d.amountCents==null?'':(cents(d.amountCents)/100).toFixed(2),materialIds:rel(d.materialIds||[])},materials)),
      facts:list(raw.facts||[]).map(f=>{if(!map.has(f.materialId)||!factStatuses.includes(f.status))throw Error('备份事实出处或状态无效');return {id:randomUUID(),text:text(f.text),quote:text(f.quote),status:f.status,materialId:map.get(f.materialId),origin:'备份恢复'};}),
      events:list(raw.events||[]).map(ev=>validateEvent({...ev,id:undefined,materialIds:rel(ev.materialIds||[])},materials)),
      worklogs:list(raw.worklogs||[]).map(r=>validateWork({...r,id:undefined,hours:r.minutesHundredths/100,agreed:r.agreedCents==null?'':(cents(r.agreedCents)/100).toFixed(2),received:(cents(r.receivedCents)/100).toFixed(2),materialIds:rel(r.materialIds||[])},materials)),
      checklist:Object.fromEntries(checklistItems.map(([key])=>{const r=raw.checklist?.[key]||{};return [key,{status:['待确认','已询问','已确认','不适用'].includes(r.status)?r.status:'待确认',note:text(r.note),materialIds:rel(r.materialIds||[])}];})),drafts:{}};
    for(const k of ['communication','questions','evidence']) if(raw.drafts?.[k]) c.drafts[k]={text:text(raw.drafts[k].text,30000),at:text(raw.drafts[k].at,60),sourceFingerprint:'restored-needs-review'};
    c.draftKind=['communication','questions','evidence'].includes(raw.draftKind)?raw.draftKind:'communication';c.draft=c.drafts[c.draftKind]?.text||'';
    const written=[];
    try{
      for(const f of files){fs.writeFileSync(path.join(dataDir,'uploads',f.name),f.buf,{flag:'wx'});written.push(f.name);}
      db.exec('BEGIN');
      try{saveCase(c);materials.forEach(saveMaterial);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
    }catch(e){for(const f of written)fs.rmSync(path.join(dataDir,'uploads',f),{force:true});throw e;}
    res.status(201).json(detail(c));
  });
}
