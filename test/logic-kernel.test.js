import test from "node:test";
import assert from "node:assert/strict";

import {
  evaluateCircuitComponent,
  getCircuitDefinition,
  listCircuitDefinitions
} from "../public/core/circuit-catalog.js";
import { simulateCircuit } from "../public/core/logic-kernel.js";

test("电路目录可查询并计算 AND 元件", () => {
  const definition = getCircuitDefinition("AND");

  assert.deepEqual(definition.inputPorts, ["A", "B"]);
  assert.deepEqual(definition.outputPorts, ["Y"]);
  assert.ok(listCircuitDefinitions().some((item) => item.type === "AND"));
  assert.deepEqual(evaluateCircuitComponent("AND", [1, 1]), [1]);
  assert.deepEqual(evaluateCircuitComponent("AND", [1, 0]), [0]);
});

test("电路目录覆盖基础门、I/O 与加法器", () => {
  const requiredTypes = [
    "INPUT", "OUTPUT", "AND", "OR", "NOT", "XOR", "NAND", "NOR", "XNOR",
    "HALF_ADDER", "FULL_ADDER"
  ];

  const catalogTypes = new Set(listCircuitDefinitions().map((definition) => definition.type));
  assert.ok(requiredTypes.every((type) => catalogTypes.has(type)));
  assert.deepEqual(evaluateCircuitComponent("OR", [0, 1]), [1]);
  assert.deepEqual(evaluateCircuitComponent("NOT", [1]), [0]);
  assert.deepEqual(evaluateCircuitComponent("XOR", [1, 1]), [0]);
  assert.deepEqual(evaluateCircuitComponent("NAND", [1, 1]), [0]);
  assert.deepEqual(evaluateCircuitComponent("NOR", [0, 0]), [1]);
  assert.deepEqual(evaluateCircuitComponent("XNOR", [1, 1]), [1]);
  assert.deepEqual(evaluateCircuitComponent("HALF_ADDER", [1, 1]), [0, 1]);
  assert.deepEqual(evaluateCircuitComponent("FULL_ADDER", [1, 0, 1]), [0, 1]);
});

test("共享电路目录覆盖 AI 搭建所需的组合模块", () => {
  const types = new Set(listCircuitDefinitions().map((definition) => definition.type));
  for (const type of ["CONST0", "CONST1", "MUX2", "MUX4", "DECODER24", "COMPARATOR", "PARITY"]) {
    assert.equal(types.has(type), true, `${type} 应由共享目录定义`);
  }
  assert.deepEqual(evaluateCircuitComponent("MUX2", [0, 1, 1]), [1]);
  assert.deepEqual(evaluateCircuitComponent("MUX4", [0, 1, 0, 1, 1, 0]), [0]);
  assert.deepEqual(evaluateCircuitComponent("DECODER24", [1, 0]), [0, 0, 1, 0]);
  assert.deepEqual(evaluateCircuitComponent("COMPARATOR", [1, 0]), [1, 0, 0]);
  assert.deepEqual(evaluateCircuitComponent("PARITY", [1, 0, 1, 1]), [1]);
});

test("仿真器按拓扑顺序计算完整的组合电路", () => {
  const graph = {
    components: [
      { id: "A", type: "INPUT" },
      { id: "B", type: "INPUT" },
      { id: "G1", type: "AND" },
      { id: "Y", type: "OUTPUT" }
    ],
    wires: [
      { id: "w-a", from: { componentId: "A", port: "Q" }, to: { componentId: "G1", port: "A" } },
      { id: "w-b", from: { componentId: "B", port: "Q" }, to: { componentId: "G1", port: "B" } },
      { id: "w-y", from: { componentId: "G1", port: "Y" }, to: { componentId: "Y", port: "IN" } }
    ]
  };

  const result = simulateCircuit(graph, { A: 1, B: 1 });

  assert.equal(result.status, "settled");
  assert.deepEqual(result.componentOutputs, { A: [1], B: [1], G1: [1], Y: [1] });
  assert.deepEqual(result.wireSignals, { "w-a": 1, "w-b": 1, "w-y": 1 });
  assert.deepEqual(result.evaluationOrder, ["A", "B", "G1", "Y"]);
  assert.deepEqual(result.diagnostics, []);
});

