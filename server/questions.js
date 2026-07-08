const halfAdderSvg = `<svg viewBox="0 0 640 230" role="img" aria-label="半加器电路图" xmlns="http://www.w3.org/2000/svg">
  <defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#38bdf8"/></marker></defs>
  <rect width="640" height="230" rx="16" fill="#071527"/>
  <g fill="none" stroke="#38bdf8" stroke-width="3">
    <path d="M120 65 H235" marker-end="url(#arrow)"/>
    <path d="M120 115 H235" marker-end="url(#arrow)"/>
    <path d="M120 155 H235" marker-end="url(#arrow)"/>
    <path d="M120 195 H235" marker-end="url(#arrow)"/>
    <path d="M370 90 H520" marker-end="url(#arrow)"/>
    <path d="M370 175 H520" marker-end="url(#arrow)"/>
  </g>
  <g fill="#0f213d" stroke="#7dd3fc" stroke-width="3">
    <rect x="235" y="42" width="135" height="96" rx="14"/>
    <rect x="235" y="145" width="135" height="60" rx="14"/>
  </g>
  <g fill="#e0f2fe" font-family="Arial, sans-serif" font-size="20" font-weight="700">
    <text x="75" y="72">A</text><text x="75" y="122">B</text>
    <text x="75" y="162">A</text><text x="75" y="202">B</text>
    <text x="273" y="97">XOR</text><text x="273" y="183">AND</text>
    <text x="540" y="96">S=A⊕B</text><text x="540" y="181">C=AB</text>
    <text x="170" y="28" fill="#93c5fd" font-size="16">半加器：异或门产生和位，与门产生进位</text>
  </g>
</svg>`;

const decoderSvg = `<svg viewBox="0 0 660 260" role="img" aria-label="3-8译码器示意图" xmlns="http://www.w3.org/2000/svg">
  <rect width="660" height="260" rx="16" fill="#071527"/>
  <rect x="210" y="35" width="190" height="190" rx="14" fill="#0f213d" stroke="#7dd3fc" stroke-width="3"/>
  <g stroke="#38bdf8" stroke-width="3" fill="none">
    <path d="M65 75 H210"/><path d="M65 130 H210"/><path d="M65 185 H210"/>
    <path d="M400 55 H560"/><path d="M400 78 H560"/><path d="M400 101 H560"/><path d="M400 124 H560"/><path d="M400 147 H560"/><path d="M400 170 H560"/><path d="M400 193 H560"/><path d="M400 216 H560"/>
  </g>
  <g fill="#e0f2fe" font-family="Arial, sans-serif" font-size="18" font-weight="700">
    <text x="35" y="81">A</text><text x="35" y="136">B</text><text x="35" y="191">C</text><text x="252" y="128">3-8 DEC</text>
    <text x="575" y="61">Y0</text><text x="575" y="84">Y1</text><text x="575" y="107">Y2</text><text x="575" y="130">Y3</text><text x="575" y="153">Y4</text><text x="575" y="176">Y5</text><text x="575" y="199">Y6</text><text x="575" y="222">Y7</text>
  </g>
  <circle cx="562" cy="193" r="7" fill="#22c55e"/><text x="430" y="245" fill="#bbf7d0" font-family="Arial, sans-serif" font-size="16">ABC=110 时 Y6 有效</text>
</svg>`;

