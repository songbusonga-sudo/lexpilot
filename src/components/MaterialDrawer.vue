<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import {
  X,
  ArrowUpRight,
  Pencil,
  Trash2,
  Check,
  Search,
  LoaderCircle,
} from "lucide-vue-next";
import { api, json } from "../api";
const props = defineProps({
  material: Object,
  caseId: String,
  quote: String,
  settings: Object,
});
const emit = defineEmits(["close", "saved", "notice"]);
const editing = ref(false),
  busy = ref(false),
  ocrBusy = ref(false),
  ocrConsent = ref(false),
  ocrDialog = ref(false);
const m = props.material;
const form = ref({
  text: m.text || "",
  date: m.date,
  dateConfirmed: !!m.dateConfirmed,
  type: m.type,
  source: m.source,
  room: m.room || "未分类",
  phase: m.phase || "未标记",
  caption: m.caption || "",
});
const fileUrl = computed(
  () => `/api/cases/${props.caseId}/materials/${m.id}/file`,
);
const parts = computed(() => {
  if (!props.quote || !form.value.text.includes(props.quote)) return null;
  const i = form.value.text.indexOf(props.quote);
  return [
    form.value.text.slice(0, i),
    props.quote,
    form.value.text.slice(i + props.quote.length),
  ];
});
async function save() {
  busy.value = true;
  try {
    await api(
      `/cases/${props.caseId}/materials/${m.id}`,
      json("PATCH", form.value),
    );
    emit("saved");
    emit("notice", "材料内容、分类与日期已保存");
  } catch (e) {
    emit("notice", e.message);
  } finally {
    busy.value = false;
  }
}
async function remove() {
  if (!confirm("删除这份材料及原始文件？关联的事实和引用也会一并移除。"))
    return;
  busy.value = true;
  try {
    await api(`/cases/${props.caseId}/materials/${m.id}`, { method: "DELETE" });
    emit("saved");
    emit("notice", "材料及原始文件已删除");
  } catch (e) {
    emit("notice", e.message);
  } finally {
    busy.value = false;
  }
}
async function ocr() {
  ocrBusy.value = true;
  try {
    const r = await api(
      `/cases/${props.caseId}/materials/${m.id}/ocr`,
      json("POST", { consent: true }),
    );
    form.value.text = r.text;
    editing.value = true;
    ocrDialog.value = false;
    emit("notice", "识别文字已填入编辑区，请核对后保存，尚未覆盖原记录");
  } catch (e) {
    emit("notice", e.message);
  } finally {
    ocrBusy.value = false;
  }
}
function close() {
  if (ocrBusy.value || busy.value) return;
  if (
    editing.value &&
    JSON.stringify(form.value) !==
      JSON.stringify({
        text: m.text || "",
        date: m.date,
        dateConfirmed: !!m.dateConfirmed,
        type: m.type,
        source: m.source,
        room: m.room || "未分类",
        phase: m.phase || "未标记",
        caption: m.caption || "",
      }) &&
    !confirm("当前修改尚未保存，确定关闭？")
  )
    return;
  emit("close");
}
const escape = (e) => {
  if (e.key === "Escape" && !ocrDialog.value) close();
};
onMounted(() => {
  document.addEventListener("keydown", escape);
  setTimeout(
    () =>
      document
        .querySelector(".material-transcript mark")
        ?.scrollIntoView({ block: "center" }),
    100,
  );
});
onUnmounted(() => document.removeEventListener("keydown", escape));
</script>

