<script setup>
import { ref } from 'vue';
import { api, json } from '../api';
import { Upload, LoaderCircle } from 'lucide-vue-next';
const emit=defineEmits(['restored','notice']);
const input=ref(null),busy=ref(false),confirmation=ref(false),pending=ref(null),failure=ref('');
async function select(e){
 const file=e.target.files?.[0];e.target.value='';if(!file)return;
 busy.value=true;failure.value='';
 try{
  if(file.size>120*1024*1024)throw Error('备份文件不能超过120MB');
  const data=JSON.parse(await file.text());
  if(data.format!=='qingdun-case'||data.version!==1||!data.case?.title||!Array.isArray(data.materials))throw Error('不是有效的青盾事项备份');
  pending.value=data;confirmation.value=true;
 }catch(e){failure.value=e instanceof SyntaxError?'备份文件无法解析，请选择青盾导出的JSON文件。':e.message;emit('notice',failure.value);}finally{busy.value=false;}
}
async function restore(){busy.value=true;failure.value='';try{const c=await api('/restore',json('POST',pending.value));confirmation.value=false;pending.value=null;emit('restored',c);emit('notice','已恢复为独立副本，原事项未被覆盖。请重新核对旧草稿。');}catch(e){failure.value=e.message;}finally{busy.value=false;}}
</script>
<template>
 <button class="button" :disabled="busy" @click="input.click()"><LoaderCircle v-if="busy" class="spin" :size="14"/><Upload v-else :size="14"/>恢复备份</button>
 <input ref="input" hidden type="file" accept=".json" @change="select">
 <div v-if="confirmation" class="modal-overlay" @click.self="!busy&&(confirmation=false)"><section class="dialog" role="dialog" aria-modal="true" aria-labelledby="restore-title"><h2 id="restore-title">恢复事项备份</h2><p class="dialog-description">{{pending.case.title}} · {{pending.materials.length}}份材料</p><p class="tools-note">将建立一个独立副本，包含备份中的材料及原始文件。原有事项保留，草稿会提示重新核对。请只恢复你信任并有权使用的备份。</p><p v-if="failure" role="alert">{{failure}}</p><div class="dialog-footer"><button class="button" :disabled="busy" @click="confirmation=false;pending=null">取消</button><button class="button dark" :disabled="busy" @click="restore">{{busy?'正在恢复…':'确认恢复副本'}}</button></div></section></div>
</template>
