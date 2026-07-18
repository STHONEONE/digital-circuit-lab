import { getExperimentDefinition, listExperimentGroups } from "./core/experiment-catalog.js";
import {
  applyExperimentCommand,
  deriveExperiment,
  enumerateExperimentCases,
  initialExperimentState,
  listExperimentModelIds
} from "./core/experiment-model-library.js";

const experiments = {
  gates: {
    name: "基本逻辑门",
    chapter: "实验一",
    state: { A: 0, B: 0, gate: "AND" },
    controls: [
      { key: "A", label: "输入 A", values: [0, 1] },
      { key: "B", label: "输入 B", values: [0, 1] },
      { key: "gate", label: "门类型", values: ["AND", "OR", "XOR"] }
    ],
    calculate(state) {
      if (state.gate === "AND") return { Y: state.A && state.B ? 1 : 0 };
      if (state.gate === "OR") return { Y: state.A || state.B ? 1 : 0 };
      return { Y: state.A !== state.B ? 1 : 0 };
    },
    rows(state) {
      return [[0, 0], [0, 1], [1, 0], [1, 1]].map(([A, B]) => ({
        values: [A, B, this.calculate({ ...state, A, B }).Y],
        active: A === state.A && B === state.B
      }));
    },
    headers: ["A", "B", "Y"],
    describe(state, output) {
      const rule = state.gate === "AND" ? "两个输入都为 1 时输出才为 1"
        : state.gate === "OR" ? "任意输入为 1，输出就是 1"
          : "两个输入不同时输出为 1";
      return `${state.gate} 门当前输入 A=${state.A}、B=${state.B}，${rule}，所以 Y=${output.Y}。`;
    },
    summary(state) { return `A=${state.A}，B=${state.B}`; },
    symbol(state) { return state.gate; }
  },
  fullAdder: {
    name: "全加器",
    chapter: "实验二",
    state: { A: 0, B: 0, Cin: 0 },
    controls: [
      { key: "A", label: "输入 A", values: [0, 1] },
      { key: "B", label: "输入 B", values: [0, 1] },
      { key: "Cin", label: "低位进位 Cin", values: [0, 1] }
    ],
    calculate(state) {
      const total = state.A + state.B + state.Cin;
      return {
        S: total % 2,
        Cout: total >= 2 ? 1 : 0
      };
    },
    rows(state) {
      return Array.from({ length: 8 }, (_, index) => {
        const A = (index >> 2) & 1;
        const B = (index >> 1) & 1;
        const Cin = index & 1;
        const output = this.calculate({ A, B, Cin });
        return {
          values: [A, B, Cin, output.S, output.Cout],
          active: A === state.A && B === state.B && Cin === state.Cin
        };
      });
    },
    headers: ["A", "B", "Cin", "和 S", "Cout"],
    describe(state, output) {
      const total = state.A + state.B + state.Cin;
      return `全加器同时计算 A、B 和低位进位 Cin。当前 ${state.A}+${state.B}+${state.Cin}=${total}，所以和位 S=${output.S}，向高位进位 Cout=${output.Cout}。`;
    },
    summary(state) { return `A=${state.A}，B=${state.B}，Cin=${state.Cin}`; },
    symbol() { return "FA"; },
    output(output) { return `S=${output.S} Cout=${output.Cout}`; },
    isOn(output) { return output.S || output.Cout; }
  },
  decoder: {
    name: "3-8 译码器",
    chapter: "实验三",
    state: { A2: 0, A1: 0, A0: 0 },
    controls: [
      { key: "A2", label: "A2", values: [0, 1] },
      { key: "A1", label: "A1", values: [0, 1] },
      { key: "A0", label: "A0", values: [0, 1] }
    ],
    calculate(state) {
      const active = state.A2 * 4 + state.A1 * 2 + state.A0;
      return { active, outputs: Array.from({ length: 8 }, (_, index) => index === active ? 1 : 0) };
    },
    rows(state) {
      return Array.from({ length: 8 }, (_, index) => {
        const A2 = (index >> 2) & 1;
        const A1 = (index >> 1) & 1;
        const A0 = index & 1;
        return {
          values: [A2, A1, A0, `Y${index}=1`],
          active: index === this.calculate(state).active
        };
      });
    },
    headers: ["A2", "A1", "A0", "有效输出"],
    describe(state, output) {
      return `输入 ${state.A2}${state.A1}${state.A0} 对应十进制 ${output.active}，因此 Y${output.active}=1，其余输出为 0。`;
    },
    summary(state) { return `A2A1A0=${state.A2}${state.A1}${state.A0}`; },
    symbol() { return "3→8"; },
    output(output) { return `Y${output.active}=1`; },
    isOn() { return true; }
  },
  jkff: {
    name: "JK 触发器",
    chapter: "实验四",
    state: { J: 0, K: 0, clock: 0, Q: 0, previousQ: 0 },
    controls: [
      { key: "J", label: "输入 J", values: [0, 1] },
      { key: "K", label: "输入 K", values: [0, 1] },
      { key: "pulse", label: "时钟", values: ["上升沿"] }
    ],
    apply(state, key, value) {
      if (key === "pulse") {
        return {
          ...state,
          clock: 1,
          previousQ: state.Q,
          Q: this.nextQ(state.J, state.K, state.Q)
        };
      }
      return { ...state, [key]: value, clock: 0 };
    },
    nextQ(J, K, Q) {
      if (J === 0 && K === 0) return Q;
      if (J === 0 && K === 1) return 0;
      if (J === 1 && K === 0) return 1;
      return Q ? 0 : 1;
    },
    calculate(state) { return { Q: state.Q, notQ: state.Q ? 0 : 1 }; },
    rows(state) {
      return [
        { values: [0, 0, "保持", state.Q], active: state.J === 0 && state.K === 0 },
        { values: [0, 1, "复位", 0], active: state.J === 0 && state.K === 1 },
        { values: [1, 0, "置位", 1], active: state.J === 1 && state.K === 0 },
        { values: [1, 1, "翻转", state.Q ? 0 : 1], active: state.J === 1 && state.K === 1 }
      ];
    },
    headers: ["J", "K", "功能", "下次上升沿 Q"],
    describe(state, output) {
      const action = state.J === 0 && state.K === 0 ? "保持"
        : state.J === 0 && state.K === 1 ? "复位"
          : state.J === 1 && state.K === 0 ? "置位"
            : "翻转";
      if (state.clock) {
        return `刚刚出现时钟上升沿，J=${state.J}、K=${state.K} 执行“${action}”：Q 从 ${state.previousQ} 变为 ${output.Q}。`;
      }
      const next = this.nextQ(state.J, state.K, state.Q);
      return `当前 J=${state.J}、K=${state.K}，功能为“${action}”。尚未出现新的上升沿，所以 Q 保持 ${output.Q}；下次上升沿后 Q 将为 ${next}。`;
    },
    summary(state) { return `J=${state.J}，K=${state.K}，CLK=${state.clock ? "↑" : "0"}`; },
    symbol() { return "JK FF"; },
    output(output) { return `Q=${output.Q}`; },
    isOn(output) { return output.Q; },
    demoSteps() {
      return [
        { J: 0, K: 0 }, { pulse: "上升沿" },
        { J: 1, K: 0 }, { pulse: "上升沿" },
        { J: 0, K: 1 }, { pulse: "上升沿" },
        { J: 1, K: 1 }, { pulse: "上升沿" },
        { pulse: "上升沿" }
      ];
    }
  }
};

const chapterNames = {
  "basic-logic": "基础逻辑",
  "combinational-logic": "组合逻辑",
  "sequential-logic": "时序逻辑",
  "advanced-topics": "进阶主题"
};

