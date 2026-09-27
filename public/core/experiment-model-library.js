function clone(value) {
  return structuredClone(value);
}

function binary(value) {
  return value === 0 || value === 1;
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

const MODELS = {
  halfAdder: {
    initial: { A: 0, B: 0 },
    inputs: { A: binary, B: binary },
    derive: halfAdderResult,
    enumerate() {
      return [0, 1].flatMap((A) => [0, 1].map((B) => ({ A, B })));
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
          ? "S=1、R=1 是 SR 触发器的禁用输入，教学模型不为该状态给出确定输出。"
          : `S=${state.S}、R=${state.R}，当前存储状态 Q=${state.Q}。`,
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
        explanation: `最近一个时钟上升沿采样 D=${state.Q}，当前 Q=${state.Q}；两个时钟沿之间保持不变。`,
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
        signals: { J: state.J, K: state.K, previousQ: state.previousQ, clockCount: state.clockCount, action },
        explanation: `J=${state.J}、K=${state.K}，时钟沿执行“${action}”，当前 Q=${state.Q}。`,
        status: "settled"
      };
    },
    enumerate() {
      return [0, 1].flatMap((Q) => [0, 1].flatMap((J) => [0, 1].map((K) => ({
        J, K, Q, previousQ: Q, clockCount: 0
      }))));
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
  return model.enumerate().map((state) => ({ state: clone(state), ...deriveExperiment(experimentId, state) }));
}
