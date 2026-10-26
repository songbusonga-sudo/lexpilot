<script setup>
import { ref, computed, watch } from "vue";
import {
  Plus,
  Upload,
  FileText,
  ArrowUpRight,
  ArrowRight,
  Check,
  X,
  Link2,
  Pencil,
  Download,
  Image as ImageIcon,
  AlertCircle,
  CheckCircle2,
  Clock3,
  Trash2,
  Search,
  ListChecks,
  LoaderCircle,
  ChevronRight,
  Settings2,
  CheckCheck,
} from "lucide-vue-next";
import MaterialDrawer from "./MaterialDrawer.vue";
import CaseTools from "./CaseTools.vue";
import { api, json, money, amountInput, download, scenes } from "../api";
const props = defineProps({ caseData: Object, settings: Object });
const emit = defineEmits(["update", "notice", "settings", "pending"]);
const toolsPanel = ref(null);
const c = computed(() => props.caseData),
  base = computed(() => "/cases/" + c.value.id);
const tab = ref("overview"),
  busy = ref(false),
  uploading = ref(false),
  uploadProgress = ref(0),
  uploadError = ref(""),
  input = ref(null),
  dragging = ref(false);
let revertingTab = false;
watch(tab, (next, previous) => {
  if (revertingTab) { revertingTab = false; return; }
  if (toolsPanel.value && !toolsPanel.value.canLeave()) { revertingTab = true; tab.value = previous; }
}, { flush: 'sync' });
const selected = ref(null),
  selectedQuote = ref(""),
  disputeDialog = ref(false),
  factDialog = ref(false),
  analysisDialog = ref(false),
  consent = ref(false),
  factForm = ref({});
const disputeForm = ref({
  monetary: true,
  title: "",
  amount: "",
  otherClaim: "",
  myStatement: "",
  missing: "",
  status: "待核实",
  materialIds: [],
});
const settlementForm = ref({
  deposit: "",
  refunded: "0.00",
  depositMaterialIds: [],
  refundMaterialIds: [],
});
const contextForm = ref({}),
  draft = ref(c.value.draft || ""),
  docType = ref(c.value.draftKind || "communication"),
  draftDirty = ref(false),
  materialFilter = ref("all");
const room = ref("全部区域"),
  left = ref(""),
  right = ref("");
const tabs = computed(() => ({
  overview: "事项概览",
  materials: "材料档案",
  facts: "事实核对",
  disputes: "争议清单",
  ...(c.value.scene === "rental"
    ? { photos: "照片对照", settlement: "押金结算" }
    : {}),
  ...(c.value.scene !== "rental" ? {scene: c.value.scene === "parttime" ? "工时报酬" : "实习保障"} : {}),
  timeline: "时间线",
  report: "事项报告",
  actions: "行动材料",
}));
const photos = computed(() =>
  c.value.materials.filter((m) => m.file && m.mime?.startsWith("image/")),
);
const rooms = computed(() => [
  ...new Set(photos.value.map((m) => m.room || "未分类")),
]);
const availablePhotos = computed(() =>
  photos.value.filter(
    (m) => room.value === "全部区域" || (m.room || "未分类") === room.value,
  ),
);
const timeline = computed(() =>
  [...c.value.materials].sort((a, b) => a.date.localeCompare(b.date)),
);
const materials = computed(() =>
  c.value.materials.filter(
    (m) =>
      materialFilter.value === "all" ||
      (materialFilter.value === "pending"
        ? m.status !== "已人工核对"
        : m.type === materialFilter.value),
  ),
);
const pending = computed(() =>
  c.value.disputes.filter((d) => d.status !== "双方确认"),
);
const gaps = computed(() => {
  const result = [];
  const ms = c.value.materials;
  if (!ms.some((m) => m.type === "合同协议"))
    result.push({
      title: "补充合同或协议",
      description: "核对双方约定、履行期限及费用条款。",
      tab: "materials",
    });
  if (c.value.scene === "rental") {
    if (!c.value.settlement.depositMaterialIds.length)
      result.push({
        title: "关联押金付款凭证",
        description: "已填金额也需要回到原始付款记录核对。",
        tab: "settlement",
      });
    if (
      !photos.value.some((m) => m.phase === "入住") ||
      !photos.value.some((m) => m.phase === "退租")
    )
      result.push({
        title: "补充入住与退租原始照片",
        description: "交接文字说明不能替代同一位置的原始照片。",
        tab: "photos",
      });
  } else if (!c.value.context.studentStatus || !c.value.context.management)
    result.push({
      title: "补充实际工作与在校情况",
      description: "先核实学校安排、工作管理和报酬约定，再分析适用规则。",
      tab: "context",
    });
  if (ms.some((m) => !m.text.trim()))
    result.push({
      title: "核对尚无文字的材料",
      description: "图片识别或人工录入后，才能进入文本核对。",
      tab: "materials",
    });
  if (ms.some((m) => !m.dateConfirmed))
    result.push({
      title: "确认材料中的事件时间",
      description: "上传日期不等于事件发生日期，请逐项核对。",
      tab: "timeline",
    });
  for (const d of pending.value)
    if (d.missing)
      result.push({
        title: d.title + "：待补充",
        description: d.missing,
        tab: "disputes",
      });
  return result;
});
const summary = computed(() => c.value.settlementSummary);
const draftStale = computed(
  () =>
    draft.value &&
    c.value.drafts?.[docType.value]?.sourceFingerprint !==
      c.value.sourceFingerprint,
);
watch(
  () => c.value.settlement,
  (s) => {
    settlementForm.value = {
      deposit: amountInput(s.depositCents),
      refunded: amountInput(s.refundedCents),
      depositMaterialIds: [...s.depositMaterialIds],
      refundMaterialIds: [...s.refundMaterialIds],
    };
  },
  { immediate: true },
);
watch(
  () => c.value.context,
  (context) => (contextForm.value = { ...context }),
  { immediate: true },
);
watch(
  () => c.value.draft,
  (value) => {
    if (!draftDirty.value) draft.value = value || "";
  },
);
watch(room, () => {
  left.value = "";
  right.value = "";
});
const notify = (text) => emit("notice", text);
async function refresh() {
  const data = await api(base.value);
  emit("update", data);
}
async function mutate(path, method, body, message) {
  busy.value = true;
  try {
    const data = await api(base.value + path, json(method, body));
    if (data.materials) emit("update", data);
    else await refresh();
    if (message) notify(message);
    return data;
  } catch (e) {
    notify(e.message);
    return null;
  } finally {
    busy.value = false;
  }
}
function view(m, quote = "") {
  selected.value = m;
  selectedQuote.value = quote;
}
function cite(id, quote = "") {
  const m = c.value.materials.find((m) => m.id === id);
  if (m) view(m, quote);
  else notify("关联材料已不存在，请重新关联。");
}
const materialName = (id) =>
  c.value.materials.find((m) => m.id === id)?.name || "材料已删除";