function compactModelCases(experimentId, state) {
  const definition = getExperimentDefinition(experimentId);
  const inputKeys = definition.controls.filter((control) => control.kind !== "action").map((control) => control.key);
  const allCases = enumerateExperimentCases(experimentId);
  const currentResult = deriveExperiment(experimentId, state);
  const currentCase = { state, ...currentResult };
  const candidates = allCases.length > 32
    ? [...Array.from({ length: 15 }, (_, index) => allCases[Math.round(index * (allCases.length - 1) / 14)]), currentCase]
    : allCases.length ? allCases : [currentCase];
  const seen = new Set();
  const cases = candidates.filter((item) => {
    const key = inputKeys.map((input) => item.state[input]).join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (!cases.some((item) => inputKeys.every((key) => Object.is(item.state[key], state[key])))) cases.push(currentCase);
  return { inputKeys, outputKeys: Object.keys(currentResult.outputs), cases };
}

function createModelExperiment(experimentId) {
  const definition = getExperimentDefinition(experimentId);
  const table = compactModelCases(experimentId, initialExperimentState(experimentId));
  return {
    name: definition.title,
    chapter: chapterNames[definition.groupId] || "扩展实验",
    state: initialExperimentState(experimentId),
    controls: definition.controls.map((control) => ({ ...control })),
    apply(state, key, value) {
      const control = definition.controls.find((item) => item.key === key);
      const command = control?.kind === "action"
        ? { type: key === "pulse" ? "clock.pulse" : key }
        : { type: "input.set", input: key, value };
      return applyExperimentCommand(experimentId, state, command);
    },
    calculate(state) {
      return deriveExperiment(experimentId, state).outputs;
    },
    rows(state) {
      const { inputKeys, outputKeys, cases } = compactModelCases(experimentId, state);
      return cases.map((item) => ({
        values: [...inputKeys.map((key) => item.state[key]), ...outputKeys.map((key) => item.outputs[key])],
        active: inputKeys.every((key) => Object.is(item.state[key], state[key]))
      }));
    },
    headers: [...table.inputKeys, ...table.outputKeys],
    describe(state) {
      return deriveExperiment(experimentId, state).explanation;
    },
    summary(state) {
      return definition.controls.filter((control) => control.kind !== "action")
        .map((control) => `${control.key}=${state[control.key]}`).join("，");
    },
    symbol() { return definition.title.replace(/（.*?）/g, "").slice(0, 8); },
    output(output) { return Object.entries(output).map(([key, value]) => `${key}=${value}`).join(" "); },
    isOn(output) { return Object.values(output).some((value) => value === 1 || /1/.test(String(value))); },
    demoSteps() {
      const inputControls = definition.controls.filter((control) => control.kind !== "action");
      const valuesFor = (control) => control.kind === "number"
        ? [...new Set([control.min, control.defaultValue, control.max])]
        : [...(control.values || [control.defaultValue])];
      const action = definition.controls.find((control) => control.kind === "action" && control.key === "pulse")
        || definition.controls.find((control) => control.kind === "action" && control.key !== "reset");
      if (action) {
        const count = Math.min(8, Number(definition.completion?.requiredCycles || definition.completion?.requiredCheckpoints) || 6);
        return Array.from({ length: count }, (_, index) => {
          const step = {};
          inputControls.forEach((control, controlIndex) => {
            const values = valuesFor(control);
            step[control.key] = values[(index + controlIndex) % values.length];
          });
          step[action.key] = null;
          return step;
        });
      }
      let steps = [{}];
      inputControls.forEach((control) => {
        steps = steps.flatMap((step) => valuesFor(control).map((value) => ({ ...step, [control.key]: value }))).slice(0, 16);
      });
      return steps;
    }
  };
}

listExperimentModelIds().forEach((experimentId) => {
  if (!experiments[experimentId]) experiments[experimentId] = createModelExperiment(experimentId);
});

const experimentGroups = listExperimentGroups();

function svgDefs() {
  return `
    <defs>
      <linearGradient id="componentFill" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#0ea5e9"/>
        <stop offset="100%" stop-color="#1e1b4b"/>
      </linearGradient>
      <filter id="componentShadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="7" stdDeviation="7" flood-color="#38bdf8" flood-opacity=".18"/>
      </filter>
      <filter id="softShadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="5" stdDeviation="5" flood-color="#38bdf8" flood-opacity=".12"/>
      </filter>
      <filter id="signalGlow" x="-80%" y="-80%" width="260%" height="260%">
        <feGaussianBlur stdDeviation="4" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id="greenGlow" x="-80%" y="-80%" width="260%" height="260%">
        <feGaussianBlur stdDeviation="3" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>`;
}

function signalClass(value, green = false) {
  return `signal-line${value ? green ? " logic-high" : " high" : ""}`;
}

function portClass(value, green = false) {
  return `port${value ? green ? " logic-high" : " high" : ""}`;
}

function valueBox(x, y, label, value, high = false, width = 120, height = 66) {
  return `
    <g>
      <rect class="value-box${high ? " high" : ""}" x="${x}" y="${y}" width="${width}" height="${height}" rx="13"/>
      <text class="small-label" x="${x + width / 2}" y="${y + 23}" text-anchor="middle">${label}</text>
      <text class="value-label" x="${x + width / 2}" y="${y + 49}" text-anchor="middle">${value}</text>
    </g>`;
}

function logicGate(type, x, y, label = type) {
  const extra = type === "XOR"
    ? '<path class="gate-detail" d="M-14 0 Q35 50 -14 100"/>'
    : "";
  const body = type === "AND"
    ? '<path class="gate-body" d="M0 0 H48 A52 50 0 0 1 48 100 H0 Z"/>'
    : '<path class="gate-body" d="M0 0 Q40 50 0 100 Q70 100 112 50 Q70 0 0 0 Z"/>';
  return `
    <g transform="translate(${x} ${y})">
      ${extra}${body}
      <text class="chip-label" x="53" y="57" text-anchor="middle">${label}</text>
    </g>`;
}

function renderGateDiagram(state, output) {
  const gateExtra = state.gate === "XOR"
    ? '<path class="gate-detail" d="M296 88 Q365 200 296 312"/>'
    : "";
  const gateBody = state.gate === "AND"
    ? '<path class="gate-body" d="M315 88 H410 A112 112 0 0 1 410 312 H315 Z"/>'
    : '<path class="gate-body" d="M315 88 Q382 200 315 312 Q450 312 545 200 Q450 88 315 88 Z"/>';
  return `
    <svg class="circuit-svg" viewBox="0 0 900 400" role="img"
         aria-label="${state.gate} 门，输入 A 等于 ${state.A}，B 等于 ${state.B}，输出 Y 等于 ${output.Y}">
      <title>${state.gate} 门实时矢量电路图</title>
      ${svgDefs()}
      ${valueBox(30, 70, "输入 A", state.A, state.A === 1)}
      ${valueBox(30, 264, "输入 B", state.B, state.B === 1)}
      <path class="${signalClass(state.A)}" d="M150 103 H255 V145 H315"/>
      <path class="${signalClass(state.B)}" d="M150 297 H255 V255 H315"/>
      <circle class="${portClass(state.A)}" cx="315" cy="145" r="7"/>
      <circle class="${portClass(state.B)}" cx="315" cy="255" r="7"/>
      ${gateExtra}${gateBody}
      <text class="chip-label" x="423" y="208" text-anchor="middle">${state.gate}</text>
      <path class="${signalClass(output.Y, true)}" d="M545 200 H720"/>
      <circle class="${portClass(output.Y, true)}" cx="545" cy="200" r="7"/>
      <circle class="${portClass(output.Y, true)}" cx="720" cy="200" r="7"/>
      ${valueBox(720, 151, "输出 Y", output.Y, output.Y === 1, 145, 98)}
      <text class="small-label" x="423" y="352" text-anchor="middle">
        ${state.gate === "AND" ? "Y = A · B" : state.gate === "OR" ? "Y = A + B" : "Y = A ⊕ B"}
      </text>
      <text id="outputValue" x="792" y="220" text-anchor="middle" opacity="0">${output.Y}</text>
    </svg>`;
}

function renderFullAdderDiagram(state, output, revealOutputs = true) {
  const xorValue = state.A !== state.B ? 1 : 0;
  const carry1 = state.A && state.B ? 1 : 0;
  const carry2 = xorValue && state.Cin ? 1 : 0;
  const accessibleLabel = revealOutputs
    ? `全加器，A 等于 ${state.A}，B 等于 ${state.B}，Cin 等于 ${state.Cin}，S 等于 ${output.S}，Cout 等于 ${output.Cout}`
    : `全加器，A 等于 ${state.A}，B 等于 ${state.B}，Cin 等于 ${state.Cin}，输出尚未验证`;
  return `
    <svg class="circuit-svg" viewBox="0 0 980 410" role="img"
         aria-label="${accessibleLabel}">
      <title>全加器两级半加器矢量电路图</title>
      ${svgDefs()}
      <text class="diagram-caption" x="490" y="25" text-anchor="middle">两级半加器级联结构</text>

      ${valueBox(20, 55, "A", state.A, state.A === 1, 110, 62)}
      ${valueBox(20, 125, "B", state.B, state.B === 1, 110, 62)}
      <path class="${signalClass(state.A)}" d="M130 86 H220"/>
      <path class="${signalClass(state.B)}" d="M130 156 H220"/>

      <rect class="module-body" x="220" y="45" width="205" height="155" rx="20"/>
      <text class="module-title" x="322" y="79" text-anchor="middle">第一级半加器 HA1</text>
      <line class="module-divider" x1="242" y1="92" x2="403" y2="92"/>
      <text class="module-formula" x="322" y="126" text-anchor="middle">X = A ⊕ B</text>
      <text class="module-formula" x="322" y="164" text-anchor="middle">C1 = A · B</text>
      <circle class="${portClass(state.A)}" cx="220" cy="86" r="6"/>
      <circle class="${portClass(state.B)}" cx="220" cy="156" r="6"/>
      <circle class="${portClass(xorValue, true)}" cx="425" cy="86" r="6"/>
      <circle class="${portClass(carry1, true)}" cx="322" cy="200" r="6"/>

      <path class="${signalClass(xorValue, true)}" d="M425 86 H510"/>
      <text class="signal-label" x="467" y="73" text-anchor="middle">X=${xorValue}</text>

      <rect class="module-body" x="510" y="45" width="205" height="155" rx="20"/>
      <text class="module-title" x="612" y="79" text-anchor="middle">第二级半加器 HA2</text>
      <line class="module-divider" x1="532" y1="92" x2="693" y2="92"/>
      <text class="module-formula" x="612" y="126" text-anchor="middle">S = X ⊕ Cin</text>
      <text class="module-formula" x="612" y="164" text-anchor="middle">C2 = X · Cin</text>
      <circle class="${portClass(xorValue, true)}" cx="510" cy="86" r="6"/>
      <circle class="${portClass(state.Cin)}" cx="552" cy="200" r="6"/>
      <circle class="${portClass(output.S, true)}" cx="715" cy="86" r="6"/>
      <circle class="${portClass(carry2, true)}" cx="652" cy="200" r="6"/>

      ${valueBox(455, 238, "Cin", state.Cin, state.Cin === 1, 112, 66)}
      <path class="${signalClass(state.Cin)}" d="M511 238 V218 H552 V200"/>

      <path class="${signalClass(output.S, true)}" d="M715 86 H820"/>
      ${valueBox(820, 38, "和 S", output.S, output.S === 1, 140, 96)}

      <path class="${signalClass(carry2, true)}" d="M652 200 V275 H750"/>
      <path class="${signalClass(carry1, true)}" d="M322 200 V325 H750"/>
      <text class="signal-label" x="674" y="263" text-anchor="middle">C2=${carry2}</text>
      <text class="signal-label" x="675" y="313" text-anchor="middle">C1=${carry1}</text>

      ${logicGate("OR", 720, 250, "+")}
      <path class="${signalClass(output.Cout, true)}" d="M832 300 H850"/>
      ${valueBox(850, 252, "进位 Cout", output.Cout, output.Cout === 1, 110, 96)}

      <text class="small-label" x="490" y="392" text-anchor="middle">
        S=A⊕B⊕Cin　　Cout=A·B+Cin·(A⊕B)
      </text>
      <text id="outputValue" x="900" y="312" text-anchor="middle" opacity="0">S=${output.S} Cout=${output.Cout}</text>
    </svg>`;
}

function renderDecoderDiagram(state, output) {
  const outputLines = output.outputs.map((value, index) => {
    const y = 78 + index * 43;
    return `
      <path class="${signalClass(value, true)}" d="M610 ${y} H785"/>
      <circle class="${portClass(value, true)}" cx="610" cy="${y}" r="6"/>
      <g>
        <rect class="${value ? "active-output" : "value-box"}" x="785" y="${y - 16}" width="150" height="32" rx="9"/>
        <text class="label" x="860" y="${y + 6}" text-anchor="middle">Y${index} = ${value}</text>
      </g>`;
  }).join("");
  return `
    <svg class="circuit-svg" viewBox="0 0 980 440" role="img"
         aria-label="3-8 译码器，输入 ${state.A2}${state.A1}${state.A0}，Y${output.active} 有效">
      <title>3-8 译码器矢量芯片图</title>
      ${svgDefs()}
      ${valueBox(22, 82, "A2", state.A2, state.A2 === 1, 112, 62)}
      ${valueBox(22, 189, "A1", state.A1, state.A1 === 1, 112, 62)}
      ${valueBox(22, 296, "A0", state.A0, state.A0 === 1, 112, 62)}
      <path class="${signalClass(state.A2)}" d="M134 113 H300"/>
      <path class="${signalClass(state.A1)}" d="M134 220 H300"/>
      <path class="${signalClass(state.A0)}" d="M134 327 H300"/>
      <circle class="${portClass(state.A2)}" cx="300" cy="113" r="7"/>
      <circle class="${portClass(state.A1)}" cx="300" cy="220" r="7"/>
      <circle class="${portClass(state.A0)}" cx="300" cy="327" r="7"/>

      <rect class="chip-body" x="300" y="38" width="310" height="365" rx="24"/>
      <text class="chip-label" x="455" y="120" text-anchor="middle">3 → 8</text>
      <text class="chip-subtext" x="455" y="156" text-anchor="middle">BINARY DECODER</text>
      <rect x="354" y="188" width="202" height="102" rx="14" fill="rgba(255,255,255,.12)" stroke="rgba(255,255,255,.45)"/>
      <text class="chip-subtext" x="455" y="222" text-anchor="middle">输入二进制</text>
      <text class="chip-label" x="455" y="260" text-anchor="middle" font-size="30">${state.A2}${state.A1}${state.A0}</text>
      <text class="chip-subtext" x="455" y="327" text-anchor="middle">十进制索引 ${output.active}</text>
      ${outputLines}
      <text id="outputValue" x="860" y="420" text-anchor="middle" opacity="0">Y${output.active}=1</text>
    </svg>`;
}

function renderJkDiagram(state, output) {
  const action = state.J === 0 && state.K === 0 ? "保持"
    : state.J === 0 && state.K === 1 ? "复位"
      : state.J === 1 && state.K === 0 ? "置位"
        : "翻转";
  const nextQ = experiments.jkff.nextQ(state.J, state.K, state.Q);
  return `
    <svg class="circuit-svg" viewBox="0 0 980 430" role="img"
         aria-label="JK 触发器，J 等于 ${state.J}，K 等于 ${state.K}，当前 Q 等于 ${output.Q}">
      <title>JK 触发器矢量逻辑符号</title>
      ${svgDefs()}
      ${valueBox(22, 52, "J", state.J, state.J === 1, 112, 62)}
      ${valueBox(22, 278, "K", state.K, state.K === 1, 112, 62)}

      <rect class="chip-body" x="312" y="35" width="345" height="350" rx="22"/>
      <text class="chip-label" x="485" y="92" text-anchor="middle">JK FLIP-FLOP</text>
      <text class="chip-pin" x="350" y="91">J</text>
      <text class="chip-pin" x="350" y="317">K</text>
      <text class="chip-pin" x="614" y="126">Q</text>
      <text class="chip-pin" x="604" y="303">Q̅</text>

      <path class="${signalClass(state.J)}" d="M134 83 H312"/>
      <path class="${signalClass(state.K)}" d="M134 309 H312"/>
      <circle class="${portClass(state.J)}" cx="312" cy="83" r="7"/>
      <circle class="${portClass(state.K)}" cx="312" cy="309" r="7"/>

      <path d="M312 190 L338 208 L312 226 Z" fill="none" stroke="#fff" stroke-width="3"/>
      <path class="${signalClass(state.clock, true)}" d="M105 208 H312"/>
      <circle class="${portClass(state.clock, true)}" cx="105" cy="208" r="7"/>
      <circle class="${portClass(state.clock, true)}" cx="312" cy="208" r="7"/>
      <path class="clock-pulse${state.clock ? " active" : ""}" d="M24 225 H52 V180 H78 V225 H105"/>
      <text class="small-label" x="65" y="252" text-anchor="middle">CLK ${state.clock ? "↑" : "待触发"}</text>

      <rect class="mode-badge" x="391" y="140" width="188" height="88" rx="15"/>
      <text class="small-label" x="485" y="170" text-anchor="middle">当前功能</text>
      <text class="value-label" x="485" y="204" text-anchor="middle">${action}</text>
      <text class="chip-state-hint" x="485" y="259" text-anchor="middle">下次上升沿 Q=${nextQ}</text>

      ${valueBox(790, 70, "Q", output.Q, output.Q === 1, 145, 96)}
      ${valueBox(790, 247, "Q̅", output.notQ, output.notQ === 1, 145, 96)}
      <path class="${signalClass(output.Q, true)}" d="M657 118 H790"/>
      <path class="${signalClass(output.notQ, true)}" d="M657 295 H790"/>
      <circle class="${portClass(output.Q, true)}" cx="657" cy="118" r="7"/>
      <circle class="${portClass(output.notQ, true)}" cx="657" cy="295" r="7"/>
      <circle class="${portClass(output.Q, true)}" cx="790" cy="118" r="7"/>
      <circle class="${portClass(output.notQ, true)}" cx="790" cy="295" r="7"/>

      <path d="M395 326 C425 350 545 350 575 326" fill="none"
            stroke="rgba(255,255,255,.55)" stroke-width="2.5" stroke-dasharray="7 6"/>
      <path d="M575 326 L566 316 M575 326 L563 331" fill="none"
            stroke="rgba(255,255,255,.72)" stroke-width="2.5"/>
      <text class="chip-subtext" x="485" y="367" text-anchor="middle">内部反馈逻辑</text>
      <text class="small-label" x="485" y="420" text-anchor="middle">J、K、CLK、Q 与 Q̅ 均直接连接到芯片端口</text>
      <text id="outputValue" x="862" y="130" text-anchor="middle" opacity="0">Q=${output.Q}</text>
    </svg>`;
}

function escapeSvgText(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;"
  }[character]));
}

