from pathlib import Path
p=Path('src/components/Workbench.vue')
s=p.read_text(encoding='utf-8')
s=s.replace('import MaterialDrawer from "./MaterialDrawer.vue";', 'import MaterialDrawer from "./MaterialDrawer.vue";\nimport CaseTools from "./CaseTools.vue";')
s=s.replace('  timeline: "时间线",','  ...(c.value.scene !== "rental" ? {scene: c.value.scene === "parttime" ? "工时报酬" : "实习保障"} : {}),\n  timeline: "时间线",\n  report: "事项报告",')
start=s.index('  <template v-if="tab === \'timeline\'">')
end=s.index('  <template v-if="tab === \'actions\'">',start)
s=s[:start]+'''  <CaseTools v-if="['timeline','scene','report'].includes(tab)" :case-data="c" :mode="tab" @update="emit('update',$event)" @notice="notify" @view="$event && view($event)" />

'''+s[end:]
s=s.replace('  <template v-if="tab === \'overview\'">','''  <template v-if="tab === 'overview'">
    <section class="action-priority">
      <div class="section-heading"><div><span class="section-index">现在开始</span><h2>先完成这几步</h2></div><span class="muted">根据当前事项更新</span></div>
      <button v-for="(action,i) in c.nextActions?.slice(0,3)" class="priority-row" @click="action.materialId ? cite(action.materialId) : tab=action.tab"><span>{{String(i+1).padStart(2,'0')}}</span><div><strong>{{action.title}}</strong><p>{{action.description}}</p></div><ArrowUpRight :size="16"/></button>
    </section>''')
s=s.replace('class="dispute-card" v-for="(d, i) in c.disputes"','class="dispute-card" v-for="(d, i) in c.disputes"')
needle='''      <div class="dispute-gap">'''
s=s.replace(needle,'''      <details class="evidence-details" v-if="d.materialIds.length"><summary>展开关联证据与原文 · {{d.materialIds.length}}份</summary><article v-for="id in d.materialIds" :key="id"><div><strong>{{materialName(id)}}</strong><button class="text-button" @click="cite(id)">核对原材料 <ArrowUpRight :size="12"/></button></div><p>{{c.materials.find(m=>m.id===id)?.text?.slice(0,350)||'此材料暂无文字，请打开原文件核对。'}}</p><span class="muted">{{c.materials.find(m=>m.id===id)?.dateConfirmed?'日期已由用户核对':'日期待核实'}} · 超过350字的内容请打开原材料</span></article></details>
'''+needle)
p.write_text(s,encoding='utf-8')
p=Path('src/App.vue');s=p.read_text(encoding='utf-8')
s=s.replace('import Workbench from "./components/Workbench.vue";','import Workbench from "./components/Workbench.vue";\nimport RestoreBackup from "./components/RestoreBackup.vue";')
s=s.replace('本地版本 · v0.2','本地版本 · v0.3')
pos=s.index('onMounted(async () =>')
s=s[:pos]+'''async function experience(scene) {
  if(busy.value)return;
  const existing=cases.value.find(c=>c.demo && c.scene===scene && !c.archived);
  if(existing)return openCase(existing.id);
  busy.value=true;
  try{const c=await api('/demos/'+scene,json('POST',{}));await load();await openCase(c.id);}catch(e){notice(e.message);}finally{busy.value=false;}
}
async function resetDemo(){
  if(!confirm('恢复此模拟案例的初始材料与记录？对此案例的编辑和上传将被清除。个人事项不受影响。'))return;
  busy.value=true;
  try{receiveCase(await api('/cases/'+active.value.id+'/reset-demo',json('POST',{})));notice('模拟案例已恢复，可从时间线体验完整流程。');}catch(e){notice(e.message);}finally{busy.value=false;}
}
async function restored(c){receiveCase(c);await openCase(c.id);}
'''+s[pos:]
s=s.replace('''<button v-for="c in demos" :key="c.id" @click="openCase(c.id)">
                  {{ scenes[c.scene] }}案例''','''<button v-for="(name,scene) in scenes" :key="scene" :disabled="busy" @click="experience(scene)">
                  {{ name }}案例''')
s=s.replace('''            ><button class="text-button" @click="start(active.scene)">''','''            ><button class="text-button" :disabled="busy" @click="resetDemo">恢复初始案例</button><button class="text-button" @click="start(active.scene)">''')
needle='''              <h1>我的事项</h1>'''
i=s.index(needle);j=s.index('</div>',i)
s=s[:j+6]+'''\n            <RestoreBackup @restored="restored" @notice="notice" />'''+s[j+6:]
p.write_text(s,encoding='utf-8')
