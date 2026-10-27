<script setup>
import { ref, computed } from 'vue';
import { Shield, ArrowRight, House, BriefcaseBusiness, GraduationCap, FolderOpen, FileCheck2, ListChecks, MessageSquareText, Check } from 'lucide-vue-next';
defineProps({ busy: Boolean, ready: Boolean, count: Number, resumeCase: Object });
defineEmits(['start', 'demo', 'records', 'guide', 'resume']);
const problems = [
  { scene: 'rental', title: '租房合同帮我看看', stage: '准备签约', icon: House, description: '核对押金、维修、提前退租等约定。', materials: '准备租赁合同或合同照片' },
  { scene: 'rental', title: '押金被扣怎么办', stage: '已经发生问题', icon: House, description: '整理扣款理由、交接证据和退款金额。', materials: '准备合同、付款记录或退租聊天' },
  { scene: 'parttime', title: '兼职工资没结', stage: '已经发生问题', icon: BriefcaseBusiness, description: '核对报酬承诺、实际工时和已收工资。', materials: '准备招聘信息、聊天或考勤记录' },
  { scene: 'internship', title: '实习协议怎么签', stage: '准备签约', icon: GraduationCap, description: '检查报酬、保险、安全和退出条件。', materials: '准备实习协议或岗位安排' },
];
const moreProblems = [
  { scene: 'parttime', title: '兼职入职前要问什么', stage: '准备签约', icon: BriefcaseBusiness, description: '核对招聘主体、收费要求和工资结算约定。', materials: '准备招聘广告或入职沟通记录' },
  { scene: 'internship', title: '实习遇到问题想退出', stage: '已经发生问题', icon: GraduationCap, description: '整理退出约定、实际安排和与学校的沟通。', materials: '准备协议、岗位安排或沟通记录' },
];
const showMore = ref(false);
function chooseProblem() {
  const heading = document.getElementById('problem-heading');
  heading?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
  heading?.focus({ preventScroll: true });
}
const preparationScene = ref('rental');
const checked = ref({ rental: [], parttime: [], internship: [] });
const preparations = {
  rental: { name: '租房', title: '租房材料核对', items: ['租赁合同或补充约定', '押金、租金付款记录', '入住与退租照片、交接记录', '关于扣款、维修或退款的聊天'] },
  parttime: { name: '兼职', title: '兼职材料核对', items: ['招聘广告或岗位介绍', '工资、工时和结算日期的约定', '考勤、排班或工作完成记录', '已收工资、催款及其他沟通记录'] },
  internship: { name: '实习', title: '实习材料核对', items: ['实习协议或录用通知', '学校安排及企业岗位说明', '报酬、保险和安全安排', '岗位变动、退出或争议沟通记录'] },
};
const preparation = computed(() => preparations[preparationScene.value]);
const preparationStage = ref('准备签约');
const faqs = [
  { question: '没有合同，只有聊天截图，也能用吗？', answer: '可以。从招聘信息、聊天、付款凭证或照片中任选一份开始，也可以先描述实际情况。材料不完整时，系统会提示继续核对；本人描述和截图中的主张都不等于已确认事实。' },
  { question: '上传以后，会得到哪些内容？', answer: '文字材料可查看条款提示、提取候选日期和金额，再整理争议与证据。辅助分析可用时，经你确认后才会调用外部服务。你还可以核对结算、编辑协商草稿，并导出报告。' },
  { question: '换手机或清除浏览器记录后，还能找回来吗？', answer: '当前通过浏览器 Cookie 识别访客，尚不支持账号登录或跨设备同步。请在「事项报告」中导出完整备份，再在其他设备的「我的记录」中恢复。完整备份包含原始材料且未加密，请妥善保管。' },
  { question: '这些结果能直接当作法律结论吗？', answer: '不能。系统帮助整理约定、证据与待核实问题，不确认材料真实性或最终责任，也不保证处理结果。可将核对后的材料带给学校相关部门或专业法律服务人员进一步咨询。' },
];
</script>