function renderModelDiagram(key, state) {
  const definition = getExperimentDefinition(key);
  const result = deriveExperiment(key, state);
  const inputs = definition.controls.filter((control) => control.kind !== "action")
    .map((control) => [control.key, state[control.key]]);
  const outputs = Object.entries(result.outputs);
  const positions = (count) => {
    if (count <= 1) return [170];
    const step = Math.min(52, 250 / (count - 1));
    const start = 170 - step * (count - 1) / 2;
    return Array.from({ length: count }, (_, index) => start + index * step);
  };
  const inputY = positions(inputs.length);
  const outputY = positions(outputs.length);
  const high = (value) => value === 1 || (typeof value === "string" && value.includes("1"));
  const inputNodes = inputs.map(([label, value], index) => `
    <path class="${signalClass(high(value))}" d="M170 ${inputY[index]} H350"/>
    ${valueBox(35, inputY[index] - 25, escapeSvgText(label), escapeSvgText(value), high(value), 130, 50)}`
  ).join("");
  const outputNodes = outputs.map(([label, value], index) => `
    <path class="${signalClass(high(value), true)}" d="M550 ${outputY[index]} H730"/>
    ${valueBox(735, outputY[index] - 25, escapeSvgText(label), escapeSvgText(value), high(value), 130, 50)}`
  ).join("");
  const statusLabel = {
    settled: "稳定",
    invalid: "禁用状态",
    hazard: "检测到毛刺",
    violation: "时序违例"
  }[result.status] || result.status;
  const signalSummary = Object.entries(result.signals || {}).slice(0, 4)
    .map(([name, value]) => `${name}=${typeof value === "object" ? "动态数据" : value}`).join(" · ");
  return `
    <svg class="circuit-svg model-circuit-svg" viewBox="0 0 900 340" role="img"
         aria-label="${escapeSvgText(definition.title)} 当前输入输出模型">
      <title>${escapeSvgText(definition.title)} 当前输入输出模型</title>
      ${svgDefs()}
      ${inputNodes}
      <g filter="url(#componentShadow)">
        <rect class="chip-body" x="350" y="74" width="200" height="192" rx="22"/>
        <text class="chip-label" x="450" y="145" text-anchor="middle">${escapeSvgText(definition.title.replace(/（.*?）/g, ""))}</text>
        <text class="chip-subtext" x="450" y="177" text-anchor="middle">统一教学模型</text>
        <text class="chip-subtext" x="450" y="209" text-anchor="middle">${escapeSvgText(statusLabel)}</text>
      </g>
      ${outputNodes}
      <text class="small-label" x="450" y="310" text-anchor="middle">${escapeSvgText(signalSummary || definition.summary)}</text>
    </svg>`;
}

