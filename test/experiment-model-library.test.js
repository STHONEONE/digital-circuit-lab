import test from "node:test";
import assert from "node:assert/strict";

import {
  initialExperimentState,
  applyExperimentCommand,
  deriveExperiment,
  enumerateExperimentCases,
  listExperimentModelIds
} from "../public/core/experiment-model-library.js";

function setInputs(experimentId, values) {
  return Object.entries(values).reduce((state, [input, value]) => (
    applyExperimentCommand(experimentId, state, { type: "input.set", input, value })
  ), initialExperimentState(experimentId));
}

test("classic half-adder model exposes four truth-table cases", () => {
  const result = deriveExperiment("halfAdder", setInputs("halfAdder", { A: 1, B: 1 }));
  assert.deepEqual(result.outputs, { S: 0, C: 1 });
  assert.deepEqual(result.signals, { xor: 0, and: 1 });
  assert.equal(enumerateExperimentCases("halfAdder").length, 4);
});

test("classic flip-flop models keep their observable storage rules", () => {
  let sr = setInputs("srff", { S: 1, R: 0 });
  assert.equal(deriveExperiment("srff", sr).outputs.Q, 1);
  sr = setInputs("srff", { S: 1, R: 1 });
  assert.equal(deriveExperiment("srff", sr).status, "invalid");

  let d = setInputs("dff", { D: 1 });
  d = applyExperimentCommand("dff", d, { type: "clock.pulse" });
  assert.equal(deriveExperiment("dff", d).outputs.Q, 1);

  let t = setInputs("tff", { T: 1 });
  t = applyExperimentCommand("tff", t, { type: "clock.pulse" });
  assert.equal(deriveExperiment("tff", t).outputs.Q, 1);

  let jk = setInputs("jkff", { J: 1, K: 1 });
  jk = applyExperimentCommand("jkff", jk, { type: "clock.pulse" });
  assert.equal(deriveExperiment("jkff", jk).outputs.Q, 1);
});

test("the model library exposes only the retained classic models", () => {
  assert.deepEqual(listExperimentModelIds(), ["halfAdder", "srff", "dff", "tff", "jkff"]);
  assert.throws(() => initialExperimentState("multiplexer"), /Unknown experiment model/);
});
