import { getExperimentDefinition } from "./experiment-catalog.js";
import { evaluateCircuitComponent } from "./circuit-catalog.js";
import {
  applyExperimentCommand,
  deriveExperiment,
  initialExperimentState,
  listExperimentModelIds
} from "./experiment-model-library.js";

const MODEL_EXPERIMENTS = new Set(listExperimentModelIds());
const SPECIALIZED_EXPERIMENTS = new Set(["gates", "fullAdder", "decoder", "jkff"]);

function usesSharedModel(experimentId) {
  return MODEL_EXPERIMENTS.has(experimentId) && !SPECIALIZED_EXPERIMENTS.has(experimentId);
}

function clone(value) {
  return structuredClone(value);
}

function initialInputs(definition) {
  return Object.fromEntries(definition.controls
    .filter((control) => control.kind !== "action")
    .map((control) => [control.key, control.defaultValue]));
}

function modelInitialState(experimentId) {
  if (usesSharedModel(experimentId)) return initialExperimentState(experimentId);
  if (experimentId === "jkff") return { Q: 0, previousQ: 0, clockEdge: "idle" };
  return {};
}

function isAllowed(control, value) {
  if (!control || control.kind === "action") return false;
  if (Array.isArray(control.values)) return control.values.some((item) => Object.is(item, value));
  if (control.kind !== "number" || !Number.isFinite(value)) return false;
  if (value < control.min || value > control.max) return false;
  return Math.abs(((value - control.min) / control.step) - Math.round((value - control.min) / control.step)) < 1e-9;
}

function deriveFullAdder(inputs) {
  const xor1 = inputs.A ^ inputs.B;
  const carry1 = inputs.A & inputs.B;
  const carry2 = xor1 & inputs.Cin;
  const [S, Cout] = evaluateCircuitComponent("FULL_ADDER", [inputs.A, inputs.B, inputs.Cin]);
  return {
    outputs: { S, Cout },
    signals: { xor1, carry1, carry2 },
    activeTruthRow: `${inputs.A}${inputs.B}${inputs.Cin}`,
    explanation: Cout
      ? `当前 ${inputs.A}+${inputs.B}+${inputs.Cin} 的结果为 ${S}，至少两个有效输入共同产生进位 Cout=1。`
      : `当前 ${inputs.A}+${inputs.B}+${inputs.Cin} 的结果为 ${S}，有效输入不足两个，因此 Cout=0。`
  };
}

function derive(definition, inputs, state) {
  if (usesSharedModel(definition.id)) {
    const result = deriveExperiment(definition.id, state);
    return {
      ...result,
      activeTruthRow: Object.values(inputs).join("")
    };
  }
  if (definition.id === "gates") {
    const [Y] = evaluateCircuitComponent(inputs.gate, [inputs.A, inputs.B]);
    return {
      outputs: { Y },
      signals: { A: inputs.A, B: inputs.B },
      activeTruthRow: `${inputs.gate}:${inputs.A}${inputs.B}`,
      explanation: `${inputs.gate} 门在 A=${inputs.A}、B=${inputs.B} 时输出 Y=${Y}。`
    };
  }
  if (definition.id === "fullAdder") return deriveFullAdder(inputs);
  if (definition.id === "decoder") {
    const active = inputs.A2 * 4 + inputs.A1 * 2 + inputs.A0;
    const outputs = { active };
    for (let index = 0; index < 8; index += 1) outputs[`Y${index}`] = index === active ? 1 : 0;
    return {
      outputs,
      signals: { selected: `Y${active}` },
      activeTruthRow: `${inputs.A2}${inputs.A1}${inputs.A0}`,
      explanation: `输入 ${inputs.A2}${inputs.A1}${inputs.A0} 选择输出 Y${active}。`
    };
  }
  if (definition.id === "jkff") {
    const action = inputs.J === 0 && inputs.K === 0 ? "保持"
      : inputs.J === 0 && inputs.K === 1 ? "复位"
        : inputs.J === 1 && inputs.K === 0 ? "置位" : "翻转";
    return {
      outputs: { Q: state.Q, notQ: state.Q ? 0 : 1 },
      signals: { clockEdge: state.clockEdge },
      activeTruthRow: `${inputs.J}${inputs.K}`,
      explanation: state.clockEdge === "rising"
        ? `时钟上升沿执行${action}，Q 从 ${state.previousQ} 变为 ${state.Q}。`
        : `当前 J=${inputs.J}、K=${inputs.K}，下一个时钟上升沿将执行${action}。`
    };
  }
  return {
    outputs: {},
    signals: {},
    activeTruthRow: "",
    explanation: definition.summary
  };
}

