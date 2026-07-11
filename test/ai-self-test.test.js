import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Store } from "../server/store.js";
import { AiService } from "../server/ai.js";

function fixture() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "digital-circuit-ai-self-test-"));
  const store = new Store(dataDir);
  return { store, cleanup: () => fs.rmSync(dataDir, { recursive: true, force: true }) };
}

test("AI self-test normalizes, validates and orders generated questions", async () => {
  const { store, cleanup } = fixture();
  try {
    store.saveAiConfig({ apiKey: "test-key", model: "test-model" });
    const ai = new AiService(store);
    ai.model = () => ({
      async invoke() {
        return {
          content: JSON.stringify({
            questions: [
              {
                title: "简答",
                type: "analysis",
                text: "说明德摩根定律在逻辑化简中的作用。",
                options: [],
                answer: null,
                answerText: "德摩根定律用于在与、或运算之间转换并对变量取反。",
                explanation: "应用两条德摩根公式即可完成转换。",
                knowledge: ["德摩根定律"],
                keywords: ["与或转换", "变量取反", "逻辑化简"],
                difficulty: 3,
                scope: "basic-logic"
              },
              {
                title: "选择",
                type: "single_choice",
                text: "(A+B)' 等价于什么？",
                options: ["A'+B'", "A'·B'", "A+B", "A·B"],
                answer: "B",
                explanation: "和取反等于各变量取反后相与。",
                knowledge: ["德摩根定律"],
                keywords: [],
                difficulty: 2,
                scope: "basic-logic"
              }
            ]
          })
        };
      }
    });

    const questions = await ai.generateSelfTest({
      scope: "basic-logic",
      count: 2,
      weakKnowledge: [{ name: "德摩根定律", wrongCount: 2 }],
      focusKnowledge: ["德摩根定律"],
      targetKnowledgePlan: ["德摩根定律", "德摩根定律"],
      availableKnowledge: ["德摩根定律"],
      wrongQuestions: []
    });

    assert.equal(questions.length, 2);
    assert.equal(questions[0].type, "single_choice");
    assert.equal(questions[0].answer, 1);
    assert.equal(questions[0].answerText, "B. A'·B'");
    assert.equal(questions[1].type, "analysis");
    assert.ok(questions[1].keywords.length >= 2);
    assert.ok(questions.every((question) => question.generatedSelfTest));
    assert.ok(questions.every((question) => question.id.startsWith("ai-selftest-")));
  } finally {
    cleanup();
  }
});

test("AI self-test reports missing configuration without a local fallback", async () => {
  const { store, cleanup } = fixture();
  try {
    const ai = new AiService(store);
    await assert.rejects(
      () => ai.generateSelfTest({ scope: "all", count: 5, weakKnowledge: [], focusKnowledge: [] }),
      (error) => error.status === 503 && error.code === "AI_NOT_CONFIGURED"
    );
  } finally {
    cleanup();
  }
});
