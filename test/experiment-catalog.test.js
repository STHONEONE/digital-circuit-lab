import test from "node:test";
import assert from "node:assert/strict";
import {
  createExperimentContext,
  getExperimentDefinition,
  listExperimentGroups
} from "../public/core/experiment-catalog.js";

test("experiment catalog exposes the complete curriculum as four foldable groups", () => {
  const groups = listExperimentGroups();

  assert.deepEqual(groups.map((group) => group.title), [
    "基础逻辑",
    "组合逻辑",
    "时序逻辑",
    "进阶主题"
  ]);
  assert.deepEqual(groups.map((group) => group.defaultExpanded), [true, false, false, false]);

  const definitions = groups.flatMap((group) => group.experiments);
  assert.equal(definitions.length, 24);
  assert.deepEqual(definitions.map((definition) => definition.title), [
    "基本逻辑门",
    "半加器",
    "全加器",
    "半减器",
    "全减器",
    "多路选择器（MUX）",
    "多路分配器（DEMUX）",
    "编码器",
    "3-8 译码器",
    "数值比较器",
    "奇偶校验器",
    "BCD-7 段译码器",
    "SR 触发器",
    "D 触发器",
    "T 触发器",
    "JK 触发器",
    "并行寄存器",
    "移位寄存器",
    "同步计数器",
    "异步计数器",
    "有限状态机（FSM）",
    "传播延迟",
    "竞争与冒险",
    "建立与保持时间"
  ]);

  for (const definition of definitions) {
    assert.equal(typeof definition.id, "string");
    assert.match(definition.version, /^\d+\.\d+\.\d+$/);
    assert.ok(Array.isArray(definition.knowledge) && definition.knowledge.length > 0);
    assert.ok(Array.isArray(definition.controls) && definition.controls.length > 0);
    assert.ok(Array.isArray(definition.views) && definition.views.length > 0);
    assert.equal(typeof definition.completion, "object");
  }
});

test("existing lab runtime ids map directly to catalog definitions", () => {
  assert.deepEqual(
    ["gates", "fullAdder", "decoder", "jkff"].map((id) => getExperimentDefinition(id)?.title),
    ["基本逻辑门", "全加器", "3-8 译码器", "JK 触发器"]
  );
});

test("experiment context keeps only declared client inputs and never trusts client outputs", () => {
  const context = createExperimentContext("fullAdder", {
    revision: 7,
    inputs: {
      A: 1,
      B: 0,
      Cin: 1,
      Cout: 1,
      internalCarry: 1
    },
    outputs: { S: 0, Cout: 0 },
    signals: { forged: 1 }
  });

  assert.deepEqual(context, {
    schemaVersion: "experiment-context/v1",
    experimentId: "fullAdder",
    definitionVersion: "1.0.0",
    groupId: "combinational-logic",
    title: "全加器",
    knowledge: ["全加器", "半加器级联", "进位"],
    revision: 7,
    inputs: { A: 1, B: 0, Cin: 1 }
  });
  assert.equal("outputs" in context, false);
  assert.equal("signals" in context, false);
});

test("legacy flat lab state is sanitized without accepting actions or derived state", () => {
  const context = createExperimentContext("jkff", {
    revision: -3,
    J: 1,
    K: "1",
    pulse: "上升沿",
    clock: 1,
    Q: 1,
    previousQ: 0
  });

  assert.equal(context.revision, 0);
  assert.deepEqual(context.inputs, { J: 1 });
});

test("catalog results are detached so callers cannot corrupt later lookups", () => {
  const groups = listExperimentGroups();
  groups[0].experiments[0].title = "被调用方修改";
  groups[0].experiments[0].knowledge.push("伪造知识点");

  const definition = getExperimentDefinition("gates");
  assert.equal(definition.title, "基本逻辑门");
  assert.equal(definition.knowledge.includes("伪造知识点"), false);
  assert.equal(getExperimentDefinition("does-not-exist"), null);
  assert.throws(
    () => createExperimentContext("does-not-exist", {}),
    (error) => error instanceof RangeError && error.message === "Unknown experiment: does-not-exist"
  );
});