test("INPUT 未提供值时返回 incomplete 与可定位诊断", () => {
  const result = simulateCircuit({
    components: [
      { id: "A", type: "INPUT" },
      { id: "Y", type: "OUTPUT" }
    ],
    wires: [
      { id: "w-a", from: { componentId: "A", port: "Q" }, to: { componentId: "Y", port: "IN" } }
    ]
  });

  assert.equal(result.status, "incomplete");
  assert.deepEqual(result.componentOutputs, { A: [null], Y: [null] });
  assert.deepEqual(result.diagnostics, [
    {
      code: "MISSING_INPUT_VALUE",
      componentId: "A",
      message: "INPUT A 缺少 0/1 输入值"
    }
  ]);
});

test("元件端口未连接时返回 incomplete 并指出缺失端口", () => {
  const result = simulateCircuit({
    components: [
      { id: "A", type: "INPUT" },
      { id: "G1", type: "AND" },
      { id: "Y", type: "OUTPUT" }
    ],
    wires: [
      { id: "w-a", from: { componentId: "A", port: "Q" }, to: { componentId: "G1", port: "A" } },
      { id: "w-y", from: { componentId: "G1", port: "Y" }, to: { componentId: "Y", port: "IN" } }
    ]
  }, { A: 1 });

  assert.equal(result.status, "incomplete");
  assert.deepEqual(result.componentOutputs.G1, [null]);
  assert.deepEqual(result.diagnostics, [
    {
      code: "MISSING_COMPONENT_INPUT",
      componentId: "G1",
      port: "B",
      message: "AND G1 的输入端口 B 未连接"
    }
  ]);
});

test("导线引用不存在的端口时返回 invalid 而不是继续计算", () => {
  const result = simulateCircuit({
    components: [
      { id: "A", type: "INPUT" },
      { id: "Y", type: "OUTPUT" }
    ],
    wires: [
      { id: "w-bad", from: { componentId: "A", port: "BAD" }, to: { componentId: "Y", port: "IN" } }
    ]
  }, { A: 1 });

  assert.equal(result.status, "invalid");
  assert.deepEqual(result.componentOutputs, {});
  assert.deepEqual(result.wireSignals, {});
  assert.deepEqual(result.evaluationOrder, []);
  assert.deepEqual(result.diagnostics, [
    {
      code: "INVALID_OUTPUT_PORT",
      wireId: "w-bad",
      componentId: "A",
      port: "BAD",
      message: "导线 w-bad 引用了 INPUT A 不存在的输出端口 BAD"
    }
  ]);
});

test("同一输入端口被两条导线驱动时返回 invalid", () => {
  const result = simulateCircuit({
    components: [
      { id: "A", type: "INPUT" },
      { id: "B", type: "INPUT" },
      { id: "C", type: "INPUT" },
      { id: "G1", type: "AND" },
      { id: "Y", type: "OUTPUT" }
    ],
    wires: [
      { id: "w-a", from: { componentId: "A", port: "Q" }, to: { componentId: "G1", port: "A" } },
      { id: "w-b", from: { componentId: "B", port: "Q" }, to: { componentId: "G1", port: "A" } },
      { id: "w-c", from: { componentId: "C", port: "Q" }, to: { componentId: "G1", port: "B" } },
      { id: "w-y", from: { componentId: "G1", port: "Y" }, to: { componentId: "Y", port: "IN" } }
    ]
  }, { A: 0, B: 1, C: 1 });

  assert.equal(result.status, "invalid");
  assert.deepEqual(result.diagnostics, [
    {
      code: "MULTIPLE_INPUT_DRIVERS",
      componentId: "G1",
      port: "A",
      wireIds: ["w-a", "w-b"],
      message: "AND G1 的输入端口 A 被多条导线驱动"
    }
  ]);
});