function renderCircuitDiagram(key, state, output, options = {}) {
  if (key === "gates") return renderGateDiagram(state, output);
  if (key === "fullAdder") return renderFullAdderDiagram(state, output, options.revealOutputs !== false);
  if (key === "decoder") return renderDecoderDiagram(state, output);
  if (key === "jkff") return renderJkDiagram(state, output);
  return renderModelDiagram(key, state);
}

const maxTimingCycles = 10;
let jkTimingHistory = [];
let jkCycleNumber = 0;

function jkAction(J, K) {
  if (J === 0 && K === 0) return "保持";
  if (J === 0 && K === 1) return "复位";
  if (J === 1 && K === 0) return "置位";
  return "翻转";
}

function recordJkPulse(previous, next) {
  jkCycleNumber += 1;
  jkTimingHistory.push({
    cycle: jkCycleNumber,
    J: previous.J,
    K: previous.K,
    previousQ: previous.Q,
    Q: next.Q,
    notQ: next.Q ? 0 : 1,
    action: jkAction(previous.J, previous.K)
  });
  jkTimingHistory = jkTimingHistory.slice(-maxTimingCycles);
}

function signalY(value, center) {
  return value ? center - 16 : center + 16;
}

function constantTimingPath(samples, key, center, startX, cycleWidth) {
  let currentValue = samples[0][key];
  let path = `M ${startX} ${signalY(currentValue, center)}`;
  samples.forEach((sample, index) => {
    const x = startX + index * cycleWidth;
    if (index > 0 && sample[key] !== currentValue) {
      currentValue = sample[key];
      path += ` V ${signalY(currentValue, center)}`;
    }
    path += ` H ${x + cycleWidth}`;
  });
  return path;
}

function outputTimingPath(samples, invert, center, startX, cycleWidth) {
  let currentValue = invert ? (samples[0].previousQ ? 0 : 1) : samples[0].previousQ;
  let path = `M ${startX} ${signalY(currentValue, center)}`;
  samples.forEach((sample, index) => {
    const x = startX + index * cycleWidth;
    const riseX = x + cycleWidth * .28;
    const nextValue = invert ? sample.notQ : sample.Q;
    path += ` H ${riseX}`;
    if (nextValue !== currentValue) {
      currentValue = nextValue;
      path += ` V ${signalY(currentValue, center)}`;
    }
    path += ` H ${x + cycleWidth}`;
  });
  return path;
}

function clockTimingPath(samples, center, startX, cycleWidth) {
  let path = `M ${startX} ${signalY(0, center)}`;
  samples.forEach((_sample, index) => {
    const x = startX + index * cycleWidth;
    const riseX = x + cycleWidth * .28;
    const fallX = x + cycleWidth * .67;
    path += ` H ${riseX} V ${signalY(1, center)} H ${fallX} V ${signalY(0, center)} H ${x + cycleWidth}`;
  });
  return path;
}

function renderTimingSvg(samples) {
  const startX = 118;
  const cycleWidth = 88;
  const rows = {
    CLK: 58,
    J: 118,
    K: 178,
    Q: 238,
    notQ: 298
  };
  const grid = Array.from({ length: maxTimingCycles + 1 }, (_item, index) => {
    const x = startX + index * cycleWidth;
    return `<path class="timing-grid" d="M${x} 24 V326"/>`;
  }).join("");
  const labels = [
    ["CLK", rows.CLK],
    ["J", rows.J],
    ["K", rows.K],
    ["Q", rows.Q],
    ["Q̅", rows.notQ]
  ].map(([label, y]) => `
    <text class="timing-label" x="50" y="${y + 5}" text-anchor="middle">${label}</text>
    <text class="timing-note" x="88" y="${y - 12}" text-anchor="middle">1</text>
    <text class="timing-note" x="88" y="${y + 21}" text-anchor="middle">0</text>
    <path class="timing-grid" d="M105 ${y + 30} H1010"/>`).join("");
  const cycleMarks = samples.map((sample, index) => {
    const x = startX + index * cycleWidth;
    const riseX = x + cycleWidth * .28;
    const middleX = x + cycleWidth / 2;
    return `
      ${index === samples.length - 1
        ? `<rect class="latest-cycle" x="${x}" y="24" width="${cycleWidth}" height="302" rx="7"/>`
        : ""}
      <path class="timing-edge" d="M${riseX} 24 V326"/>
      <path class="edge-marker" d="M${riseX - 5} 24 L${riseX + 5} 24 L${riseX} 33 Z"/>
      <text class="timing-note" x="${riseX}" y="18" text-anchor="middle">↑${sample.cycle}</text>
      <text class="timing-note" x="${middleX}" y="347" text-anchor="middle">${sample.action}</text>`;
  }).join("");

  return `
    <svg class="timing-svg" viewBox="0 0 1040 365" role="img"
         aria-label="JK 触发器最近 ${samples.length} 个时钟周期的动态时序图">
      <title>JK 触发器动态时序图</title>
      ${grid}${labels}${cycleMarks}
      <path class="timing-signal clock" d="${clockTimingPath(samples, rows.CLK, startX, cycleWidth)}"/>
      <path class="timing-signal input" d="${constantTimingPath(samples, "J", rows.J, startX, cycleWidth)}"/>
      <path class="timing-signal input" d="${constantTimingPath(samples, "K", rows.K, startX, cycleWidth)}"/>
      <path class="timing-signal output" d="${outputTimingPath(samples, false, rows.Q, startX, cycleWidth)}"/>
      <path class="timing-signal output" d="${outputTimingPath(samples, true, rows.notQ, startX, cycleWidth)}"/>
      <text class="timing-note" x="1010" y="359" text-anchor="end">Q 只在黄色虚线上升沿更新</text>
    </svg>`;
}

function renderTimingPanel() {
  const visible = experimentKey === "jkff";
  elements.timingPanel.hidden = !visible;
  if (!visible) return;

  if (!jkTimingHistory.length) {
    elements.timingSummary.textContent = "点击“上升沿”后记录 J、K、Q 与 Q̅，最多保留最近 10 个周期。";
    elements.timingDiagram.innerHTML = `
      <div class="timing-empty">
        暂无时序记录。<br>
        先设置 J、K，再点击“上升沿”观察输出如何变化。
      </div>`;
    return;
  }

  const latest = jkTimingHistory.at(-1);
  elements.timingSummary.textContent = `已记录 ${jkTimingHistory.length} 个周期；最近一次为${latest.action}，Q：${latest.previousQ} → ${latest.Q}。`;
  elements.timingDiagram.innerHTML = renderTimingSvg(jkTimingHistory);
  elements.timingDiagram.scrollLeft = elements.timingDiagram.scrollWidth;
}

let experimentKey = "gates";
let demoTimer = null;
let demoRunId = 0;
let demoActive = false;
let demoPauseResolve = null;
let activeSpeech = null;
let activeTutorController = null;
let tutorConversation = [];
let fullAdderSession = null;
let fullAdderSessionPromise = null;
let latestExperimentReport = null;
let predictionDraft = { S: null, Cout: null };
let predictionSubmittedCase = "";
let predictionSubmissionPendingCase = "";
const pendingExperimentEventIds = new Map();
let catalogSearch = "";
const expandedGroups = new Set(experimentGroups.filter((group) => group.defaultExpanded).map((group) => group.id));
const learnerIdStorageKey = "digital-circuit-learner-id";
const labStateStorageKey = "digital-circuit-lab-state-v1";