<template>
  <div class="public-home">
    <header class="public-header">
      <a href="#home" class="public-brand"><Shield :size="27" /><strong>青盾</strong><span>大学生权益助手</span></a>
      <nav aria-label="网站导航">
        <button @click="$emit('guide')">权益指南</button>
        <button class="button" :disabled="!ready" @click="$emit('records')"><FolderOpen :size="15" />我的记录<span v-if="count">{{ count }}</span></button>
      </nav>
    </header>
    <main class="public-main">
      <section class="public-hero">
        <div class="public-hero-copy">
        <span class="public-eyebrow">租房 · 兼职 · 实习</span>
        <h1>遇到权益问题，<br />从这里理清下一步。</h1>
        <p>把合同和聊天里的约定看清楚，把证据和金额整理好。<br class="desktop-break" />选择你遇到的问题，直接开始，无需注册。</p>
        <div class="public-assurances"><span>无需自行配置服务</span><span>每位访客独立记录</span><span>支持导出备份</span></div>
        <button class="button dark home-primary-action" @click="chooseProblem">选择我的问题<ArrowRight :size="15" /></button>
        </div>
        <aside class="home-result-preview" aria-labelledby="result-preview-title">
          <div class="home-preview-heading"><span>使用后，你可以整理出</span><span class="home-preview-badge">内容示意</span></div>
          <h2 id="result-preview-title">一份说得清、找得到依据的记录</h2>
          <div class="home-preview-item"><FileCheck2 :size="19" /><div><h3>需要问清楚的问题</h3><p>例如：押金扣款标准，合同里写清楚了吗？</p></div></div>
          <div class="home-preview-item"><ListChecks :size="19" /><div><h3>对应材料与待补证据</h3><p>把双方说法、付款记录和交接照片放在一起核对。</p></div></div>
          <div class="home-preview-item"><MessageSquareText :size="19" /><div><h3>能继续编辑的行动草稿</h3><p>整理提问清单、协商说明，导出后再使用。</p></div></div>
          <button class="text-button" :disabled="busy || !ready" @click="$emit('demo', 'rental')">打开租房示例看看<ArrowRight :size="14" /></button>
        </aside>
      </section>
      <section v-if="resumeCase" class="home-resume" aria-label="继续上次记录">
        <div><span>欢迎回来 · 你有 {{ count }} 条进行中的记录</span><h2>{{ resumeCase.title }}</h2><p>材料和核对进度已保存，可继续补充。</p></div>
        <button class="button dark" :disabled="busy || !ready" @click="$emit('resume', resumeCase.id)">继续上次记录<ArrowRight :size="15" /></button>
      </section>
      <section aria-labelledby="problem-heading">
        <div class="public-section-heading"><h2 id="problem-heading" tabindex="-1">你现在需要解决什么？</h2><span>选一个最接近的情况</span></div>
        <div class="problem-grid">
          <button v-for="problem in problems" :key="problem.title" class="problem-card" :disabled="busy || !ready" @click="$emit('start', problem)">
            <component :is="problem.icon" :size="25" :stroke-width="1.5" />
            <h3>{{ problem.title }}<ArrowRight :size="18" /></h3>
            <p>{{ problem.description }}</p><small>{{ problem.materials }}</small>
          </button>
        </div>
        <div v-if="showMore" id="more-problems" class="problem-grid home-more-problems">
          <button v-for="problem in moreProblems" :key="problem.title" class="problem-card" :disabled="busy || !ready" @click="$emit('start', problem)">
            <component :is="problem.icon" :size="25" :stroke-width="1.5" /><h3>{{ problem.title }}<ArrowRight :size="18" /></h3><p>{{ problem.description }}</p><small>{{ problem.materials }}</small>
          </button>
        </div>
        <button class="text-button home-more-toggle" :aria-expanded="showMore" aria-controls="more-problems" @click="showMore = !showMore">{{ showMore ? '收起其他情况' : '还有其他兼职、实习问题？' }}<ArrowRight :size="14" /></button>
        <p class="public-start-status" role="status" v-if="busy">正在为你准备独立记录…</p>
      </section>
      <section class="asean-entry"><div><span class="section-index">CHINA–ASEAN · PUBLIC LEGAL SERVICE</span><h2>在陌生的语言里，也能说清自己的权益</h2><p>中英双语核对材料、保留原文，准备交给法律服务人员的咨询问题。</p><p lang="en">Compare Chinese and English documents and prepare questions for legal consultation.</p></div><button class="button dark" :disabled="busy || !ready" @click="$emit('demo','rental','asean')">东盟双语案例 / Try bilingual demo <ArrowRight :size="15"/></button></section>
      <section class="public-how" aria-label="使用步骤">
        <div><span>01</span><h3>提供材料或描述情况</h3><p>支持合同、聊天截图、付款凭证，也可以手动补充文字。</p></div>
        <div><span>02</span><h3>核对问题与证据</h3><p>查看条款提示，核对日期、金额以及双方的说法。</p></div>
        <div><span>03</span><h3>准备下一步行动</h3><p>整理待确认问题、协商说明和报告，再导出使用。</p></div>
      </section>
      <section class="home-preparation" aria-labelledby="preparation-heading">
        <div class="home-preparation-intro"><span class="public-eyebrow">开始前的小准备</span><h2 id="preparation-heading">手边有这些，就能往前一步</h2><p>按已有材料勾选，不必全部备齐。原文件请自己保留，上传后仍可继续补充。</p><div class="home-scene-tabs" role="group" aria-label="选择材料清单场景"><button v-for="(item, scene) in preparations" :key="scene" :aria-pressed="preparationScene === scene" @click="preparationScene = scene">{{ item.name }}</button></div></div>
        <div class="home-preparation-list">
          <label v-for="item in preparation.items" :key="preparationScene + item" class="home-check-item"><input v-model="checked[preparationScene]" type="checkbox" :value="item" /><span>{{ item }}</span><Check v-if="checked[preparationScene].includes(item)" :size="15" /></label>
          <div class="home-preparation-bottom"><span role="status">{{ checked[preparationScene].length ? `手边已有 ${checked[preparationScene].length} 类材料` : '暂时没有材料，也能先描述情况' }}</span></div>
          <label class="home-stage">目前的情况<select v-model="preparationStage"><option>准备签约</option><option>正在履行</option><option>已经发生问题</option></select></label>
          <button class="button dark" :disabled="busy || !ready" @click="$emit('start', { scene: preparationScene, title: preparation.title, stage: preparationStage })">开始{{ preparation.name }}核对<ArrowRight :size="15" /></button>
        </div>
      </section>
      <section class="public-demo">
        <div><h2>还没准备好材料？先看示例</h2><p>每次体验使用你自己的模拟副本，可放心尝试。</p></div>
        <div class="public-demo-actions"><button v-for="(name, scene) in { rental: '租房', parttime: '兼职', internship: '实习' }" :key="scene" class="button" :disabled="busy || !ready" @click="$emit('demo', scene)">{{ name }}示例<ArrowRight :size="14" /></button></div>
      </section>
      <section class="home-faq" aria-labelledby="faq-heading"><div class="public-section-heading"><h2 id="faq-heading">开始前，你可能还想知道</h2><span>材料、保存与使用范围</span></div><details v-for="faq in faqs" :key="faq.question"><summary>{{ faq.question }}<span aria-hidden="true">+</span></summary><p>{{ faq.answer }}</p></details></section>
      <section class="home-help"><div><h2>需要进一步咨询？</h2><p>可联系学校辅导员、就业指导部门，或了解官方公共法律服务渠道。</p></div><a class="button" href="https://www.12348.gov.cn/" target="_blank" rel="noopener noreferrer">中国法律服务网<ArrowRight :size="15" /></a></section>
      <aside class="public-privacy"><Shield :size="19" /><p>材料保存在服务器，仅当前浏览器的访客身份可访问。清除 Cookie、使用无痕模式或更换设备后，可能无法找回记录。重要材料请在「事项报告」中导出完整备份；分析提示需要你核实，不替代专业法律意见。</p></aside>
    </main>
    <footer class="public-footer"><span>青盾 · 大学生权益助手</span><span>看清约定，留好证据，准备行动。</span></footer>
  </div>
