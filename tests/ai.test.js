import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeWithModel, recognizeImage, aiStatus } from "../server/ai.js";
test("model adapter validates exact quotes and never returns its API key", async () => {
  const oldFetch = global.fetch;
  const original = {
    key: process.env.SILICONFLOW_API_KEY,
    text: process.env.SILICONFLOW_TEXT_MODEL,
    vision: process.env.SILICONFLOW_VISION_MODEL,
  };
  process.env.SILICONFLOW_API_KEY = "unit-test-placeholder";
  process.env.SILICONFLOW_TEXT_MODEL = "test/text";
  process.env.SILICONFLOW_VISION_MODEL = "test/vision";
  try {
    assert.ok(!JSON.stringify(aiStatus()).includes("unit-test-placeholder"));
    global.fetch = async (url, options) => {
      assert.equal(url, "https://api.siliconflow.cn/v1/chat/completions");
      const body = JSON.parse(options.body);
      assert.equal(body.model, "test/text");
      assert.ok(body.messages[0].content.includes("不可信"));
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  findings: [
                    {
                      title: "待核实",
                      description: "确认押金金额",
                      materialId: "a",
                      quote: "押金2000元",
                    },
                    {
                      title: "编造",
                      description: "无依据",
                      materialId: "a",
                      quote: "不在原文里",
                    },
                  ],
                }),
              },
            },
          ],
        }),
      );
    };
    const result = await analyzeWithModel({ scene: "rental", context: {} }, [
      { id: "a", name: "合同", text: "合同押金2000元。" },
    ]);
    assert.equal(result.findings.length, 1);
    assert.equal(result.rejectedCount, 1);
    assert.equal(result.coverage.materialCount, 1);
    assert.equal(result.sourceFingerprint.length, 64);
    await assert.rejects(() => analyzeWithModel({scene:'rental'}, [{id:'a',name:'超长材料',text:'文'.repeat(16001)}]), /16000/);
    global.fetch = async (url, options) => {
      const body = JSON.parse(options.body);
      assert.equal(body.model, "test/vision");
      assert.ok(
        body.messages[1].content[1].image_url.url.startsWith(
          "data:image/png;base64,",
        ),
      );
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: "识别文字，待人工核对" } }],
        }),
      );
    };
    assert.equal(
      await recognizeImage(Buffer.from("test"), "image/png"),
      "识别文字，待人工核对",
    );
    global.fetch = async () => new Response("", { status: 401 });
    await assert.rejects(
      () => recognizeImage(Buffer.from("test"), "image/png"),
      /401/,
    );
  } finally {
    global.fetch = oldFetch;
    for (const [field, value] of Object.entries({
      SILICONFLOW_API_KEY: original.key,
      SILICONFLOW_TEXT_MODEL: original.text,
      SILICONFLOW_VISION_MODEL: original.vision,
    })) {
      if (value === undefined) delete process.env[field];
      else process.env[field] = value;
    }
  }
});
