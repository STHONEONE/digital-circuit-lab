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

const numberControl = (key, label, min, max, defaultValue, step = 1) => ({
  key,
  label,
  kind: "number",
  min,
  max,
  step,
  defaultValue
});

const actionControl = (key, label) => ({ key, label, kind: "action" });
const truthTableCompletion = (requiredCases) => ({
  type: "truth-table-coverage",
  requiredCases
});
const checkpointCompletion = (requiredCheckpoints) => ({
  type: "checkpoint-sequence",
  requiredCheckpoints
});
const cycleCompletion = (requiredCycles) => ({
  type: "clock-cycle-coverage",
  requiredCycles
});

const EXPERIMENTS = [
  {
    id: "gates",
    version: "1.0.0",
    groupId: "basic-logic",
    title: "基本逻辑门",
    summary: "切换输入并验证 AND、OR、XOR 门的真值表。",
    availability: "available",
    knowledge: ["与门", "或门", "异或门", "真值表"],
    controls: [
      switchControl("A", "输入 A"),
      switchControl("B", "输入 B"),
      choiceControl("gate", "门类型", ["AND", "OR", "XOR"])
    ],
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
    controls: [
      switchControl("A"),
      switchControl("B"),
      switchControl("Cin", "低位进位 Cin")
    ],
    views: ["circuit", "truth-table", "signal-path", "prediction"],
    completion: truthTableCompletion(8)
  },
  {
    id: "halfSubtractor",
    version: "1.0.0",
    groupId: "combinational-logic",
    title: "半减器",
    summary: "观察一位减法的差与借位输出。",
    availability: "planned",
    knowledge: ["半减器", "异或门", "借位"],
    controls: [switchControl("A", "被减数 A"), switchControl("B", "减数 B")],
    views: ["circuit", "truth-table", "signal-path"],
    completion: truthTableCompletion(4)
  },
  {
    id: "fullSubtractor",
    version: "1.0.0",
    groupId: "combinational-logic",
    title: "全减器",
    summary: "验证被减数、减数和低位借位共同作用的结果。",
    availability: "available",
    knowledge: ["全减器", "半减器级联", "借位"],
    controls: [
      switchControl("A", "被减数 A"),
      switchControl("B", "减数 B"),
      switchControl("Bin", "低位借位 Bin")
    ],
    views: ["circuit", "truth-table", "signal-path"],
    completion: truthTableCompletion(8)
  },
  {
    id: "multiplexer",
    version: "1.0.0",
    groupId: "combinational-logic",
    title: "多路选择器（MUX）",
    summary: "使用选择信号从多路输入中选出一路。",
    availability: "available",
    knowledge: ["多路选择器", "数据选择", "选择信号"],
    controls: [
      switchControl("D0"), switchControl("D1"),
      switchControl("D2"), switchControl("D3"),
      choiceControl("select", "选择端 S1S0", ["00", "01", "10", "11"])
    ],
    views: ["circuit", "truth-table", "signal-path"],
    completion: checkpointCompletion(4)
  },
  {
    id: "demultiplexer",
    version: "1.0.0",
    groupId: "combinational-logic",
    title: "多路分配器（DEMUX）",
    summary: "把一路数据按选择信号送至指定输出。",
    availability: "available",
    knowledge: ["多路分配器", "数据分配", "选择信号"],
    controls: [
      switchControl("D", "数据输入 D"),
      choiceControl("select", "选择端 S1S0", ["00", "01", "10", "11"])
    ],
    views: ["circuit", "truth-table", "signal-path"],
    completion: checkpointCompletion(4)
  },
  {
    id: "encoder",
    version: "1.0.0",
    groupId: "combinational-logic",
    title: "编码器",
    summary: "把有效输入线转换为二进制编码。",
    availability: "planned",
    knowledge: ["编码器", "优先编码", "二进制编码"],
    controls: [
      choiceControl("mode", "编码器类型", ["普通 8-3", "优先 8-3"]),
      choiceControl("activeInput", "有效输入", ["I0", "I1", "I2", "I3", "I4", "I5", "I6", "I7"])
    ],
    views: ["chip", "truth-table", "signal-path"],
    completion: checkpointCompletion(8)
  },
  {
    id: "decoder",
    version: "1.0.0",
    groupId: "combinational-logic",
    title: "3-8 译码器",
    summary: "把三位二进制输入译为一路有效输出。",
    availability: "available",
    knowledge: ["译码器", "3-8 译码", "最小项"],
    controls: [switchControl("A2"), switchControl("A1"), switchControl("A0")],
    views: ["chip", "truth-table", "signal-path"],
    completion: truthTableCompletion(8)
  },
  {
    id: "comparator",
    version: "1.0.0",
    groupId: "combinational-logic",
    title: "数值比较器",
    summary: "比较两个多位二进制数的大小关系。",
    availability: "available",
    knowledge: ["数值比较器", "级联比较", "大小关系"],
    controls: [
      numberControl("A", "数值 A", 0, 15, 0),
      numberControl("B", "数值 B", 0, 15, 0)
    ],
    views: ["circuit", "comparison", "truth-table"],
    completion: checkpointCompletion(6)
  },
  {
    id: "parityChecker",
    version: "1.0.0",
    groupId: "combinational-logic",
    title: "奇偶校验器",
    summary: "生成并检查数据字的奇校验或偶校验位。",
    availability: "available",
    knowledge: ["奇偶校验", "异或运算", "检错码"],
    controls: [
      choiceControl("data", "4 位数据", ["0000", "0001", "0011", "0111", "1111"]),
      choiceControl("parity", "校验方式", ["even", "odd"])
    ],
    views: ["circuit", "truth-table", "bit-inspector"],
    completion: checkpointCompletion(5)
  },
  {
    id: "bcdSevenSegment",
    version: "1.0.0",
    groupId: "combinational-logic",
    title: "BCD-7 段译码器",
    summary: "把 BCD 码转换为七段数码管的段选信号。",
    availability: "available",
    knowledge: ["BCD 码", "七段译码", "数码管"],
    controls: [numberControl("digit", "十进制数字", 0, 9, 0)],
    views: ["chip", "seven-segment", "truth-table"],
    completion: checkpointCompletion(10)
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
    knowledge: ["JK 触发器", "特性方程", "边沿触发"],
    controls: [
      switchControl("J"),
      switchControl("K"),
      actionControl("pulse", "时钟上升沿")
    ],
    views: ["circuit", "state-table", "timing"],
    completion: cycleCompletion(8)
  },
  {
    id: "register",
    version: "1.0.0",
    groupId: "sequential-logic",
    title: "并行寄存器",
    summary: "在时钟沿并行装载并保持多位数据。",
    availability: "available",
    knowledge: ["寄存器", "并行装载", "数据保持"],
    controls: [
      choiceControl("data", "4 位输入", ["0000", "0101", "1010", "1111"]),
      switchControl("load", "装载使能"),
      actionControl("pulse", "时钟上升沿")
    ],
    views: ["circuit", "register-state", "timing"],
    completion: cycleCompletion(6)
  },
  {
    id: "shiftRegister",
    version: "1.0.0",
    groupId: "sequential-logic",
    title: "移位寄存器",
    summary: "逐拍观察串行数据在寄存器各级间移动。",
    availability: "available",
    knowledge: ["移位寄存器", "串并转换", "时序传递"],
    controls: [
      switchControl("serialIn", "串行输入"),
      choiceControl("direction", "移位方向", ["left", "right"]),
      actionControl("pulse", "时钟上升沿")
    ],
    views: ["circuit", "register-state", "timing"],
    completion: cycleCompletion(8)
  },
  {
    id: "synchronousCounter",
    version: "1.0.0",
    groupId: "sequential-logic",
    title: "同步计数器",
    summary: "观察所有触发器在同一时钟沿同步更新。",
    availability: "available",
    knowledge: ["同步计数器", "计数模值", "同步时钟"],
    controls: [
      switchControl("enable", "计数使能"),
      actionControl("pulse", "时钟上升沿"),
      actionControl("reset", "复位")
    ],
    views: ["circuit", "state-sequence", "timing"],
    completion: cycleCompletion(16)
  },
  {
    id: "asynchronousCounter",
    version: "1.0.0",
    groupId: "sequential-logic",
    title: "异步计数器",
    summary: "观察逐级触发带来的计数状态和传播延迟。",
    availability: "available",
    knowledge: ["异步计数器", "脉动计数", "累积延迟"],
    controls: [actionControl("pulse", "时钟上升沿"), actionControl("reset", "复位")],
    views: ["circuit", "state-sequence", "timing"],
    completion: cycleCompletion(16)
  },
  {
    id: "finiteStateMachine",
    version: "1.0.0",
    groupId: "sequential-logic",
    title: "有限状态机（FSM）",
    summary: "在输入序列驱动下观察状态转移和输出。",
    availability: "available",
    knowledge: ["有限状态机", "状态转移", "Mealy 与 Moore"],
    controls: [
      switchControl("input", "输入 X"),
      actionControl("pulse", "时钟上升沿"),
      actionControl("reset", "复位")
    ],
    views: ["state-diagram", "state-table", "timing"],
    completion: checkpointCompletion(8)
  },
  {
    id: "propagationDelay",
    version: "1.0.0",
    groupId: "advanced-topics",
    title: "传播延迟",
    summary: "比较输入变化与各级输出响应之间的时间差。",
    availability: "available",
    knowledge: ["传播延迟", "门延迟", "关键路径"],
    controls: [
      switchControl("input", "输入 X"),
      numberControl("gateDelay", "单级门延迟（ns）", 1, 20, 5)
    ],
    views: ["circuit", "timing", "delay-measurement"],
    completion: checkpointCompletion(5)
  },
  {
    id: "hazards",
    version: "1.0.0",
    groupId: "advanced-topics",
    title: "竞争与冒险",
    summary: "观察不同路径延迟造成的瞬态毛刺并尝试消除。",
    availability: "available",
    knowledge: ["竞争", "静态冒险", "毛刺消除"],
    controls: [
      switchControl("A"), switchControl("B"), switchControl("C"),
      choiceControl("circuit", "电路版本", ["hazardous", "consensus-term"])
    ],
    views: ["circuit", "timing", "hazard-highlight"],
    completion: checkpointCompletion(4)
  },
  {
    id: "setupHold",
    version: "1.0.0",
    groupId: "advanced-topics",
    title: "建立与保持时间",
    summary: "调整数据相对时钟沿的位置并判断采样是否可靠。",
    availability: "available",
    knowledge: ["建立时间", "保持时间", "亚稳态"],
    controls: [
      numberControl("dataOffset", "数据变化偏移（ns）", -10, 10, -5),
      numberControl("setupTime", "建立时间（ns）", 1, 10, 3),
      numberControl("holdTime", "保持时间（ns）", 1, 10, 2)
    ],
    views: ["timing", "sampling-window", "result"],
    completion: checkpointCompletion(6)
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
    description: "输出仅由当前输入决定的常用组合电路。",
    defaultExpanded: false
  },
  {
    id: "sequential-logic",
    title: "时序逻辑",
    description: "通过时钟、状态和波形理解带记忆的电路。",
    defaultExpanded: false
  },
  {
    id: "advanced-topics",
    title: "进阶主题",
    description: "探索真实数字电路中的延迟、冒险与时序约束。",
    defaultExpanded: false
  }
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

/**
 * Return a detached experiment definition, or null when the id is unknown.
 * Callers may safely decorate the returned object for presentation.
 */
export function getExperimentDefinition(id) {
  const definition = EXPERIMENTS.find((item) => item.id === id);
  return definition ? clone(definition) : null;
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isAllowedControlValue(control, value) {
  if (control.kind === "action") return false;
  if (Array.isArray(control.values)) return control.values.some((allowed) => Object.is(allowed, value));
  if (control.kind !== "number" || typeof value !== "number" || !Number.isFinite(value)) return false;
  if (value < control.min || value > control.max) return false;
  const steps = (value - control.min) / control.step;
  return Math.abs(steps - Math.round(steps)) < Number.EPSILON * 10;
}

/**
 * Build the client-safe half of the experiment/AI context contract.
 * Derived outputs and signals must be appended only after trusted simulation.
 */
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
    revision: Number.isSafeInteger(snapshot.revision) && snapshot.revision >= 0
      ? snapshot.revision
      : 0,
    inputs
  };
}

/**
 * Return the curriculum in display order. The first group is open by default;
 * consumers own subsequent accordion state.
 */
export function listExperimentGroups() {
  return clone(GROUPS.map((group) => {
    const experiments = EXPERIMENTS.filter((definition) => definition.groupId === group.id);
    return {
      ...group,
      experimentCount: experiments.length,
      experiments
    };
  }));
}