<template>
  <div class="drawer-overlay" @click.self="close">
    <section
      class="material-drawer"
      role="dialog"
      aria-modal="true"
      :aria-label="m.name"
    >
      <header class="drawer-heading">
        <div>
          <span class="overline"
            >原始材料 / {{ m.demo ? "模拟演示" : "用户上传" }}</span
          >
          <h2>{{ m.name }}</h2>
        </div>
        <button class="icon-button" @click="close" aria-label="关闭材料">
          <X :size="20" />
        </button>
      </header>
      <div class="drawer-toolbar">
        <span class="badge outline">{{ m.status }}</span
        ><a
          v-if="m.file"
          class="text-button"
          :href="fileUrl"
          target="_blank"
          rel="noopener"
          >打开原始文件 <ArrowUpRight :size="14" /></a
        ><button class="button small" @click="editing = !editing">
          <Pencil :size="13" />{{ editing ? "返回预览" : "编辑与核对" }}
        </button>
      </div>
      <div class="drawer-body">
        <template v-if="m.file"
          ><img
            v-if="m.mime?.startsWith('image/')"
            :src="fileUrl"
            class="material-image"
            alt="上传的原始图片" /><iframe
            v-else-if="m.mime === 'application/pdf'"
            :src="fileUrl"
            class="pdf-preview"
            title="原始PDF预览"
          ></iframe
        ></template>
        <div v-if="!editing" class="material-readonly">
          <div class="subsection-title">
            <h3>材料文字</h3>
            <span>引用内容已标记</span>
          </div>
          <pre
            class="material-transcript"
            v-if="form.text"
          ><template v-if="parts">{{parts[0]}}<mark>{{parts[1]}}</mark>{{parts[2]}}</template><template v-else>{{form.text}}</template></pre>
          <div v-else class="empty-state compact">
            <Search :size="25" />
            <h3>尚无可核对文字</h3>
            <p>编辑补充文字，或使用图片文字识别。</p>
          </div>
          <dl class="material-metadata">
            <div>
              <dt>材料类型</dt>
              <dd>{{ m.type }}</dd>
            </div>
            <div>
              <dt>记录日期</dt>
              <dd>
                {{ m.date }} · {{ m.dateConfirmed ? "已人工核对" : "待核实" }}
              </dd>
            </div>
            <div>
              <dt>信息来源</dt>
              <dd>{{ m.source }}</dd>
            </div>
            <template v-if="m.mime?.startsWith('image/')"
              ><div>
                <dt>区域 / 阶段</dt>
                <dd>{{ m.room || "未分类" }} / {{ m.phase || "未标记" }}</dd>
              </div>
              <div>
                <dt>可见情况</dt>
                <dd>{{ m.caption || "尚未填写" }}</dd>
              </div></template
            >
          </dl>
        </div>
        <form v-else @submit.prevent="save">
          <div class="form-grid">
            <label class="field"
              >材料类型<select v-model="form.type" aria-label="材料类型">
                <option
                  v-for="type in [
                    '合同协议',
                    '聊天记录',
                    '付款凭证',
                    '交接记录',
                    '招聘信息',
                    '工时考勤',
                    '照片图片',
                    '待分类材料',
                  ]"
                  :key="type"
                >
                  {{ type }}
                </option>
              </select></label
            ><label class="field"
              >信息来源<select v-model="form.source" aria-label="信息来源">
                <option
                  v-for="source in [
                    ...new Set([
                      m.source,
                      '用户上传',
                      '材料记载',
                      '本人陈述',
                      '对方主张',
                      '双方确认',
                      '待核实',
                    ]),
                  ]"
                  :key="source"
                >
                  {{ source }}
                </option>
              </select></label
            >
          </div>
          <label class="field"
            >材料 / 事件日期<input
              type="date"
              v-model="form.date"
              required /></label
          ><label class="consent-label"
            ><input
              type="checkbox"
              v-model="form.dateConfirmed"
            />已核对原始材料中的事件日期，并非直接采用上传日期。</label
          ><template v-if="m.mime?.startsWith('image/')"
            ><div class="form-grid">
              <label class="field"
                >照片区域<select v-model="form.room" aria-label="照片区域">
                  <option
                    v-for="r in [
                      '未分类',
                      '卧室',
                      '客厅',
                      '厨房',
                      '卫生间',
                      '阳台',
                      '其他',
                    ]"
                    :key="r"
                  >
                    {{ r }}
                  </option>
                </select></label
              ><label class="field"
                >拍摄阶段<select v-model="form.phase" aria-label="拍摄阶段">
                  <option>未标记</option>
                  <option>入住</option>
                  <option>履行中</option>
                  <option>退租</option>
                </select></label
              >
            </div>
            <label class="field"
              >可见情况与待核实内容<textarea
                v-model="form.caption"
                rows="3"
                placeholder="仅描述可见内容，拍摄时间和损伤原因另行核实。"
              ></textarea></label></template
          ><label class="field"
            >材料文字 / 人工转录<textarea
              class="material-text"
              v-model="form.text"
              rows="10"
              placeholder="保留原文；看不清的内容请注明，避免补写推测。"
            ></textarea>
          </label>
          <div class="notice-bar">
            人工转录不替代原始文件。保存后会重新进行文本规则检查。
          </div>
        </form>
      </div>
      <footer class="drawer-footer">
        <button
          class="icon-button"
          @click="remove"
          :disabled="busy"
          aria-label="删除材料"
        >
          <Trash2 :size="16" /></button
        ><button
          v-if="m.mime?.startsWith('image/')"
          class="button"
          @click="
            ocrConsent = false;
            ocrDialog = true;
          "
          :disabled="busy"
        >
          <Search :size="14" />图片文字识别</button
        ><button
          v-if="editing"
          class="button dark"
          @click="save"
          :disabled="busy"
        >
          保存核对结果 <Check :size="14" /></button
        ><button v-else class="button dark" @click="editing = true">
          编辑与核对 <Pencil :size="14" />
        </button>
      </footer>
    </section>
  </div>
  <div v-if="ocrDialog" class="modal-overlay high-overlay">
    <div class="dialog">
      <div class="dialog-heading">
        <h2>图片文字识别</h2>
        <button
          class="icon-button"
          @click="ocrDialog = false"
          :disabled="ocrBusy"
        >
          <X :size="20" />
        </button>
      </div>
      <template v-if="settings.visionReady"
        ><p class="dialog-description">
          仅将当前图片发送至硅基流动进行文字转录。识别结果先填入编辑区，核对并保存后才更新材料。
        </p>
        <label class="consent-label"
          ><input
            type="checkbox"
            v-model="ocrConsent"
          />同意发送当前图片进行本次识别。</label
        >
        <div class="dialog-footer">
          <button
            class="button dark"
            @click="ocr"
            :disabled="!ocrConsent || ocrBusy"
          >
            <LoaderCircle v-if="ocrBusy" class="spinning" :size="15" />{{
              ocrBusy ? "正在识别…" : "开始识别"
            }}
          </button>
        </div></template
      ><template v-else
        ><p class="dialog-description">
          尚未配置支持图片输入的多模态模型。你可以先手动转录材料文字，分类与照片对照不受影响。
        </p>
        <div class="dialog-footer">
          <button
            class="button dark"
            @click="
              ocrDialog = false;
              editing = true;
            "
          >
            手动补充文字
          </button>
        </div></template
      >
    </div>
  </div>
</template>