test("组合逻辑环路返回 cycle 并标出环内元件与导线", () => {
  const result = simulateCircuit({
    components: [
      { id: "N1", type: "NOT" },
      { id: "N2", type: "NOT" },
      { id: "Y", type: "OUTPUT" }
    ],
    wires: [
      { id: "w-12", from: { componentId: "N1", port: "Y" }, to: { componentId: "N2", port: "A" } },
      { id: "w-21", from: { componentId: "N2", port: "Y" }, to: { componentId: "N1", port: "A" } },
      { id: "w-out", from: { componentId: "N2", port: "Y" }, to: { componentId: "Y", port: "IN" } }
    ]
  });

  assert.equal(result.status, "cycle");
  assert.deepEqual(result.componentOutputs, { N1: [null], N2: [null], Y: [null] });
  assert.deepEqual(result.wireSignals, { "w-12": null, "w-21": null, "w-out": null });
  assert.deepEqual(result.evaluationOrder, []);
  assert.deepEqual(result.diagnostics, [
    {
      code: "COMBINATIONAL_CYCLE",
      componentIds: ["N1", "N2"],
      wireIds: ["w-12", "w-21"],
      message: "检测到组合逻辑环路：N1 → N2"
    }
  ]);
});

test("FULL_ADDER 仿真覆盖全部 8 组输入真值", () => {
  const graph = {
    components: [
      { id: "A", type: "INPUT" },
      { id: "B", type: "INPUT" },
      { id: "Cin", type: "INPUT" },
      { id: "FA", type: "FULL_ADDER" },
      { id: "S", type: "OUTPUT" },
      { id: "Cout", type: "OUTPUT" }
    ],
    wires: [
      { id: "w-a", from: { componentId: "A", port: "Q" }, to: { componentId: "FA", port: "A" } },
      { id: "w-b", from: { componentId: "B", port: "Q" }, to: { componentId: "FA", port: "B" } },
      { id: "w-cin", from: { componentId: "Cin", port: "Q" }, to: { componentId: "FA", port: "Cin" } },
      { id: "w-s", from: { componentId: "FA", port: "S" }, to: { componentId: "S", port: "IN" } },
      { id: "w-cout", from: { componentId: "FA", port: "Cout" }, to: { componentId: "Cout", port: "IN" } }
    ]
  };

  for (let a = 0; a <= 1; a += 1) {
    for (let b = 0; b <= 1; b += 1) {
      for (let cin = 0; cin <= 1; cin += 1) {
        const result = simulateCircuit(graph, { A: a, B: b, Cin: cin });
        const total = a + b + cin;

        assert.equal(result.status, "settled", `A=${a}, B=${b}, Cin=${cin}`);
        assert.deepEqual(result.componentOutputs.FA, [total % 2, total >= 2 ? 1 : 0]);
        assert.deepEqual(result.componentOutputs.S, [total % 2]);
        assert.deepEqual(result.componentOutputs.Cout, [total >= 2 ? 1 : 0]);
      }
    }
  }
});

test("INPUT 只接受二进制电平", () => {
  const result = simulateCircuit({
    components: [
      { id: "A", type: "INPUT" },
      { id: "Y", type: "OUTPUT" }
    ],
    wires: [
      { id: "w-a", from: { componentId: "A", port: 0 }, to: { componentId: "Y", port: 0 } }
    ]
  }, { A: 2 });

  assert.equal(result.status, "invalid");
  assert.deepEqual(result.diagnostics, [
    {
      code: "INVALID_INPUT_VALUE",
      componentId: "A",
      value: 2,
      message: "INPUT A 的值必须是 0 或 1"
    }
  ]);
});

