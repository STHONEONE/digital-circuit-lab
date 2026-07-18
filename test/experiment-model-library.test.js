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

test("half-adder model exposes the shared result contract and all truth-table cases", () => {
  let state = initialExperimentState("halfAdder");
  state = applyExperimentCommand("halfAdder", state, {
    type: "input.set",
    input: "A",
    value: 1
  });
  state = applyExperimentCommand("halfAdder", state, {
    type: "input.set",
    input: "B",
    value: 1
  });

  assert.deepEqual(deriveExperiment("halfAdder", state), {
    outputs: { S: 0, C: 1 },
    signals: { xor: 0, and: 1 },
    explanation: "A=1、B=1：异或得到和位 S=0，与运算得到进位 C=1。",
    status: "settled"
  });

  const cases = enumerateExperimentCases("halfAdder");
  assert.equal(cases.length, 4);
  assert.deepEqual(cases.map((item) => item.outputs), [
    { S: 0, C: 0 },
    { S: 1, C: 0 },
    { S: 1, C: 0 },
    { S: 0, C: 1 }
  ]);
});

test("full subtractor computes difference and borrow for every input combination", () => {
  const cases = enumerateExperimentCases("fullSubtractor");
  assert.equal(cases.length, 8);

  const borrowed = cases.find(({ state }) => state.A === 0 && state.B === 1 && state.Bin === 1);
  assert.deepEqual(borrowed.outputs, { D: 0, Bout: 1 });
  assert.deepEqual(borrowed.signals, { xorAB: 1, borrowFromB: 1, borrowFromBin: 0 });

  for (const { state, outputs } of cases) {
    const raw = state.A - state.B - state.Bin;
    assert.equal(outputs.D, ((raw % 2) + 2) % 2);
    assert.equal(outputs.Bout, raw < 0 ? 1 : 0);
  }
});

test("MUX selects exactly one source and DEMUX routes data to exactly one destination", () => {
  const muxState = setInputs("multiplexer", {
    D0: 0,
    D1: 1,
    D2: 0,
    D3: 1,
    select: "11"
  });
  assert.deepEqual(deriveExperiment("multiplexer", muxState).outputs, { Y: 1 });
  assert.deepEqual(deriveExperiment("multiplexer", muxState).signals, {
    selectedIndex: 3,
    selectedInput: "D3"
  });

  const demuxState = setInputs("demultiplexer", { D: 1, select: "10" });
  assert.deepEqual(deriveExperiment("demultiplexer", demuxState).outputs, {
    Y0: 0,
    Y1: 0,
    Y2: 1,
    Y3: 0
  });
  assert.equal(deriveExperiment("demultiplexer", demuxState).signals.selectedOutput, "Y2");
});

test("four-bit comparator asserts exactly one relation output", () => {
  const greater = deriveExperiment("comparator", setInputs("comparator", { A: 12, B: 5 }));
  assert.deepEqual(greater.outputs, { GT: 1, EQ: 0, LT: 0 });
  assert.deepEqual(greater.signals, { A4: "1100", B4: "0101", relation: ">" });

  const equal = deriveExperiment("comparator", setInputs("comparator", { A: 7, B: 7 }));
  assert.deepEqual(equal.outputs, { GT: 0, EQ: 1, LT: 0 });
  assert.equal(enumerateExperimentCases("comparator").length, 256);
});

test("parity model generates the bit required by even and odd parity", () => {
  const even = deriveExperiment("parityChecker", setInputs("parityChecker", {
    data: "0111",
    parity: "even"
  }));
  assert.deepEqual(even.outputs, { parityBit: 1 });
  assert.deepEqual(even.signals, { onesCount: 3, totalOnes: 4, parity: "even" });

  const odd = deriveExperiment("parityChecker", setInputs("parityChecker", {
    data: "0111",
    parity: "odd"
  }));
  assert.deepEqual(odd.outputs, { parityBit: 0 });
  assert.equal(odd.signals.totalOnes, 3);
  assert.equal(enumerateExperimentCases("parityChecker").length, 32);
});

test("BCD seven-segment model emits the active-high a-g pattern", () => {
  const two = deriveExperiment("bcdSevenSegment", setInputs("bcdSevenSegment", { digit: 2 }));
  assert.deepEqual(two.outputs, { a: 1, b: 1, c: 0, d: 1, e: 1, f: 0, g: 1 });
  assert.deepEqual(two.signals, { bcd: "0010", pattern: "1101101" });

  const eight = deriveExperiment("bcdSevenSegment", setInputs("bcdSevenSegment", { digit: 8 }));
  assert.deepEqual(eight.outputs, { a: 1, b: 1, c: 1, d: 1, e: 1, f: 1, g: 1 });
  assert.equal(enumerateExperimentCases("bcdSevenSegment").length, 10);
});