const photo = (id) => photos.value.find((m) => m.id === id);
const photoUrl = (id) => "/api" + base.value + "/materials/" + id + "/file";
function recordFinding(f) {
  startDispute();
  disputeForm.value = {
    ...disputeForm.value,
    title: f.title,
    missing: f.description,
    materialIds: [
      f.materialId,
      ...(f.relatedMaterialId ? [f.relatedMaterialId] : []),
    ],
  };
}
function startDispute(d) {
  disputeForm.value = d
    ? {
        ...d,
        monetary: d.monetary !== false,
        amount: amountInput(d.amountCents),
        materialIds: [...d.materialIds],
      }
    : {
        monetary: true,
        title: "",
        amount: "",
        otherClaim: "",
        myStatement: "",
        missing: "",
        status: "待核实",
        materialIds: [],
      };
  disputeDialog.value = true;
}
async function saveDispute() {
  const d = disputeForm.value;
  const result = await mutate(
    "/disputes" + (d.id ? "/" + d.id : ""),
    d.id ? "PUT" : "POST",
    d,
    "争议项目已保存",
  );
  if (result) disputeDialog.value = false;
}
async function deleteDispute(d) {
  if (confirm("删除这个争议项目？原始材料会保留。"))
    await mutate("/disputes/" + d.id, "DELETE", {}, "争议项目已删除");
}
async function saveSettlement() {
  await mutate("/settlement", "PUT", settlementForm.value, "结算记录已保存");
}
async function saveContext() {
  await mutate("", "PATCH", { context: contextForm.value }, "实际情况已保存");
}
async function toggleTask(index) {
  const tasks = c.value.tasks.map((t, i) => ({
    ...t,
    done: i === index ? !t.done : t.done,
  }));
  await mutate("", "PATCH", { tasks });
}
async function extract() {
  const data = await mutate("/facts/extract", "POST", {});
  if (data)
    notify(
      data.addedCount
        ? "已提取" + data.addedCount + "条候选信息，请逐条核实"
        : "没有新增的金额或日期候选信息",
    );
}
function editFact(f) {
  factForm.value = { ...f };
  factDialog.value = true;
}
async function saveFact() {
  const f = factForm.value;
  if (
    await mutate(
      "/facts/" + f.id,
      "PATCH",
      { text: f.text, status: f.status },
      "事实记录已更新",
    )
  )
    factDialog.value = false;
}
async function analyze() {
  if (!consent.value) return;
  busy.value = true;
  try {
    const data = await api(
      base.value + "/analysis",
      json("POST", { consent: true }),
    );
    emit("update", data);
    analysisDialog.value = false;
    notify("模型辅助核对完成，引用已校验，请人工核实结果");
  } catch (e) {
    notify(e.message);
  } finally {
    busy.value = false;
  }
}
async function generate() {
  if (draft.value && !confirm("重新生成会替换当前草稿，是否继续？")) return;
  busy.value = true;
  try {
    const result = await api(
      base.value + "/draft",
      json("POST", { kind: docType.value }),
    );
    draft.value = result.draft;
    draftDirty.value = false;
    await refresh();
    notify("草稿已生成，请核对后使用");
  } catch (e) {
    notify(e.message);
  } finally {
    busy.value = false;
  }
}
async function saveDraft() {
  const data = await mutate(
    "",
    "PATCH",
    { draft: draft.value, draftKind: docType.value },
    "草稿已保存",
  );
  if (data) draftDirty.value = false;
}
function changeDocType(key) {
  if (draftDirty.value && !confirm("当前草稿尚未保存，确定切换材料类型？"))
    return;
  docType.value = key;
  draft.value =
    c.value.drafts?.[key]?.text ||
    (c.value.draftKind === key ? c.value.draft : "") ||
    "";
  draftDirty.value = false;
}
function exportSettlement() {
  const s = summary.value;
  const rows = [
    ["押金结算记录", c.value.title],
    ["押金实付", money(s.deposit)],
    ["已记录退款", money(s.refunded)],
    ["已标记双方确认的扣款", money(s.confirmed)],
    ["待核实或有争议的扣款（未扣减）", money(s.pending)],
    ["仅按确认项目计算的账面待退余额", money(s.balance)],
    [],
    [
      "争议项目",
      "状态",
      "涉及金额",
      "对方主张",
      "我的说明",
      "待核实事项",
      "关联材料",
    ],
    ...c.value.disputes.map((d) => [
      d.title,
      d.status,
      money(d.amountCents),
      d.otherClaim,
      d.myStatement,
      d.missing,
      d.materialIds.map(materialName).join("；"),
    ]),
    [],
    ["说明", "该记录基于录入信息，不代表最终应退金额的法律认定。"],
  ];
  const csv = rows
    .map((row) =>
      row
        .map(
          (v) =>
            '"' +
            String(v ?? "")
              .replace(/^[=+@-]/, "'$&")
              .replaceAll('"', '""') +
            '"',
        )
        .join(","),
    )
    .join("\r\n");
  download(
    "\uFEFF" + csv,
    c.value.title + "-结算表.csv",
    "text/csv;charset=utf-8",
  );
}
function sendFiles(files) {
  if (!files?.length || uploading.value) return;
  const list = [...files];
  if (list.length > 10) {
    notify("一次最多上传10个文件");
    return;
  }
  if (list.some((f) => f.size > 20 * 1024 * 1024)) {
    notify("单个文件不能超过20MB");
    return;
  }
  if (list.some((f) => !/\.(txt|md|pdf|png|jpe?g|webp)$/i.test(f.name))) {
    notify("请选择PDF、TXT、MD或图片文件");
    return;
  }
  const data = new FormData();
  list.forEach((f) => data.append("files", f));
  uploading.value = true;
  uploadError.value = "";
  uploadProgress.value = 0;
  const xhr = new XMLHttpRequest();
  xhr.open("POST", "/api" + base.value + "/materials");
  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable)
      uploadProgress.value = Math.round((e.loaded / e.total) * 100);
  };
  xhr.onload = async () => {
    uploading.value = false;
    try {
      const result = JSON.parse(xhr.responseText);
      if (xhr.status >= 400) throw Error(result.error);
      await refresh();
      notify("材料已保存，请核对提取内容及事件日期");
    } catch (e) {
      uploadError.value = e.message;
    }
  };
  xhr.onerror = () => {
    uploading.value = false;
    uploadError.value = "上传中断，请检查服务后重新选择文件。";
  };
  xhr.send(data);
}
function dropped(event) {
  dragging.value = false;
  sendFiles(event.dataTransfer.files);
}
</script>