function sanitizeExperimentState(experimentId, candidate) {
  const current = experiments[experimentId];
  if (!current || !candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
  const restored = { ...current.state };
  Object.entries(current.state).forEach(([key, defaultValue]) => {
    const value = candidate[key];
    const control = current.controls.find((item) => item.key === key);
    if (Array.isArray(control?.values)) {
      if (control.values.includes(value)) restored[key] = value;
      return;
    }
    if (control?.kind === "number") {
      const min = Number(control.min);
      const max = Number(control.max);
      const step = Number(control.step) || 1;
      const stepOffset = (value - min) / step;
      if (Number.isFinite(value) && value >= min && value <= max
          && Math.abs(stepOffset - Math.round(stepOffset)) < 1e-9) restored[key] = value;
      return;
    }
    if (typeof defaultValue === "number" && Number.isFinite(value) && Number.isInteger(value)) {
      if (["count", "previousCount"].includes(key) && value >= 0 && value <= 15) restored[key] = value;
      else if (key === "clockCount" && value >= 0 && value <= 1_000_000) restored[key] = value;
      else if (key === "stageDelayNs" && value >= 1 && value <= 20) restored[key] = value;
      else if (!["count", "previousCount", "clockCount", "stageDelayNs"].includes(key)
          && [0, 1].includes(defaultValue) && [0, 1].includes(value)) restored[key] = value;
      return;
    }
    if (typeof defaultValue === "string" && typeof value === "string") {
      if (/^[01]+$/.test(defaultValue) && value.length === defaultValue.length && /^[01]+$/.test(value)) {
        restored[key] = value;
      } else if (["currentState", "previousState"].includes(key)
          && ["IDLE", "SEEN_1", "SEEN_10"].includes(value)) {
        restored[key] = value;
      }
      return;
    }
    if (typeof defaultValue === "boolean" && typeof value === "boolean") restored[key] = value;
  });
  return restored;
}

function persistLabState() {
  try {
    localStorage.setItem(labStateStorageKey, JSON.stringify({
      version: 1,
      experimentKey,
      experimentStates: Object.fromEntries(Object.entries(experiments).map(([id, value]) => [id, value.state])),
      expandedGroups: [...expandedGroups],
      jkTimingHistory,
      jkCycleNumber
    }));
  } catch {
    // The lab remains fully usable when storage is unavailable or full.
  }
}

function restoreLabState() {
  try {
    const saved = JSON.parse(localStorage.getItem(labStateStorageKey) || "null");
    if (!saved || saved.version !== 1) return;
    Object.keys(experiments).forEach((id) => {
      const state = sanitizeExperimentState(id, saved.experimentStates?.[id]);
      if (state) experiments[id].state = state;
    });
    if (experiments[saved.experimentKey]) experimentKey = saved.experimentKey;

    const validGroupIds = new Set(experimentGroups.map((group) => group.id));
    if (Array.isArray(saved.expandedGroups)) {
      expandedGroups.clear();
      saved.expandedGroups.filter((id) => validGroupIds.has(id)).forEach((id) => expandedGroups.add(id));
    }

    if (Array.isArray(saved.jkTimingHistory)) {
      jkTimingHistory = saved.jkTimingHistory.filter((sample) => sample
        && Number.isInteger(sample.cycle)
        && ["J", "K", "previousQ", "Q", "notQ"].every((key) => sample[key] === 0 || sample[key] === 1)
        && typeof sample.action === "string").slice(-maxTimingCycles);
    }
    jkCycleNumber = Number.isInteger(saved.jkCycleNumber) && saved.jkCycleNumber >= 0
      ? saved.jkCycleNumber
      : (jkTimingHistory.at(-1)?.cycle || 0);
  } catch {
    // Ignore corrupt or incompatible snapshots and start from safe defaults.
  }
}

function getLearnerId() {
  try {
    const existing = localStorage.getItem(learnerIdStorageKey);
    if (/^[a-zA-Z0-9_-]{1,100}$/.test(existing || "")) return existing;
    const created = globalThis.crypto?.randomUUID?.()
      || `learner-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(learnerIdStorageKey, created);
    return created;
  } catch {
    return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

const learnerId = getLearnerId();

async function labApi(url, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set("X-Learner-Id", learnerId);
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(url, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "实验数据请求失败");
  return data;
}

function markLearningDataUpdated() {
  try {
    localStorage.setItem("digital-circuit-learning-data-version", JSON.stringify({ learnerId, updatedAt: Date.now() }));
  } catch {
    // The learning report refreshes again when it receives focus.
  }
}

function fullAdderCaseKey(state = experiment().state) {
  return `${state.A}${state.B}${state.Cin}`;
}

function isCurrentFullAdderCaseVerified() {
  return experimentKey !== "fullAdder"
    || Boolean(fullAdderSession?.testedCases?.includes(fullAdderCaseKey()));
}

function pendingFullAdderPrediction(session = fullAdderSession, state = experiments.fullAdder.state) {
  if (experimentKey !== "fullAdder" || session?.status !== "active") return null;
  const key = fullAdderCaseKey(state);
  if (session.testedCases?.includes(key)) return null;
  return [...(session.predictions || [])].reverse().find((item) => (
    item.caseKey === key
    && !(session.runs || []).some((run) => run.caseKey === key && run.revision > item.revision)
  )) || null;
}

function restoreFullAdderPendingPrediction(session = fullAdderSession) {
  if (experimentKey !== "fullAdder" || !session) return null;
  const key = fullAdderCaseKey();
  const pending = pendingFullAdderPrediction(session);
  if (pending) {
    predictionDraft = { ...pending.prediction };
    predictionSubmittedCase = key;
  } else if (session.testedCases?.includes(key) && predictionSubmittedCase === key) {
    predictionSubmittedCase = "";
  }
  return pending;
}

function isFullAdderPredictionLocked() {
  if (experimentKey !== "fullAdder") return false;
  return Boolean(pendingFullAdderPrediction()) || predictionSubmissionPendingCase === fullAdderCaseKey();
}

async function ensureFullAdderSession() {
  if (fullAdderSession?.status === "active") {
    restoreFullAdderPendingPrediction(fullAdderSession);
    return fullAdderSession;
  }
  if (fullAdderSessionPromise) return fullAdderSessionPromise;
  fullAdderSessionPromise = labApi("/api/experiment-sessions", {
    method: "POST",
    body: JSON.stringify({ experimentId: "fullAdder" })
  }).then((session) => {
    fullAdderSession = session;
    restoreFullAdderPendingPrediction(session);
    return session;
  }).finally(() => {
    fullAdderSessionPromise = null;
  });
  return fullAdderSessionPromise;
}

const ids = [
  "experimentTabs", "experimentSearch", "experimentChapter", "experimentTitle", "controls", "circuitDiagram", "circuitPanel",
  "timingPanel", "timingSummary", "timingDiagram", "clearTimingButton",
  "stateExplanation", "truthTable",
  "demoButton", "speakButton", "tutorFace", "voiceStatus", "labMessages",
  "stateQuestionButton", "voiceButton", "labQuestion", "askButton",
  "guideButton", "focusButton", "fullscreenButton", "screenshotButton", "exportReportButton", "toolStatus",
  "experimentGuide", "guideObjective", "guideSteps", "fullAdderChallenge", "coverageText", "coverageBar",
  "submitPredictionButton", "runVerificationButton", "predictionFeedback", "experimentRunLog",
  "experimentConclusion", "completeExperimentButton"
];
const elements = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));

function experiment() {
  return experiments[experimentKey];
}

function renderTabs() {
  elements.experimentTabs.innerHTML = "";
  const query = catalogSearch.trim().toLowerCase();
  let visibleCount = 0;
  experimentGroups.forEach((group) => {
    const matches = group.experiments.filter((definition) => {
      if (!query) return true;
      return [definition.title, definition.summary, ...(definition.knowledge || [])]
        .join(" ").toLowerCase().includes(query);
    });
    if (!matches.length) return;
    visibleCount += matches.length;
    const section = document.createElement("section");
    section.className = "experiment-group";
    section.dataset.experimentGroup = group.id;
    const open = query ? true : expandedGroups.has(group.id);
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "experiment-group-toggle";
    toggle.setAttribute("aria-expanded", String(open));
    toggle.innerHTML = `<span><strong>${group.title}</strong><small>${group.description}</small></span><b>${matches.length}</b><i aria-hidden="true">⌄</i>`;
    const items = document.createElement("div");
    items.className = "experiment-group-items";
    items.hidden = !open;
    toggle.addEventListener("click", () => {
      if (expandedGroups.has(group.id)) expandedGroups.delete(group.id);
      else expandedGroups.add(group.id);
      persistLabState();
      renderTabs();
    });
    matches.forEach((definition) => {
      if (definition.availability === "available" && experiments[definition.id]) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "experiment-item";
        button.classList.toggle("active", definition.id === experimentKey);
        button.setAttribute("aria-pressed", String(definition.id === experimentKey));
        button.innerHTML = `<span><strong>${definition.title}</strong><small>${definition.summary}</small></span><b>进入</b>`;
        button.addEventListener("click", async () => {
          stopDemo();
          activeTutorController?.abort();
          experimentKey = definition.id;
          expandedGroups.add(group.id);
          predictionDraft = { S: null, Cout: null };
          predictionSubmittedCase = "";
          persistLabState();
          render();
          if (definition.id === "fullAdder") {
            try {
              await ensureFullAdderSession();
              if (experimentKey === "fullAdder") render();
            } catch (error) {
              elements.predictionFeedback.textContent = `实验记录暂时不可用：${error.message}`;
            }
          }
        });
        items.append(button);
      } else {
        const planned = document.createElement("div");
        planned.className = "experiment-item planned";
        planned.innerHTML = `<span><strong>${definition.title}</strong><small>${definition.summary}</small></span><b>规划中</b>`;
        items.append(planned);
      }
    });
    section.append(toggle, items);
    elements.experimentTabs.append(section);
  });
  if (!visibleCount) elements.experimentTabs.innerHTML = '<p class="experiment-search-empty">没有匹配的实验，请换一个关键词。</p>';
}

function renderControls() {
  const current = experiment();
  const controlsLocked = isFullAdderPredictionLocked();
  elements.controls.innerHTML = "";
  current.controls.forEach((control) => {
    const group = document.createElement("div");
    group.className = "control-group";
    const label = document.createElement("span");
    label.textContent = control.label;
    group.append(label);
    if (control.kind === "number") {
      const input = document.createElement("input");
      input.type = "range";
      input.min = control.min;
      input.max = control.max;
      input.step = control.step;
      input.value = current.state[control.key];
      input.disabled = controlsLocked;
      input.setAttribute("aria-label", control.label);
      const valueLabel = document.createElement("output");
      valueLabel.textContent = current.state[control.key];
      input.addEventListener("input", () => {
        valueLabel.textContent = input.value;
      });
      input.addEventListener("change", () => {
        applyExperimentInput(current, control.key, Number(input.value));
        render();
      });
      group.classList.add("number-control");
      group.append(input, valueLabel);
      elements.controls.append(group);
      return;
    }
    if (control.kind === "action") {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = control.label;
      button.className = "action-control";
      button.disabled = controlsLocked;
      button.addEventListener("click", () => {
        applyExperimentInput(current, control.key, null);
        render();
      });
      group.append(button);
      elements.controls.append(group);
      return;
    }
    (control.values || []).forEach((value) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = value;
      button.classList.toggle("active", current.state[control.key] === value);
      button.disabled = controlsLocked;
      button.addEventListener("click", () => {
        applyExperimentInput(current, control.key, value);
        render();
      });
      group.append(button);
    });
    elements.controls.append(group);
  });
}

function applyExperimentInput(current, key, value) {
  if (experimentKey === "fullAdder" && isFullAdderPredictionLocked()) return;
  activeTutorController?.abort();
  const previous = { ...current.state };
  const next = current.apply
    ? current.apply(current.state, key, value)
    : { ...current.state, [key]: value };
  if (experimentKey === "jkff" && key === "pulse") {
    recordJkPulse(previous, next);
  }
  current.state = next;
  if (experimentKey === "fullAdder") {
    predictionDraft = { S: null, Cout: null };
    predictionSubmittedCase = "";
  }
  persistLabState();
}

function renderTruthTable() {
  const current = experiment();
  const rows = current.rows(current.state);
  elements.truthTable.innerHTML = "";
  [current.headers, ...rows.map((row) => row.values)].forEach((values, index) => {
    const row = document.createElement("div");
    row.className = `truth-row${index === 0 ? " header" : ""}`;
    row.style.setProperty("--columns", values.length);
    const dataRow = index > 0 ? rows[index - 1] : null;
    const verified = experimentKey === "fullAdder" && dataRow
      ? Boolean(fullAdderSession?.testedCases?.includes(dataRow.values.slice(0, 3).join("")))
      : false;
    if (dataRow?.active) row.classList.add("active");
    if (verified) row.classList.add("verified");
    values.forEach((value, cellIndex) => {
      const cell = document.createElement("span");
      const masked = experimentKey === "fullAdder" && index > 0 && cellIndex >= 3 && !verified;
      cell.textContent = masked ? "?" : value;
      if (masked) cell.className = "masked-output";
      row.append(cell);
    });
    elements.truthTable.append(row);
  });
}

function renderExperimentGuide() {
  const definition = getExperimentDefinition(experimentKey);
  if (!definition) return;
  elements.guideObjective.textContent = definition.summary;
  const completion = definition.completion || {};
  const completionText = completion.type === "truth-table-coverage"
    ? `覆盖 ${completion.requiredCases} 组真值组合并总结规律。`
    : completion.type === "clock-cycle-coverage"
      ? `完成至少 ${completion.requiredCycles} 个关键时钟周期。`
      : `完成 ${completion.requiredCheckpoints || 1} 个实验检查点。`;
  elements.guideSteps.innerHTML = [
    "设置输入或器件参数，观察电路中的信号路径。",
    experimentKey === "fullAdder" ? "在查看输出前先预测 S 与 Cout。" : "对照真值表或状态表验证当前结果。",
    completionText
  ].map((step) => `<li>${step}</li>`).join("");
}

function renderFullAdderLearningPanel() {
  const active = experimentKey === "fullAdder";
  elements.fullAdderChallenge.hidden = !active;
  elements.circuitDiagram.classList.toggle("awaiting-prediction", active && !isCurrentFullAdderCaseVerified());
  if (!active) return;
  const testedCases = fullAdderSession?.testedCases || [];
  const coverage = Number(fullAdderSession?.coverage) || 0;
  const currentKey = fullAdderCaseKey();
  const verified = testedCases.includes(currentKey);
  const pendingPrediction = restoreFullAdderPendingPrediction();
  const submissionPending = predictionSubmissionPendingCase === currentKey;
  const predictionLocked = Boolean(pendingPrediction) || submissionPending;
  elements.coverageText.textContent = `${testedCases.length} / 8`;
  elements.coverageBar.style.width = `${coverage}%`;
  document.querySelectorAll("[data-prediction-output]").forEach((button) => {
    const key = button.dataset.predictionOutput;
    button.classList.toggle("active", Number(button.dataset.value) === predictionDraft[key]);
    button.disabled = verified || predictionLocked;
  });
  const draftReady = [predictionDraft.S, predictionDraft.Cout].every((value) => value === 0 || value === 1);
  elements.submitPredictionButton.disabled = !draftReady || verified || !fullAdderSession || predictionLocked;
  elements.runVerificationButton.disabled = verified || !pendingPrediction;
  elements.completeExperimentButton.disabled = coverage < 100;
  elements.exportReportButton.disabled = !latestExperimentReport;

  const lastRun = [...(fullAdderSession?.runs || [])].reverse().find((run) => run.caseKey === currentKey);
  if (!fullAdderSession) {
    elements.predictionFeedback.textContent = "正在恢复你的实验记录…";
  } else if (verified && lastRun) {
    elements.predictionFeedback.textContent = lastRun.predictionCorrect
      ? `预测正确：S=${lastRun.outputs.S}，Cout=${lastRun.outputs.Cout}。已形成一条独立实验学习证据。`
      : `本组预测需要订正：实际 S=${lastRun.outputs.S}，Cout=${lastRun.outputs.Cout}。请结合内部信号重新分析。`;
  } else if (submissionPending) {
    elements.predictionFeedback.textContent = "正在提交预测，请稍候…";
  } else if (pendingPrediction) {
    elements.predictionFeedback.textContent = "预测已提交。现在运行仿真，验证你的判断。";
  } else if (draftReady) {
    elements.predictionFeedback.textContent = `当前预测：S=${predictionDraft.S}，Cout=${predictionDraft.Cout}。确认后提交。`;
  } else {
    elements.predictionFeedback.textContent = "请选择 S 和 Cout 的预测值。";
  }

  const runs = [...(fullAdderSession?.runs || [])].slice(-8).reverse();
  elements.experimentRunLog.innerHTML = runs.length
    ? `<table><thead><tr><th>输入</th><th>预测结果</th><th>实际输出</th></tr></thead><tbody>${runs.map((run) => `<tr><td>${run.caseKey}</td><td class="${run.predictionCorrect ? "correct" : "wrong"}">${run.predictionCorrect ? "正确" : "需订正"}</td><td>S=${run.outputs.S} · Cout=${run.outputs.Cout}</td></tr>`).join("")}</tbody></table>`
    : '<p>还没有验证记录。完成第一组预测后，这里会保留实验数据。</p>';
}

function render() {
  renderTabs();
  renderControls();
  const current = experiment();
  const output = current.calculate(current.state);
  const predictionPending = experimentKey === "fullAdder" && !isCurrentFullAdderCaseVerified();
  elements.experimentChapter.textContent = current.chapter;
  elements.experimentTitle.textContent = current.name;
  elements.circuitDiagram.innerHTML = renderCircuitDiagram(experimentKey, current.state, output, {
    revealOutputs: !predictionPending
  });
  renderTimingPanel();
  const fullAdderDemoLocked = experimentKey === "fullAdder" && (fullAdderSession?.testedCases?.length || 0) < 8;
  elements.stateExplanation.textContent = predictionPending
    ? `当前输入为 A=${current.state.A}、B=${current.state.B}、Cin=${current.state.Cin}。输出暂时隐藏，请先预测 S 与 Cout，再运行仿真验证。`
    : current.describe(current.state, output);
  elements.demoButton.disabled = fullAdderDemoLocked;
  elements.stateQuestionButton.disabled = predictionPending;
  elements.screenshotButton.disabled = predictionPending;
  elements.screenshotButton.title = predictionPending
    ? "请先运行仿真验证当前预测，再保存截图"
    : "保存当前电路截图";
  renderTruthTable();
  renderExperimentGuide();
  renderFullAdderLearningPanel();
}

function stopDemo() {
  demoActive = false;
  demoRunId += 1;
  if (demoTimer) {
    window.clearTimeout(demoTimer);
  }
  demoTimer = null;
  if (demoPauseResolve) {
    const resolvePause = demoPauseResolve;
    demoPauseResolve = null;
    resolvePause(false);
  }
  cancelSpeech("演示已停止");
  elements.demoButton.textContent = "自动演示";
}

function getDemoNarration(current, step) {
  const state = current.state;
  const output = current.calculate(state);
  if (experimentKey === "gates") {
    return `A 为 ${state.A}，B 为 ${state.B}，${state.gate} 门输出 ${output.Y}。`;
  }
  if (experimentKey === "fullAdder") {
    return `A 为 ${state.A}，B 为 ${state.B}，输入进位 ${state.Cin}；和位 ${output.S}，输出进位 ${output.Cout}。`;
  }
  if (experimentKey === "decoder") {
    return `输入 ${state.A2}${state.A1}${state.A0}，选中 Y${output.active}。`;
  }

  if (experimentKey !== "jkff") return current.describe(state, output);

  const action = state.J === 0 && state.K === 0 ? "保持"
    : state.J === 0 && state.K === 1 ? "复位"
      : state.J === 1 && state.K === 0 ? "置位"
        : "翻转";
  if (Object.hasOwn(step, "pulse")) {
    return `时钟上升沿，执行${action}，Q 从 ${state.previousQ} 变为 ${output.Q}。`;
  }
  return `J 为 ${state.J}，K 为 ${state.K}，准备${action}。`;
}

async function startDemo() {
  if (demoActive) {
    stopDemo();
    return;
  }
  if (experimentKey === "fullAdder" && (fullAdderSession?.testedCases?.length || 0) < 8) return;
  const current = experiment();
  const currentExperimentKey = experimentKey;
  const runId = ++demoRunId;
  demoActive = true;
  cancelSpeech("准备自动演示");
  let index = 0;
  elements.demoButton.textContent = "停止演示";
  const steps = current.demoSteps
    ? current.demoSteps()
    : current.rows(current.state).map((row) => Object.fromEntries(
      current.controls.filter((control) => !["gate", "pulse"].includes(control.key))
        .map((control, position) => [control.key, row.values[position]])
    ));

  while (demoActive && runId === demoRunId && experimentKey === currentExperimentKey) {
    const step = steps[index % steps.length];
    Object.entries(step).forEach(([key, value]) => {
      applyExperimentInput(current, key, value);
    });
    render();
    const speechResult = await speak(getDemoNarration(current, step), {
      interrupt: false,
      fallbackDelay: true
    });
    if (!demoActive || runId !== demoRunId || experimentKey !== currentExperimentKey
        || speechResult.cancelled) {
      break;
    }
    index += 1;
    await waitForDemoPause(250, runId);
  }

  if (runId === demoRunId) {
    demoActive = false;
    elements.demoButton.textContent = "自动演示";
  }
}

function waitForDemoPause(milliseconds, runId) {
  return new Promise((resolve) => {
    demoPauseResolve = resolve;
    demoTimer = window.setTimeout(() => {
      demoTimer = null;
      demoPauseResolve = null;
      resolve(runId === demoRunId);
    }, milliseconds);
  });
}

function cancelSpeech(status = "讲解已停止") {
  if (activeSpeech) {
    const speech = activeSpeech;
    speech.finish(true, status);
  }
  if ("speechSynthesis" in window) {
    speechSynthesis.cancel();
  }
  elements.tutorFace.classList.remove("speaking");
  elements.voiceStatus.textContent = status;
}

function speak(text, options = {}) {
  const { interrupt = true, fallbackDelay = false } = options;
  if (!("speechSynthesis" in window)) {
    elements.voiceStatus.textContent = "当前浏览器不支持语音播报";
    if (!fallbackDelay) return Promise.resolve({ cancelled: false });
    const estimatedDelay = Math.min(3500, Math.max(700, String(text).length * 60));
    return new Promise((resolve) => {
      window.setTimeout(() => resolve({ cancelled: false }), estimatedDelay);
    });
  }

  if (interrupt) {
    cancelSpeech("准备朗读");
  } else if (activeSpeech) {
    return activeSpeech.promise;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "zh-CN";
  utterance.rate = 1.28;
  const promise = new Promise((resolve) => {
    let settled = false;
    const finish = (cancelled, status) => {
      if (settled) return;
      settled = true;
      if (activeSpeech?.utterance === utterance) {
        window.clearTimeout(activeSpeech.watchdog);
        activeSpeech = null;
      }
      elements.tutorFace.classList.remove("speaking");
      elements.voiceStatus.textContent = status;
      resolve({ cancelled });
    };

    utterance.onstart = () => {
      elements.tutorFace.classList.add("speaking");
      elements.voiceStatus.textContent = "正在快速讲解";
    };
    utterance.onend = () => finish(false, "讲解完成");
    utterance.onerror = (event) => {
      const cancelled = ["canceled", "interrupted"].includes(event.error);
      finish(cancelled, cancelled ? "讲解已停止" : "语音播放失败");
    };

    activeSpeech = { utterance, finish, watchdog: null, promise: null };
    activeSpeech.watchdog = window.setTimeout(() => {
      finish(false, "讲解完成");
      speechSynthesis.cancel();
    }, Math.min(30000, Math.max(12000, String(text).length * 380)));
  });
  activeSpeech.promise = promise;
  speechSynthesis.speak(utterance);
  return promise;
}

function appendMessage(role, text) {
  const message = document.createElement("div");
  message.className = `message ${role}`;
  message.textContent = text;
  elements.labMessages.append(message);
  elements.labMessages.scrollTop = elements.labMessages.scrollHeight;
  return message;
}

async function askLab(question) {
  const text = String(question || "").trim();
  if (!text) return;
  appendMessage("user", text);
  if (experimentKey === "fullAdder" && !isCurrentFullAdderCaseVerified()) {
    appendMessage("assistant", "为了保留这次预测的独立性，请先完成当前输入的预测并运行仿真。验证后我会结合内部信号为你讲解。");
    return;
  }
  const answer = appendMessage("assistant", "");
  elements.askButton.disabled = true;
  activeTutorController?.abort();
  const controller = new AbortController();
  activeTutorController = controller;
  const requestRevision = fullAdderSession?.revision || 0;
  try {
    const current = experiment();
    const history = tutorConversation.slice(-6)
      .map((item) => `${item.role === "user" ? "学生" : "助教"}：${item.text}`)
      .join("\n");
    const requestBody = experimentKey === "fullAdder"
      ? {
          question: text,
          experimentId: experimentKey,
          revision: requestRevision,
          state: { ...current.state },
          history
        }
      : {
          question: text,
          experimentName: current.name,
          history,
          experimentState: {
            ...current.state,
            ...current.calculate(current.state),
            ...(experimentKey === "jkff" ? { recentTiming: jkTimingHistory.slice(-5) } : {})
          }
        };
    const response = await fetch("/api/lab/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });
    if (!response.ok || !response.body) throw new Error("实验助教暂时不可用");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        const payload = line.trim().replace(/^data:\s*/, "");
        if (!payload) continue;
        const event = JSON.parse(payload);
        if (event.type === "delta") {
          answer.textContent += event.text || "";
          elements.labMessages.scrollTop = elements.labMessages.scrollHeight;
        }
        if (event.type === "error") throw new Error(event.error);
      }
      if (done) break;
    }
    tutorConversation.push({ role: "user", text }, { role: "assistant", text: answer.textContent });
    tutorConversation = tutorConversation.slice(-12);
    if (experimentKey === "fullAdder" && (fullAdderSession?.revision || 0) !== requestRevision) {
      answer.classList.add("stale");
      answer.textContent += "\n（这段讲解基于上一版实验状态。）";
    }
  } catch (error) {
    if (error.name === "AbortError") answer.remove();
    else answer.textContent = `暂时无法回复：${error.message}`;
  } finally {
    if (activeTutorController === controller) {
      activeTutorController = null;
      elements.askButton.disabled = false;
    }
  }
}

function startRecognition() {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    elements.voiceStatus.textContent = "当前浏览器不支持语音识别";
    return;
  }
  const recognition = new Recognition();
  recognition.lang = "zh-CN";
  recognition.interimResults = false;
  recognition.onstart = () => { elements.voiceStatus.textContent = "正在聆听…"; };
  recognition.onerror = () => { elements.voiceStatus.textContent = "语音识别失败，请改用文字"; };
  recognition.onresult = (event) => {
    const text = event.results[0][0].transcript;
    elements.labQuestion.value = text;
    askLab(text);
  };
  recognition.onend = () => { elements.voiceStatus.textContent = "可继续语音提问"; };
  recognition.start();
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function saveCircuitScreenshot() {
  if (experimentKey === "fullAdder" && !isCurrentFullAdderCaseVerified()) {
    elements.screenshotButton.disabled = true;
    elements.toolStatus.textContent = "请先运行仿真验证当前预测，再保存全加器截图。";
    return;
  }
  const svg = elements.circuitDiagram.querySelector("svg");
  if (!svg) {
    elements.toolStatus.textContent = "当前实验没有可保存的电路图。";
    return;
  }
  elements.screenshotButton.disabled = true;
  try {
    const cloneSvg = svg.cloneNode(true);
    const viewBox = svg.viewBox.baseVal;
    const width = Math.max(900, Math.round(viewBox.width || svg.clientWidth || 900));
    const height = Math.max(400, Math.round(viewBox.height || svg.clientHeight || 400));
    cloneSvg.setAttribute("width", width);
    cloneSvg.setAttribute("height", height);
    const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
    style.textContent = `text{font-family:system-ui,sans-serif;fill:#eaf8ff}.gate-body,.module-body,.chip-body,.value-box{fill:#10284b;stroke:#38bdf8;stroke-width:2.5}.signal-line{fill:none;stroke:#64748b;stroke-width:4}.signal-line.high,.signal-line.logic-high{stroke:#34d399}.port{fill:#64748b}.port.high,.port.logic-high{fill:#34d399}.value-box.high,.active-output{fill:#064e3b;stroke:#34d399}`;
    cloneSvg.prepend(style);
    const source = new XMLSerializer().serializeToString(cloneSvg);
    const imageUrl = URL.createObjectURL(new Blob([source], { type: "image/svg+xml;charset=utf-8" }));
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
      image.src = imageUrl;
    });
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height + 72;
    const context = canvas.getContext("2d");
    context.fillStyle = "#06152d";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#eaf8ff";
    context.font = "600 24px system-ui";
    context.fillText(`${experiment().name} · ${experiment().summary(experiment().state)}`, 24, 38);
    context.font = "16px system-ui";
    context.fillStyle = "#93c5fd";
    context.fillText(new Date().toLocaleString("zh-CN"), 24, 62);
    context.drawImage(image, 0, 72, width, height);
    URL.revokeObjectURL(imageUrl);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("浏览器未能生成 PNG");
    downloadBlob(blob, `${experimentKey}-${Date.now()}.png`);
    elements.toolStatus.textContent = "电路截图已保存。";
  } catch (error) {
    elements.toolStatus.textContent = `截图失败：${error.message}`;
  } finally {
    elements.screenshotButton.disabled = experimentKey === "fullAdder" && !isCurrentFullAdderCaseVerified();
  }
}

