<script setup>
import { computed, ref, watch, onMounted, onUnmounted } from 'vue';
import { api, json, money, download } from '../api';
import { Plus, Download, Printer, ArrowUpRight, Trash2, FileText, Check } from 'lucide-vue-next';
const props=defineProps({caseData:Object,mode:String});
const emit=defineEmits(['update','notice','view','pending']);
const c=computed(()=>props.caseData),base=computed(()=>'/cases/'+c.value.id);
const busy=ref(false),eventOpen=ref(false),workOpen=ref(false),reportFrame=ref(null);
const today=()=>new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Shanghai'});
const eventEmpty=()=>({title:'',date:today(),note:'',dateConfirmed:false,status:'本人陈述',materialIds:[]});
const workEmpty=()=>({task:'',date:today(),hours:'',agreed:'',received:'0',status:'待核实',materialIds:[]});
const event=ref(eventEmpty()),work=ref(workEmpty()),checklist=ref({}),checkDirty=ref(false);
const hasPending=computed(()=>checkDirty.value || eventOpen.value || workOpen.value);
watch(hasPending,value=>emit('pending',value));
function canLeave(){
  if(!hasPending.value)return true;
  if(!confirm('此页有尚未保存的内容，确定离开并放弃修改？'))return false;
  eventOpen.value=false;workOpen.value=false;checkDirty.value=false;
  event.value=eventEmpty();work.value=workEmpty();resetChecklist(c.value.checklist);
  return true;
}
defineExpose({canLeave});
function unload(e){if(hasPending.value){e.preventDefault();e.returnValue='';}}
onMounted(()=>window.addEventListener('beforeunload',unload));
onUnmounted(()=>{window.removeEventListener('beforeunload',unload);emit('pending',false);});
const checklistItems=[['school','学校参与方式','学校是否组织或批准实习，校内联系人是谁？'],['insurance','保险保障','由谁购买、保障期间与范围是什么，是否有凭证？'],['safety','工作与安全安排','工作地点、岗位、作息及意外联系渠道是否明确？'],['pay','报酬与结算','标准、支付主体、周期与扣减条件是否明确？'],['exit','退出与交接','提前通知期限、学校沟通和交接程序是否明确？']];
function resetChecklist(value){checklist.value=Object.fromEntries(checklistItems.map(([id])=>[id,{status:value?.[id]?.status||'待确认',note:value?.[id]?.note||'',materialIds:[...(value?.[id]?.materialIds||[])]}]));}
watch(()=>c.value.checklist, value=>{
  if(!checkDirty.value)resetChecklist(value);
},{immediate:true,deep:true});
const timeline=computed(()=>[
  ...c.value.materials.map(m=>({id:m.id,date:m.date,dateConfirmed:m.dateConfirmed,title:m.name,note:m.text?.slice(0,180)||'尚无文字，请核对原始材料。',status:m.source||'材料记载',materialIds:[m.id],kind:'material'})),
  ...(c.value.events||[]).map(ev=>({...ev,kind:'event'}))
].sort((a,b)=>Number(!!b.dateConfirmed)-Number(!!a.dateConfirmed)||String(a.date).localeCompare(String(b.date))));
const timelineFilter=ref('all');
const filtered=computed(()=>timeline.value.filter(ev=>timelineFilter.value==='all'||(timelineFilter.value==='pending'?!ev.dateConfirmed:ev.kind==='event')));
const material=id=>c.value.materials.find(m=>m.id===id);
async function mutate(path,method,body){
 busy.value=true;
 try{const result=await api(base.value+path,json(method,body));emit('update',result);emit('notice','已保存');return true;}
 catch(e){emit('notice',e.message);return false;}finally{busy.value=false;}
}
async function addEvent(){if(await mutate('/events'+(event.value.id?'/'+event.value.id:''),event.value.id?'PUT':'POST',event.value)){eventOpen.value=false;event.value=eventEmpty();}}
async function addWork(){if(await mutate('/worklogs'+(work.value.id?'/'+work.value.id:''),work.value.id?'PUT':'POST',work.value)){workOpen.value=false;work.value=workEmpty();}}
function editEvent(ev){event.value={...ev,materialIds:[...ev.materialIds]};eventOpen.value=true;window.scrollTo({top:300,behavior:'smooth'});}
function editWork(r){work.value={...r,hours:String(r.minutesHundredths/100),agreed:r.agreedCents===null?'':(r.agreedCents/100).toFixed(2),received:(r.receivedCents/100).toFixed(2),materialIds:[...r.materialIds]};workOpen.value=true;window.scrollTo({top:300,behavior:'smooth'});}
async function remove(kind,id){if(confirm('删除此条记录？原始材料会保留。'))await mutate('/'+kind+'/'+id,'DELETE');}
async function saveChecklist(){if(await mutate('/checklist','PUT',checklist.value))checkDirty.value=false;}
async function exportReport(){busy.value=true;try{const r=await fetch('/api'+base.value+'/report');if(!r.ok)throw Error('报告导出失败');download(await r.text(),c.value.title+'-事项报告.html','text/html;charset=utf-8');emit('notice','已导出报告，用浏览器打开后可打印或另存为PDF');}catch(e){emit('notice',e.message);}finally{busy.value=false;}}
function printReport(){try{reportFrame.value.contentWindow.focus();reportFrame.value.contentWindow.print();}catch{emit('notice','请下载报告后在浏览器中打印。');}}
async function backup(){busy.value=true;try{const b=await api(base.value+'/backup');download(JSON.stringify(b),c.value.title+'-完整备份.qingdun.json','application/json;charset=utf-8');emit('notice','已备份事项及原文件，请妥善保管，其中含个人材料。');}catch(e){emit('notice',e.message);}finally{busy.value=false;}}
const reportUrl=computed(()=>'/api'+base.value+'/report?v='+encodeURIComponent(c.value.sourceFingerprint));
function exportWork(){const cell=v=>'"'+String((typeof v==='string' && /^[=+@\-\t\r]/.test(v)) ? "'"+v : (v??'')).replaceAll('"','""')+'"';const rows=[['日期','任务','工时','约定报酬 元','已收 元','状态'],...(c.value.worklogs||[]).map(r=>[r.date,r.task,r.minutesHundredths/100,r.agreedCents===null?'未填写':(r.agreedCents/100).toFixed(2),(r.receivedCents/100).toFixed(2),r.status])];download('\uFEFF'+rows.map(r=>r.map(cell).join(',')).join('\r\n'),c.value.title+'-工时台账.csv','text/csv;charset=utf-8');}
</script>