</template>

<style scoped>
.public-hero{display:grid;grid-template-columns:1.15fr 1fr;gap:48px;align-items:center;padding-top:56px}
.public-hero h1{font-size:clamp(32px,3.8vw,48px)}
.public-hero-copy>p{font-size:15px;color:#676767;line-height:1.9}
.home-primary-action{margin-top:24px;min-height:43px;padding:11px 22px}#problem-heading{scroll-margin-top:24px}#problem-heading:focus{outline:none}
.home-result-preview{padding:26px;background:#fff;border:1px solid #dfdfdf;border-radius:14px;box-shadow:0 12px 40px #27272710}
.home-preview-heading{display:flex;justify-content:space-between;align-items:center;gap:12px;font-size:11px;color:#696969}
.home-preview-badge{padding:4px 8px;background:#f1f1f1;border-radius:4px;white-space:nowrap}
.home-result-preview h2{font-size:18px;line-height:1.6;margin:13px 0 8px}
.home-preview-item{display:flex;gap:12px;padding:16px 0;border-bottom:1px solid #ededed}.home-preview-item>svg{color:#6d6d6d;margin-top:3px}.home-preview-item h3{font-size:13px}.home-preview-item p{font-size:12px;color:#777777;margin-top:5px;line-height:1.8}.home-result-preview>.text-button{margin-top:17px;font-size:12px}
.home-resume{display:flex;justify-content:space-between;align-items:center;gap:22px;padding:22px 26px;margin:0 0 36px;background:#ededed;border:1px solid #dcdcdc;border-radius:10px}.home-resume span{font-size:11px;color:#6b6b6b}.home-resume h2{font-size:17px;margin:7px 0 4px;overflow-wrap:anywhere}.home-resume p{font-size:12px;color:#6c6c6c}.home-resume .button{flex-shrink:0}
.home-more-problems{margin-top:18px}.home-more-toggle{margin:18px 0 24px;font-size:12px;color:#676767}
.home-preparation{display:grid;grid-template-columns:1fr 1fr;gap:50px;padding:38px 0;border-bottom:1px solid #e3e3e3}.home-preparation h2{font-size:22px;margin:15px 0 12px;line-height:1.6}.home-preparation-intro>p{font-size:13px;color:#757575;max-width:350px}.home-preparation .public-eyebrow{font-size:11px;letter-spacing:2px}
.home-scene-tabs{display:flex;gap:8px;margin-top:22px}.home-scene-tabs button{border:1px solid #dfdfdf;border-radius:6px;min-height:38px;padding:8px 21px;font-size:13px;background:white}.home-scene-tabs button[aria-pressed=true]{background:#e8e8e8;border-color:#a5a5a5;color:#404040}
.home-preparation-list{padding:4px 0}.home-check-item{display:flex;align-items:center;gap:11px;font-size:13px;cursor:pointer;padding:13px 0;border-bottom:1px solid #e8e8e8}.home-check-item input{accent-color:#5d5d5d;width:16px;height:16px;margin:0;flex-shrink:0}.home-check-item>span{flex:1}.home-check-item>svg{color:#5d5d5d}.home-preparation-bottom{margin-top:15px;font-size:11px;color:#797979}.home-stage{display:flex;align-items:center;justify-content:space-between;gap:15px;margin:18px 0;font-size:12px;color:#6b6b6b}.home-stage select{max-width:190px;background:white}.home-preparation-list>.button{width:100%;min-height:42px}
.home-faq{padding:12px 0 28px}.home-faq details{border-bottom:1px solid #e3e3e3}.home-faq summary{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:20px 0;cursor:pointer;font-size:14px;list-style:none}.home-faq summary::-webkit-details-marker{display:none}.home-faq summary>span{font-size:22px;font-weight:300;color:#7d7d7d}.home-faq details[open] summary>span{transform:rotate(45deg)}.home-faq details>p{font-size:13px;color:#6d6d6d;max-width:850px;padding:0 25px 20px 0}.home-faq summary:focus-visible{outline:2px solid #5d5d5d;outline-offset:4px}
.home-help{display:flex;justify-content:space-between;align-items:center;gap:22px;padding:22px 0 30px}.home-help h2{font-size:16px}.home-help p{font-size:12px;color:#757575;margin-top:7px}.home-help a{flex-shrink:0;background:#fff}
@media(max-width:900px){.public-hero{gap:26px}.public-hero h1{font-size:35px}.home-result-preview{padding:21px}.home-result-preview h2{font-size:16px}.desktop-break{display:none}.home-preparation{gap:30px}}
@media(max-width:650px){.public-hero{grid-template-columns:1fr;padding-top:36px;gap:28px}.public-hero h1{font-size:32px}.public-hero-copy>p{font-size:14px}.home-result-preview{padding:20px}.home-result-preview h2{font-size:17px}.home-preview-item{padding:12px 0}.home-resume{align-items:stretch;flex-direction:column;gap:15px;padding:20px;margin-bottom:28px}.home-preparation{grid-template-columns:1fr;gap:22px;padding:28px 0}.home-preparation h2{font-size:20px;margin-top:12px}.home-preparation-intro>p{max-width:none}.home-scene-tabs{margin-top:16px}.home-scene-tabs button{flex:1}.home-more-toggle{margin-bottom:22px}.home-faq summary{font-size:13px;line-height:1.7;padding:17px 0}.home-help{flex-direction:column;align-items:stretch;gap:15px}.home-help a{align-self:flex-start}}
</style>
