import express from "express";
import multer from "multer";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { analyze, makeAction, scenarios } from "./domain.js";
import {
  moneyToCents,
  settlementFor,
  validateDispute,
  extractCandidates,
  factStatuses,
  sourceFingerprint,
} from "./workflow.js";
import { aiStatus, analyzeWithModel, recognizeImage } from "./ai.js";
import { registerExtensions } from './extensions.js';
import { nextActions, workSummary } from './progress.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "data");
fs.mkdirSync(path.join(dataDir, "uploads"), { recursive: true });
const db = new DatabaseSync(path.join(dataDir, "qingdun.sqlite"));
db.exec(
  `CREATE TABLE IF NOT EXISTS cases (id TEXT PRIMARY KEY, body TEXT NOT NULL); CREATE TABLE IF NOT EXISTS materials (id TEXT PRIMARY KEY, case_id TEXT NOT NULL, body TEXT NOT NULL); CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);`,
);
const saveCase = (c) => {
  c.updatedAt = new Date().toISOString();
  db.prepare(
    "INSERT INTO cases VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET body=excluded.body",
  ).run(c.id, JSON.stringify(c));
};
const saveMaterial = (m) =>
  db
    .prepare("INSERT OR REPLACE INTO materials VALUES (?, ?, ?)")
    .run(m.id, m.caseId, JSON.stringify(m));
const getCase = (id) => {
  const row = db.prepare("SELECT body FROM cases WHERE id=?").get(id);
  return row ? JSON.parse(row.body) : null;
};
const getMaterials = (id) =>
  db
    .prepare("SELECT body FROM materials WHERE case_id=? ORDER BY rowid")
    .all(id)
    .map((r) => JSON.parse(r.body));
