function clone(value) {
  return structuredClone(value);
}

function binary(value) {
  return value === 0 || value === 1;
}

function oneOf(...values) {
  return (value) => values.includes(value);
}

function integerBetween(min, max) {
  return (value) => Number.isInteger(value) && value >= min && value <= max;
}

function bitWord(width) {
  const pattern = new RegExp(`^[01]{${width}}$`);
  return (value) => typeof value === "string" && pattern.test(value);
}

function halfAdderResult(state) {
  const S = state.A ^ state.B;
  const C = state.A & state.B;
  return {
    outputs: { S, C },
    signals: { xor: S, and: C },
    explanation: `A=${state.A}、B=${state.B}：异或得到和位 S=${S}，与运算得到进位 C=${C}。`,
    status: "settled"
  };
}

const SEVEN_SEGMENT_PATTERNS = [
  "1111110", "0110000", "1101101", "1111001", "0110011",
  "1011011", "1011111", "1110000", "1111111", "1111011"
];

const MODELS = {
  halfAdder: {
    initial: { A: 0, B: 0 },
    inputs: {
      A: binary,
      B: binary
    },
    derive: halfAdderResult,
    enumerate() {
      return [0, 1].flatMap((A) => [0, 1].map((B) => ({ A, B })));
    }
  },
  fullSubtractor: {
    initial: { A: 0, B: 0, Bin: 0 },
    inputs: { A: binary, B: binary, Bin: binary },
    derive(state) {
      const xorAB = state.A ^ state.B;
      const borrowFromB = (state.A ? 0 : 1) & state.B;
      const borrowFromBin = (xorAB ? 0 : 1) & state.Bin;
      const D = xorAB ^ state.Bin;
      const Bout = borrowFromB | borrowFromBin;
      return {
        outputs: { D, Bout },
        signals: { xorAB, borrowFromB, borrowFromBin },
        explanation: `A=${state.A}、B=${state.B}、Bin=${state.Bin}：差 D=${D}，向高位借位 Bout=${Bout}。`,
        status: "settled"
      };
    },
    enumerate() {
      return [0, 1].flatMap((A) => [0, 1].flatMap((B) => (
        [0, 1].map((Bin) => ({ A, B, Bin }))
      )));
    }
  },
  multiplexer: {
    initial: { D0: 0, D1: 0, D2: 0, D3: 0, select: "00" },
    inputs: {
      D0: binary,
      D1: binary,
      D2: binary,
      D3: binary,
      select: oneOf("00", "01", "10", "11")
    },
    derive(state) {
      const selectedIndex = Number.parseInt(state.select, 2);
      const selectedInput = `D${selectedIndex}`;
      const Y = state[selectedInput];
      return {
        outputs: { Y },
        signals: { selectedIndex, selectedInput },
        explanation: `选择端 S1S0=${state.select}，因此 D${selectedIndex}=${Y} 被送到输出 Y。`,
        status: "settled"
      };
    },
    enumerate() {
      const dataWords = Array.from({ length: 16 }, (_, value) => value.toString(2).padStart(4, "0"));
      return dataWords.flatMap((word) => ["00", "01", "10", "11"].map((select) => ({
        D0: Number(word[3]),
        D1: Number(word[2]),
        D2: Number(word[1]),
        D3: Number(word[0]),
        select
      })));
    }
  },
  demultiplexer: {
    initial: { D: 0, select: "00" },
    inputs: {
      D: binary,
      select: oneOf("00", "01", "10", "11")
    },
    derive(state) {
      const selectedIndex = Number.parseInt(state.select, 2);
      const outputs = { Y0: 0, Y1: 0, Y2: 0, Y3: 0 };
      outputs[`Y${selectedIndex}`] = state.D;
      return {
        outputs,
        signals: { selectedIndex, selectedOutput: `Y${selectedIndex}` },
        explanation: `选择端 S1S0=${state.select}，输入 D=${state.D} 只被送到 Y${selectedIndex}。`,
        status: "settled"
      };
    },
    enumerate() {
      return [0, 1].flatMap((D) => ["00", "01", "10", "11"].map((select) => ({ D, select })));
    }
  },
  comparator: {
    initial: { A: 0, B: 0 },
    inputs: { A: integerBetween(0, 15), B: integerBetween(0, 15) },
    derive(state) {
      const relation = state.A > state.B ? ">" : state.A < state.B ? "<" : "=";
      return {
        outputs: {
          GT: state.A > state.B ? 1 : 0,
          EQ: state.A === state.B ? 1 : 0,
          LT: state.A < state.B ? 1 : 0
        },
        signals: {
          A4: state.A.toString(2).padStart(4, "0"),
          B4: state.B.toString(2).padStart(4, "0"),
          relation
        },
        explanation: `A=${state.A}、B=${state.B}，因此 A ${relation} B。`,
        status: "settled"
      };
    },
    enumerate() {
      return Array.from({ length: 16 }, (_, A) => (
        Array.from({ length: 16 }, (__, B) => ({ A, B }))
      )).flat();
    }
  },
  parityChecker: {
    initial: { data: "0000", parity: "even" },
    inputs: { data: bitWord(4), parity: oneOf("even", "odd") },
    derive(state) {
      const onesCount = [...state.data].filter((bit) => bit === "1").length;
      const parityBit = state.parity === "even" ? onesCount % 2 : (onesCount + 1) % 2;
      const totalOnes = onesCount + parityBit;
      return {
        outputs: { parityBit },
        signals: { onesCount, totalOnes, parity: state.parity },
        explanation: `${state.data} 含 ${onesCount} 个 1，${state.parity === "even" ? "偶" : "奇"}校验位应为 ${parityBit}。`,
        status: "settled"
      };
    },
    enumerate() {
      return Array.from({ length: 16 }, (_, value) => value.toString(2).padStart(4, "0"))
        .flatMap((data) => ["even", "odd"].map((parity) => ({ data, parity })));
    }
  },
  bcdSevenSegment: {
    initial: { digit: 0 },
    inputs: { digit: integerBetween(0, 9) },
    derive(state) {
      const pattern = SEVEN_SEGMENT_PATTERNS[state.digit];
      const [a, b, c, d, e, f, g] = [...pattern].map(Number);
      return {
        outputs: { a, b, c, d, e, f, g },
        signals: { bcd: state.digit.toString(2).padStart(4, "0"), pattern },
        explanation: `BCD ${state.digit.toString(2).padStart(4, "0")} 表示十进制 ${state.digit}，点亮段码 ${pattern}（a 到 g，高电平有效）。`,
        status: "settled"
      };
    },
    enumerate() {
      return Array.from({ length: 10 }, (_, digit) => ({ digit }));
    }
  },
  srff: {
    initial: { S: 0, R: 0, Q: 0, previousQ: 0 },
    inputs: { S: binary, R: binary },
    setInput(state, input, value) {
      const next = { ...state, [input]: value, previousQ: state.Q };
      if (next.S === 1 && next.R === 0) next.Q = 1;
      if (next.S === 0 && next.R === 1) next.Q = 0;
      return next;
    },
    derive(state) {
      const forbidden = state.S === 1 && state.R === 1;
      return {
        outputs: forbidden ? { Q: null, notQ: null } : { Q: state.Q, notQ: state.Q ? 0 : 1 },
        signals: { S: state.S, R: state.R, forbidden },
        explanation: forbidden
          ? "S=1、R=1 是 SR 触发器的禁用输入，教学模型不为该状态伪造确定输出。"
          : `S=${state.S}、R=${state.R}，存储状态 Q=${state.Q}。`,
        status: forbidden ? "invalid" : "settled"
      };
    },
    enumerate() {
      return [
        { S: 0, R: 0, Q: 0, previousQ: 0 },
        { S: 0, R: 0, Q: 1, previousQ: 1 },
        { S: 0, R: 1, Q: 0, previousQ: 1 },
        { S: 1, R: 0, Q: 1, previousQ: 0 },
        { S: 1, R: 1, Q: 0, previousQ: 0 }
      ];
    }
  },
  dff: {
    initial: { D: 0, Q: 0, previousQ: 0, clockCount: 0 },
    inputs: { D: binary },
    pulse(state) {
      return { ...state, previousQ: state.Q, Q: state.D, clockCount: state.clockCount + 1 };
    },
    derive(state) {
      return {
        outputs: { Q: state.Q, notQ: state.Q ? 0 : 1 },
        signals: { D: state.D, previousQ: state.previousQ, clockCount: state.clockCount },
        explanation: `最近一个时钟上升沿采样 D=${state.Q}，当前 Q=${state.Q}；两次时钟沿之间保持不变。`,
        status: "settled"
      };
    }
  },
  tff: {
    initial: { T: 0, Q: 0, previousQ: 0, clockCount: 0 },
    inputs: { T: binary },
    pulse(state) {
      return {
        ...state,
        previousQ: state.Q,
        Q: state.T ? (state.Q ? 0 : 1) : state.Q,
        clockCount: state.clockCount + 1
      };
    },
    derive(state) {
      return {
        outputs: { Q: state.Q, notQ: state.Q ? 0 : 1 },
        signals: { T: state.T, previousQ: state.previousQ, clockCount: state.clockCount },
        explanation: `T=${state.T}，最近一个时钟沿${state.T ? "翻转" : "保持"} Q，当前 Q=${state.Q}。`,
        status: "settled"
      };
    }
  },
  jkff: {
    initial: { J: 0, K: 0, Q: 0, previousQ: 0, clockCount: 0 },
    inputs: { J: binary, K: binary },
    pulse(state) {
      const Q = state.J === 0 && state.K === 0 ? state.Q
        : state.J === 0 && state.K === 1 ? 0
          : state.J === 1 && state.K === 0 ? 1
            : state.Q ? 0 : 1;
      return { ...state, previousQ: state.Q, Q, clockCount: state.clockCount + 1 };
    },
    derive(state) {
      const action = state.J === 0 && state.K === 0 ? "保持"
        : state.J === 0 && state.K === 1 ? "复位"
          : state.J === 1 && state.K === 0 ? "置位" : "翻转";
      return {
        outputs: { Q: state.Q, notQ: state.Q ? 0 : 1 },
        signals: {
          J: state.J,
          K: state.K,
          previousQ: state.previousQ,
          clockCount: state.clockCount,
          action
        },
        explanation: `J=${state.J}、K=${state.K}，时钟沿执行“${action}”，当前 Q=${state.Q}。`,
        status: "settled"
      };
    },
    enumerate() {
      return [0, 1].flatMap((Q) => [0, 1].flatMap((J) => [0, 1].map((K) => ({
        J,
        K,
        Q,
        previousQ: Q,
        clockCount: 0
      }))));
    }
  },
  register: {
    initial: { data: "0000", load: 0, Q: "0000", previousQ: "0000", clockCount: 0 },
    inputs: { data: bitWord(4), load: binary },
    pulse(state) {
      return {
        ...state,
        previousQ: state.Q,
        Q: state.load ? state.data : state.Q,
        clockCount: state.clockCount + 1
      };
    },
    derive(state) {
      return {
        outputs: { Q: state.Q },
        signals: {
          data: state.data,
          load: state.load,
          previousQ: state.previousQ,
          clockCount: state.clockCount
        },
        explanation: `装载使能 load=${state.load}，最近时钟沿${state.load ? `并行装载 ${state.data}` : "保持原值"}，Q=${state.Q}。`,
        status: "settled"
      };
    }
  },
  shiftRegister: {
    initial: {
      serialIn: 0,
      direction: "left",
      bits: "0000",
      previousBits: "0000",
      serialOut: 0,
      clockCount: 0
    },
    inputs: { serialIn: binary, direction: oneOf("left", "right") },
    pulse(state) {
      const left = state.direction === "left";
      const serialOut = Number(left ? state.bits[0] : state.bits[state.bits.length - 1]);
      const bits = left
        ? `${state.bits.slice(1)}${state.serialIn}`
        : `${state.serialIn}${state.bits.slice(0, -1)}`;
      return {
        ...state,
        previousBits: state.bits,
        bits,
        serialOut,
        clockCount: state.clockCount + 1
      };
    },
    derive(state) {
      return {
        outputs: { Q: state.bits, serialOut: state.serialOut },
        signals: {
          serialIn: state.serialIn,
          direction: state.direction,
          previousQ: state.previousBits,
          clockCount: state.clockCount
        },
        explanation: `最近时钟沿向${state.direction === "left" ? "左" : "右"}移位，串行输入 ${state.serialIn}，当前 Q=${state.bits}。`,
        status: "settled"
      };
    }
  },
  synchronousCounter: {
    initial: { enable: 0, count: 0, previousCount: 0, clockCount: 0 },
    inputs: { enable: binary },
    pulse(state) {
      return {
        ...state,
        previousCount: state.count,
        count: state.enable ? (state.count + 1) % 16 : state.count,
        clockCount: state.clockCount + 1
      };
    },
    derive(state) {
      const bits = state.count.toString(2).padStart(4, "0");
      const previousBits = state.previousCount.toString(2).padStart(4, "0");
      const changedBits = [0, 1, 2, 3]
        .filter((stage) => bits[3 - stage] !== previousBits[3 - stage])
        .map((stage) => `Q${stage}`);
      return {
        outputs: { count: state.count, bits },
        signals: {
          enable: state.enable,
          previousCount: state.previousCount,
          changedBits,
          simultaneous: true,
          clockCount: state.clockCount
        },
        explanation: `同步计数器的各位在同一时钟沿更新，当前计数为 ${state.count}（${bits}）。`,
        status: "settled"
      };
    }
  },
  asynchronousCounter: {
    initial: {
      count: 0,
      previousCount: 0,
      clockCount: 0,
      stageDelayNs: 2,
      rippleEvents: []
    },
    inputs: {},
    pulse(state) {
      const count = (state.count + 1) % 16;
      const before = state.count.toString(2).padStart(4, "0");
      const after = count.toString(2).padStart(4, "0");
      const rippleEvents = [];
      for (let stage = 0; stage < 4; stage += 1) {
        const position = 3 - stage;
        if (before[position] === after[position]) continue;
        rippleEvents.push({
          stage: `Q${stage}`,
          from: Number(before[position]),
          to: Number(after[position]),
          atNs: (rippleEvents.length + 1) * state.stageDelayNs
        });
      }
      return {
        ...state,
        previousCount: state.count,
        count,
        rippleEvents,
        clockCount: state.clockCount + 1
      };
    },
    derive(state) {
      const bits = state.count.toString(2).padStart(4, "0");
      const totalSettleNs = state.rippleEvents.at(-1)?.atNs || 0;
      return {
        outputs: { count: state.count, bits },
        signals: {
          previousCount: state.previousCount,
          rippleEvents: state.rippleEvents,
          totalSettleNs,
          stageDelayNs: state.stageDelayNs,
          model: "teaching-ripple-delay",
          clockCount: state.clockCount
        },
        explanation: `教学级纹波延迟模型：各级按每级 ${state.stageDelayNs} ns 依次翻转，最终稳定为 ${bits}；它不是晶体管级精密仿真。`,
        status: "settled"
      };
    }
  },
  finiteStateMachine: {
    initial: {
      input: 0,
      currentState: "IDLE",
      previousState: "IDLE",
      detected: 0,
      clockCount: 0
    },
    inputs: { input: binary },
    pulse(state) {
      let currentState = "IDLE";
      let detected = 0;
      if (state.currentState === "IDLE") currentState = state.input ? "SEEN_1" : "IDLE";
      if (state.currentState === "SEEN_1") currentState = state.input ? "SEEN_1" : "SEEN_10";
      if (state.currentState === "SEEN_10") {
        currentState = state.input ? "SEEN_1" : "IDLE";
        detected = state.input ? 1 : 0;
      }
      return {
        ...state,
        previousState: state.currentState,
        currentState,
        detected,
        clockCount: state.clockCount + 1
      };
    },
    derive(state) {
      return {
        outputs: { state: state.currentState, detected: state.detected },
        signals: {
          input: state.input,
          previousState: state.previousState,
          transition: `${state.previousState}->${state.currentState}`,
          clockCount: state.clockCount,
          machine: "overlapping-101-detector"
        },
        explanation: `101 序列检测器在输入 X=${state.input} 后由 ${state.previousState} 转到 ${state.currentState}${state.detected ? "，检测到 101" : ""}。`,
        status: "settled"
      };
    }
  },
  propagationDelay: {
    initial: {
      input: 0,
      previousInput: 0,
      gateDelay: 5,
      transitioned: false
    },
    inputs: { input: binary, gateDelay: integerBetween(1, 20) },
    setInput(state, input, value) {
      if (input !== "input") return { ...state, [input]: value };
      return {
        ...state,
        input: value,
        previousInput: state.input,
        transitioned: value !== state.input
      };
    },
    derive(state) {
      const N1 = state.input ? 0 : 1;
      const N2 = N1 ? 0 : 1;
      const Y = N2 ? 0 : 1;
      const events = state.transitioned ? [
        { signal: "N1", atNs: state.gateDelay, value: N1 },
        { signal: "N2", atNs: state.gateDelay * 2, value: N2 },
        { signal: "Y", atNs: state.gateDelay * 3, value: Y }
      ] : [];
      return {
        outputs: { Y },
        signals: {
          previousInput: state.previousInput,
          stages: { N1, N2, Y },
          events,
          totalDelayNs: state.gateDelay * 3,
          model: "teaching-discrete-gate-delay"
        },
        explanation: `教学级离散门延迟模型：三层反相器每级延迟 ${state.gateDelay} ns，总延迟 ${state.gateDelay * 3} ns；它不是晶体管级精密仿真。`,
        status: "settled"
      };
    },
    enumerate() {
      return [0, 1].flatMap((input) => [1, 5, 20].map((gateDelay) => ({
        input,
        previousInput: input ? 0 : 1,
        gateDelay,
        transitioned: true
      })));
    }
  },
  hazards: {
    initial: {
      A: 0,
      B: 0,
      C: 0,
      circuit: "hazardous",
      previousA: 0,
      changedInput: null
    },
    inputs: {
      A: binary,
      B: binary,
      C: binary,
      circuit: oneOf("hazardous", "consensus-term")
    },
    setInput(state, input, value) {
      if (input !== "A") return { ...state, [input]: value };
      return {
        ...state,
        A: value,
        previousA: state.A,
        changedInput: value === state.A ? null : "A"
      };
    },
    derive(state) {
      const termAB = state.A & state.B;
      const termNotAC = (state.A ? 0 : 1) & state.C;
      const consensusTerm = state.B & state.C;
      const F = termAB | termNotAC | (state.circuit === "consensus-term" ? consensusTerm : 0);
      const staticOneTransition = state.changedInput === "A"
        && state.previousA !== state.A
        && state.B === 1
        && state.C === 1;
      const glitchDetected = staticOneTransition && state.circuit === "hazardous" ? 1 : 0;
      const waveform = glitchDetected ? [
        { atNs: 0, value: 1 },
        { atNs: 2, value: 0 },
        { atNs: 4, value: 1 }
      ] : [{ atNs: 0, value: F }];
      return {
        outputs: { F, glitchDetected },
        signals: {
          termAB,
          termNotAC,
          consensusTerm,
          transition: state.changedInput === "A" ? `${state.previousA}->${state.A}` : "none",
          waveform,
          model: "teaching-static-1-hazard"
        },
        explanation: glitchDetected
          ? "教学级静态 1 冒险模型：A 翻转且 B=C=1 时，两条路径延迟不同，F 会短暂下降；这不是晶体管级精密仿真。"
          : state.circuit === "consensus-term" && staticOneTransition
            ? "加入一致项 BC 后，A 翻转期间仍有有效路径维持 F=1，教学模型中毛刺被消除。"
            : `当前逻辑函数 F=${F}，未触发经典静态 1 冒险条件。`,
        status: glitchDetected ? "hazard" : "settled"
      };
    },
    enumerate() {
      return ["hazardous", "consensus-term"].flatMap((circuit) => [0, 1].flatMap((A) => (
        [0, 1].flatMap((B) => [0, 1].map((C) => ({
          A,
          B,
          C,
          circuit,
          previousA: A ? 0 : 1,
          changedInput: "A"
        })))
      )));
    }
  },
  setupHold: {
    initial: { dataOffset: -5, setupTime: 3, holdTime: 2 },
    inputs: {
      dataOffset: integerBetween(-10, 10),
      setupTime: integerBetween(1, 10),
      holdTime: integerBetween(1, 10)
    },
    derive(state) {
      const setupViolation = state.dataOffset > -state.setupTime && state.dataOffset <= 0;
      const holdViolation = state.dataOffset >= 0 && state.dataOffset < state.holdTime;
      const violations = [
        ...(setupViolation ? ["setup"] : []),
        ...(holdViolation ? ["hold"] : [])
      ];
      const sampleReliable = violations.length ? 0 : 1;
      return {
        outputs: { sampleReliable },
        signals: {
          clockEdgeNs: 0,
          dataOffsetNs: state.dataOffset,
          setupWindow: [-state.setupTime, 0],
          holdWindow: [0, state.holdTime],
          violations,
          model: "teaching-setup-hold-window"
        },
        explanation: violations.length
          ? `数据在时钟边沿附近违反 ${violations.join(" 和 ")} 时间。该结果是确定性教学判定，不预测真实器件的亚稳概率或持续时间。`
          : "数据变化位于建立/保持禁区之外，确定性教学判定为可可靠采样；它不替代真实器件时序参数。",
        status: violations.length ? "violation" : "settled"
      };
    },
    enumerate() {
      return [-3, -2, 0, 1, 2].map((dataOffset) => ({
        dataOffset,
        setupTime: 3,
        holdTime: 2
      }));
    }
  }
};