test("SR, D, T and JK models implement their observable storage rules", () => {
  let sr = setInputs("srff", { S: 1 });
  assert.deepEqual(deriveExperiment("srff", sr).outputs, { Q: 1, notQ: 0 });
  sr = applyExperimentCommand("srff", sr, { type: "input.set", input: "R", value: 1 });
  assert.deepEqual(deriveExperiment("srff", sr).outputs, { Q: null, notQ: null });
  assert.equal(deriveExperiment("srff", sr).status, "invalid");

  let d = setInputs("dff", { D: 1 });
  assert.equal(deriveExperiment("dff", d).outputs.Q, 0, "D must wait for a clock edge");
  d = applyExperimentCommand("dff", d, { type: "clock.pulse" });
  assert.equal(deriveExperiment("dff", d).outputs.Q, 1);

  let t = setInputs("tff", { T: 1 });
  t = applyExperimentCommand("tff", t, { type: "clock.pulse" });
  t = applyExperimentCommand("tff", t, { type: "clock.pulse" });
  assert.equal(deriveExperiment("tff", t).outputs.Q, 0);

  let jk = setInputs("jkff", { J: 1, K: 1 });
  jk = applyExperimentCommand("jkff", jk, { type: "clock.pulse" });
  assert.equal(deriveExperiment("jkff", jk).outputs.Q, 1);
  jk = applyExperimentCommand("jkff", jk, { type: "reset" });
  assert.equal(deriveExperiment("jkff", jk).outputs.Q, 0);
  assert.equal(jk.J, 1, "reset clears storage while preserving control inputs");
});

test("parallel and shift registers load, hold and move four-bit words on clock pulses", () => {
  let register = setInputs("register", { data: "1010", load: 0 });
  register = applyExperimentCommand("register", register, { type: "clock.pulse" });
  assert.equal(deriveExperiment("register", register).outputs.Q, "0000");
  register = applyExperimentCommand("register", register, { type: "input.set", input: "load", value: 1 });
  register = applyExperimentCommand("register", register, { type: "clock.pulse" });
  assert.equal(deriveExperiment("register", register).outputs.Q, "1010");

  let shift = setInputs("shiftRegister", { serialIn: 1, direction: "left" });
  shift = applyExperimentCommand("shiftRegister", shift, { type: "clock.pulse" });
  assert.deepEqual(deriveExperiment("shiftRegister", shift).outputs, { Q: "0001", serialOut: 0 });
  shift = applyExperimentCommand("shiftRegister", shift, { type: "input.set", input: "direction", value: "right" });
  shift = applyExperimentCommand("shiftRegister", shift, { type: "clock.pulse" });
  assert.deepEqual(deriveExperiment("shiftRegister", shift).outputs, { Q: "1000", serialOut: 1 });
});

test("synchronous and ripple counters wrap at 16 while exposing different timing evidence", () => {
  let sync = setInputs("synchronousCounter", { enable: 1 });
  for (let index = 0; index < 16; index += 1) {
    sync = applyExperimentCommand("synchronousCounter", sync, { type: "clock.pulse" });
  }
  assert.deepEqual(deriveExperiment("synchronousCounter", sync).outputs, { count: 0, bits: "0000" });
  assert.equal(deriveExperiment("synchronousCounter", sync).signals.simultaneous, true);

  let ripple = initialExperimentState("asynchronousCounter");
  for (let index = 0; index < 8; index += 1) {
    ripple = applyExperimentCommand("asynchronousCounter", ripple, { type: "clock.pulse" });
  }
  const result = deriveExperiment("asynchronousCounter", ripple);
  assert.deepEqual(result.outputs, { count: 8, bits: "1000" });
  assert.deepEqual(result.signals.rippleEvents.map(({ stage, atNs }) => ({ stage, atNs })), [
    { stage: "Q0", atNs: 2 },
    { stage: "Q1", atNs: 4 },
    { stage: "Q2", atNs: 6 },
    { stage: "Q3", atNs: 8 }
  ]);
  assert.equal(result.signals.model, "teaching-ripple-delay");
});