function exportExperimentReport() {
  const report = latestExperimentReport;
  if (!report) return;
  const rows = (report.runs || []).map((run, index) => (
    `| ${index + 1} | ${run.caseKey} | S=${run.outputs.S}, Cout=${run.outputs.Cout} | ${run.predictionCorrect ? "正确" : "需订正"} |`
  )).join("\n");
  const markdown = [
    `# ${report.title}实验报告`,
    "",
    `- 完成时间：${new Date(report.completedAt).toLocaleString("zh-CN")}`,
    `- 真值表覆盖率：${report.coverage}%`,
    `- 独立实验证据：${report.evidenceSummary.independent} 条`,
    `- 预测正确率：${report.evidenceSummary.score}%（${report.evidenceSummary.confidence}）`,
    "",
    "## 实验记录",
    "",
    "| 序号 | 输入 ABCin | 实际输出 | 预测 |",
    "|---:|---|---|---|",
    rows,
    "",
    "## 实验结论",
    "",
    report.conclusion || "未填写"
  ].join("\n");
  downloadBlob(new Blob([markdown], { type: "text/markdown;charset=utf-8" }), `全加器实验报告-${Date.now()}.md`);
  elements.toolStatus.textContent = "实验报告已导出。";
}

async function submitFullAdderPrediction() {
  if ([predictionDraft.S, predictionDraft.Cout].some((value) => value !== 0 && value !== 1)) return;
  if (pendingFullAdderPrediction()) return;
  const key = fullAdderCaseKey();
  predictionSubmissionPendingCase = key;
  render();
  try {
    const session = await ensureFullAdderSession();
    const pendingKey = `${session.id}:prediction.submitted:${key}`;
    const eventId = pendingExperimentEventIds.get(pendingKey)
      || globalThis.crypto?.randomUUID?.()
      || `prediction-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    pendingExperimentEventIds.set(pendingKey, eventId);
    fullAdderSession = await labApi(`/api/experiment-sessions/${session.id}/events`, {
      method: "POST",
      body: JSON.stringify({
        eventId,
        type: "prediction.submitted",
        state: { ...experiment().state },
        prediction: { ...predictionDraft },
        hintLevel: 0
      })
    });
    pendingExperimentEventIds.delete(pendingKey);
    restoreFullAdderPendingPrediction(fullAdderSession);
  } catch (error) {
    elements.predictionFeedback.textContent = `预测提交失败：${error.message}`;
  } finally {
    predictionSubmissionPendingCase = "";
    render();
  }
}

async function runFullAdderVerification() {
  if (!fullAdderSession || !pendingFullAdderPrediction()) return;
  elements.runVerificationButton.disabled = true;
  const key = fullAdderCaseKey();
  const pendingKey = `${fullAdderSession.id}:simulation.run:${key}`;
  const eventId = pendingExperimentEventIds.get(pendingKey)
    || globalThis.crypto?.randomUUID?.()
    || `simulation-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  pendingExperimentEventIds.set(pendingKey, eventId);
  try {
    fullAdderSession = await labApi(`/api/experiment-sessions/${fullAdderSession.id}/events`, {
      method: "POST",
      body: JSON.stringify({ eventId, type: "simulation.run", state: { ...experiment().state } })
    });
    pendingExperimentEventIds.delete(pendingKey);
    predictionSubmittedCase = "";
    markLearningDataUpdated();
    render();
  } catch (error) {
    elements.predictionFeedback.textContent = `仿真运行失败：${error.message}`;
  } finally {
    renderFullAdderLearningPanel();
  }
}

async function completeFullAdderExperiment() {
  const conclusion = elements.experimentConclusion.value.trim();
  if (!conclusion) {
    elements.predictionFeedback.textContent = "请先用自己的话填写实验结论。";
    elements.experimentConclusion.focus();
    return;
  }
  elements.completeExperimentButton.disabled = true;
  try {
    const result = await labApi(`/api/experiment-sessions/${fullAdderSession.id}/complete`, {
      method: "POST",
      body: JSON.stringify({ conclusion })
    });
    fullAdderSession = result.session;
    latestExperimentReport = result.report;
    markLearningDataUpdated();
    elements.predictionFeedback.textContent = "实验已完成，报告和掌握度证据已经更新。";
    elements.exportReportButton.disabled = false;
  } catch (error) {
    elements.predictionFeedback.textContent = `完成实验失败：${error.message}`;
  } finally {
    elements.completeExperimentButton.disabled = Number(fullAdderSession?.coverage) < 100;
  }
}

elements.demoButton.addEventListener("click", startDemo);
elements.clearTimingButton.addEventListener("click", () => {
  jkTimingHistory = [];
  jkCycleNumber = 0;
  persistLabState();
  renderTimingPanel();
});
elements.speakButton.addEventListener("click", () => speak(elements.stateExplanation.textContent));
elements.stateQuestionButton.addEventListener("click", () => askLab("请解释当前输入为什么会得到这个输出。"));
elements.voiceButton.addEventListener("click", startRecognition);
elements.askButton.addEventListener("click", () => {
  const value = elements.labQuestion.value;
  elements.labQuestion.value = "";
  askLab(value);
});
elements.labQuestion.addEventListener("keydown", (event) => {
  if (event.key === "Enter") elements.askButton.click();
});
elements.experimentSearch.addEventListener("input", () => {
  catalogSearch = elements.experimentSearch.value;
  renderTabs();
});
document.querySelectorAll("[data-prediction-output]").forEach((button) => button.addEventListener("click", () => {
  if (isFullAdderPredictionLocked()) return;
  predictionDraft[button.dataset.predictionOutput] = Number(button.dataset.value);
  renderFullAdderLearningPanel();
}));
elements.submitPredictionButton.addEventListener("click", submitFullAdderPrediction);
elements.runVerificationButton.addEventListener("click", runFullAdderVerification);
elements.completeExperimentButton.addEventListener("click", completeFullAdderExperiment);
elements.guideButton.addEventListener("click", () => {
  elements.experimentGuide.hidden = !elements.experimentGuide.hidden;
  elements.guideButton.setAttribute("aria-expanded", String(!elements.experimentGuide.hidden));
});
elements.focusButton.addEventListener("click", () => {
  const active = document.body.classList.toggle("lab-focus-mode");
  elements.focusButton.setAttribute("aria-pressed", String(active));
  elements.focusButton.textContent = active ? "退出专注" : "专注模式";
});
elements.fullscreenButton.addEventListener("click", async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (elements.circuitPanel.requestFullscreen) await elements.circuitPanel.requestFullscreen();
    else throw new Error("当前浏览器不支持全屏 API");
  } catch (error) {
    elements.toolStatus.textContent = `无法进入全屏：${error.message}`;
  }
});
document.addEventListener("fullscreenchange", () => {
  elements.fullscreenButton.textContent = document.fullscreenElement ? "退出全屏" : "电路全屏";
});
elements.screenshotButton.addEventListener("click", saveCircuitScreenshot);
elements.exportReportButton.addEventListener("click", exportExperimentReport);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && document.body.classList.contains("lab-focus-mode")) {
    document.body.classList.remove("lab-focus-mode");
    elements.focusButton.setAttribute("aria-pressed", "false");
    elements.focusButton.textContent = "专注模式";
  }
});

restoreLabState();
render();
if (experimentKey === "fullAdder") {
  ensureFullAdderSession()
    .then(() => {
      if (experimentKey === "fullAdder") render();
    })
    .catch((error) => {
      if (experimentKey === "fullAdder") {
        elements.predictionFeedback.textContent = `实验记录暂时不可用：${error.message}`;
      }
    });
}
