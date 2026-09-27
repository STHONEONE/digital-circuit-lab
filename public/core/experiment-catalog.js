const switchControl = (key, label = key) => ({
  key,
  label,
  kind: "switch",
  values: [0, 1],
  defaultValue: 0
});

const choiceControl = (key, label, values, defaultValue = values[0]) => ({
  key,
  label,
  kind: "choice",
  values,
  defaultValue
});

const actionControl = (key, label) => ({ key, label, kind: "action" });
const truthTableCompletion = (requiredCases) => ({ type: "truth-table-coverage", requiredCases });
const checkpointCompletion = (requiredCheckpoints) => ({ type: "checkpoint-sequence", requiredCheckpoints });
const cycleCompletion = (requiredCycles) => ({ type: "clock-cycle-coverage", requiredCycles });

const EXPERIMENTS = [
  {
    id: "gates",
    version: "1.0.0",
    groupId: "basic-logic",
    title: "基本逻辑门",
    summary: "切换输入并验证 AND、OR、XOR 门的真值表。",
    availability: "available",
    knowledge: ["与门", "或门", "异或门", "真值表"],
    controls: [switchControl("A", "输入 A"), switchControl("B", "输入 B"), choiceControl("gate", "门类型", ["AND", "OR", "XOR"])],
    views: ["circuit", "truth-table", "explanation"],
    completion: truthTableCompletion(12)
  },
  {
    id: "halfAdder",
    version: "1.0.0",
    groupId: "combinational-logic",
    title: "半加器",
    summary: "观察两个一位二进制数相加时的和与进位。",
    availability: "available",
    knowledge: ["半加器", "异或门", "与门"],
    controls: [switchControl("A"), switchControl("B")],
    views: ["circuit", "truth-table", "signal-path"],
    completion: truthTableCompletion(4)
  },
  {
    id: "fullAdder",
    version: "1.0.0",
    groupId: "combinational-logic",
    title: "全加器",
    summary: "验证 A、B 与低位进位 Cin 的求和及进位关系。",
    availability: "available",
    knowledge: ["全加器", "半加器级联", "进位"],
    controls: [switchControl("A"), switchControl("B"), switchControl("Cin", "低位进位 Cin")],
    views: ["circuit", "truth-table", "signal-path", "prediction"],
    completion: truthTableCompletion(8)
  },
  {
    id: "decoder",
    version: "1.0.0",
    groupId: "combinational-logic",
    title: "3-8 译码器",
    summary: "将三位二进制输入译为一路有效输出。",
    availability: "available",
    knowledge: ["译码器", "3-8 译码", "最小项"],
    controls: [switchControl("A2"), switchControl("A1"), switchControl("A0")],
    views: ["chip", "truth-table", "signal-path"],
    completion: truthTableCompletion(8)
  },
  {
    id: "srff",
    version: "1.0.0",
    groupId: "sequential-logic",
    title: "SR 触发器",
    summary: "观察置位、复位、保持及禁用状态。",
    availability: "available",
    knowledge: ["SR 触发器", "置位", "复位"],
    controls: [switchControl("S"), switchControl("R")],
    views: ["circuit", "state-table", "timing"],
    completion: checkpointCompletion(4)
  },
  {
    id: "dff",
    version: "1.0.0",
    groupId: "sequential-logic",
    title: "D 触发器",
    summary: "验证 D 输入在有效时钟沿被采样并保持。",
    availability: "available",
    knowledge: ["D 触发器", "边沿触发", "数据保持"],
    controls: [switchControl("D"), actionControl("pulse", "时钟上升沿")],
    views: ["circuit", "state-table", "timing"],
    completion: cycleCompletion(6)
  },
  {
    id: "tff",
    version: "1.0.0",
    groupId: "sequential-logic",
    title: "T 触发器",
    summary: "观察 T 控制下输出在时钟沿保持或翻转。",
    availability: "available",
    knowledge: ["T 触发器", "翻转", "二分频"],
    controls: [switchControl("T"), actionControl("pulse", "时钟上升沿")],
    views: ["circuit", "state-table", "timing"],
    completion: cycleCompletion(6)
  },
  {
    id: "jkff",
    version: "1.0.0",
    groupId: "sequential-logic",
    title: "JK 触发器",
    summary: "通过时钟沿验证保持、复位、置位和翻转。",
    availability: "available",
    knowledge: ["JK 触发器", "时钟沿", "状态翻转"],
    controls: [switchControl("J"), switchControl("K"), actionControl("pulse", "时钟上升沿")],
    views: ["circuit", "state-table", "timing"],
    completion: cycleCompletion(6)
  }
];

const GROUPS = [
  {
    id: "basic-logic",
    title: "基础逻辑",
    description: "从输入、输出与真值表理解基本逻辑关系。",
    defaultExpanded: true
  },
  {
    id: "combinational-logic",
    title: "组合逻辑",
    description: "通过经典加法与译码电路理解输入和输出关系。",
    defaultExpanded: false
  },
  {
    id: "sequential-logic",
    title: "时序逻辑",
    description: "通过触发器理解时钟、状态与存储。",
    defaultExpanded: false
  }
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function getExperimentDefinition(id) {
  const definition = EXPERIMENTS.find((item) => item.id === id);
  return definition ? clone(definition) : null;
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isAllowedControlValue(control, value) {
  if (control.kind === "action") return false;
  return Array.isArray(control.values) && control.values.some((allowed) => Object.is(allowed, value));
}

export function createExperimentContext(id, clientSnapshot = {}) {
  const definition = EXPERIMENTS.find((item) => item.id === id);
  if (!definition) throw new RangeError(`Unknown experiment: ${id}`);
  const snapshot = isRecord(clientSnapshot) ? clientSnapshot : {};
  const candidateInputs = isRecord(snapshot.inputs) ? snapshot.inputs : snapshot;
  const inputs = {};
  for (const control of definition.controls) {
    if (!Object.hasOwn(candidateInputs, control.key)) continue;
    const value = candidateInputs[control.key];
    if (isAllowedControlValue(control, value)) inputs[control.key] = value;
  }
  return {
    schemaVersion: "experiment-context/v1",
    experimentId: definition.id,
    definitionVersion: definition.version,
    groupId: definition.groupId,
    title: definition.title,
    knowledge: [...definition.knowledge],
    revision: Number.isSafeInteger(snapshot.revision) && snapshot.revision >= 0 ? snapshot.revision : 0,
    inputs
  };
}

export function listExperimentGroups() {
  return clone(GROUPS.map((group) => {
    const experiments = EXPERIMENTS.filter((definition) => definition.groupId === group.id);
    return { ...group, experimentCount: experiments.length, experiments };
  }));
}
