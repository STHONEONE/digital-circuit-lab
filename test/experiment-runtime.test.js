import test from "node:test";
import assert from "node:assert/strict";
import { createExperimentRuntime } from "../public/core/experiment-runtime.js";

test("full-adder runtime derives trusted outputs and intermediate signals", () => {
  const runtime = createExperimentRuntime("fullAdder");
  assert.deepEqual(runtime.snapshot().outputs, { S: 0, Cout: 0 });

  assert.equal(runtime.dispatch({ type: "input.set", input: "A", value: 1 }).ok, true);
  assert.equal(runtime.dispatch({ type: "input.set", input: "Cin", value: 1 }).ok, true);
  const snapshot = runtime.snapshot();

  assert.equal(snapshot.revision, 2);
  assert.deepEqual(snapshot.inputs, { A: 1, B: 0, Cin: 1 });
  assert.deepEqual(snapshot.outputs, { S: 0, Cout: 1 });
  assert.deepEqual(snapshot.signals, { xor1: 1, carry1: 0, carry2: 1 });
  assert.equal(snapshot.activeTruthRow, "101");
  assert.match(snapshot.explanation, /产生进位/);
  assert.equal(snapshot.status, "settled");

  runtime.dispose();
});

test("JK runtime changes Q only when a clock pulse command is dispatched", () => {
  const runtime = createExperimentRuntime("jkff");
  runtime.dispatch({ type: "input.set", input: "J", value: 1 });
  runtime.dispatch({ type: "input.set", input: "K", value: 1 });
  assert.equal(runtime.snapshot().outputs.Q, 0);

  const firstPulse = runtime.dispatch({ type: "clock.pulse" });
  assert.equal(firstPulse.ok, true);
  assert.deepEqual(firstPulse.snapshot.outputs, { Q: 1, notQ: 0 });
  assert.equal(firstPulse.snapshot.signals.clockEdge, "rising");

  const secondPulse = runtime.dispatch({ type: "clock.pulse" });
  assert.equal(secondPulse.snapshot.outputs.Q, 0);
  assert.match(secondPulse.snapshot.explanation, /翻转/);
});

test("gate and decoder runtimes share the same snapshot interface", () => {
  const gate = createExperimentRuntime("gates");
  gate.dispatch({ type: "input.set", input: "A", value: 1 });
  gate.dispatch({ type: "input.set", input: "B", value: 0 });
  gate.dispatch({ type: "input.set", input: "gate", value: "XOR" });
  assert.deepEqual(gate.snapshot().outputs, { Y: 1 });
  assert.equal(gate.snapshot().activeTruthRow, "XOR:10");

  const decoder = createExperimentRuntime("decoder");
  decoder.dispatch({ type: "input.set", input: "A2", value: 1 });
  decoder.dispatch({ type: "input.set", input: "A0", value: 1 });
  assert.equal(decoder.snapshot().outputs.active, 5);
  assert.equal(decoder.snapshot().outputs.Y5, 1);
  assert.equal(decoder.snapshot().outputs.Y4, 0);
});
