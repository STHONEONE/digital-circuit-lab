import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Store } from "../server/store.js";
import { AiService } from "../server/ai.js";

function fixture() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "digital-circuit-ai-ghost-"));
  const store = new Store(dataDir);
  return { store, cleanup: () => fs.rmSync(dataDir, { recursive: true, force: true }) };
}

test("AI ghost planning returns validated topology without layout coordinates", async () => {
  const { store, cleanup } = fixture();
  try {
    store.saveAiConfig({ apiKey: "test-key", model: "test-model" });
    const ai = new AiService(store);
    let calls = 0;
    let modelOptions;
    let promptText = "";
    ai.model = (options) => ({
      async invoke(messages) {
        calls += 1;
        modelOptions = options;
        promptText = messages.map((message) => message.content).join("\n");
        return {
          content: JSON.stringify({
            name: "异或指示电路",
            summary: "两个输入不同时点亮输出灯。",
            nodes: [
              { id: "A", type: "INPUT", label: "输入 A", x: 999, y: 999 },
              { id: "B", type: "INPUT", label: "输入 B" },
              { id: "X1", type: "XOR", label: "异或" },
              { id: "Y", type: "OUTPUT", label: "输出 Y" }
            ],
            wires: [
              { from: "A", fromPort: 0, to: "X1", toPort: 0 },
              { from: "B", fromPort: 0, to: "X1", toPort: 1 },
              { from: "X1", fromPort: 0, to: "Y", toPort: 0 }
            ]
          })
        };
      }
    });

    const plan = await ai.generateGhostPlan({
      requirement: "用异或门实现两个输入不同时输出1",
      canvas: { components: [], wires: [] }
    });

    assert.equal(calls, 1);
    assert.equal(modelOptions.maxRetries, 0);
    assert.equal(modelOptions.timeout, 18000);
    assert.ok(modelOptions.maxTokens <= 1400);
    assert.match(promptText, /用异或门实现两个输入不同时输出1/);
    assert.doesNotMatch(promptText, /"x"\s*:/);
    assert.equal(plan.source, "ai");
    assert.equal(plan.nodes.length, 4);
    assert.equal(plan.wires.length, 3);
    assert.ok(plan.nodes.every((node) => !("x" in node) && !("y" in node)));
    assert.deepEqual(plan.wires[1], { from: "B", fromPort: 0, to: "X1", toPort: 1 });
  } finally {
    cleanup();
  }
});