const dffWaveSvg = `<svg viewBox="0 0 720 260" role="img" aria-label="D触发器波形图" xmlns="http://www.w3.org/2000/svg">
  <rect width="720" height="260" rx="16" fill="#071527"/>
  <g stroke="#334155" stroke-width="1"><path d="M90 40 H680"/><path d="M90 105 H680"/><path d="M90 170 H680"/></g>
  <g fill="#e0f2fe" font-family="Arial, sans-serif" font-size="18" font-weight="700"><text x="35" y="72">CLK</text><text x="50" y="137">D</text><text x="50" y="202">Q</text></g>
  <path d="M100 80 H140 V45 H180 V80 H240 V45 H280 V80 H340 V45 H380 V80 H680" fill="none" stroke="#38bdf8" stroke-width="4"/>
  <path d="M100 145 H180 V110 H300 V145 H420 V110 H680" fill="none" stroke="#facc15" stroke-width="4"/>
  <path d="M100 210 H180 V175 H300 V210 H420 V175 H680" fill="none" stroke="#22c55e" stroke-width="4"/>
  <g stroke="#f472b6" stroke-width="2" stroke-dasharray="6 6"><path d="M180 35 V225"/><path d="M300 35 V225"/><path d="M420 35 V225"/></g>
  <g fill="#fecdd3" font-family="Arial, sans-serif" font-size="14"><text x="160" y="32">↑</text><text x="280" y="32">↑</text><text x="400" y="32">↑</text></g>
</svg>`;

const counterSvg = `<svg viewBox="0 0 700 250" role="img" aria-label="3位计数器状态环" xmlns="http://www.w3.org/2000/svg">
  <rect width="700" height="250" rx="16" fill="#071527"/>
  <g fill="none" stroke="#38bdf8" stroke-width="3">
    <path d="M145 68 C205 25 285 25 345 68"/><path d="M405 68 C465 25 545 25 605 68"/><path d="M620 112 C650 145 650 190 610 210"/><path d="M545 220 C465 245 235 245 155 220"/><path d="M90 205 C50 165 55 105 90 78"/>
  </g>
  <g fill="#0f213d" stroke="#7dd3fc" stroke-width="3">
    <circle cx="110" cy="70" r="34"/><circle cx="370" cy="70" r="34"/><circle cx="630" cy="90" r="34"/><circle cx="570" cy="205" r="34"/><circle cx="130" cy="205" r="34"/>
  </g>
  <g fill="#e0f2fe" font-family="Arial, sans-serif" font-size="18" font-weight="700" text-anchor="middle">
    <text x="110" y="77">000</text><text x="370" y="77">001</text><text x="630" y="97">010</text><text x="570" y="212">...</text><text x="130" y="212">111</text>
  </g>
  <text x="230" y="135" fill="#bbf7d0" font-family="Arial, sans-serif" font-size="18">3 位二进制计数器共有 2³ = 8 个状态</text>
</svg>`;