<template>
  <div class="workflow-steps">
    <button
      v-for="(name, key, i) in {
        materials: '整理材料',
        facts: '核对事实',
        disputes: '处理争议',
        actions: '准备行动',
      }"
      :key="key"
      @click="tab = key"
    >
      <span>0{{ i + 1 }}</span
      >{{ name
      }}<Check
        v-if="key === 'materials' && c.materials.length"
        :size="13"
      /><ChevronRight v-else :size="13" />
    </button>
  </div>
  <div class="detail-tabs" role="tablist">
    <button
      v-for="(name, key) in tabs"
      :key="key"
      role="tab"
      :aria-selected="tab === key"
      :class="{ active: tab === key }"
      @click="tab = key"
    >
      {{ name }}<span v-if="key === 'materials'">{{ c.materials.length }}</span
      ><span v-if="key === 'disputes'">{{ c.disputes.length }}</span></button
    ><button
      class="context-tab"
      role="tab"
      :aria-selected="tab === 'context'"
      :class="{ active: tab === 'context' }"
      @click="tab = 'context'"
    >
      实际情况
    </button>
  </div>

  <template v-if="tab === 'overview'">
    <section class="action-priority">
      <div class="section-heading"><div><span class="section-index">现在开始</span><h2>先完成这几步</h2></div><span class="muted">根据当前事项更新</span></div>
      <button v-for="(action,i) in c.nextActions?.slice(0,3)" class="priority-row" @click="action.materialId ? cite(action.materialId) : tab=action.tab"><span>{{String(i+1).padStart(2,'0')}}</span><div><strong>{{action.title}}</strong><p>{{action.description}}</p></div><ArrowUpRight :size="16"/></button>
    </section>
    <div class="case-overview-grid">
      <div>
        <section class="content-section">
          <div class="section-heading">
            <div>
              <h2>当前争议</h2>
              <span class="plain-count">{{ c.disputes.length }}</span>
            </div>
            <button class="text-button" @click="tab = 'disputes'">
              查看清单 <ArrowUpRight :size="14" />
            </button>
          </div>
          <div
            v-for="d in c.disputes.slice(0, 3)"
            :key="d.id"
            class="overview-dispute"
          >
            <div>
              <span class="badge" :class="{ outline: d.status === '待核实' }">{{
                d.status
              }}</span>
              <h3>{{ d.title }}</h3>
              <strong>{{
                d.monetary === false
                  ? "不涉及扣款"
                  : d.amountCents === null
                    ? "金额待核实"
                    : "¥ " + money(d.amountCents)
              }}</strong>
            </div>
            <p>{{ d.missing || "请补充双方主张和关联材料。" }}</p>
            <button class="text-button" @click="startDispute(d)">
              核对该项目 <ArrowRight :size="13" />
            </button>
          </div>
          <div v-if="!c.disputes.length" class="empty-state compact">
            <ListChecks :size="25" />
            <h3>还没有记录争议项目</h3>
            <p>签约前也可以先整理需要确认的问题。</p>
            <button class="button" @click="startDispute()">
              <Plus :size="14" />添加项目
            </button>
          </div>
        </section>
        <section class="content-section">
          <div class="section-heading">
            <div>
              <h2>材料检查</h2>
              <span class="plain-count">{{ c.findings.length }}</span>
            </div>
            <button class="text-button" @click="tab = 'facts'">
              全部核对项 <ArrowUpRight :size="14" />
            </button>
          </div>
          <button
            v-for="f in c.findings.slice(0, 3)"
            :key="f.id"
            class="finding-row"
            @click="cite(f.materialId, f.quote)"
          >
            <span class="finding-square"><Search :size="15" /></span>
            <div>
              <strong>{{ f.title }}</strong
              ><span>{{ materialName(f.materialId) }}</span>
            </div>
            <ArrowUpRight :size="15" />
          </button>
          <p v-if="!c.findings.length" class="muted section-empty">
            尚未检出匹配项。补充并核对材料后继续，不代表没有风险。
          </p>
        </section>
      </div>
      <aside class="case-overview-side">
        <section class="content-section">
          <div class="section-heading">
            <h2>下一步行动</h2>
            <ListChecks :size="17" />
          </div>
          <button
            class="task-row"
            v-for="(task, i) in c.tasks"
            :key="i"
            @click="toggleTask(i)"
            :disabled="busy"
          >
            <span class="check-box" :class="{ checked: task.done }"
              ><Check v-if="task.done" :size="12" /></span
            ><span :class="{ done: task.done }">{{ task.text }}</span>
          </button>
        </section>
        <section class="content-section gaps-section">
          <div class="section-heading">
            <h2>材料与信息缺口</h2>
            <span class="plain-count">{{ gaps.length }}</span>
          </div>
          <button
            v-for="(gap, i) in gaps.slice(0, 5)"
            :key="i"
            class="gap-row"
            @click="tab = gap.tab"
          >
            <span>0{{ i + 1 }}</span>
            <div>
              <strong>{{ gap.title }}</strong>
              <p>{{ gap.description }}</p>
            </div>
            <ChevronRight :size="14" />
          </button>
          <p v-if="!gaps.length" class="muted">
            基础材料已整理，请继续核实每项事实。
          </p>
        </section>
      </aside>
    </div>
  </template>

  <template v-if="tab === 'materials'">
    <div class="section-heading">
      <div>
        <h2>材料档案</h2>
        <span class="muted">原始文件与核对文字一并保存</span>
      </div>
      <button class="button dark" @click="input.click()" :disabled="uploading">
        <Upload :size="15" />上传材料
      </button>
    </div>
    <div
      class="upload-zone"
      :class="{ dragging }"
      @dragover.prevent="dragging = true"
      @dragleave.prevent="dragging = false"
      @drop.prevent="dropped"
    >
      <Upload :size="22" :stroke-width="1.5" />
      <div>
        <strong>{{
          uploading
            ? uploadProgress < 100
              ? "正在上传 " + uploadProgress + "%"
              : "上传完成，正在提取文字…"
            : "拖动文件到这里，或点击选择文件"
        }}</strong>
        <p>PDF、TXT、MD、PNG、JPG、WEBP · 单个20MB · 每次最多10个</p>
      </div>
      <button class="button" @click="input.click()" :disabled="uploading">
        选择文件
      </button>
      <div
        v-if="uploading"
        class="upload-progress"
        :style="{ width: uploadProgress + '%' }"
      ></div>
    </div>
    <div v-if="uploadError" class="error-box">
      {{ uploadError
      }}<button class="text-button" @click="input.click()">重新选择</button>
    </div>
    <div class="material-toolbar">
      <div class="segment">
        <button
          v-for="(label, key) in {
            all: '全部材料',
            pending: '待核对',
            合同协议: '合同协议',
            照片图片: '照片图片',
          }"
          :key="key"
          :class="{ active: materialFilter === key }"
          @click="materialFilter = key"
        >
          {{ label }}
        </button>
      </div>
      <span class="muted">{{ materials.length }}份材料</span>
    </div>
    <div class="table-scroll">
      <table class="material-table">
        <thead>
          <tr>
            <th>材料名称</th>
            <th>类型</th>
            <th>日期</th>
            <th>处理状态</th>
            <th>来源</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="m in materials" :key="m.id" @click="view(m)">
            <td>
              <button class="file-title" @click.stop="view(m)">
                <ImageIcon
                  v-if="m.mime?.startsWith('image/')"
                  :size="17"
                /><FileText v-else :size="17" />{{ m.name }}
              </button>
            </td>
            <td>{{ m.type }}</td>
            <td>
              <span class="tabular">{{ m.date }}</span
              ><small class="cell-note">{{
                m.dateConfirmed ? "已人工核对" : "日期待核实"
              }}</small>
            </td>
            <td>
              <span class="badge outline">{{ m.status }}</span>
            </td>
            <td>{{ m.source }}</td>
            <td><ArrowUpRight :size="15" /></td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-if="!materials.length" class="empty-state">
      <FileText :size="28" />
      <h3>暂时没有材料</h3>
      <p>上传合同、聊天记录、照片或付款凭证。</p>
    </div>
    <p class="table-note">
      文字型PDF可自动提取。图片识别需配置模型服务，也可直接手动补充文字。
    </p>
  </template>

  <template v-if="tab === 'facts'">
    <div class="section-heading">
      <div>
        <h2>事实核对</h2>
        <span class="muted">先区分信息来源，再确认实际情况</span>
      </div>
      <div class="inline-actions">
        <button class="button" @click="extract" :disabled="busy">
          <Search :size="14" />提取金额与日期</button
        ><button
          class="button dark"
          @click="
            consent = false;
            analysisDialog = true;
          "
          :disabled="busy"
        >
          <ListChecks :size="15" />模型辅助核对
        </button>
      </div>
    </div>
    <div class="subsection-title">
      <h3>候选事实</h3>
      <span>材料提取结果默认待核实，支持修改说明和状态。</span>
    </div>
    <div class="facts-list">
      <div v-for="f in c.facts" :key="f.id" class="fact-row">
        <div>
          <span class="badge outline">{{ f.status }}</span
          ><strong>{{ f.text }}</strong
          ><button class="citation" @click="cite(f.materialId, f.quote)">
            <Link2 :size="12" />{{ materialName(f.materialId) }}
          </button>
        </div>
        <button
          class="icon-button bordered"
          @click="editFact(f)"
          aria-label="编辑事实"
        >
          <Pencil :size="14" /></button
        ><button
          class="icon-button"
          @click="mutate('/facts/' + f.id, 'DELETE', {}, '候选事实已删除')"
          aria-label="删除事实"
        >
          <X :size="15" />
        </button>
      </div>
      <div v-if="!c.facts.length" class="empty-state compact">
        <FileText :size="25" />
        <h3>尚未提取候选事实</h3>
        <p>点击“提取金额与日期”，核对后标记信息状态。</p>
      </div>
    </div>
    <div class="subsection-title separated">
      <h3>
        材料中的待核对项
        <span class="plain-count">{{ c.findings.length }}</span>
      </h3>
      <span>规则检查与模型辅助结果均需人工核实</span>
    </div>
    <article class="finding-card" v-for="f in c.findings" :key="f.id">
      <div class="finding-heading">
        <h3>{{ f.title }}</h3>
        <span class="badge">{{ f.origin || "规则检查" }}</span>
      </div>
      <p>{{ f.description }}</p>
      <blockquote>{{ f.quote }}</blockquote>
      <div class="finding-footer">
        <span>{{ materialName(f.materialId) }}</span
        ><button class="text-button" @click="recordFinding(f)">
          记录为争议项目 <Plus :size="12" /></button
        ><button class="text-button" @click="cite(f.materialId, f.quote)">
          定位原文 <ArrowUpRight :size="14" /></button
        ><button
          v-if="f.relatedMaterialId"
          class="text-button"
          @click="cite(f.relatedMaterialId)"
        >
          核对另一份材料 <ArrowUpRight :size="14" />
        </button>
      </div>
    </article>
    <div v-if="!c.findings.length" class="notice-bar">
      尚未检出匹配项，不代表没有风险。请先补充并核对材料。
    </div>
  </template>

  <template v-if="tab === 'disputes'">
    <div class="section-heading">
      <div>
        <h2>争议清单</h2>
        <span class="muted">逐项核对主张、说明、金额与材料依据</span>
      </div>
      <button class="button dark" @click="startDispute()">
        <Plus :size="15" />添加争议项目
      </button>
    </div>
    <div class="dispute-stats">
      <span
        >全部 <b>{{ c.disputes.length }}</b></span
      ><span
        >待核实 / 有争议 <b>{{ pending.length }}</b></span
      ><span
        >双方确认 <b>{{ c.disputes.length - pending.length }}</b></span
      >
    </div>
    <article class="dispute-card" v-for="(d, i) in c.disputes" :key="d.id">
      <div class="dispute-heading">
        <span class="dispute-number">{{ String(i + 1).padStart(2, "0") }}</span>
        <h3>{{ d.title }}</h3>
        <span class="badge" :class="{ outline: d.status === '待核实' }">{{
          d.status
        }}</span
        ><strong>{{
          d.monetary === false
            ? "不涉及扣款"
            : d.amountCents === null
              ? "金额待核实"
              : "¥ " + money(d.amountCents)
        }}</strong
        ><button class="button small" @click="startDispute(d)">
          <Pencil :size="13" />编辑</button
        ><button
          class="icon-button"
          @click="deleteDispute(d)"
          aria-label="删除争议项目"
        >
          <Trash2 :size="14" />
        </button>
      </div>
      <div class="claims-grid">
        <div>
          <span class="field-caption">对方主张</span>
          <p>{{ d.otherClaim || "尚未记录" }}</p>
        </div>
        <div>
          <span class="field-caption">我的说明</span>
          <p>{{ d.myStatement || "尚未记录" }}</p>
        </div>
      </div>
      <div class="dispute-evidence">
        <span class="field-caption">关联材料</span>
        <div>
          <button
            class="citation"
            v-for="id in d.materialIds"
            :key="id"
            @click="cite(id)"
          >
            <Link2 :size="12" />{{ materialName(id)
            }}<ArrowUpRight :size="11" /></button
          ><span v-if="!d.materialIds.length" class="muted"
            >尚未关联材料，请编辑补充。</span
          >
        </div>
      </div>
      <details class="evidence-details" v-if="d.materialIds.length"><summary>展开关联证据与原文 · {{d.materialIds.length}}份</summary><article v-for="id in d.materialIds" :key="id"><div><strong>{{materialName(id)}}</strong><button class="text-button" @click="cite(id)">核对原材料 <ArrowUpRight :size="12"/></button></div><p>{{c.materials.find(m=>m.id===id)?.text?.slice(0,350)||'此材料暂无文字，请打开原文件核对。'}}</p><span class="muted">{{c.materials.find(m=>m.id===id)?.dateConfirmed?'日期已由用户核对':'日期待核实'}} · 超过350字的内容请打开原材料</span></article></details>
      <div class="dispute-gap">
        <span>待核实 / 补充</span>
        <p>{{ d.missing || "尚未记录。请确认事实、金额与依据。" }}</p>
      </div>
    </article>
    <div v-if="!c.disputes.length" class="empty-state">
      <ListChecks :size="30" />
      <h3>从一个具体问题开始</h3>
      <p>例如：墙面维修扣款、薪酬结算差额、实习保险安排。</p>
      <button class="button" @click="startDispute()">添加争议项目</button>
    </div>
    <div class="notice-bar">
      “双方确认”表示你记录的核对状态，系统不会自动认定责任。只有标记为双方确认的金额才进入确认扣款合计。
    </div>
  </template>

  <template v-if="tab === 'settlement'">
    <div class="section-heading">
      <div>
        <h2>押金结算</h2>
        <span class="muted">区分对方主张与双方确认的扣款</span>
      </div>
      <button class="button" @click="exportSettlement">
        <Download :size="14" />导出结算表
      </button>
    </div>
    <div class="settlement-summary">
      <div>
        <span>押金实付</span
        ><strong>{{
          summary.deposit === null ? "未填写" : "¥ " + money(summary.deposit)
        }}</strong>
      </div>
      <div>
        <span>双方确认扣款</span
        ><strong>¥ {{ money(summary.confirmed) }}</strong>
      </div>
      <div>
        <span>已记录退款</span><strong>¥ {{ money(summary.refunded) }}</strong>
      </div>
      <div>
        <span>账面待退余额</span
        ><strong>{{
          summary.balance === null
            ? "待补充押金"
            : "¥ " + money(summary.balance)
        }}</strong>
      </div>
    </div>
    <div class="calculation-note">
      <span>计算方式：押金实付 − 双方确认扣款 − 已退款。</span
      ><strong
        >另有 ¥
        {{
          money(summary.pending)
        }}
        待核实或有争议，暂未作为确认扣款扣减。</strong
      >
      <p>账面余额基于录入信息计算，不是对最终应退金额的法律认定。</p>
    </div>
    <div v-for="w in summary.warnings" :key="w" class="warning-bar">
      <AlertCircle :size="15" />{{ w }}
    </div>
    <form class="settlement-form" @submit.prevent="saveSettlement">
      <div class="form-grid">
        <section>
          <h3>押金支付记录</h3>
          <label class="field"
            >实付金额（元）<input
              v-model="settlementForm.deposit"
              inputmode="decimal"
              placeholder="未核实时可留空"
              aria-label="押金实付金额" /></label
          ><label class="field">关联付款凭证</label>
          <div class="evidence-picker">
            <label v-for="m in c.materials" :key="m.id"
              ><input
                type="checkbox"
                v-model="settlementForm.depositMaterialIds"
                :value="m.id"
              />{{ m.name }}</label
            >
            <p v-if="!c.materials.length" class="muted">请先上传付款凭证。</p>
          </div>
        </section>
        <section>
          <h3>已退款记录</h3>
          <label class="field"
            >累计已退款（元）<input
              v-model="settlementForm.refunded"
              required
              inputmode="decimal"
              aria-label="已退款金额" /></label
          ><label class="field">关联退款凭证</label>
          <div class="evidence-picker">
            <label v-for="m in c.materials" :key="m.id"
              ><input
                type="checkbox"
                v-model="settlementForm.refundMaterialIds"
                :value="m.id"
              />{{ m.name }}</label
            >
            <p v-if="!c.materials.length" class="muted">尚无可关联材料。</p>
          </div>
        </section>
      </div>
      <div class="form-bottom">
        <span class="muted">扣款项目请在“争议清单”中逐项维护。</span
        ><button class="button dark" :disabled="busy">保存结算记录</button>
      </div>
    </form>
    <div class="subsection-title">
      <h3>扣款项目明细</h3>
      <button class="text-button" @click="tab = 'disputes'">
        编辑争议清单 <ArrowUpRight :size="14" />
      </button>
    </div>
    <div class="table-scroll">
      <table>
        <thead>
          <tr>
            <th>项目</th>
            <th>涉及金额</th>
            <th>状态</th>
            <th>是否计入确认扣款</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="d in c.disputes" :key="d.id">
            <td>{{ d.title }}</td>
            <td class="tabular">
              {{
                d.amountCents === null ? "待核实" : "¥ " + money(d.amountCents)
              }}
            </td>
            <td>{{ d.status }}</td>
            <td>
              {{
                d.status === "双方确认" && d.amountCents !== null
                  ? "已计入"
                  : "未计入"
              }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </template>

  <template v-if="tab === 'photos'">
    <div class="section-heading">
      <div>
        <h2>入住 / 退租照片对照</h2>
        <span class="muted">按房间配对，核对同一位置的可见变化</span>
      </div>
      <button class="button" @click="input.click()">
        <Upload :size="15" />上传照片
      </button>
    </div>
    <div class="photo-toolbar">
      <label
        >查看区域<select v-model="room">
          <option>全部区域</option>
          <option v-for="r in rooms" :key="r">{{ r }}</option>
        </select></label
      ><span
        >{{ photos.length }}张原始图片 · 区域与拍摄阶段可在材料详情中修改</span
      >
    </div>
    <div class="photo-pair">
      <section v-for="side in ['left', 'right']" :key="side">
        <div class="photo-panel-heading">
          <h3>{{ side === "left" ? "入住记录" : "退租记录" }}</h3>
          <span class="badge outline">{{
            side === "left" ? "BEFORE" : "AFTER"
          }}</span>
        </div>
        <select v-if="side === 'left'" v-model="left" aria-label="选择入住照片">
          <option value="">选择入住照片</option>
          <option v-for="m in availablePhotos" :key="m.id" :value="m.id">
            {{ m.name }} · {{ m.phase || "未标记" }}
          </option></select
        ><select v-else v-model="right" aria-label="选择退租照片">
          <option value="">选择退租照片</option>
          <option v-for="m in availablePhotos" :key="m.id" :value="m.id">
            {{ m.name }} · {{ m.phase || "未标记" }}
          </option></select
        ><template v-if="photo(side === 'left' ? left : right)"
          ><a
            :href="photoUrl(side === 'left' ? left : right)"
            target="_blank"
            rel="noopener"
            class="photo-display"
            ><img
              :src="photoUrl(side === 'left' ? left : right)"
              :alt="side === 'left' ? '入住原始照片' : '退租原始照片'"
          /></a>
          <div class="photo-details">
            <span
              >{{ photo(side === "left" ? left : right).date }} ·
              {{
                photo(side === "left" ? left : right).dateConfirmed
                  ? "日期已核对"
                  : "日期待核实"
              }}</span
            >
            <p>
              {{
                photo(side === "left" ? left : right).caption ||
                "尚未填写可见情况说明。"
              }}
            </p>
            <button
              class="text-button"
              @click="view(photo(side === 'left' ? left : right))"
            >
              编辑区域、阶段与说明 <Pencil :size="12" />
            </button></div
        ></template>
        <div v-else class="photo-empty">
          <ImageIcon :size="32" :stroke-width="1.2" />
          <p>选择已上传的原始图片</p>
          <span>建议拍摄同一区域的全景与细节</span>
        </div>
      </section>
    </div>
    <div v-if="left && right && left === right" class="warning-bar">
      <AlertCircle :size="15" />当前选择了同一份照片，请选择不同阶段的材料。
    </div>
    <div class="notice-bar">
      照片仅辅助核对可见变化。拍摄时间、位置、损伤原因及维修责任，需要结合合同、交接与沟通材料核实。
    </div>
    <div class="section-heading photo-links">
      <h3>将照片关联到具体争议</h3>
      <button class="text-button" @click="tab = 'disputes'">
        前往争议清单 <ArrowRight :size="14" />
      </button>
    </div>
    <p class="muted">
      编辑争议项目时，可将照片与合同、聊天记录一同关联，形成完整的证据目录。
    </p>
  </template>

  <CaseTools ref="toolsPanel" v-if="['timeline','scene','report'].includes(tab)" :case-data="c" :mode="tab" @update="emit('update',$event)" @notice="notify" @view="$event && view($event)" @pending="emit('pending',$event)" />

  <template v-if="tab === 'actions'">
    <div class="section-heading">
      <div>
        <h2>行动材料</h2>
        <span class="muted">根据已录入信息准备草稿，核对后自行使用</span>
      </div>
      <button class="button dark" @click="generate" :disabled="busy">
        <FileText :size="15" />{{
          busy ? "正在生成…" : draft ? "重新生成草稿" : "生成草稿"
        }}
      </button>
    </div>
    <div v-if="draftStale" class="warning-bar">
      <AlertCircle
        :size="15"
      />材料或核对信息可能已更新。请重新生成，或核对并保存当前草稿后再使用。
    </div>
    <div class="document-layout">
      <aside class="document-options">
        <span class="field-caption">材料类型</span
        ><button
          v-for="(label, key) in {
            communication: '协商沟通说明',
            questions: '签约前提问清单',
            evidence: '证据材料目录',
          }"
          :key="key"
          :class="{ active: docType === key }"
          @click="changeDocType(key)"
        >
          <FileText :size="15" />{{ label
          }}<Check v-if="docType === key" :size="13" />
        </button>
        <div class="document-source">
          <span>草稿依据</span>
          <p>
            {{ c.materials.length }}份材料<br />{{
              c.disputes.length
            }}个争议项目<br />{{
              c.facts.filter((f) => f.status === "双方确认").length
            }}条双方确认记录
          </p>
        </div>
      </aside>
      <section class="document-editor">
        <div class="editor-heading">
          <h3>
            {{
              {
                communication: "协商沟通说明",
                questions: "签约前提问清单",
                evidence: "证据材料目录",
              }[docType]
            }}
          </h3>
          <span>{{ draftDirty ? "有未保存修改" : "保存到本地" }}</span>
        </div>
        <textarea
          v-if="draft"
          v-model="draft"
          @input="draftDirty = true"
          class="draft-editor"
          aria-label="行动材料草稿"
          spellcheck="false"
        ></textarea>
        <div v-else class="empty-document">
          <FileText :size="39" :stroke-width="1" />
          <h3>准备一份清晰的书面材料</h3>
          <p>
            选择材料类型，点击生成草稿。<br />已记录的争议项目和金额会一并整理。
          </p>
        </div>
        <div class="editor-footer">
          <span>草稿不会自动发送</span
          ><button class="button" @click="saveDraft" :disabled="!draft || busy">
            保存草稿</button
          ><button
            class="button dark"
            @click="download(draft, c.title + '-行动材料.txt')"
            :disabled="!draft"
          >
            <Download :size="14" />导出 TXT
          </button>
        </div>
      </section>
    </div>
    <div class="notice-bar">
      使用前请核对人物、时间、金额和信息状态。未确认的主张与争议金额，应保留待核实表述。
    </div>
  </template>

  <template v-if="tab === 'context'">
    <div class="section-heading">
      <div>
        <h2>实际情况</h2>
        <span class="muted">补充必要背景，避免仅凭协议名称判断适用规则</span>
      </div>
    </div>
    <form class="context-form" @submit.prevent="saveContext">
      <div class="form-grid">
        <label class="field"
          >当前身份<select
            v-model="contextForm.studentStatus"
            aria-label="当前身份"
          >
            <option value="">请选择</option>
            <option>在校学生</option>
            <option>已毕业</option>
            <option>其他 / 待核实</option>
          </select></label
        ><label class="field"
          >是否由学校安排<select
            v-model="contextForm.schoolArrangement"
            aria-label="是否由学校安排"
          >
            <option value="">请选择</option>
            <option>学校统一安排</option>
            <option>个人寻找</option>
            <option>学校推荐，具体安排待核实</option>
            <option>不适用</option>
          </select></label
        >
      </div>
      <label class="field"
        >{{ c.scene === "rental" ? "租住与交接安排" : "实际工作管理方式"
        }}<textarea
          v-model="contextForm.management"
          placeholder="描述实际情况，例如由谁安排、如何沟通、如何记录履行情况。"
          rows="3"
        ></textarea></label
      ><label class="field"
        >{{
          c.scene === "rental"
            ? "押金、租金与费用约定"
            : "报酬、工时与结算约定"
        }}<textarea
          v-model="contextForm.payAgreement"
          rows="3"
          placeholder="仅记录已知情况，不确定内容请标注待核实。"
        ></textarea></label
      ><label v-if="c.scene !== 'rental'" class="field"
        >保险与安全安排<textarea
          v-model="contextForm.insurance"
          rows="3"
          placeholder="谁购买保险，保障范围是什么，是否已提供凭证？"
        ></textarea></label
      ><label class="field"
        >希望解决的问题<textarea
          v-model="contextForm.goal"
          rows="3"
          placeholder="例如：核对扣款依据、确认退款时间。"
        ></textarea>
      </label>
      <div class="form-bottom">
        <span class="muted">记录背景不会自动确认法律关系或责任。</span
        ><button class="button dark" :disabled="busy">保存实际情况</button>
      </div>
    </form>
  </template>

  <input
    ref="input"
    type="file"
    multiple
    hidden
    accept=".pdf,.txt,.md,.png,.jpg,.jpeg,.webp"
    @change="
      (e) => {
        sendFiles(e.target.files);
        e.target.value = '';
      }
    "
  />
  <MaterialDrawer
    v-if="selected"
    :material="selected"
    :case-id="c.id"
    :quote="selectedQuote"
    :settings="settings"
    @close="selected = null"
    @notice="notify"
    @saved="
      selected = null;
      refresh();
    "
  />
  <div
    v-if="disputeDialog"
    class="modal-overlay"
    @click.self="disputeDialog = false"
  >
    <form class="dialog wide-dialog" @submit.prevent="saveDispute">
      <div class="dialog-heading">
        <div>
          <span class="overline">DISPUTE RECORD</span>
          <h2>{{ disputeForm.id ? "核对争议项目" : "添加争议项目" }}</h2>
        </div>
        <button
          type="button"
          class="icon-button"
          @click="disputeDialog = false"
          aria-label="关闭争议编辑"
        >
          <X :size="20" />
        </button>
      </div>
      <label class="field"
        >项目名称<input
          v-model="disputeForm.title"
          required
          maxlength="120"
          placeholder="例如：墙面维修扣款" /></label
      ><label class="consent-label"
        ><input
          type="checkbox"
          v-model="disputeForm.monetary"
        />这个项目涉及扣款金额</label
      >
      <div class="form-grid">
        <label class="field"
          >涉及金额（元）<input
            v-model="disputeForm.amount"
            :disabled="!disputeForm.monetary"
            inputmode="decimal"
            placeholder="未知可留空" /></label
        ><label class="field"
          >核对状态<select v-model="disputeForm.status" aria-label="核对状态">
            <option>待核实</option>
            <option>有争议</option>
            <option>双方确认</option>
          </select></label
        >
      </div>
      <div class="form-grid">
        <label class="field"
          >对方主张<textarea
            v-model="disputeForm.otherClaim"
            rows="3"
            placeholder="对方提出了什么，是否有书面记录？"
          ></textarea></label
        ><label class="field"
          >我的说明<textarea
            v-model="disputeForm.myStatement"
            rows="3"
            placeholder="记录自己的说明，区分已知事实与推测。"
          ></textarea>
        </label>
      </div>
      <label class="field"
        >待核实 / 需要补充<textarea
          v-model="disputeForm.missing"
          rows="2"
          placeholder="例如：维修明细、付款凭证、原始照片。"
        ></textarea>
      </label>
      <div class="field">
        <span>关联证据材料</span>
        <div class="evidence-picker">
          <label v-for="m in c.materials" :key="m.id"
            ><input
              type="checkbox"
              v-model="disputeForm.materialIds"
              :value="m.id"
            /><FileText :size="13" />{{ m.name }}</label
          ><span v-if="!c.materials.length" class="muted"
            >尚无材料，可以先保存项目，稍后补充。</span
          >
        </div>
      </div>
      <p v-if="disputeForm.status === '双方确认'" class="notice-bar">
        请确认有双方核对依据。该状态下的金额将计入确认扣款合计。
      </p>
      <div class="dialog-footer">
        <button type="button" class="button" @click="disputeDialog = false">
          取消</button
        ><button class="button dark" :disabled="busy">保存项目</button>
      </div>
    </form>
  </div>
  <div v-if="factDialog" class="modal-overlay" @click.self="factDialog = false">
    <form class="dialog" @submit.prevent="saveFact">
      <div class="dialog-heading">
        <h2>核对事实记录</h2>
        <button type="button" class="icon-button" @click="factDialog = false">
          <X :size="20" />
        </button>
      </div>
      <label class="field"
        >说明<textarea
          v-model="factForm.text"
          required
          rows="4"
        ></textarea></label
      ><label class="field"
        >信息状态<select v-model="factForm.status" aria-label="信息状态">
          <option
            v-for="s in [
              '待核实',
              '材料记载',
              '本人陈述',
              '对方主张',
              '双方确认',
            ]"
            :key="s"
          >
            {{ s }}
          </option>
        </select></label
      >
      <blockquote class="original-quote">原文：{{ factForm.quote }}</blockquote>
      <div class="dialog-footer">
        <button type="button" class="button" @click="factDialog = false">
          取消</button
        ><button class="button dark" :disabled="busy">保存核对结果</button>
      </div>
    </form>
  </div>
  <div
    v-if="analysisDialog"
    class="modal-overlay"
    @click.self="!busy && (analysisDialog = false)"
  >
    <div class="dialog">
      <div class="dialog-heading">
        <h2>模型辅助核对</h2>
        <button
          class="icon-button"
          @click="analysisDialog = false"
          :disabled="busy"
        >
          <X :size="20" />
        </button>
      </div>
      <template v-if="settings.textReady"
        ><p class="dialog-description">
          将当前事项的材料文字与已填写背景发送至硅基流动，检查需要核实的问题。原文引用经系统校验后显示，结果仍需人工核对。
        </p>
        <label class="consent-label"
          ><input
            type="checkbox"
            v-model="consent"
          />我已核对材料范围，同意发送文字进行本次分析。</label
        >
        <div class="dialog-footer">
          <button
            class="button"
            @click="analysisDialog = false"
            :disabled="busy"
          >
            取消</button
          ><button
            class="button dark"
            @click="analyze"
            :disabled="!consent || busy"
          >
            <LoaderCircle v-if="busy" class="spinning" :size="15" />{{
              busy ? "分析中…" : "开始核对"
            }}
          </button>
        </div></template
      ><template v-else
        ><p class="dialog-description">
          尚未配置硅基流动文本模型。规则检查、候选事实提取、争议清单和草稿功能可以继续使用。
        </p>
        <div class="notice-bar">需要在后端配置 API Key 和文本模型名称。</div>
        <div class="dialog-footer">
          <button class="button" @click="analysisDialog = false">
            继续使用本地功能</button
          ><button class="button dark" @click="emit('settings')">
            查看服务设置
          </button>
        </div></template
      >
    </div>
  </div>
</template>