export function createExperimentRuntime(experimentId, options = {}) {
  const definition = getExperimentDefinition(experimentId);
  if (!definition) throw new RangeError(`Unknown experiment: ${experimentId}`);
  let state = { ...initialInputs(definition), ...modelInitialState(definition.id), ...(options.state || {}) };
  let revision = Number.isSafeInteger(options.revision) ? Math.max(0, options.revision) : 0;
  let disposed = false;
  const listeners = new Set();

  const buildSnapshot = () => {
    const inputs = Object.fromEntries(definition.controls
      .filter((control) => control.kind !== "action")
      .map((control) => [control.key, state[control.key]]));
    const result = derive(definition, inputs, state);
    return clone({
      experimentId: definition.id,
      definitionVersion: definition.version,
      revision,
      state,
      inputs,
      outputs: result.outputs,
      signals: result.signals,
      activeTruthRow: result.activeTruthRow,
      explanation: result.explanation,
      status: result.status || "settled",
      diagnostics: result.status && result.status !== "settled"
        ? [{ code: `MODEL_${result.status.toUpperCase()}`, message: result.explanation }]
        : []
    });
  };

  const notify = () => {
    const next = buildSnapshot();
    listeners.forEach((listener) => listener(next));
    return next;
  };

  return {
    snapshot() {
      return buildSnapshot();
    },
    dispatch(command = {}) {
      if (disposed) return { ok: false, error: { code: "RUNTIME_DISPOSED", message: "实验运行时已关闭。" } };
      if (usesSharedModel(definition.id)) {
        if (command.type === "input.set") {
          const control = definition.controls.find((item) => item.key === command.input);
          if (!isAllowed(control, command.value)) {
            return { ok: false, error: { code: "INPUT_INVALID", message: "实验输入无效。" }, snapshot: buildSnapshot() };
          }
        }
        try {
          state = applyExperimentCommand(definition.id, state, command);
          revision += 1;
          return { ok: true, snapshot: notify() };
        } catch (error) {
          return {
            ok: false,
            error: {
              code: command.type === "input.set" ? "INPUT_INVALID" : "COMMAND_INVALID",
              message: error instanceof Error ? error.message : "实验命令无效。"
            },
            snapshot: buildSnapshot()
          };
        }
      }
      if (command.type === "clock.pulse" && definition.id === "jkff") {
        const previousQ = state.Q;
        const Q = state.J === 0 && state.K === 0 ? state.Q
          : state.J === 0 && state.K === 1 ? 0
            : state.J === 1 && state.K === 0 ? 1 : state.Q ? 0 : 1;
        state = { ...state, previousQ, Q, clockEdge: "rising" };
        revision += 1;
        return { ok: true, snapshot: notify() };
      }
      if (command.type !== "input.set") {
        return { ok: false, error: { code: "COMMAND_INVALID", message: "不支持的实验命令。" }, snapshot: buildSnapshot() };
      }
      const control = definition.controls.find((item) => item.key === command.input);
      if (!isAllowed(control, command.value)) {
        return { ok: false, error: { code: "INPUT_INVALID", message: "实验输入无效。" }, snapshot: buildSnapshot() };
      }
      state = { ...state, [command.input]: command.value, ...(definition.id === "jkff" ? { clockEdge: "idle" } : {}) };
      revision += 1;
      return { ok: true, snapshot: notify() };
    },
    subscribe(listener) {
      if (typeof listener !== "function") throw new TypeError("listener must be a function");
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      disposed = true;
      listeners.clear();
    }
  };
}