function modelFor(experimentId) {
  const model = MODELS[experimentId];
  if (!model) throw new RangeError(`Unknown experiment model: ${experimentId}`);
  return model;
}

export function initialExperimentState(experimentId) {
  return clone(modelFor(experimentId).initial);
}

export function listExperimentModelIds() {
  return Object.keys(MODELS);
}

export function applyExperimentCommand(experimentId, state, command = {}) {
  const model = modelFor(experimentId);
  const current = clone(state);
  if (command.type === "reset") {
    const reset = clone(model.initial);
    for (const input of Object.keys(model.inputs)) reset[input] = clone(current[input]);
    return model.reset ? clone(model.reset(current, reset)) : reset;
  }
  if (command.type === "pulse" || command.type === "clock.pulse") {
    if (!model.pulse) throw new RangeError(`Experiment ${experimentId} does not accept a clock pulse`);
    return clone(model.pulse(current));
  }
  if (command.type !== "input.set") {
    throw new RangeError(`Unsupported command for ${experimentId}: ${command.type}`);
  }
  const validate = model.inputs[command.input];
  if (!validate || !validate(command.value)) {
    throw new RangeError(`Invalid ${experimentId} input ${command.input}`);
  }
  return model.setInput
    ? clone(model.setInput(current, command.input, clone(command.value)))
    : { ...current, [command.input]: clone(command.value) };
}

export function deriveExperiment(experimentId, state) {
  return clone(modelFor(experimentId).derive(clone(state)));
}

export function enumerateExperimentCases(experimentId) {
  const model = modelFor(experimentId);
  if (!model.enumerate) return [];
  return model.enumerate().map((state) => ({
    state: clone(state),
    ...deriveExperiment(experimentId, state)
  }));
}
