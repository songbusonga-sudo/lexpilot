<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import {
  Shield,
  LayoutDashboard,
  FolderOpen,
  BookOpen,
  Settings2,
  ArrowUpRight,
  ArrowRight,
  Plus,
  ChevronRight,
  Search,
  House,
  BriefcaseBusiness,
  GraduationCap,
  FileText,
  X,
  ArrowLeft,
  Menu,
  SlidersHorizontal,
  Archive,
  Trash2,
  Check,
  CircleHelp,
} from "lucide-vue-next";
import Workbench from "./components/Workbench.vue";
import RestoreBackup from "./components/RestoreBackup.vue";
import { api, json, scenes, stages } from "./api";
const cases = ref([]),
  active = ref(null),
  page = ref("dashboard"),
  query = ref(""),
  sceneFilter = ref("all"),
  statusFilter = ref("active");
const modal = ref(false),
  editMode = ref(false),
  busy = ref(false),
  error = ref(""),
  message = ref(""),
  mobileNav = ref(false),
  help = ref(false);
const settings = ref({ textReady: false, visionReady: false });
const pendingChanges = ref(false);
const form = ref({
  title: "",
  scene: "rental",
  stage: "准备签约",
  location: "",
});
const icons = {
  rental: House,
  parttime: BriefcaseBusiness,
  internship: GraduationCap,
};
const real = computed(() => cases.value.filter((c) => !c.demo && !c.archived));
const demos = computed(() => cases.value.filter((c) => c.demo && !c.archived));
const live = computed(() => cases.value.filter((c) => !c.archived));
const visible = computed(() =>
  cases.value.filter(
    (c) =>
      (statusFilter.value === "archived"
        ? c.archived
        : statusFilter.value === "demo"
          ? c.demo && !c.archived
          : !c.archived) &&
      (sceneFilter.value === "all" || c.scene === sceneFilter.value) &&
      c.title.toLowerCase().includes(query.value.toLowerCase()),
  ),
);
const recent = computed(() =>
  [...live.value]
    .sort((a, b) =>
      (b.updatedAt || b.date).localeCompare(a.updatedAt || a.date),
    )
    .slice(0, 5),
);
const todos = computed(() =>
  live.value
    .flatMap((c) =>
      (c.nextActions || []).map(t=>({...t,text:t.title}))
        .map((t) => ({ ...t, caseId: c.id, title: c.title, demo: c.demo })),
    )
    .slice(0, 4),
);
const metrics = computed(() => ({
  materials: live.value.reduce((n, c) => n + c.materialCount, 0),
  disputes: live.value.reduce(
    (n, c) =>
      n + (c.disputes?.filter((d) => d.status !== "双方确认").length || 0),
    0,
  ),
  tasks: live.value.reduce(
    (n, c) => n + c.tasks.filter((t) => !t.done).length,
    0,
  ),
}));
let toastTimer;
function notice(text) {
  message.value = text;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (message.value = ""), 4200);
}
async function load() {
  cases.value = await api("/cases");
}
async function refreshCase() {
  if (!active.value) return;
  active.value = await api("/cases/" + active.value.id);
  await load();
}
function receiveCase(data) {
  active.value = data;
  load().catch((e) => notice(e.message));
}
async function openCase(id, route = true) {
  try {
    active.value = await api("/cases/" + id);
    page.value = "detail";
    mobileNav.value = false;
    if (route) location.hash = "case/" + id;
  } catch (e) {
    notice(e.message);
    go("cases");
  }
}
function go(p) {
  if (pendingChanges.value && !confirm('有尚未保存的内容，确定离开并放弃修改？')) return;
  pendingChanges.value = false;
  page.value = p;
  active.value = null;
  mobileNav.value = false;
  location.hash = p;
}
async function readRoute() {
  const route = location.hash.slice(1);
  if (route.startsWith("case/")) {
    const id = decodeURIComponent(route.slice(5));
    if (active.value?.id !== id) await openCase(id, false);
  } else {
    page.value = ["dashboard", "cases", "guide", "settings"].includes(route)
      ? route
      : "dashboard";
    active.value = null;
    mobileNav.value = false;
  }
}
function start(scene = "rental") {
  editMode.value = false;
  form.value = { title: "", scene, stage: "准备签约", location: "" };
  modal.value = true;
}
function edit() {
  editMode.value = true;
  form.value = {
    title: active.value.title,
    scene: active.value.scene,
    stage: active.value.stage,
    location: active.value.location,
  };
  modal.value = true;
}
async function submit() {
  if (busy.value) return;
  busy.value = true;
  try {
    if (editMode.value) {
      await api("/cases/" + active.value.id, json("PATCH", form.value));
      await refreshCase();
      notice("事项信息已更新");
    } else {
      const c = await api("/cases", json("POST", form.value));
      await load();
      await openCase(c.id);
      notice("事项已创建");
    }
    modal.value = false;
  } catch (e) {
    notice(e.message);
  } finally {
    busy.value = false;
  }
}
async function archive() {
  try {
    await api(
      "/cases/" + active.value.id,
      json("PATCH", { archived: !active.value.archived }),
    );
    await refreshCase();
    notice(active.value.archived ? "事项已归档，可在归档中恢复" : "事项已恢复");
  } catch (e) {
    notice(e.message);
  }
}
async function remove() {
  if (!confirm("确定永久删除该事项及全部材料？删除后无法恢复。")) return;
  try {
    await api("/cases/" + active.value.id, { method: "DELETE" });
    await load();
    go("cases");
    notice("事项和文件已删除");
  } catch (e) {
    notice(e.message);
  }
}
async function experience(scene) {
  if(busy.value)return;
  const existing=cases.value.find(c=>c.demo && c.demoRevision===3 && c.scene===scene && !c.archived);
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
onMounted(async () => {
  try {
    await Promise.all([
      load(),
      api("/settings").then((s) => (settings.value = s)),
    ]);
    await readRoute();
  } catch (e) {
    error.value = "无法连接本地服务，请确认后端8266端口已启动。";
  }
  window.addEventListener("hashchange", readRoute);
});
onUnmounted(() => {
  window.removeEventListener("hashchange", readRoute);
  clearTimeout(toastTimer);
});
</script>

<template>
  <div class="app-layout">
    <div v-if="mobileNav" class="nav-scrim" @click="mobileNav = false"></div>
    <aside class="sidebar" :class="{ open: mobileNav }">
      <a href="#dashboard" class="brand" @click.prevent="go('dashboard')"
        ><span class="brand-mark"
          ><Shield :size="24" :stroke-width="1.6" /></span
        ><span>青盾<span class="brand-sub">大学生权益工作台</span></span></a
      >
      <div class="workspace-switch">
        <span class="workspace-letter">Q</span>
        <div>个人工作空间<small>本地版本 · v0.3</small></div>
        <ChevronRight :size="13" />
      </div>
      <div class="nav-label">工作空间</div>
      <nav aria-label="主要导航">
        <button
          :class="{ selected: page === 'dashboard' }"
          @click="go('dashboard')"
        >
          <LayoutDashboard :size="17" />工作台
        </button>
        <button
          :class="{ selected: page === 'cases' || page === 'detail' }"
          @click="
            statusFilter = 'active';
            sceneFilter = 'all';
            go('cases');
          "
        >
          <FolderOpen :size="17" />我的事项<span class="nav-count">{{
            live.length
          }}</span>
        </button>
        <button :class="{ selected: page === 'guide' }" @click="go('guide')">
          <BookOpen :size="17" />权益指南
        </button>
      </nav>
      <div class="nav-label secondary-label">按场景查看</div>
      <nav class="scene-nav">
        <button
          v-for="(name, key) in scenes"
          :key="key"
          @click="
            sceneFilter = key;
            statusFilter = 'active';
            go('cases');
          "
        >
          <component :is="icons[key]" :size="16" />{{ name }}事项
        </button>
      </nav>
      <div class="sidebar-bottom">
        <nav>
          <button
            :class="{ selected: page === 'settings' }"
            @click="go('settings')"
          >
            <Settings2 :size="17" />服务设置</button
          ><button @click="help = true">
            <CircleHelp :size="17" />使用说明
          </button>
        </nav>
        <div class="local-account">
          <span class="account-avatar">我</span>
          <div>本机用户<small>材料保存在当前设备</small></div>
          <span class="connection-dot"></span>
        </div>
      </div>
    </aside>
    <div class="main-shell">
      <header class="topbar">
        <div class="breadcrumbs">
          <button
            class="mobile-toggle icon-button"
            @click="mobileNav = !mobileNav"
            aria-label="展开导航"
          >
            <Menu :size="20" /></button
          ><span>个人工作空间</span><ChevronRight :size="12" /><strong>{{
            page === "dashboard"
              ? "工作台"
              : page === "guide"
                ? "权益指南"
                : page === "settings"
                  ? "服务设置"
                  : page === "detail"
                    ? "事项档案"
                    : "我的事项"
          }}</strong>
        </div>
        <div class="header-status">
          <span class="status-dot"></span> 本地服务<span
            class="header-divider"
          ></span
          ><button
            class="icon-button"
            @click="help = true"
            aria-label="使用说明"
          >
            <CircleHelp :size="17" />
          </button>
        </div>
      </header>
      <main>
        <div v-if="error" class="error-box">
          {{ error
          }}<button
            class="button"
            @click="
              error = '';
              load().catch((e) => (error = e.message));
            "
          >
            重试连接
          </button>
        </div>
        <template v-if="page === 'dashboard'">
          <div class="page-heading">
            <div>
              <div class="overline">工作空间 / OVERVIEW</div>
              <h1>工作台</h1>
              <p>集中整理材料、核对事实，跟进每一项权益事项。</p>
            </div>
            <button class="button dark" @click="start()">
              <Plus :size="16" />新建事项
            </button>
          </div>
          <div class="metrics">
            <div>
              <span>进行中事项</span
              ><strong>{{ live.length.toString().padStart(2, "0") }}</strong
              ><small>个人 {{ real.length }} · 演示 {{ demos.length }}</small>
            </div>
            <div>
              <span>归档材料</span
              ><strong>{{
                metrics.materials.toString().padStart(2, "0")
              }}</strong
              ><small>合同、截图与付款记录</small>
            </div>
            <div>
              <span>待核实争议</span
              ><strong>{{
                metrics.disputes.toString().padStart(2, "0")
              }}</strong
              ><small>尚未标记双方确认</small>
            </div>
            <div>
              <span>待完成行动</span
              ><strong>{{ metrics.tasks.toString().padStart(2, "0") }}</strong
              ><small>包括演示事项中的待办</small>
            </div>
          </div>
          <div class="dashboard-columns">
            <section class="recent-section">
              <div class="section-heading">
                <div>
                  <span class="section-index">01</span>
                  <h2>近期事项</h2>
                </div>
                <button
                  class="text-button"
                  @click="
                    sceneFilter = 'all';
                    statusFilter = 'active';
                    go('cases');
                  "
                >
                  全部事项 <ArrowUpRight :size="14" />
                </button>
              </div>
              <div class="recent-list">
                <button
                  v-for="c in recent"
                  :key="c.id"
                  class="recent-row"
                  @click="openCase(c.id)"
                >
                  <span class="row-icon"
                    ><component
                      :is="icons[c.scene]"
                      :size="21"
                      :stroke-width="1.5" /></span
                  ><span class="recent-copy"
                    ><span class="row-title"
                      >{{ c.title
                      }}<span class="badge" v-if="c.demo">演示</span></span
                    ><span class="row-meta"
                      >{{ scenes[c.scene] }} · {{ c.materialCount }}份材料 ·
                      {{ c.disputes?.length || 0 }}个争议项目</span
                    ></span
                  ><span class="stage-label">{{ c.stage }}</span
                  ><ArrowUpRight :size="16" />
                </button>
                <div v-if="!recent.length" class="empty-state">
                  <FolderOpen :size="28" />
                  <h3>创建你的第一个事项</h3>
                  <p>选择场景后，从已有材料开始整理。</p>
                  <button class="button" @click="start()">新建事项</button>
                </div>
              </div>
              <div class="demo-strip">
                <span>体验完整流程</span>
                <p>演示案例均为模拟材料，与个人事项分开标记。</p>
                <button v-for="(name,scene) in scenes" :key="scene" :disabled="busy" @click="experience(scene)">
                  {{ name }}案例 <ArrowRight :size="13" />
                </button>
              </div>
            </section>
            <section class="next-section">
              <div class="section-heading">
                <div>
                  <span class="section-index">02</span>
                  <h2>下一步行动</h2>
                </div>
                <span class="plain-count">{{ metrics.tasks }}</span>
              </div>
              <div
                v-for="(t, i) in todos"
                :key="t.caseId + i"
                class="dashboard-task"
              >
                <span class="empty-check"></span>
                <div>
                  <button @click="openCase(t.caseId)">{{ t.text }}</button
                  ><span>{{ t.title }}<span v-if="t.demo"> / 演示</span></span>
                </div>
              </div>
              <p v-if="!todos.length" class="muted no-tasks">
                当前没有待完成行动。
              </p>
              <div class="note-block">
                <FileText :size="16" />
                <p>
                  优先保存原始文件，再核对人物、日期和金额。材料中的主张不等同于已确认事实。
                </p>
              </div>
            </section>
          </div>
          <section class="scenario-section">
            <div class="section-heading">
              <div>
                <span class="section-index">03</span>
                <h2>开始一个新事项</h2>
              </div>
              <span class="muted">按实际情况选择场景</span>
            </div>
            <div class="scenario-grid">
              <button
                v-for="(name, key, index) in scenes"
                :key="key"
                class="scenario-item"
                @click="start(key)"
              >
                <div class="scenario-top">
                  <component
                    :is="icons[key]"
                    :size="24"
                    :stroke-width="1.4"
                  /><span>0{{ index + 1 }}</span>
                </div>
                <h3>{{ name }}权益<ArrowUpRight :size="17" /></h3>
                <p>
                  {{
                    key === "rental"
                      ? "核对租赁条款、房屋交接与押金结算。"
                      : key === "parttime"
                        ? "核对招聘承诺、实际安排与薪酬结算。"
                        : "确认实习报酬、保险责任与退出条件。"
                  }}
                </p>
                <div class="scenario-bottom">
                  {{
                    key === "rental"
                      ? "合同 / 照片 / 付款记录"
                      : key === "parttime"
                        ? "招聘广告 / 聊天 / 考勤"
                        : "实习协议 / 学校安排 / 沟通记录"
                  }}
                </div>
              </button>
            </div>
          </section>
        </template>
        <template v-else-if="page === 'cases'">
          <div class="page-heading">
            <div>
              <div class="overline">工作空间 / CASES</div>
              <h1>我的事项</h1>
              <p>让问题、材料与每一次进展，保存在同一份档案里。</p>
            </div>
            <RestoreBackup @restored="restored" @notice="notice" />
            <button class="button dark" @click="start()">
              <Plus :size="16" />新建事项
            </button>
          </div>
          <div class="list-controls">
            <div class="segment">
              <button
                v-for="(name, key) in {
                  active: '进行中',
                  demo: '演示案例',
                  archived: '已归档',
                }"
                :key="key"
                :class="{ active: statusFilter === key }"
                @click="statusFilter = key"
              >
                {{ name }}
              </button>
            </div>
            <div class="control-right">
              <label class="search-field"
                ><Search :size="15" /><input
                  v-model="query"
                  placeholder="搜索事项名称"
                  aria-label="搜索事项" /></label
              ><select v-model="sceneFilter" aria-label="筛选场景">
                <option value="all">全部场景</option>
                <option v-for="(name, key) in scenes" :key="key" :value="key">
                  {{ name }}
                </option>
              </select>
            </div>
          </div>
          <div class="table-scroll">
            <table class="case-table">
              <thead>
                <tr>
                  <th>事项名称</th>
                  <th>场景</th>
                  <th>当前阶段</th>
                  <th>材料</th>
                  <th>争议项目</th>
                  <th>建档日期</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="c in visible" :key="c.id" @click="openCase(c.id)">
                  <td>
                    <button class="table-title" @click.stop="openCase(c.id)">
                      {{ c.title }}</button
                    ><span v-if="c.demo" class="badge">演示</span>
                  </td>
                  <td>{{ scenes[c.scene] }}</td>
                  <td>
                    <span class="badge outline">{{ c.stage }}</span>
                  </td>
                  <td>{{ c.materialCount }}份</td>
                  <td>{{ c.disputes?.length || 0 }}项</td>
                  <td class="tabular">{{ c.date }}</td>
                  <td><ArrowUpRight :size="15" /></td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-if="!visible.length" class="empty-state">
            <FolderOpen :size="28" />
            <h3>没有匹配的事项</h3>
            <p>尝试切换筛选条件，或创建新的事项。</p>
            <button class="button" @click="start()">新建事项</button>
          </div>
          <div class="table-note">
            共 {{ visible.length }} 个事项
            <span>演示材料仅用于体验，不代表真实案件。</span>
          </div>
        </template>
        <template v-else-if="page === 'detail' && active">
          <button class="back-button" @click="go('cases')">
            <ArrowLeft :size="14" />返回我的事项
          </button>
          <div class="page-heading case-heading">
            <div>
              <div class="overline">
                {{ scenes[active.scene] }}事项 /
                {{ active.id.slice(0, 8).toUpperCase() }}
                <span v-if="active.demo" class="badge">模拟演示</span
                ><span v-if="active.archived" class="badge">已归档</span>
              </div>
              <h1>{{ active.title }}</h1>
              <p>
                {{ active.stage }} <span class="separator">/</span>
                {{ active.location || "地点待补充" }}
                <span class="separator">/</span> {{ active.date }} 建档
              </p>
            </div>
            <div class="heading-actions">
              <button class="button" @click="edit">
                <SlidersHorizontal :size="14" />事项信息</button
              ><button
                class="icon-button bordered"
                @click="archive"
                :aria-label="active.archived ? '恢复事项' : '归档事项'"
                :title="active.archived ? '恢复事项' : '归档事项'"
              >
                <Archive :size="16" /></button
              ><button
                class="icon-button bordered"
                @click="remove"
                aria-label="删除事项"
                title="删除事项"
              >
                <Trash2 :size="15" />
              </button>
            </div>
          </div>
          <div v-if="active.demo" class="notice-bar">
            <span
              ><span class="badge dark-badge">演示</span
              >此事项使用模拟材料。可以编辑体验，也可以创建自己的真实事项。</span
            ><button class="text-button" :disabled="busy" @click="resetDemo">恢复初始案例</button><button class="text-button" @click="start(active.scene)">
              新建我的事项 <ArrowUpRight :size="14" />
            </button>
          </div>
          <Workbench
            :key="active.id"
            :case-data="active"
            :settings="settings"
            @update="receiveCase"
            @notice="notice"
            @settings="go('settings')"
            @pending="pendingChanges = $event"
          />
        </template>
        <template v-else-if="page === 'guide'">
          <div class="page-heading">
            <div>
              <div class="overline">参考 / GUIDE</div>
              <h1>权益指南</h1>
              <p>从需要问清的问题，到需要保留的材料。</p>
            </div>
            <span class="badge outline">通用留证建议</span>
          </div>
          <div class="guide-intro">
            <h2>先核对事实，再准备行动。</h2>
            <p>
              本平台帮助整理材料、识别待核实事项和准备沟通草稿。具体适用规则与处理程序，需要结合实际情况确认。
            </p>
          </div>
          <div class="guide-grid">
            <section
              class="guide-card"
              v-for="(name, key, index) in scenes"
              :key="key"
            >
              <span class="guide-number">0{{ index + 1 }}</span>
              <h2>{{ name }}权益</h2>
              <template v-if="key === 'rental'"
                ><h3>签约前问清楚</h3>
                <p>
                  出租人身份与出租权限、押金退还时间、扣款标准、维修责任和提前退租安排。
                </p>
                <h3>过程中留好证</h3>
                <p>
                  保存合同、付款凭证、报修沟通。入住与退租按同一区域拍摄全景和细节，保留原始文件与交接记录。
                </p>
                <h3>发生争议后</h3>
                <p>
                  请对方逐项说明扣款金额和依据，将每个争议项目与对应材料关联，核对无争议部分的退款安排。
                </p></template
              ><template v-else-if="key === 'parttime'"
                ><h3>签约前问清楚</h3>
                <p>
                  招聘主体、固定报酬、绩效条件、工时、结算日期，以及是否要求收费或保管证件。
                </p>
                <h3>过程中留好证</h3>
                <p>
                  留存招聘广告、聊天承诺、任务安排、考勤与实际工资记录，注意各处薪酬表述是否一致。
                </p>
                <h3>发生争议后</h3>
                <p>
                  按日期整理工作与付款明细。是否成立劳动关系，需要结合在校状态和实际用工情况判断。
                </p></template
              ><template v-else
                ><h3>签约前问清楚</h3>
                <p>
                  学校安排、实习岗位、报酬、保险购买主体、保障范围、安全责任和退出条件。
                </p>
                <h3>过程中留好证</h3>
                <p>
                  保存协议、岗位及地点变更、考勤、保险信息，以及与企业和学校的书面沟通。
                </p>
                <h3>发生争议后</h3>
                <p>
                  结合学校安排和实际履行情况，分别列出需要企业、学校确认的问题，不能仅凭协议名称判断法律关系。
                </p></template
              ><button class="text-button" @click="start(key)">
                创建{{ name }}事项 <ArrowRight :size="14" />
              </button>
            </section>
          </div>
          <div class="resource-section">
            <div>
              <h2>需要进一步帮助？</h2>
              <p>
                可联系学校辅导员、就业指导部门，或通过当地公共法律服务渠道咨询。
              </p>
            </div>
            <a
              class="button"
              href="https://www.12348.gov.cn/"
              target="_blank"
              rel="noopener noreferrer"
              >中国法律服务网 <ArrowUpRight :size="14"
            /></a>
          </div>
        </template>
        <template v-else-if="page === 'settings'">
          <div class="page-heading">
            <div>
              <div class="overline">工作空间 / SETTINGS</div>
              <h1>服务设置</h1>
              <p>查看本地功能与外部模型服务的连接状态。</p>
            </div>
          </div>
          <div class="settings-list">
            <section>
              <div class="settings-icon"><FolderOpen :size="21" /></div>
              <div>
                <h2>本地档案服务 <span class="badge">已连接</span></h2>
                <p>
                  事项、材料与编辑记录保存在当前设备。删除材料会同时删除原始上传文件。
                </p>
                <div class="settings-detail">
                  前端 5267 <span>/</span> 后端 8266 <span>/</span> SQLite
                  本地存储
                </div>
              </div>
            </section>
            <section>
              <div class="settings-icon"><FileText :size="21" /></div>
              <div>
                <h2>材料文字核对 <span class="badge">本地可用</span></h2>
                <p>
                  支持文字型
                  PDF、TXT、MD；可提取候选金额与日期，由你核对后记录事实状态。
                </p>
                <div class="settings-detail">
                  规则检查可独立使用，未匹配不代表没有风险。
                </div>
              </div>
            </section>
            <section>
              <div class="settings-icon"><SlidersHorizontal :size="21" /></div>
              <div>
                <h2>
                  硅基流动 · 材料分析
                  <span class="badge">{{
                    settings.textReady ? "已配置" : "待配置"
                  }}</span>
                </h2>
                <p>
                  辅助检查合同、聊天及付款材料中的差异。分析结果保留原文引用，需要人工核对。
                </p>
                <div class="settings-detail">
                  {{ settings.textModel || "尚未选择文本模型" }}
                </div>
              </div>
            </section>
            <section>
              <div class="settings-icon"><Search :size="21" /></div>
              <div>
                <h2>
                  硅基流动 · 图片文字识别
                  <span class="badge">{{
                    settings.visionReady ? "已配置" : "待配置"
                  }}</span>
                </h2>
                <p>
                  转录聊天截图、合同照片中的可见文字。识别后先核对，再保存进事项材料。
                </p>
                <div class="settings-detail">
                  {{
                    settings.visionModel || "尚未选择支持图片输入的多模态模型"
                  }}
                </div>
              </div>
            </section>
          </div>
          <div class="settings-footnote">
            <h3>连接方式</h3>
            <p>
              在项目根目录的 <code>.env</code> 中填写 API
              Key、文本模型和多模态模型名称，重启后端即可。密钥仅由后端读取。调用外部服务前，页面会提示发送的材料范围。
            </p>
            <p>
              未配置时，争议清单、凭证关联、押金结算、人工核对与草稿导出均可正常使用。
            </p>
          </div>
        </template>
        <footer>
          <span>青盾 · 大学生权益工作台</span
          ><span>材料整理与行动辅助，不替代专业法律意见</span
          ><span>本地版本 0.3</span>
        </footer>
      </main>
    </div>
    <div v-if="modal" class="modal-overlay" @click.self="modal = false">
      <form class="dialog" @submit.prevent="submit">
        <div class="dialog-heading">
          <div>
            <span class="overline">{{
              editMode ? "EDIT CASE" : "NEW CASE"
            }}</span>
            <h2>{{ editMode ? "编辑事项信息" : "新建事项" }}</h2>
          </div>
          <button
            type="button"
            class="icon-button"
            @click="modal = false"
            aria-label="关闭"
          >
            <X :size="20" />
          </button>
        </div>
        <p class="muted">
          {{
            editMode
              ? "更新事项名称、阶段与地点。"
              : "选择场景后，上传已有材料，逐步补充实际情况。"
          }}
        </p>
        <label class="field"
          >事项名称<input
            v-model="form.title"
            required
            maxlength="100"
            placeholder="例如：梧桐公寓退租押金核对"
        /></label>
        <div class="field">
          <span>事项场景</span>
          <div class="scene-choice">
            <button
              v-for="(name, key) in scenes"
              :key="key"
              type="button"
              :disabled="editMode"
              :class="{ active: form.scene === key }"
              @click="form.scene = key"
            >
              <component :is="icons[key]" :size="18" />{{ name
              }}<Check v-if="form.scene === key" :size="13" />
            </button>
          </div>
        </div>
        <div class="form-grid">
          <label class="field"
            >当前阶段<select v-model="form.stage" aria-label="当前阶段">
              <option v-for="stage in stages" :key="stage">{{ stage }}</option>
            </select></label
          ><label class="field"
            >地点或机构<input
              v-model="form.location"
              placeholder="选填"
              maxlength="100"
          /></label>
        </div>
        <div class="dialog-footer">
          <button type="button" class="button" @click="modal = false">
            取消</button
          ><button class="button dark" :disabled="busy || !form.title.trim()">
            {{ busy ? "正在保存…" : editMode ? "保存修改" : "创建事项"
            }}<ArrowRight :size="15" />
          </button>
        </div>
      </form>
    </div>
    <div v-if="help" class="modal-overlay" @click.self="help = false">
      <div class="dialog">
        <div class="dialog-heading">
          <h2>使用说明</h2>
          <button
            class="icon-button"
            @click="help = false"
            aria-label="关闭说明"
          >
            <X :size="20" />
          </button>
        </div>
        <ol class="help-list">
          <li>
            <strong>整理材料</strong>
            <p>上传原始文件，核对文字、时间与材料类型。</p>
          </li>
          <li>
            <strong>核对事实</strong>
            <p>区分材料记载、本人陈述、对方主张和双方确认。</p>
          </li>
          <li>
            <strong>处理争议</strong>
            <p>逐项记录金额、双方说明、证据与待补充材料。</p>
          </li>
          <li>
            <strong>准备行动</strong>
            <p>核对结算信息，编辑草稿后再导出使用。</p>
          </li>
        </ol>
        <p class="muted">
          本地功能不需要
          API。外部模型分析和图片识别需要配置硅基流动服务。当前版本仅供本机使用，尚无线上账号与多人权限隔离。
        </p>
        <button class="button dark wide" @click="help = false">知道了</button>
      </div>
    </div>
    <div v-if="message" class="toast" role="status">
      <Check :size="16" />{{ message }}
    </div>
  </div>
</template>