if (
  !db.prepare("SELECT key FROM meta WHERE key='initialized'").get() &&
  !db.prepare("SELECT id FROM cases LIMIT 1").get()
) {
  const seeds = [
    {
      id: "demo-rental",
      scene: "rental",
      title: "梧桐公寓 · 退租押金核对",
      stage: "已经发生问题",
      date: "2026-10-26",
      location: "广西 · 南宁",
      deposit: 2000,
      deduction: 800,
      demo: true,
      tasks: [
        { text: "补充押金付款凭证", done: true },
        { text: "请房东提供扣款明细和维修凭证", done: false },
        { text: "核对入住与退租照片的拍摄时间", done: false },
      ],
    },
    {
      id: "demo-parttime",
      scene: "parttime",
      title: "周末活动兼职 · 薪酬约定核对",
      stage: "准备签约",
      date: "2026-10-25",
      location: "线上招聘",
      demo: true,
      tasks: [
        { text: "书面确认保底报酬与绩效条件", done: false },
        { text: "核实招聘主体及实际工作安排", done: false },
      ],
    },
    {
      id: "demo-internship",
      scene: "internship",
      title: "暑期实习 · 协议签约检查",
      stage: "准备签约",
      date: "2026-10-24",
      location: "学校推荐",
      demo: true,
      tasks: [
        { text: "向企业确认保险购买主体", done: false },
        { text: "向学校核实实习安排", done: false },
      ],
    },
  ];
  seeds.forEach(saveCase);
  const demoMaterials = [
    [
      "demo-rental",
      "房屋租赁合同.txt",
      "合同协议",
      "2026-07-01",
      "第四条：租赁押金为人民币2000元。租赁期满，房东验收后视情况扣除相关费用，退还剩余押金。\n第五条：房屋损坏的维修责任由双方根据实际情况协商确定。",
      "合同记载",
    ],
    [
      "demo-rental",
      "入住交接记录.txt",
      "交接记录",
      "2026-07-01",
      "入住交接记录：卧室东侧墙面有少量旧痕，桌角有磨损。该记录为模拟文字材料，未附真实照片，不能代替双方签认或原始照片。",
      "材料记载",
    ],
    [
      "demo-rental",
      "押金付款记录.txt",
      "付款凭证",
      "2026-07-01",
      "模拟付款记录：2026年7月1日，租客向出租方转账2000元，备注租房押金。仅用于功能演示。",
      "材料记载",
    ],
    [
      "demo-rental",
      "退租沟通记录.txt",
      "聊天记录",
      "2026-10-24",
      "房东：墙面需要重新处理，押金扣款800元。\n租客：入住时墙面已有旧痕，请提供扣款明细和维修费用凭证。\n目前尚未提供维修凭证，损伤原因及扣款合理性待核实。",
      "双方主张",
    ],
    [
      "demo-parttime",
      "招聘广告.txt",
      "招聘信息",
      "2026-10-23",
      "周末活动协助，日薪200元，每天工作8小时。工作地点与结算方式面议。",
      "材料记载",
    ],
    [
      "demo-parttime",
      "招聘沟通.txt",
      "聊天记录",
      "2026-10-24",
      "招聘方：200元包含最高绩效，实际报酬按公司规定结算。\n求职者：请问保底金额是多少？\n该问题尚未得到明确回复。",
      "双方主张",
    ],
    [
      "demo-internship",
      "实习协议.txt",
      "合同协议",
      "2026-10-24",
      "实习期间的报酬为每月1800元。实习生应自行注意人身安全，保险安排另行通知。提前退出需与企业协商，具体通知期限未作约定。",
      "合同记载",
    ],
  ];
  for (const [caseId, name, type, date, text, source] of demoMaterials)
    saveMaterial({
      id: randomUUID(),
      caseId,
      name,
      type,
      date,
      text,
      source,
      status: "已整理",
      demo: true,
    });
}
db.prepare("INSERT OR IGNORE INTO meta VALUES ('initialized','true')").run();
// Add workflow fields in place; existing material files and user edits are retained.
for (const row of db.prepare("SELECT body FROM cases").all()) {
  const c = JSON.parse(row.body);
  if (c.workflowVersion) continue;
  const materials = getMaterials(c.id);
  c.disputes ||= [];
  if (c.id === "demo-rental" && !c.disputes.length) {
    c.disputes = [
      {
        id: randomUUID(),
        title: "墙面维修扣款",
        otherClaim: "房东提出墙面需要处理，扣除押金800元。",
        myStatement: "入住交接记录记载墙面已有旧痕，损伤原因需要核对。",
        missing: "维修项目与费用凭证；入住、退租原始照片；双方签认的交接记录。",
        status: "有争议",
        amountCents: 80000,
        materialIds: materials
          .filter((m) => /合同|交接|沟通/.test(m.name))
          .map((m) => m.id),
      },
      {
        id: randomUUID(),
        title: "押金退还时间",
        otherClaim: "尚未明确剩余押金的退还时间。",
        myStatement: "希望确认退款日期与结算明细。",
        missing: "书面结算确认与约定退款日期。",
        status: "待核实",
        amountCents: null,
        materialIds: materials
          .filter((m) => /合同|付款/.test(m.name))
          .map((m) => m.id),
      },
    ];
  }
  c.facts ||= [];
  c.settlement ||= {
    depositCents: c.deposit === undefined ? null : moneyToCents(c.deposit),
    refundedCents: 0,
    depositMaterialIds: materials
      .filter((m) => /付款/.test(m.name))
      .map((m) => m.id),
    refundMaterialIds: [],
  };
  c.context ||= {};
  c.archived = !!c.archived;
  c.workflowVersion = 2;
  saveCase(c);
}
function detail(c) {
  const materials = getMaterials(c.id);
  const validAi = (c.aiAnalysis?.findings || []).filter((f) =>
    materials.some((m) => m.id === f.materialId && m.text?.includes(f.quote)),
  );
  return {
    ...c,
    materials,
    findings: [...analyze(materials, c.scene), ...validAi],
    settlementSummary: settlementFor(c),
    sourceFingerprint: sourceFingerprint(c, materials),
    nextActions: nextActions(c, materials),
    workSummary: workSummary(c),
  };
}
for (const row of db.prepare("SELECT body FROM cases").all()) {
  const c = JSON.parse(row.body);
  if (
    c.id === "demo-rental" &&
    c.disputes.some(
      (d) => d.title === "押金退还时间" && d.monetary === undefined,
    )
  ) {
    c.disputes = c.disputes.map((d) =>
      d.title === "押金退还时间" ? { ...d, monetary: false } : d,
    );
    saveCase(c);
  }
}
const app = express();
app.use("/api", (req, res, next) => {
  const h = req.hostname;
  if (!["127.0.0.1", "localhost", "[::1]"].includes(h))
    return res.status(403).json({ error: "本地版本仅供本机访问" });
  next();
});
app.use("/api", (req, res, next) => {
  const origin = req.get("origin");
  if (
    origin &&
    ![
      "http://127.0.0.1:5267",
      "http://localhost:5267",
      "http://127.0.0.1:8266",
      "http://localhost:8266",
    ].includes(origin)
  )
    return res.status(403).json({ error: "不允许来自其他站点的请求" });
  next();
});
app.get("/api/health", (req, res) =>
  res.json({ ok: true, mode: "local", analysis: "rules" }),
);
app.use('/api/restore', express.json({limit:'120mb'}));
app.use(express.json({limit:'2mb'}));
app.get("/api/settings", (req, res) => res.json(aiStatus()));
app.get("/api/cases", (req, res) =>
  res.json(
    db
      .prepare("SELECT body FROM cases ORDER BY rowid")
      .all()
      .map((r) => {
        const c = JSON.parse(r.body);
        const materials = getMaterials(c.id);
        return {
          ...c,
          materialCount: materials.length,
          riskCount: analyze(materials, c.scene).length,
          nextActions: nextActions(c, materials),
        };
      }),
  ),
);
app.post("/api/cases", (req, res) => {
  const { title, scene, stage } = req.body;
  if (
    typeof title !== "string" ||
    !title.trim() ||
    title.length > 100 ||
    !Object.hasOwn(scenarios, scene) ||
    !["准备签约", "正在履行", "已经发生问题"].includes(stage)
  )
    return res.status(400).json({ error: "请填写有效的事项名称、场景与阶段" });
  const c = {
    id: randomUUID(),
    title: title.trim(),
    scene,
    stage,
    date: new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Shanghai" }),
    location: String(req.body.location || "").slice(0, 100),
    demo: false,
    archived: false,
    workflowVersion: 2,
    disputes: [],
    facts: [],
    context: {},
    settlement: {
      depositCents: null,
      refundedCents: 0,
      depositMaterialIds: [],
      refundMaterialIds: [],
    },
    tasks: [
      { text: "上传并核对相关材料", done: false },
      { text: "确认事项中的时间、金额和实际情况", done: false },
    ],
  };
  saveCase(c);
  res.status(201).json(c);
});
app.use("/api/cases/:id", (req, res, next) => {
  req.case = getCase(req.params.id);
  if (!req.case) return res.status(404).json({ error: "事项不存在" });
  next();
});
app.get("/api/cases/:id", (req, res) => res.json(detail(req.case)));
app.patch("/api/cases/:id", (req, res) => {
  const c = req.case;
  if (Array.isArray(req.body.tasks))
    c.tasks = req.body.tasks
      .slice(0, 30)
      .map((t) => ({ text: String(t.text).slice(0, 300), done: !!t.done }));
  if (typeof req.body.draft === "string") {
    c.draft = req.body.draft.slice(0, 30000);
    c.draftKind = ["communication", "questions", "evidence"].includes(
      req.body.draftKind,
    )
      ? req.body.draftKind
      : c.draftKind || "communication";
    c.drafts ||= {};
    c.drafts[c.draftKind] = {
      text: c.draft,
      at: new Date().toISOString(),
      sourceFingerprint: sourceFingerprint(c, getMaterials(c.id)),
    };
  }
  if (typeof req.body.title === "string") {
    if (!req.body.title.trim() || req.body.title.length > 100)
      return res.status(400).json({ error: "事项名称不能为空且最多100字" });
    c.title = req.body.title.trim();
  }
  if (typeof req.body.stage === "string") {
    if (!["准备签约", "正在履行", "已经发生问题"].includes(req.body.stage))
      return res.status(400).json({ error: "事项阶段无效" });
    c.stage = req.body.stage;
  }
  if (typeof req.body.location === "string")
    c.location = req.body.location.slice(0, 100);
  if (typeof req.body.archived === "boolean") c.archived = req.body.archived;
  if (req.body.context && typeof req.body.context === "object") {
    c.context = Object.fromEntries(
      [
        "studentStatus",
        "schoolArrangement",
        "management",
        "payAgreement",
        "insurance",
        "goal",
      ].map((key) => [key, String(req.body.context[key] || "").slice(0, 1500)]),
    );
  }
  saveCase(c);
  res.json(c);
});
app.delete("/api/cases/:id", (req, res) => {
  for (const m of getMaterials(req.case.id))
    if (m.file)
      fs.rmSync(path.join(dataDir, "uploads", m.file), { force: true });
  db.prepare("DELETE FROM materials WHERE case_id=?").run(req.case.id);
  db.prepare("DELETE FROM cases WHERE id=?").run(req.case.id);
  res.json({ ok: true });
});
app.post("/api/cases/:id/disputes", (req, res) => {
  const c = req.case;
  const d = validateDispute({ ...req.body, id: undefined }, getMaterials(c.id));
  c.disputes.push(d);
  saveCase(c);
  res.status(201).json(detail(c));
});
app.put("/api/cases/:id/disputes/:did", (req, res) => {
  const c = req.case;
  const index = c.disputes.findIndex((d) => d.id === req.params.did);
  if (index < 0) return res.status(404).json({ error: "争议项目不存在" });
  c.disputes[index] = validateDispute(
    { ...req.body, id: req.params.did },
    getMaterials(c.id),
  );
  saveCase(c);
  res.json(detail(c));
});
app.delete("/api/cases/:id/disputes/:did", (req, res) => {
  const c = req.case;
  c.disputes = c.disputes.filter((d) => d.id !== req.params.did);
  saveCase(c);
  res.json(detail(c));
});
app.put("/api/cases/:id/settlement", (req, res) => {
  const c = req.case;
  const materials = getMaterials(c.id);
  const allowed = new Set(materials.map((m) => m.id));
  const depositMaterialIds = [...new Set(req.body.depositMaterialIds || [])],
    refundMaterialIds = [...new Set(req.body.refundMaterialIds || [])];
  if (
    [...depositMaterialIds, ...refundMaterialIds].some((id) => !allowed.has(id))
  )
    return res.status(400).json({ error: "关联凭证不属于当前事项" });
  c.settlement = {
    depositCents: moneyToCents(req.body.deposit),
    refundedCents: moneyToCents(req.body.refunded, false),
    depositMaterialIds,
    refundMaterialIds,
  };
  saveCase(c);
  res.json(detail(c));
});
app.post("/api/cases/:id/facts/extract", (req, res) => {
  const c = req.case;
  const candidates = extractCandidates(getMaterials(c.id), c.facts);
  c.facts.push(...candidates);
  saveCase(c);
  res.json({ ...detail(c), addedCount: candidates.length });
});
app.patch("/api/cases/:id/facts/:fid", (req, res) => {
  const c = req.case;
  const f = c.facts.find((f) => f.id === req.params.fid);
  if (!f) return res.status(404).json({ error: "事实记录不存在" });
  if (
    !factStatuses.includes(req.body.status) ||
    typeof req.body.text !== "string" ||
    !req.body.text.trim()
  )
    return res.status(400).json({ error: "请填写事实说明并选择状态" });
  f.text = req.body.text.slice(0, 1500);
  f.status = req.body.status;
  saveCase(c);
  res.json(detail(c));
});
app.delete("/api/cases/:id/facts/:fid", (req, res) => {
  const c = req.case;
  c.facts = c.facts.filter((f) => f.id !== req.params.fid);
  saveCase(c);
  res.json(detail(c));
});
app.post("/api/cases/:id/analysis", async (req, res, next) => {
  try {
    if (req.body.consent !== true)
      return res
        .status(400)
        .json({ error: "请先确认将材料文字发送至硅基流动进行分析" });
    const snapshot = req.case;
    const result = await analyzeWithModel(snapshot, getMaterials(snapshot.id));
    const current = getCase(snapshot.id);
    if (!current) return res.status(404).json({ error: "事项已被删除" });
    current.aiAnalysis = result;
    saveCase(current);
    res.json(detail(current));
  } catch (e) {
    next(e);
  }
});
const upload = multer({
  dest: path.join(dataDir, "uploads"),
  limits: { fileSize: 20 * 1024 * 1024, files: 10 },
  fileFilter: (req, file, cb) =>
    cb(null, /\.(txt|md|pdf|png|jpe?g|webp)$/i.test(file.originalname)),
});
app.post(
  "/api/cases/:id/materials",
  upload.array("files", 10),
  async (req, res, next) => {
    try {
      if (!req.files?.length)
        return res
          .status(400)
          .json({ error: "请选择 TXT、MD、PDF 或图片文件" });
      for (const file of req.files) {
        const signature = fs.readFileSync(file.path).subarray(0, 1024);
        if (/\.(png|jpe?g|webp)$/i.test(file.originalname)) {
          if (
            signature
              .subarray(0, 8)
              .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          )
            file.safeMime = "image/png";
          else if (
            signature[0] === 255 &&
            signature[1] === 216 &&
            signature[2] === 255
          )
            file.safeMime = "image/jpeg";
          else if (
            signature.toString("ascii", 0, 4) === "RIFF" &&
            signature.toString("ascii", 8, 12) === "WEBP"
          )
            file.safeMime = "image/webp";
          else
            throw Error(
              "图片内容与支持格式不符，请选择有效的PNG、JPEG或WEBP图片",
            );
        } else if (/\.pdf$/i.test(file.originalname)) {
          if (!signature.includes(Buffer.from("%PDF-")))
            throw Error("文件不是有效的PDF");
          file.safeMime = "application/pdf";
        } else file.safeMime = "text/plain";
      }
      const result = [];
      for (const file of req.files) {
        let content = "";
        let status = "待人工核对";
        if (/\.(txt|md)$/i.test(file.originalname)) {
          content = fs.readFileSync(file.path, "utf8").slice(0, 150000);
          status = "已提取文本";
        }
        if (/\.pdf$/i.test(file.originalname)) {
          try {
            const { PDFParse } = await import("pdf-parse");
            const parser = new PDFParse({
              data: new Uint8Array(fs.readFileSync(file.path)),
            });
            try {
              content = (await parser.getText()).text.slice(0, 150000);
              status = content.trim() ? "已提取文本" : "待人工核对";
            } finally {
              await parser.destroy();
            }
          } catch {
            status = "待人工核对";
          }
        }
        const name = Buffer.from(file.originalname, "latin1").toString("utf8");
        const suggestedType = file.safeMime.startsWith("image/")
          ? "照片图片"
          : /合同|协议/.test(name)
            ? "合同协议"
            : /付款|转账|收款|支付/.test(name)
              ? "付款凭证"
              : /聊天|沟通/.test(name)
                ? "聊天记录"
                : /交接/.test(name)
                  ? "交接记录"
                  : /招聘|广告/.test(name)
                    ? "招聘信息"
                    : /工时|考勤/.test(name)
                      ? "工时考勤"
                      : "待分类材料";
        const m = {
          id: randomUUID(),
          caseId: req.case.id,
          name,
          type: suggestedType,
          date: new Date().toLocaleDateString("sv-SE", {
            timeZone: "Asia/Shanghai",
          }),
          dateConfirmed: false,
          room: "未分类",
          phase: "未标记",
          caption: "",
          text: content,
          status,
          source: "用户上传",
          file: file.filename,
          mime: file.safeMime,
        };
        saveMaterial(m);
        result.push(m);
      }
      res.status(201).json(result);
    } catch (error) {
      for (const file of req.files || []) fs.rmSync(file.path, { force: true });
      next(error);
    }
  },
);
app.patch("/api/cases/:id/materials/:mid", (req, res) => {
  const m = getMaterials(req.case.id).find((m) => m.id === req.params.mid);
  if (!m) return res.status(404).json({ error: "材料不存在" });
  if (typeof req.body.text === "string")
    m.text = req.body.text.slice(0, 150000);
  if (typeof req.body.type === "string") m.type = req.body.type.slice(0, 30);
  if (
    typeof req.body.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(req.body.date) &&
    !Number.isNaN(Date.parse(req.body.date))
  )
    m.date = req.body.date;
  if (typeof req.body.dateConfirmed === "boolean")
    m.dateConfirmed = req.body.dateConfirmed;
  for (const field of ["room", "phase", "caption", "source"])
    if (typeof req.body[field] === "string")
      m[field] = req.body[field].slice(0, field === "caption" ? 1500 : 50);
  m.status = "已人工核对";
  saveMaterial(m);
  res.json(m);
});
app.delete("/api/cases/:id/materials/:mid", (req, res) => {
  const m = getMaterials(req.case.id).find((m) => m.id === req.params.mid);
  if (!m) return res.status(404).json({ error: "材料不存在" });
  if (m.file) fs.rmSync(path.join(dataDir, "uploads", m.file), { force: true });
  db.prepare("DELETE FROM materials WHERE id=? AND case_id=?").run(
    m.id,
    req.case.id,
  );
  const c = req.case;
  c.disputes = c.disputes.map((d) => ({
    ...d,
    materialIds: d.materialIds.filter((id) => id !== m.id),
  }));
  c.facts = c.facts.filter((f) => f.materialId !== m.id);
  for (const row of [...(c.events || []), ...(c.worklogs || []), ...Object.values(c.checklist || {})])
    row.materialIds = (row.materialIds || []).filter(id => id !== m.id);
  c.settlement.depositMaterialIds = c.settlement.depositMaterialIds.filter(
    (id) => id !== m.id,
  );
  c.settlement.refundMaterialIds = c.settlement.refundMaterialIds.filter(
    (id) => id !== m.id,
  );
  if (c.aiAnalysis)
    c.aiAnalysis.findings = c.aiAnalysis.findings.filter(
      (f) => f.materialId !== m.id,
    );
  saveCase(c);
  res.json({ ok: true });
});
app.get("/api/cases/:id/materials/:mid/file", (req, res) => {
  const m = getMaterials(req.case.id).find((m) => m.id === req.params.mid);
  if (!m?.file) return res.status(404).json({ error: "无原始文件" });
  res.type(m.mime).sendFile(path.join(dataDir, "uploads", m.file));
});
app.post("/api/cases/:id/materials/:mid/ocr", async (req, res, next) => {
  try {
    if (req.body.consent !== true)
      return res
        .status(400)
        .json({ error: "请先确认将此图片发送至硅基流动识别" });
    const m = getMaterials(req.case.id).find((m) => m.id === req.params.mid);
    if (!m?.file || !["image/png", "image/jpeg", "image/webp"].includes(m.mime))
      return res
        .status(400)
        .json({ error: "仅支持已上传的PNG、JPEG、WEBP图片" });
    const text = await recognizeImage(
      fs.readFileSync(path.join(dataDir, "uploads", m.file)),
      m.mime,
    );
    res.json({ text, status: "待人工核对" });
  } catch (e) {
    next(e);
  }
});
app.post("/api/cases/:id/draft", (req, res) => {
  const c = req.case;
  const materials = getMaterials(c.id);
  c.draftKind = ["communication", "questions", "evidence"].includes(
    req.body?.kind,
  )
    ? req.body.kind
    : "communication";
  c.draft = makeAction(c, materials, c.draftKind);
  c.draftAt = new Date().toISOString();
  c.drafts ||= {};
  c.drafts[c.draftKind] = {
    text: c.draft,
    at: c.draftAt,
    sourceFingerprint: sourceFingerprint(c, materials),
  };
  saveCase(c);
  res.json({ draft: c.draft });
});
registerExtensions(app, { db, dataDir, getCase, getMaterials, saveCase, saveMaterial, detail });
app.use(express.static(path.join(root, "dist")));
app.get("/{*path}", (req, res) => {
  if (req.path.startsWith("/api"))
    return res.status(404).json({ error: "接口不存在" });
  if (fs.existsSync(path.join(root, "dist/index.html")))
    res.sendFile(path.join(root, "dist/index.html"));
  else res.status(404).send("请使用前端开发地址 http://127.0.0.1:5267");
});
app.use((err, req, res, next) => {
  console.error(err.message);
  res
    .status(err.status || 400)
    .json({
      error:
        err.code === "LIMIT_FILE_SIZE"
          ? "每个文件不能超过20MB"
          : err.name === "TimeoutError"
            ? "模型响应超时，请稍后重试"
            : err.message || "处理失败，请检查后重试",
    });
});
app.listen(8266, "127.0.0.1", () =>
  console.log("青盾 API：http://127.0.0.1:8266"),
);
