import test from "node:test";
import assert from "node:assert/strict";
import { getExperimentDefinition } from "../public/core/experiment-catalog.js";
import { createExperimentRuntime } from "../public/core/experiment-runtime.js";

test("classic runtime models are discoverable in the curated catalog", () => {
  for (const experimentId of ["halfAdder", "srff", "dff", "tff", "jkff"]) {
    assert.equal(getExperimentDefinition(experimentId)?.availability, "available", experimentId);
  }
  assert.equal(getExperimentDefinition("multiplexer"), null);
});

test("classic runtime models simulate combinational and clocked behavior", () => {
  const halfAdder = createExperimentRuntime("halfAdder");
  halfAdder.dispatch({ type: "input.set", input: "A", value: 1 });
  const sum = halfAdder.dispatch({ type: "input.set", input: "B", value: 1 });
  assert.deepEqual(sum.snapshot.outputs, { S: 0, C: 1 });

  const tff = createExperimentRuntime("tff");
  tff.dispatch({ type: "input.set", input: "T", value: 1 });
  const pulse = tff.dispatch({ type: "clock.pulse" });
  assert.deepEqual(pulse.snapshot.outputs, { Q: 1, notQ: 0 });
});

test("removed models are not constructible", () => {
  assert.throws(() => createExperimentRuntime("multiplexer"), /Unknown experiment/);
});
