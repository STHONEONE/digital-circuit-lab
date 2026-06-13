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

function svgDefs() {
  return `
    <defs>
      <linearGradient id="componentFill" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#1aa07e"/>
        <stop offset="100%" stop-color="#0d6954"/>
      </linearGradient>
      <filter id="componentShadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="7" stdDeviation="7" flood-color="#173f35" flood-opacity=".2"/>
      </filter>
      <filter id="softShadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="5" stdDeviation="5" flood-color="#243c48" flood-opacity=".12"/>
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

function renderFullAdderDiagram(state, output) {
  const xorValue = state.A !== state.B ? 1 : 0;
  const carry1 = state.A && state.B ? 1 : 0;
  const carry2 = xorValue && state.Cin ? 1 : 0;
  return `
    <svg class="circuit-svg" viewBox="0 0 980 410" role="img"
         aria-label="全加器，A 等于 ${state.A}，B 等于 ${state.B}，Cin 等于 ${state.Cin}，S 等于 ${output.S}，Cout 等于 ${output.Cout}">
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

function renderCircuitDiagram(key, state, output) {
  if (key === "gates") return renderGateDiagram(state, output);
  if (key === "fullAdder") return renderFullAdderDiagram(state, output);
  if (key === "decoder") return renderDecoderDiagram(state, output);
  return renderJkDiagram(state, output);
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
const ids = [
  "experimentTabs", "experimentChapter", "experimentTitle", "controls", "circuitDiagram",
  "timingPanel", "timingSummary", "timingDiagram", "clearTimingButton",
  "stateExplanation", "truthTable",
  "demoButton", "speakButton", "tutorFace", "voiceStatus", "labMessages",
  "stateQuestionButton", "voiceButton", "labQuestion", "askButton"
];
const elements = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));

function experiment() {
  return experiments[experimentKey];
}

function renderTabs() {
  elements.experimentTabs.innerHTML = "";
  Object.entries(experiments).forEach(([key, item]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = item.name;
    button.classList.toggle("active", key === experimentKey);
    button.addEventListener("click", () => {
      stopDemo();
      experimentKey = key;
      render();
    });
    elements.experimentTabs.append(button);
  });
}

function renderControls() {
  const current = experiment();
  elements.controls.innerHTML = "";
  current.controls.forEach((control) => {
    const group = document.createElement("div");
    group.className = "control-group";
    const label = document.createElement("span");
    label.textContent = control.label;
    group.append(label);
    control.values.forEach((value) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = value;
      button.classList.toggle("active", current.state[control.key] === value);
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
  const previous = { ...current.state };
  const next = current.apply
    ? current.apply(current.state, key, value)
    : { ...current.state, [key]: value };
  if (experimentKey === "jkff" && key === "pulse") {
    recordJkPulse(previous, next);
  }
  current.state = next;
}

function renderTruthTable() {
  const current = experiment();
  const rows = current.rows(current.state);
  elements.truthTable.innerHTML = "";
  [current.headers, ...rows.map((row) => row.values)].forEach((values, index) => {
    const row = document.createElement("div");
    row.className = `truth-row${index === 0 ? " header" : ""}`;
    row.style.setProperty("--columns", values.length);
    if (index > 0 && rows[index - 1].active) row.classList.add("active");
    values.forEach((value) => {
      const cell = document.createElement("span");
      cell.textContent = value;
      row.append(cell);
    });
    elements.truthTable.append(row);
  });
}

function render() {
  renderTabs();
  renderControls();
  const current = experiment();
  const output = current.calculate(current.state);
  elements.experimentChapter.textContent = current.chapter;
  elements.experimentTitle.textContent = current.name;
  elements.circuitDiagram.innerHTML = renderCircuitDiagram(experimentKey, current.state, output);
  renderTimingPanel();
  elements.stateExplanation.textContent = current.describe(current.state, output);
  renderTruthTable();
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
  const answer = appendMessage("assistant", "");
  elements.askButton.disabled = true;
  try {
    const current = experiment();
    const response = await fetch("/api/lab/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: text,
        experimentName: current.name,
        experimentState: {
          ...current.state,
          ...current.calculate(current.state),
          ...(experimentKey === "jkff"
            ? { recentTiming: jkTimingHistory.slice(-5) }
            : {})
        }
      })
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
  } catch (error) {
    answer.textContent = `暂时无法回复：${error.message}`;
  } finally {
    elements.askButton.disabled = false;
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

elements.demoButton.addEventListener("click", startDemo);
elements.clearTimingButton.addEventListener("click", () => {
  jkTimingHistory = [];
  jkCycleNumber = 0;
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

render();