test("越界的数字端口索引也属于 invalid", () => {
  const result = simulateCircuit({
    components: [
      { id: "A", type: "INPUT" },
      { id: "Y", type: "OUTPUT" }
    ],
    wires: [
      { id: "w-bad-index", from: { componentId: "A", port: 3 }, to: { componentId: "Y", port: 0 } }
    ]
  }, { A: 1 });

  assert.equal(result.status, "invalid");
  assert.equal(result.diagnostics[0].code, "INVALID_OUTPUT_PORT");
  assert.equal(result.diagnostics[0].port, 3);
});

test("未知元件类型通过 invalid 诊断返回而不是抛出异常", () => {
  const result = simulateCircuit({
    components: [{ id: "G1", type: "MAGIC_GATE" }],
    wires: []
  });

  assert.equal(result.status, "invalid");
  assert.deepEqual(result.diagnostics, [
    {
      code: "UNKNOWN_COMPONENT_TYPE",
      componentId: "G1",
      type: "MAGIC_GATE",
      message: "元件 G1 使用了未知类型 MAGIC_GATE"
    }
  ]);
});

test("导线引用不存在的元件时返回 invalid", () => {
  const result = simulateCircuit({
    components: [{ id: "Y", type: "OUTPUT" }],
    wires: [
      { id: "w-orphan", from: { componentId: "MISSING", port: "Q" }, to: { componentId: "Y", port: "IN" } }
    ]
  });

  assert.equal(result.status, "invalid");
  assert.deepEqual(result.diagnostics, [
    {
      code: "UNKNOWN_SOURCE_COMPONENT",
      wireId: "w-orphan",
      componentId: "MISSING",
      message: "导线 w-orphan 引用了不存在的源元件 MISSING"
    }
  ]);
});

test("图结构缺失时返回统一的 invalid 结果", () => {
  const result = simulateCircuit({ components: [] });

  assert.deepEqual(result, {
    status: "invalid",
    componentOutputs: {},
    wireSignals: {},
    diagnostics: [
      {
        code: "INVALID_GRAPH",
        message: "电路图必须包含 components 与 wires 数组"
      }
    ],
    evaluationOrder: []
  });
});

test("导线端点结构损坏时返回 invalid 而不是抛出 TypeError", () => {
  const result = simulateCircuit({
    components: [{ id: "A", type: "INPUT" }],
    wires: [{}]
  }, { A: 1 });

  assert.equal(result.status, "invalid");
  assert.equal(result.diagnostics[0].code, "INVALID_WIRE");
});

test("元件 id 重复时返回 invalid，避免结果被静默覆盖", () => {
  const result = simulateCircuit({
    components: [
      { id: "A", type: "INPUT" },
      { id: "A", type: "OUTPUT" }
    ],
    wires: []
  }, { A: 1 });

  assert.equal(result.status, "invalid");
  assert.deepEqual(result.diagnostics, [
    {
      code: "DUPLICATE_COMPONENT_ID",
      componentId: "A",
      message: "元件 id A 重复"
    }
  ]);
});

test("导线 id 重复时返回 invalid，保证 wireSignals 可唯一索引", () => {
  const result = simulateCircuit({
    components: [
      { id: "A", type: "INPUT" },
      { id: "Y1", type: "OUTPUT" },
      { id: "Y2", type: "OUTPUT" }
    ],
    wires: [
      { id: "w", from: { componentId: "A", port: "Q" }, to: { componentId: "Y1", port: "IN" } },
      { id: "w", from: { componentId: "A", port: "Q" }, to: { componentId: "Y2", port: "IN" } }
    ]
  }, { A: 1 });

  assert.equal(result.status, "invalid");
  assert.deepEqual(result.diagnostics, [
    {
      code: "DUPLICATE_WIRE_ID",
      wireId: "w",
      message: "导线 id w 重复"
    }
  ]);
});
