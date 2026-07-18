import test from "node:test";
import assert from "node:assert/strict";

import { getExperimentDefinition } from "../public/core/experiment-catalog.js";
import { createExperimentRuntime } from "../public/core/experiment-runtime.js";

const expandedIds = [
  "halfAdder", "fullSubtractor", "multiplexer", "demultiplexer", "comparator",
  "parityChecker", "bcdSevenSegment", "srff", "dff", "tff", "register",
  "shiftRegister", "synchronousCounter", "asynchronousCounter", "finiteStateMachine",
  "propagationDelay", "hazards", "setupHold"
];

test("every implemented expansion is discoverable as an available curriculum experiment", () => {
  for (const experimentId of expandedIds) {
    assert.equal(getExperimentDefinition(experimentId)?.availability, "available", experimentId);
  }
});

test("shared runtime drives expanded combinational, sequential and timing models", () => {
  const mux = createExperimentRuntime("multiplexer");
  assert.equal(mux.dispatch({ type: "input.set", input: "D3", value: 1 }).ok, true);
  const muxResult = mux.dispatch({ type: "input.set", input: "select", value: "11" });
  assert.deepEqual(muxResult.snapshot.outputs, { Y: 1 });
  assert.equal(muxResult.snapshot.signals.selectedInput, "D3");

  const counter = createExperimentRuntime("synchronousCounter");
  assert.equal(counter.dispatch({ type: "input.set", input: "enable", value: 1 }).ok, true);
  const counted = counter.dispatch({ type: "clock.pulse" });
  assert.deepEqual(counted.snapshot.outputs, { count: 1, bits: "0001" });

  const setupHold = createExperimentRuntime("setupHold");
  assert.equal(setupHold.dispatch({ type: "input.set", input: "dataOffset", value: 0 }).ok, true);
  assert.equal(setupHold.snapshot().status, "violation");
  assert.deepEqual(setupHold.snapshot().signals.violations, ["setup", "hold"]);
});

test("expanded runtime rejects invalid inputs and supports reset actions", () => {
  const register = createExperimentRuntime("register");
  const invalid = register.dispatch({ type: "input.set", input: "data", value: "2222" });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.error.code, "INPUT_INVALID");

  const counter = createExperimentRuntime("asynchronousCounter");
  counter.dispatch({ type: "clock.pulse" });
  assert.equal(counter.snapshot().outputs.count, 1);
  const reset = counter.dispatch({ type: "reset" });
  assert.equal(reset.ok, true);
  assert.equal(reset.snapshot.outputs.count, 0);
});
