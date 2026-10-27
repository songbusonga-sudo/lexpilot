import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createSessionFetch } from './session-fetch.mjs';
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 1080 },
  deviceScaleFactor: 1,
});
const errors = [];
const fetch = createSessionFetch(page.context());
page.on("pageerror", (e) => errors.push(e.message));
let testId;
const request = async (path, options) => {
  const r = await fetch("http://127.0.0.1:8266/api" + path, options);
  const d = await r.json();
  assert.ok(r.ok, JSON.stringify(d));
  return d;
};
const shot = async (name) =>
  page.screenshot({
    path: "artifacts/" + name,
    fullPage: true,
    animations: "disabled",
  });
try {
  fs.mkdirSync("artifacts", { recursive: true });
  await page.goto("http://127.0.0.1:5267/#dashboard");
  await page.getByRole("button", { name: "租房案例", exact: true }).waitFor();
  assert.equal(
    await page.evaluate(() => getComputedStyle(document.body).color),
    "rgb(23, 23, 23)",
  );
  await shot("v2-dashboard-desktop.png");
  await page.getByRole("button", { name: "租房案例", exact: true }).click();
  await page
    .getByRole("heading", { name: "梧桐公寓 · 退租押金核对" })
    .waitFor();
  await shot("v2-case-desktop.png");
  await page.getByRole("tab", { name: "事实核对", exact: true }).click();
  await page.getByRole("button", { name: "定位原文" }).first().click();
  await page.getByRole("heading", { name: "房屋租赁合同.txt" }).waitFor();
  assert.ok(
    (await page.locator(".material-transcript mark").innerText()).includes(
      "押金",
    ),
  );
  await shot("v2-citation-desktop.png");
  await page.getByRole("button", { name: "关闭材料" }).click();
  await page.getByRole("button", { name: "返回我的记录" }).click();
  await page.getByRole("button", { name: "新建事项", exact: true }).click();
  const title = "界面流程验证-" + Date.now();
  await page.getByPlaceholder("例如：梧桐公寓退租押金核对").fill(title);
  await page.getByRole("button", { name: "创建事项", exact: true }).click();
  await page.getByRole("heading", { name: title }).waitFor();
  testId = page.url().split("case/")[1];
  const png = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 500;
    canvas.height = 320;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#eee";
    ctx.fillRect(0, 0, 500, 320);
    ctx.strokeStyle = "#555";
    ctx.strokeRect(40, 40, 420, 240);
    ctx.fillStyle = "#333";
    ctx.font = "22px sans-serif";
    ctx.fillText("测试用模拟房间照片", 120, 155);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  const uploaded = page.waitForResponse(
    (r) => r.url().includes("/materials") && r.request().method() === "POST",
  );
  await page.locator("input[type=file]").setInputFiles([
    {
      name: "租赁合同.txt",
      mimeType: "text/plain",
      buffer: Buffer.from(
        "2026年7月1日，押金1000.01元。墙面损坏维修扣款应核实。",
      ),
    },
    {
      name: "入住照片.png",
      mimeType: "image/png",
      buffer: Buffer.from(png, "base64"),
    },
    {
      name: "退租照片.png",
      mimeType: "image/png",
      buffer: Buffer.from(png, "base64"),
    },
  ]);
  assert.equal((await uploaded).status(), 201);
  await page.getByRole("tab", { name: /材料档案/ }).click();
  await page.getByRole("button", { name: "租赁合同.txt", exact: true }).click();
  await page
    .getByRole("button", { name: "编辑与核对", exact: true })
    .last()
    .click();
  await page.getByLabel("材料类型", { exact: true }).selectOption("合同协议");
  await page.getByLabel("材料 / 事件日期", { exact: true }).fill("2026-07-01");
  await page.getByText("已核对原始材料中的事件日期").click();
  await page.getByRole("button", { name: "保存核对结果", exact: true }).click();
  await page.locator(".material-drawer").waitFor({ state: "hidden" });
  await page.getByRole("tab", { name: /争议清单/ }).click();
  await page
    .getByRole("button", { name: "添加争议项目", exact: true })
    .first()
    .click();
  await page.getByLabel("项目名称", { exact: true }).fill("墙面维修扣款");
  await page.getByLabel("涉及金额（元）", { exact: true }).fill("80.15");
  await page.getByLabel("核对状态", { exact: true }).selectOption("有争议");
  await page
    .getByLabel("对方主张", { exact: true })
    .fill("对方要求扣款80.15元");
  await page
    .getByLabel("我的说明", { exact: true })
    .fill("原有旧痕需要对照照片");
  await page
    .getByLabel("待核实 / 需要补充", { exact: true })
    .fill("请提供维修凭证");
  await page.locator(".dialog .evidence-picker label").first().click();
  await page.getByRole("button", { name: "保存项目", exact: true }).click();
  await page.locator(".wide-dialog").waitFor({ state: "hidden" });
  await page.getByRole("tab", { name: "押金结算", exact: true }).click();
  await page.getByRole("textbox", { name: "押金实付金额" }).fill("1000.01");
  await page.getByRole("textbox", { name: "已退款金额" }).fill("0.20");
  await page
    .locator(".settlement-form .evidence-picker")
    .first()
    .locator("label")
    .first()
    .click();
  await page.getByRole("button", { name: "保存结算记录" }).click();
  await page.waitForFunction(() =>
    document
      .querySelectorAll(".settlement-summary strong")[3]
      ?.textContent.includes("999.81"),
  );
  await page.getByRole("tab", { name: /争议清单/ }).click();
  await page.getByRole("button", { name: "编辑", exact: true }).click();
  await page.getByLabel("核对状态", { exact: true }).selectOption("双方确认");
  await page.getByRole("button", { name: "保存项目", exact: true }).click();
  await page.locator(".wide-dialog").waitFor({ state: "hidden" });
  await page.getByRole("tab", { name: "押金结算", exact: true }).click();
  await page.waitForFunction(() =>
    document
      .querySelectorAll(".settlement-summary strong")[3]
      ?.textContent.includes("919.66"),
  );
  const csv = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出结算表" }).click();
  assert.ok((await csv).suggestedFilename().endsWith(".csv"));
  await shot("v2-settlement-desktop.png");
  await page.getByRole("tab", { name: "事实核对", exact: true }).click();
  await page.getByRole("button", { name: "提取金额与日期" }).click();
  await page.getByRole("button", { name: "编辑事实" }).first().waitFor();
  await page.getByRole("button", { name: "编辑事实" }).first().click();
  await page.getByLabel("信息状态", { exact: true }).selectOption("材料记载");
  await page.getByRole("button", { name: "保存核对结果", exact: true }).click();
  await page.locator(".dialog").waitFor({ state: "hidden" });
  await page.getByRole("tab", { name: "照片对照", exact: true }).click();
  const ms = (await request("/cases/" + testId)).materials;
  await page
    .getByLabel("选择入住照片")
    .selectOption(ms.find((m) => m.name === "入住照片.png").id);
  await page
    .getByLabel("选择退租照片")
    .selectOption(ms.find((m) => m.name === "退租照片.png").id);
  assert.equal(await page.locator(".photo-display img").count(), 2);
  await page.getByRole("tab", { name: "行动材料", exact: true }).click();
  await page.getByRole("button", { name: "生成草稿", exact: true }).click();
  await page.locator(".draft-editor").waitFor();
  assert.ok(
    (await page.locator(".draft-editor").inputValue()).includes("维修凭证"),
  );
  await page
    .locator(".draft-editor")
    .fill("手工修订的协商草稿，需核对后使用。");
  await page.getByRole("button", { name: "保存草稿", exact: true }).click();
  await page.getByRole("button", { name: "证据材料目录", exact: true }).click();
  await page.getByRole("button", { name: "生成草稿", exact: true }).click();
  await page.locator(".draft-editor").waitFor();
  assert.ok(
    (await page.locator(".draft-editor").inputValue()).includes(
      "关联争议：墙面维修扣款",
    ),
  );
  await page.getByRole("button", { name: "协商沟通说明", exact: true }).click();
  assert.equal(
    await page.locator(".draft-editor").inputValue(),
    "手工修订的协商草稿，需核对后使用。",
  );
  const txt = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出 TXT" }).click();
  assert.ok((await txt).suggestedFilename().endsWith(".txt"));
  await page.reload();
  await page.getByRole("heading", { name: title }).waitFor();
  await page.getByRole("tab", { name: "实际情况", exact: true }).click();
  await page
    .getByLabel("希望解决的问题", { exact: true })
    .fill("核对维修费用与退款时间");
  await page.getByRole("button", { name: "保存实际情况" }).click();
  await page.getByRole("button", { name: "事项信息", exact: true }).click();
  await page
    .getByLabel("当前阶段", { exact: true })
    .selectOption("已经发生问题");
  await page.getByRole("button", { name: "保存修改", exact: true }).click();
  await page.locator(".dialog").waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "归档事项", exact: true }).click();
  await page.getByRole("button", { name: "恢复事项", exact: true }).waitFor();
  await page.getByRole("button", { name: "恢复事项", exact: true }).click();
  await page.getByRole("button", { name: "归档事项", exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(250);
  for (const name of [
    "事项概览",
    "材料档案",
    "事实核对",
    "争议清单",
    "押金结算",
    "照片对照",
    "时间线",
    "行动材料",
    "实际情况",
  ]) {
    await page.getByRole("tab", { name: new RegExp(name) }).click();
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "mobile overflow on " + name,
    );
  }
  await page.getByRole("tab", { name: /争议清单/ }).click();
  await shot("v2-disputes-mobile.png");
  assert.deepEqual(errors, []);
  console.log(
    "PASS: new UI, exact citations, create/upload/classify, disputes/evidence, cent-accurate settlement, fact confirmation, photo comparison, independent drafts/downloads, persistence, context, edit/archive/restore and all mobile tabs.",
  );
} finally {
  if (testId)
    await request("/cases/" + testId, { method: "DELETE" }).catch(() => {});
  await page.goto("http://127.0.0.1:5267/#dashboard");
  await page.reload();
  await page.getByRole("button", { name: "租房案例", exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(250);
  await shot("v2-dashboard-mobile.png");
  await browser.close();
}