export const seedQuestions = [
  {
    id: "base-001",
    scope: "basic-logic",
    chapter: "基础逻辑",
    title: "二进制数转十进制",
    type: "single_choice",
    text: "二进制数 (101101)₂ 转换为十进制数是：",
    options: ["43", "45", "47", "49"],
    answer: 1,
    answerText: "B. 45",
    explanation: "101101₂=32+8+4+1=45。",
    knowledge: ["数制与编码", "二进制转换"],
    keywords: [],
    difficulty: 1
  },
  {
    id: "base-002",
    scope: "basic-logic",
    chapter: "基础逻辑",
    title: "二进制加法",
    type: "single_choice",
    text: "计算 (101101)₂ + (0110)₂，结果是：",
    options: ["(110001)₂", "(110010)₂", "(110011)₂", "(111000)₂"],
    answer: 2,
    answerText: "C. (110011)₂",
    explanation: "45+6=51，51 的二进制为 110011。",
    knowledge: ["数制与编码", "二进制运算"],
    keywords: [],
    difficulty: 2
  },
  {
    id: "base-003",
    scope: "basic-logic",
    chapter: "基础逻辑",
    title: "十六进制进位",
    type: "single_choice",
    text: "十六进制数 2F 再加 1，结果是：",
    options: ["2G", "30", "3F", "20"],
    answer: 1,
    answerText: "B. 30",
    explanation: "十六进制中 F+1 向前进 1，所以 2F+1=30。",
    knowledge: ["数制与编码", "十六进制转换"],
    keywords: [],
    difficulty: 1
  },
  {
    id: "base-004",
    scope: "basic-logic",
    chapter: "基础逻辑",
    title: "8421 BCD 编码",
    type: "fill_blank",
    text: "十进制数 59 的 8421 BCD 编码是：________。",
    options: [],
    answerText: "0101 1001",
    explanation: "5 的 BCD 是 0101，9 的 BCD 是 1001。",
    knowledge: ["数制与编码", "BCD 编码"],
    keywords: ["01011001", "0101 1001"],
    difficulty: 1
  },
  {
    id: "base-005",
    scope: "basic-logic",
    chapter: "基础逻辑",
    title: "格雷码特点",
    type: "single_choice",
    text: "格雷码相邻两个编码通常有几位不同？",
    options: ["0 位", "1 位", "2 位", "3 位"],
    answer: 1,
    answerText: "B. 1 位",
    explanation: "格雷码的特点是相邻编码只有 1 位不同。",
    knowledge: ["数制与编码", "格雷码"],
    keywords: [],
    difficulty: 1
  },
  {
    id: "base-006",
    scope: "basic-logic",
    chapter: "基础逻辑",
    title: "逻辑函数输出",
    type: "single_choice",
    text: "输入 A=1，B=0，逻辑函数 Y=(A+B)' 的输出为：",
    options: ["0", "1", "A", "B"],
    answer: 0,
    answerText: "A. 0",
    explanation: "A+B=1，再取反得到 0。",
    knowledge: ["逻辑门", "或非门"],
    keywords: [],
    difficulty: 1
  },
  {
    id: "base-007",
    scope: "basic-logic",
    chapter: "基础逻辑",
    title: "德摩根定律",
    type: "single_choice",
    text: "德摩根定律中，(AB)' 等价于：",
    options: ["A'+B'", "A'B'", "A+B", "AB'"],
    answer: 0,
    answerText: "A. A'+B'",
    explanation: "与非等于各变量取反后相或。",
    knowledge: ["逻辑代数", "德摩根定律"],
    keywords: [],
    difficulty: 1
  },
  {
    id: "base-008",
    scope: "basic-logic",
    chapter: "基础逻辑",
    title: "吸收律化简",
    type: "single_choice",
    text: "逻辑表达式 A+AB 可化简为：",
    options: ["A", "B", "AB", "A+B"],
    answer: 0,
    answerText: "A. A",
    explanation: "根据吸收律，A+AB=A。",
    knowledge: ["逻辑代数", "逻辑函数化简"],
    keywords: [],
    difficulty: 1
  },
  {
    id: "base-009",
    scope: "basic-logic",
    chapter: "基础逻辑",
    title: "逻辑函数化简",
    type: "single_choice",
    text: "逻辑函数 F=AB+AB' 可化简为：",
    options: ["A", "B", "AB", "A+B"],
    answer: 0,
    answerText: "A. A",
    explanation: "F=A(B+B')=A。",
    knowledge: ["逻辑函数化简", "逻辑代数"],
    keywords: [],
    difficulty: 1
  },
  {
    id: "base-010",
    scope: "basic-logic",
    chapter: "基础逻辑",
    title: "最小项判断",
    type: "single_choice",
    text: "F(A,B,C)=Σm(1,3,7)，当 ABC=101 时，F 的值为：",
    options: ["0", "1", "A", "C"],
    answer: 0,
    answerText: "A. 0",
    explanation: "ABC=101 对应最小项 m5，不在 Σm(1,3,7) 中，所以 F=0。",
    knowledge: ["真值表", "最小项"],
    keywords: [],
    difficulty: 2
  },
  {
    id: "base-011",
    scope: "basic-logic",
    chapter: "基础逻辑",
    title: "卡诺图合并",
    type: "fill_blank",
    text: "三变量卡诺图中，相邻两个 1 格合并可以消去 ________ 个变量。",
    options: [],
    answerText: "1",
    explanation: "两个相邻最小项只有一个变量不同，合并后可消去 1 个变量。",
    knowledge: ["逻辑函数化简", "卡诺图"],
    keywords: ["1", "一个"],
    difficulty: 2
  },
  {
    id: "base-012",
    scope: "basic-logic",
    chapter: "基础逻辑",
    title: "由真值表写表达式",
    type: "analysis",
    text: "二变量函数在 01、10、11 时为 1，在 00 时为 0，写出最简表达式，并说明可用什么逻辑门实现。",
    options: [],
    answerText: "最简表达式为 F=A+B，可用或门实现。",
    explanation: "只要 A 或 B 中有一个为 1，输出就是 1。",
    knowledge: ["真值表", "逻辑门", "逻辑函数化简"],
    keywords: ["A+B", "或门"],
    difficulty: 2
  },
  {
    id: "comb-001",
    scope: "combinational",
    chapter: "组合逻辑",
    title: "优先编码器输出",
    type: "single_choice",
    text: "8 线-3 线优先编码器中，I5 和 I2 同时有效，且高编号优先，则输出对应：",
    options: ["I2", "I5", "I7", "无输出"],
    answer: 1,
    answerText: "B. I5",
    explanation: "优先编码器会选择优先级更高的输入，I5 高于 I2。",
    knowledge: ["编码器", "优先编码器", "组合逻辑"],
    keywords: [],
    difficulty: 1
  },
  {
    id: "comb-002",
    scope: "combinational",
    chapter: "组合逻辑",
    title: "普通编码器与优先编码器",
    type: "single_choice",
    text: "普通编码器和优先编码器的主要区别是：",
    options: ["普通编码器只能输入 0", "优先编码器能处理多个输入同时有效的情况", "普通编码器没有输出", "优先编码器不能编码"],
    answer: 1,
    answerText: "B. 优先编码器能处理多个输入同时有效的情况",
    explanation: "优先编码器可以在多个输入同时有效时，按优先级输出。",
    knowledge: ["编码器", "优先编码器"],
    keywords: [],
    difficulty: 1
  },
  {
    id: "comb-003",
    scope: "combinational",
    chapter: "组合逻辑",
    title: "3-8 译码器输出",
    type: "single_choice",
    text: "3-8 译码器使能有效，输入 ABC=110，输出为 1 的是：",
    diagramSvg: decoderSvg,
    explanationSvg: decoderSvg,
    options: ["Y0", "Y3", "Y6", "Y7"],
    answer: 2,
    answerText: "C. Y6",
    explanation: "110₂=6，所以对应 Y6。",
    knowledge: ["译码器", "组合逻辑"],
    keywords: [],
    difficulty: 1
  },
  {
    id: "comb-004",
    scope: "combinational",
    chapter: "组合逻辑",
    title: "译码器实现函数",
    type: "single_choice",
    text: "用 3-8 译码器实现 F=Σm(0,2,6)，应将哪些输出端相或？",
    options: ["Y0、Y1、Y2", "Y0、Y2、Y6", "Y1、Y3、Y6", "Y2、Y4、Y6"],
    answer: 1,
    answerText: "B. Y0、Y2、Y6",
    explanation: "函数包含最小项 0、2、6，所以连接 Y0、Y2、Y6。",
    knowledge: ["译码器", "逻辑函数实现"],
    keywords: [],
    difficulty: 2
  },
  {
    id: "comb-005",
    scope: "combinational",
    chapter: "组合逻辑",
    title: "数据选择器",
    type: "single_choice",
    text: "4 选 1 数据选择器中，选择端 S1S0=10 时，输出哪一路数据？",
    options: ["D0", "D1", "D2", "D3"],
    answer: 2,
    answerText: "C. D2",
    explanation: "S1S0=10₂=2，所以选择 D2。",
    knowledge: ["数据选择器", "组合逻辑"],
    keywords: [],
    difficulty: 1
  },
  {
    id: "comb-006",
    scope: "combinational",
    chapter: "组合逻辑",
    title: "数据选择器实现函数",
    type: "single_choice",
    text: "用 4 选 1 数据选择器实现 F(A,B,C)=Σm(1,2,6,7)，若选择端为 AB，则数据端应为：",
    options: ["D0=C，D1=C'，D2=0，D3=1", "D0=0，D1=1，D2=C，D3=C'", "D0=C'，D1=C，D2=1，D3=0", "D0=1，D1=0，D2=C，D3=C'"],
    answer: 0,
    answerText: "A. D0=C，D1=C'，D2=0，D3=1",
    explanation: "按 AB=00、01、10、11 分组，得到 D0=C，D1=C'，D2=0，D3=1。",
    knowledge: ["数据选择器", "逻辑函数实现"],
    keywords: [],
    difficulty: 2
  },
  {
    id: "comb-007",
    scope: "combinational",
    chapter: "组合逻辑",
    title: "半加器",
    type: "single_choice",
    text: "半加器的和位 S 和进位 C 分别为：",
    diagramSvg: halfAdderSvg,
    explanationSvg: halfAdderSvg,
    options: ["S=A+B，C=A⊕B", "S=A⊕B，C=AB", "S=AB，C=A+B", "S=A'B，C=AB'"],
    answer: 1,
    answerText: "B. S=A⊕B，C=AB",
    explanation: "半加器中，和位为异或，进位为与。",
    knowledge: ["加法器", "半加器"],
    keywords: [],
    difficulty: 1
  },
  {
    id: "comb-008",
    scope: "combinational",
    chapter: "组合逻辑",
    title: "全加器输出",
    type: "single_choice",
    text: "全加器中，A=1，B=1，Cin=0，则 S 和 Cout 分别为：",
    options: ["S=0，Cout=0", "S=0，Cout=1", "S=1，Cout=0", "S=1，Cout=1"],
    answer: 1,
    answerText: "B. S=0，Cout=1",
    explanation: "1+1+0=10₂，所以和位 S=0，进位 Cout=1。",
    knowledge: ["加法器", "全加器"],
    keywords: [],
    difficulty: 1
  },
  {
    id: "comb-009",
    scope: "combinational",
    chapter: "组合逻辑",
    title: "全加器进位表达式",
    type: "fill_blank",
    text: "全加器的进位输出表达式为：Cout=________。",
    options: [],
    answerText: "AB+ACin+BCin",
    explanation: "三个输入中至少有两个为 1 时产生进位。",
    knowledge: ["加法器", "全加器"],
    keywords: ["AB+ACin+BCin", "AB+BCin+ACin"],
    difficulty: 2
  },
  {
    id: "comb-010",
    scope: "combinational",
    chapter: "组合逻辑",
    title: "两位比较器",
    type: "fill_blank",
    text: "两位二进制数 A=A1A0，B=B1B0，判断 A>B 的逻辑条件可写为：________。",
    options: [],
    answerText: "A1B1' + (A1⊙B1)A0B0'",
    explanation: "先比较高位，高位相等时再比较低位。",
    knowledge: ["比较器", "组合逻辑设计"],
    keywords: ["A1B1'", "A0B0'"],
    difficulty: 3
  },
  {
    id: "comb-011",
    scope: "combinational",
    chapter: "组合逻辑",
    title: "竞争冒险",
    type: "single_choice",
    text: "组合逻辑电路中，输出理论上应保持 1，但实际出现短暂 0 脉冲，这属于：",
    options: ["编码错误", "竞争冒险", "触发翻转", "状态保持"],
    answer: 1,
    answerText: "B. 竞争冒险",
    explanation: "由于不同信号路径延迟不同，可能出现短暂错误脉冲。",
    knowledge: ["组合逻辑设计", "竞争冒险"],
    keywords: [],
    difficulty: 2
  },
  {
    id: "comb-012",
    scope: "combinational",
    chapter: "组合逻辑",
    title: "组合逻辑设计步骤",
    type: "analysis",
    text: "简述组合逻辑电路的一般设计步骤，并以半加器为例说明。",
    options: [],
    answerText: "一般步骤为：分析功能要求 → 列真值表 → 写逻辑表达式 → 化简表达式 → 画逻辑电路图。半加器有两个输入 A、B，输出和位 S 和进位 C，表达式为 S=A⊕B，C=AB。",
    explanation: "组合逻辑电路没有记忆功能，输出只由当前输入决定，因此真值表和表达式化简是核心。",
    knowledge: ["组合逻辑设计", "加法器", "半加器"],
    keywords: ["真值表", "表达式", "化简", "S=A⊕B", "C=AB"],
    difficulty: 2
  },
  {
    id: "seq-001",
    scope: "sequential",
    chapter: "时序逻辑",
    title: "SR 触发器置位",
    type: "single_choice",
    text: "SR 触发器中，S=1，R=0 时，输出 Q 通常变为：",
    options: ["0", "1", "保持不变", "不确定"],
    answer: 1,
    answerText: "B. 1",
    explanation: "S 表示置 1，R 表示清 0。",
    knowledge: ["触发器", "SR 触发器"],
    keywords: [],
    difficulty: 1
  },
  {
    id: "seq-002",
    scope: "sequential",
    chapter: "时序逻辑",
    title: "SR 触发器禁止状态",
    type: "single_choice",
    text: "SR 触发器通常不允许 S=1，R=1，原因是：",
    options: ["电路无法通电", "输出状态可能不确定", "输出一定为 0", "输出一定为 1"],
    answer: 1,
    answerText: "B. 输出状态可能不确定",
    explanation: "两个控制端同时有效时，可能导致输出状态不确定。",
    knowledge: ["触发器", "SR 触发器"],
    keywords: [],
    difficulty: 1
  },
  {
    id: "seq-003",
    scope: "sequential",
    chapter: "时序逻辑",
    title: "D 触发器功能",
    type: "single_choice",
    text: "边沿触发 D 触发器在有效时钟沿到来后，Q(n+1) 等于：",
    diagramSvg: dffWaveSvg,
    explanationSvg: dffWaveSvg,
    options: ["0", "1", "D", "Q(n)"],
    answer: 2,
    answerText: "C. D",
    explanation: "D 触发器的特点是有效时钟沿后输出跟随 D。",
    knowledge: ["触发器", "D 触发器"],
    keywords: [],
    difficulty: 1
  },
  {
    id: "seq-004",
    scope: "sequential",
    chapter: "时序逻辑",
    title: "JK 触发器翻转",
    type: "single_choice",
    text: "JK 触发器中，J=1，K=1 且有效时钟沿到来时，输出状态会：",
    options: ["置 0", "置 1", "保持", "翻转"],
    answer: 3,
    answerText: "D. 翻转",
    explanation: "JK 触发器在 J=K=1 时发生翻转。",
    knowledge: ["触发器", "JK 触发器"],
    keywords: [],
    difficulty: 1
  },
  {
    id: "seq-005",
    scope: "sequential",
    chapter: "时序逻辑",
    title: "T 触发器构成",
    type: "single_choice",
    text: "用 JK 触发器构成 T 触发器，最直接的连接方式是：",
    options: ["J=0，K=0", "J=1，K=0", "J=K=T", "J=T，K=0"],
    answer: 2,
    answerText: "C. J=K=T",
    explanation: "当 T=1 时翻转，T=0 时保持。",
    knowledge: ["触发器", "JK 触发器", "T 触发器"],
    keywords: [],
    difficulty: 2
  },
  {
    id: "seq-006",
    scope: "sequential",
    chapter: "时序逻辑",
    title: "4 位寄存器",
    type: "single_choice",
    text: "一个 4 位寄存器通常需要几个 D 触发器？",
    options: ["1 个", "2 个", "4 个", "8 个"],
    answer: 2,
    answerText: "C. 4 个",
    explanation: "1 个 D 触发器存 1 位，4 位寄存器需要 4 个。",
    knowledge: ["寄存器", "D 触发器"],
    keywords: [],
    difficulty: 1
  },
  {
    id: "seq-007",
    scope: "sequential",
    chapter: "时序逻辑",
    title: "移位寄存器",
    type: "single_choice",
    text: "串入串出移位寄存器每来一个时钟脉冲，通常会：",
    options: ["清零", "并行输出全部数据", "数据整体移动一位", "停止工作"],
    answer: 2,
    answerText: "C. 数据整体移动一位",
    explanation: "移位寄存器的核心功能就是按时钟逐位移动数据。",
    knowledge: ["寄存器", "移位寄存器"],
    keywords: [],
    difficulty: 1
  },
  {
    id: "seq-008",
    scope: "sequential",
    chapter: "时序逻辑",
    title: "3 位计数器状态",
    type: "single_choice",
    text: "3 位二进制计数器当前状态为 011，经过 5 个脉冲后状态为：",
    diagramSvg: counterSvg,
    explanationSvg: counterSvg,
    options: ["000", "001", "010", "100"],
    answer: 0,
    answerText: "A. 000",
    explanation: "011₂=3，经过 5 个脉冲变为 8，3 位计数器循环后为 000。",
    knowledge: ["计数器", "二进制计数器"],
    keywords: [],
    difficulty: 2
  },
  {
    id: "seq-009",
    scope: "sequential",
    chapter: "时序逻辑",
    title: "模 10 计数器",
    type: "single_choice",
    text: "模 10 计数器一轮需要多少个有效状态？",
    options: ["8 个", "9 个", "10 个", "16 个"],
    answer: 2,
    answerText: "C. 10 个",
    explanation: "模 N 计数器有 N 个有效状态。",
    knowledge: ["计数器", "模计数器"],
    keywords: [],
    difficulty: 1
  },
  {
    id: "seq-010",
    scope: "sequential",
    chapter: "时序逻辑",
    title: "D 触发器波形分析",
    type: "fill_blank",
    text: "D 触发器初态 Q=0，三个上升沿前 D 依次为 1、0、1，则每个上升沿后的 Q 序列为：________。",
    diagramSvg: dffWaveSvg,
    explanationSvg: dffWaveSvg,
    options: [],
    answerText: "1、0、1",
    explanation: "D 触发器在每个有效上升沿后，Q 等于当时的 D。",
    knowledge: ["波形分析", "D 触发器"],
    keywords: ["1、0、1", "101"],
    difficulty: 2
  },
  {
    id: "seq-011",
    scope: "sequential",
    chapter: "时序逻辑",
    title: "同步与异步计数器",
    type: "analysis",
    text: "同步计数器和异步计数器的主要区别是什么？",
    options: [],
    answerText: "同步计数器中，各触发器由同一个时钟脉冲同时触发；异步计数器中，只有第一级触发器直接接收时钟，后级触发器由前一级输出触发，所以各级状态变化不是完全同时的。",
    explanation: "核心区别在于各触发器是否共用同一个时钟。",
    knowledge: ["计数器", "同步计数器", "异步计数器"],
    keywords: ["同一个时钟", "同时触发", "前一级输出", "不是完全同时"],
    difficulty: 2
  },
  {
    id: "seq-012",
    scope: "sequential",
    chapter: "时序逻辑",
    title: "状态转移表",
    type: "analysis",
    text: "状态转移表主要描述什么内容？",
    options: [],
    answerText: "状态转移表主要描述时序逻辑电路在当前状态和输入条件下，下一状态以及输出的变化关系。简单说，就是说明电路“现在是什么状态，输入来了以后会变成什么状态”。",
    explanation: "状态转移表是时序逻辑状态分析的核心工具。",
    knowledge: ["状态分析", "状态转移表"],
    keywords: ["当前状态", "输入", "下一状态", "输出"],
    difficulty: 2
  }
].map((question) => ({
  imported: false,
  source: "平台内置题库",
  ...question
}));