test("finite-state machine detects the overlapping 101 input sequence", () => {
  let fsm = initialExperimentState("finiteStateMachine");
  for (const input of [1, 0, 1]) {
    fsm = applyExperimentCommand("finiteStateMachine", fsm, { type: "input.set", input: "input", value: input });
    fsm = applyExperimentCommand("finiteStateMachine", fsm, { type: "clock.pulse" });
  }
  assert.deepEqual(deriveExperiment("finiteStateMachine", fsm).outputs, {
    state: "SEEN_1",
    detected: 1
  });
  fsm = applyExperimentCommand("finiteStateMachine", fsm, { type: "reset" });
  assert.equal(deriveExperiment("finiteStateMachine", fsm).outputs.state, "IDLE");
});

test("model id discovery returns a detached list of models that are actually implemented", () => {
  const ids = listExperimentModelIds();
  assert.ok(ids.includes("halfAdder"));
  assert.ok(ids.includes("finiteStateMachine"));
  ids.length = 0;
  assert.ok(listExperimentModelIds().length > 0);
});

test("propagation delay uses an explicit three-stage teaching timeline", () => {
  const state = setInputs("propagationDelay", { gateDelay: 4, input: 1 });
  const result = deriveExperiment("propagationDelay", state);
  assert.deepEqual(result.outputs, { Y: 0 });
  assert.equal(result.signals.totalDelayNs, 12);
  assert.deepEqual(result.signals.events, [
    { signal: "N1", atNs: 4, value: 0 },
    { signal: "N2", atNs: 8, value: 1 },
    { signal: "Y", atNs: 12, value: 0 }
  ]);
  assert.equal(result.signals.model, "teaching-discrete-gate-delay");
  assert.match(result.explanation, /不是晶体管级精密仿真/);
});

test("hazard model reports the classic static-1 glitch and consensus-term removal", () => {
  let state = setInputs("hazards", { B: 1, C: 1, A: 1 });
  const hazardous = deriveExperiment("hazards", state);
  assert.deepEqual(hazardous.outputs, { F: 1, glitchDetected: 1 });
  assert.equal(hazardous.status, "hazard");
  assert.deepEqual(hazardous.signals.waveform, [
    { atNs: 0, value: 1 },
    { atNs: 2, value: 0 },
    { atNs: 4, value: 1 }
  ]);

  state = applyExperimentCommand("hazards", state, {
    type: "input.set",
    input: "circuit",
    value: "consensus-term"
  });
  const protectedResult = deriveExperiment("hazards", state);
  assert.deepEqual(protectedResult.outputs, { F: 1, glitchDetected: 0 });
  assert.equal(protectedResult.signals.consensusTerm, 1);
});

test("setup/hold teaching model treats exact boundaries as safe and window interiors as violations", () => {
  const setupBoundary = deriveExperiment("setupHold", setInputs("setupHold", {
    dataOffset: -3,
    setupTime: 3,
    holdTime: 2
  }));
  assert.deepEqual(setupBoundary.outputs, { sampleReliable: 1 });
  assert.equal(setupBoundary.status, "settled");

  const setupViolation = deriveExperiment("setupHold", setInputs("setupHold", {
    dataOffset: -2,
    setupTime: 3,
    holdTime: 2
  }));
  assert.deepEqual(setupViolation.signals.violations, ["setup"]);
  assert.equal(setupViolation.status, "violation");

  const holdBoundary = deriveExperiment("setupHold", setInputs("setupHold", {
    dataOffset: 2,
    setupTime: 3,
    holdTime: 2
  }));
  assert.deepEqual(holdBoundary.outputs, { sampleReliable: 1 });

  const edgeViolation = deriveExperiment("setupHold", setInputs("setupHold", {
    dataOffset: 0,
    setupTime: 3,
    holdTime: 2
  }));
  assert.deepEqual(edgeViolation.signals.violations, ["setup", "hold"]);
  assert.equal(edgeViolation.outputs.sampleReliable, 0);
  assert.match(edgeViolation.explanation, /确定性教学判定/);
});

test("commands are pure and reject unsupported controls instead of corrupting model state", () => {
  const original = initialExperimentState("dff");
  const changed = applyExperimentCommand("dff", original, {
    type: "input.set",
    input: "D",
    value: 1
  });
  assert.equal(original.D, 0);
  assert.equal(changed.D, 1);
  assert.throws(() => applyExperimentCommand("dff", changed, {
    type: "input.set",
    input: "Q",
    value: 1
  }), /Invalid dff input Q/);
  assert.throws(() => initialExperimentState("not-an-experiment"), /Unknown experiment model/);
});