<template>
 <section v-if="mode==='timeline'" class="tools-section">
  <div class="section-heading"><div><h2>证据时间线</h2><span class="muted">日期待核实的记录单列在后</span></div><button class="button dark" @click="event=eventEmpty();eventOpen=!eventOpen"><Plus :size="15"/>记录事件</button></div>
  <div class="segment tools-filter"><button v-for="(label,key) in {all:'全部记录',events:'手动事件',pending:'日期待核实'}" :class="{active:timelineFilter===key}" @click="timelineFilter=key">{{label}}</button></div>
  <form v-if="eventOpen" class="tools-form" @submit.prevent="addEvent">
   <h3>{{event.id ? '编辑事件' : '添加事件'}}</h3><div class="form-grid"><label class="field">事件名称<input v-model="event.title" required maxlength="120" placeholder="例如：向房东要求维修明细"></label><label class="field">事件日期<input v-model="event.date" type="date" required></label></div>
   <label class="field">事件说明<textarea v-model="event.note" rows="3" maxlength="2000"/></label>
   <div class="form-grid"><label class="field">信息状态<select v-model="event.status"><option v-for="s in ['本人陈述','材料记载','对方主张','双方确认','待核实']">{{s}}</option></select></label><label class="consent-label"><input type="checkbox" v-model="event.dateConfirmed">我已核对事件日期</label></div>
   <fieldset class="tools-evidence"><legend>关联材料（可选）</legend><label v-for="m in c.materials"><input type="checkbox" v-model="event.materialIds" :value="m.id">{{m.name}}</label><p v-if="!c.materials.length" class="muted">尚无材料，事件按录入状态保存。</p></fieldset>
   <div class="tools-actions"><button type="button" class="button" @click="eventOpen=false">取消</button><button class="button dark" :disabled="busy">保存事件</button></div>
  </form>
  <div class="timeline"><article v-for="ev in filtered" :key="ev.id" class="timeline-item"><div class="timeline-date">{{ev.date}}<span>{{ev.dateConfirmed?'日期已核对':'日期待核实'}}</span></div><span class="timeline-point"/><div class="timeline-content"><div><span class="badge">{{ev.kind==='event'?'事件 · ':''}}{{ev.status}}</span><button v-if="ev.kind==='event'" class="text-button" @click="editEvent(ev)">编辑事件</button><button v-if="ev.kind==='event'" class="icon-button" aria-label="删除事件" @click="remove('events',ev.id)"><Trash2 :size="14"/></button></div><h3>{{ev.title}}</h3><p>{{ev.note}}</p><div class="evidence-inline"><button v-for="id in ev.materialIds" class="citation" @click="emit('view',material(id))">{{material(id)?.name||'材料已删除'}}<ArrowUpRight :size="12"/></button></div><span v-if="!ev.dateConfirmed" class="timeline-foot">此日期尚未核实，不作为确定的事件发生时间。</span></div></article></div>
  <p v-if="!filtered.length" class="tools-empty">暂无此类记录。可以上传材料或手动记录事件。</p>
 </section>

 <section v-if="mode==='scene' && c.scene==='parttime'" class="tools-section">
  <div class="section-heading"><div><h2>工时与报酬台账</h2><span class="muted">按约定报酬和实际收款核对</span></div><div class="tools-actions"><button class="button" @click="exportWork"><Download :size="14"/>导出台账</button><button class="button dark" @click="work=workEmpty();workOpen=!workOpen"><Plus :size="14"/>登记工作</button></div></div>
  <div class="tools-metrics"><div><span>总工时</span><strong>{{c.workSummary.hours}}<small> 小时</small></strong></div><div><span>已录约定报酬</span><strong>¥ {{money(c.workSummary.agreed)}}</strong></div><div><span>实际收款</span><strong>¥ {{money(c.workSummary.received)}}</strong></div><div><span>账面差额</span><strong>{{c.workSummary.balance===null?'待补报酬':'¥ '+money(c.workSummary.balance)}}</strong></div></div>
  <p class="tools-note">差额仅为已录约定报酬减实际收款，不等于已确认欠款。{{c.workSummary.unknown}}条约定报酬尚未填写；广告中的最高金额不会自动计入。请勿重复登记同一工作或收款。</p>
  <form v-if="workOpen" class="tools-form" @submit.prevent="addWork"><h3>{{work.id ? '编辑工作记录' : '登记一段工作'}}</h3><label class="field">任务说明<input v-model="work.task" required maxlength="500" placeholder="例如：周六活动现场协助"></label><div class="form-grid"><label class="field">工作日期<input v-model="work.date" type="date" required></label><label class="field">实际工时 小时<input v-model="work.hours" inputmode="decimal" required placeholder="例如：8"></label><label class="field">此项约定报酬 元<input v-model="work.agreed" inputmode="decimal" placeholder="未知可留空"></label><label class="field">此项已收金额 元<input v-model="work.received" required inputmode="decimal"></label></div><label class="field">核对状态<select v-model="work.status"><option>待核实</option><option>双方确认</option></select></label><fieldset class="tools-evidence"><legend>关联考勤、报酬约定或收款记录</legend><label v-for="m in c.materials"><input v-model="work.materialIds" type="checkbox" :value="m.id">{{m.name}}</label></fieldset><div class="tools-actions"><button type="button" class="button" @click="workOpen=false">取消</button><button class="button dark" :disabled="busy">保存工作记录</button></div></form>
  <article v-for="r in c.worklogs" class="tools-record"><div class="section-heading"><div><h3>{{r.task}}</h3><span class="badge">{{r.status}}</span></div><button class="text-button" @click="editWork(r)">编辑工作记录</button><button class="icon-button" aria-label="删除工作记录" @click="remove('worklogs',r.id)"><Trash2 :size="15"/></button></div><p>{{r.date}} · {{r.minutesHundredths/100}}小时 · 约定 ¥ {{money(r.agreedCents)}} · 已收 ¥ {{money(r.receivedCents)}}</p><div class="evidence-inline"><button v-for="id in r.materialIds" class="citation" @click="emit('view',material(id))">{{material(id)?.name}}<ArrowUpRight :size="12"/></button></div></article>
  <p v-if="!c.worklogs?.length" class="tools-empty">先保存招聘承诺，再登记实际工作和收款。报酬不明确时可以留空。</p>
 </section>

 <section v-if="mode==='scene' && c.scene==='internship'" class="tools-section">
  <div class="section-heading"><div><h2>实习保障清单</h2><span class="muted">已确认 {{Object.values(checklist).filter(r=>r.status==='已确认').length}} / 5</span></div><button class="button dark" :disabled="busy" @click="saveChecklist"><Check :size="14"/>保存清单</button></div>
  <p class="tools-note">“已确认”由你根据实际沟通标记，建议关联书面材料；协议名称本身不能确定法律关系。</p>
  <div @input="$event.target.tagName !== 'SELECT' && (checkDirty=true)" @change="checkDirty=true"><article v-for="([id,title,question],i) in checklistItems" class="tools-record"><div class="section-heading"><h3>0{{i+1}} {{title}}</h3><select v-model="checklist[id].status" :aria-label="title+'状态'"><option v-for="s in ['待确认','已询问','已确认','不适用']">{{s}}</option></select></div><p class="muted">{{question}}</p><label class="field">核对记录<textarea v-model="checklist[id].note" rows="2" maxlength="2000" :placeholder="'填写'+title+'的确认结果或待问问题'"/></label><fieldset class="tools-evidence"><legend>关联材料</legend><label v-for="m in c.materials"><input v-model="checklist[id].materialIds" type="checkbox" :value="m.id">{{m.name}}</label></fieldset></article></div>
  <div class="tools-actions"><span class="muted">{{checkDirty?'有修改尚未保存':'清单已与事项同步'}}</span><button class="button dark" :disabled="busy" @click="saveChecklist">保存保障清单</button></div>
 </section>

 <section v-if="mode==='report'" class="tools-section">
  <div class="section-heading"><div><h2>事项报告</h2><span class="muted">事实、争议、时间线、结算与证据目录</span></div><div class="tools-actions"><button class="button" :disabled="busy" @click="backup"><Download :size="14"/>完整备份</button><button class="button" @click="printReport"><Printer :size="14"/>打印 / 存为PDF</button><button class="button dark" :disabled="busy" @click="exportReport"><Download :size="14"/>下载报告</button></div></div>
  <p class="tools-note">报告为当前已保存内容的快照，可用浏览器打开和打印。原始图片与文件请使用完整备份保存；备份含个人材料，请妥善保管。恢复入口在“我的事项”。</p>
  <iframe ref="reportFrame" class="report-preview" :src="reportUrl" title="事项报告预览" sandbox="allow-same-origin allow-modals"/>
 </section>
</template>
