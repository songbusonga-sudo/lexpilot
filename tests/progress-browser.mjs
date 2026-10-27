import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createSessionFetch } from './session-fetch.mjs';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1080}}),errors=[],ids=[];
const fetch = createSessionFetch(page.context());
page.on('pageerror',e=>errors.push(e.message));
page.on('response',async r=>{if(r.status()>=400)console.log('HTTP',r.status(),r.url(),(await r.text()).slice(0,300));});
const json=(method,body)=>({method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
async function api(path,options){const r=await fetch('http://127.0.0.1:8266/api'+path,options),d=await r.json();assert.ok(r.ok,JSON.stringify(d));return d;}
const shot=name=>page.screenshot({path:'artifacts/v3-'+name+'.png',fullPage:true,animations:'disabled'});
async function tab(name){await page.getByRole('tab',{name:new RegExp('^'+name)}).click();}
try{
 fs.mkdirSync('artifacts',{recursive:true});
 const rental=await api('/demos/rental',json('POST',{}));ids.push(rental.id);
 await page.goto('http://127.0.0.1:5267/#case/'+rental.id);
 await page.getByRole('heading',{name:'先完成这几步'}).waitFor();await shot('overview-desktop');
 await page.locator('.priority-row').filter({hasText:'核对事件日期'}).click();
 await page.getByRole('heading',{name:'入住墙面示意图.png',exact:true}).waitFor();
 await page.getByRole('button',{name:'关闭材料'}).click();
 await tab('争议清单');await page.locator('.evidence-details summary').first().click();
 assert.ok(await page.locator('.evidence-details').first().innerText().then(t=>t.includes('2000')));await shot('evidence-desktop');
 await tab('照片对照');assert.equal(await page.locator('.photo-display img').count(),0); // selectors start empty until selected
 await tab('时间线');await page.getByRole('button',{name:'记录事件',exact:true}).click();
 await page.getByLabel('事件名称',{exact:true}).fill('已向房东要求凭证');
 await page.getByLabel('事件日期',{exact:true}).fill('2026-10-26');
 await page.getByLabel('事件说明',{exact:true}).fill('本人陈述，尚待对方回复。');
 await page.getByRole('button',{name:'保存事件',exact:true}).click();
 await page.getByRole('heading',{name:'已向房东要求凭证',exact:true}).waitFor();await shot('timeline-desktop');
 await tab('事项报告');
 const report=page.frameLocator('iframe[title="事项报告预览"]');
 await report.getByRole('heading',{name:'六 证据目录与原文摘录'}).waitFor();
 await shot('report-desktop');
 const [dl]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'下载报告',exact:true}).click()]);
 assert.ok(dl.suggestedFilename().endsWith('.html'));
 const [backup]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'完整备份',exact:true}).click()]);
 await backup.saveAs('artifacts/v3-roundtrip.qingdun.json');
 await page.getByRole('button',{name:'返回我的记录',exact:true}).click();
 await page.locator('input[type=file]').setInputFiles('artifacts/v3-roundtrip.qingdun.json');
 await page.getByRole('button',{name:'确认恢复副本',exact:true}).click();
 await page.getByRole('heading',{name:/恢复副本/}).waitFor();ids.push(page.url().split('case/')[1]);
 const part=await api('/demos/parttime',json('POST',{}));ids.push(part.id);
 await page.goto('http://127.0.0.1:5267/#case/'+part.id);await tab('工时报酬');
 await page.getByRole('button',{name:'登记工作',exact:true}).click();
 await page.getByLabel('任务说明',{exact:true}).fill('活动现场协助');
 await page.getByLabel('实际工时 小时',{exact:true}).fill('8');
 await page.getByLabel('此项约定报酬 元',{exact:true}).fill('160');
 await page.getByLabel('此项已收金额 元',{exact:true}).fill('100');
 await page.getByRole('button',{name:'保存工作记录',exact:true}).click();
 await page.getByRole('heading',{name:'活动现场协助',exact:true}).waitFor();
 assert.ok((await page.locator('.tools-metrics').innerText()).includes('60.00'));await shot('ledger-desktop');
 const intern=await api('/demos/internship',json('POST',{}));ids.push(intern.id);
 await page.goto('http://127.0.0.1:5267/#case/'+intern.id);await tab('实习保障');
 await page.getByLabel('保险保障状态').selectOption('已询问');
 await page.getByPlaceholder('填写保险保障的确认结果或待问问题').fill('已询问企业，等待保单。');
 page.once('dialog',d=>d.dismiss());await tab('时间线');
 assert.equal(await page.getByLabel('保险保障状态').inputValue(),'已询问');
 page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'返回我的记录',exact:true}).click();
 assert.ok(page.url().includes(intern.id));
 await page.getByRole('button',{name:'保存保障清单',exact:true}).click();
 await page.reload();await tab('实习保障');
 assert.equal(await page.getByLabel('保险保障状态').inputValue(),'已询问');await shot('internship-desktop');
 await page.setViewportSize({width:390,height:844});await shot('internship-mobile');
 for(const name of ['事项概览','时间线','事项报告','实际情况']){await tab(name);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' overflows mobile');await shot(name==='事项报告'?'report-mobile':name==='时间线'?'timeline-mobile':name==='实际情况'?'context-mobile':'overview-mobile');}
 assert.deepEqual(errors,[]);console.log('PASS: actionable guidance, evidence expansion, manual event, report and original-file backup downloads, restore UI, pay ledger, checklist persistence and mobile overflow.');
}catch(e){console.log('URL',page.url(),'ERRORS',errors);console.log((await page.locator('body').innerText()).slice(-3000));await shot('failure');throw e;}finally{for(const id of ids)await fetch('http://127.0.0.1:8266/api/cases/'+id,{method:'DELETE'});await browser.close();}


