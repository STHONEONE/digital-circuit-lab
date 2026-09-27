import test from "node:test";
import assert from "node:assert/strict";
import {
  createExperimentContext,
  getExperimentDefinition,
  listExperimentGroups
} from "../public/core/experiment-catalog.js";

test("experiment catalog keeps only eight classic experiments in three groups", () => {
  const groups = listExperimentGroups();
  assert.deepEqual(groups.map((group) => group.id), ["basic-logic", "combinational-logic", "sequential-logic"]);
  assert.deepEqual(groups.map((group) => group.experimentCount), [1, 3, 4]);
  assert.deepEqual(groups.flatMap((group) => group.experiments.map((item) => item.id)), [
    "gates", "halfAdder", "fullAdder", "decoder", "srff", "dff", "tff", "jkff"
  ]);
  assert.equal(getExperimentDefinition("multiplexer"), null);
  assert.equal(getExperimentDefinition("propagationDelay"), null);
});

test("experiment context keeps only declared classic-experiment inputs", () => {
  const context = createExperimentContext("fullAdder", {
    revision: 7,
    inputs: { A: 1, B: 0, Cin: 1, Cout: 1 },
    outputs: { S: 0, Cout: 0 }
  });
  assert.deepEqual(context.inputs, { A: 1, B: 0, Cin: 1 });
  assert.equal("outputs" in context, false);
  assert.equal("signals" in context, false);
});

test("catalog results are detached and reject removed experiments", () => {
  const groups = listExperimentGroups();
  groups[0].experiments[0].title = "mutated";
  assert.equal(getExperimentDefinition("gates").title, "基本逻辑门");
  assert.throws(() => createExperimentContext("multiplexer", {}), /Unknown experiment/);
});
