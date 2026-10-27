<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { Globe2, Download, ArrowUpRight, Check, Languages } from 'lucide-vue-next';
import { api, json, download } from '../api';
const props=defineProps({caseData:Object});
const emit=defineEmits(['update','notice','pending','analyze']);
const busy=ref(false), dirty=ref(false), resources=ref([]), form=ref({});
const countries=['中国 China','越南 Vietnam','泰国 Thailand','马来西亚 Malaysia','新加坡 Singapore','印度尼西亚 Indonesia','菲律宾 Philippines','柬埔寨 Cambodia','老挝 Laos','缅甸 Myanmar','文莱 Brunei','东帝汶 Timor-Leste','其他 / Other'];
watch(()=>props.caseData.context, value=>{if(!dirty.value)form.value={...value,serviceLanguage:value?.serviceLanguage||'zh'};},{immediate:true});
watch(dirty,v=>emit('pending',v));
function canLeave(){if(dirty.value&&!confirm('服务信息尚未保存，确定离开并放弃修改？'))return false;dirty.value=false;form.value={...props.caseData.context};return true;}
defineExpose({canLeave});
function unload(e){if(dirty.value){e.preventDefault();e.returnValue='';}}
onMounted(()=>{window.addEventListener('beforeunload',unload);api('/legal-services').then(v=>resources.value=v).catch(e=>emit('notice',e.message));});
onUnmounted(()=>{window.removeEventListener('beforeunload',unload);emit('pending',false);});
const outside=computed(()=>form.value.jurisdiction&&form.value.jurisdiction!=='中国内地 Mainland China');
async function save(){busy.value=true;try{await api('/cases/'+props.caseData.id,json('PATCH',{context:form.value}));dirty.value=false;emit('update',await api('/cases/'+props.caseData.id));emit('notice','服务信息已保存 / Intake saved');return true;}catch(e){emit('notice',e.message);return false;}finally{busy.value=false;}}
async function exportBrief(){if(dirty.value&&!await save())return;busy.value=true;try{const response=await fetch('/api/cases/'+props.caseData.id+'/consultation');if(!response.ok)throw Error('咨询材料导出失败');download(await response.text(),props.caseData.title+'-咨询准备材料.txt');emit('notice','咨询材料已下载，请自行核对后提供给服务人员。');}catch(e){emit('notice',e.message);}finally{busy.value=false;}}
async function analyze(){if(dirty.value&&!await save())return;emit('analyze');}
</script>
<template>
  <section class="legal-service">
    <div class="section-heading"><div><span class="section-index">PUBLIC LEGAL SERVICE · CHINA–ASEAN</span><h2>公共法律服务 / Legal service preparation</h2><p class="muted">先说明发生在哪里、需要什么帮助，再带着材料咨询。</p></div><Globe2 :size="25" :stroke-width="1.4" /></div>
    <div class="service-intro"><Languages :size="21"/><div><h3>让语言差异，不再挡在求助之前</h3><p>中英双语整理租房、兼职与实习材料，保留原文，方便向学校、调解员或法律服务人员说明情况。</p><p lang="en">Prepare evidence and questions in Chinese and English. Keep original quotations for your school, mediator or legal adviser.</p></div></div>
    <form class="service-intake" @submit.prevent="save" @input="$event.target.tagName !== 'SELECT' && (dirty=true)" @change="dirty=true">
      <div class="form-grid"><label class="field">国籍或地区 / Nationality or region<select v-model="form.nationality"><option value="">请选择 / Select</option><option v-for="country in countries" :key="country">{{country}}</option></select></label><label class="field">事项发生地 / Location of matter<select v-model="form.jurisdiction"><option value="">尚未明确 / Not yet confirmed</option><option>中国内地 Mainland China</option><option>东盟国家 ASEAN country</option><option>其他或跨境 Other / Cross-border</option></select></label></div>
      <label class="field">辅助核对语言 / Analysis language<select v-model="form.serviceLanguage"><option value="zh">中文 Chinese</option><option value="bilingual">中文 + English</option></select></label>
      <label class="field">希望获得什么帮助 / What help do you need?<textarea v-model="form.goal" rows="3" maxlength="1500" placeholder="例如：核对扣款依据，整理给法律服务人员的问题。 / E.g. clarify deposit deductions and prepare consultation questions." /></label>
      <p v-if="outside" class="warning-bar">境外或跨境事项需先核实适用法律和当地服务渠道，系统仅帮助整理材料与提问。 / For overseas or cross-border matters, confirm applicable law and local services with a qualified provider.</p>
      <div class="tools-actions"><span class="muted">{{dirty?'有未保存修改 / Unsaved changes':'保存后用于本事项核对 / Used for this case'}}</span><button class="button dark" :disabled="busy"><Check :size="14"/>保存服务信息 / Save intake</button></div>
    </form>
    <div class="service-next"><div><span class="section-index">01 · PREPARE</span><h3>从原文到咨询问题</h3><p>设置双语后，重新进行 AI 核对，生成中文问题与英文辅助翻译。</p><p lang="en">Run AI analysis after selecting bilingual mode. Questions include original quotations and English machine translations.</p><button class="button" @click="analyze" :disabled="busy">AI 核对 / Analyze <ArrowUpRight :size="14"/></button></div><div><span class="section-index">02 · TAKE WITH YOU</span><h3>导出咨询准备材料</h3><p>包含服务信息、双方主张、当前有效 AI 问题、原文引用及证据目录。</p><p lang="en">Download intake, claims, validated AI questions, original quotes and an evidence index.</p><button class="button dark" @click="exportBrief" :disabled="busy"><Download :size="14"/>下载咨询材料 / Download brief</button></div></div>
    <div class="section-heading"><div><h3>中国内地公共法律服务信息 / Mainland China service information</h3><p class="muted">自行访问官方渠道核实，本平台未与服务机构建立转介连接。</p></div></div>
    <div class="service-resources"><a v-for="r in resources" :key="r.url" :href="r.url" target="_blank" rel="noopener noreferrer"><ArrowUpRight :size="17"/><strong>{{r.title}}<small>{{r.titleEn}}</small></strong><p>{{r.description}}</p><p lang="en">{{r.descriptionEn}}</p></a></div>
    <p class="notice-bar">如在中国内地遇到人身危险，请拨打110。国籍不决定适用法律或法律援助资格，服务语言、受理条件与费用请向机构核实。<br/>For immediate danger in mainland China, call 110. Confirm language availability, eligibility and fees directly with the provider.</p>
  </section>
</template>
