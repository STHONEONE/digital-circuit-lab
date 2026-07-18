import {
  evaluateCircuitComponent,
  getCircuitDefinition
} from "./circuit-catalog.js";

/**
 * @typedef {{ componentId: string, port: string | number }} WireEndpoint
 * @typedef {{ id: string, type: string }} CircuitComponent
 * @typedef {{ id: string, from: WireEndpoint, to: WireEndpoint }} CircuitWire
 * @typedef {{ components: CircuitComponent[], wires: CircuitWire[] }} CircuitGraph
 * @typedef {{
 *   status: "settled" | "incomplete" | "cycle" | "invalid",
 *   componentOutputs: Record<string, (number | null)[]>,
 *   wireSignals: Record<string, number | null>,
 *   diagnostics: object[],
 *   evaluationOrder: string[]
 * }} CircuitSimulationResult
 */

function portIndex(definition, direction, port) {
  const ports = direction === "from" ? definition.outputPorts : definition.inputPorts;
  if (Number.isInteger(port)) return port >= 0 && port < ports.length ? port : -1;
  return ports.indexOf(port);
}

function findCombinationalCycles(components, wires) {
  const order = new Map(components.map((component, index) => [component.id, index]));
  const adjacency = new Map(components.map((component) => [component.id, []]));
  wires.forEach((wire) => adjacency.get(wire.from.componentId).push(wire.to.componentId));

  let nextIndex = 0;
  const indexes = new Map();
  const lowLinks = new Map();
  const stack = [];
  const onStack = new Set();
  const cycles = [];

  function visit(componentId) {
    indexes.set(componentId, nextIndex);
    lowLinks.set(componentId, nextIndex);
    nextIndex += 1;
    stack.push(componentId);
    onStack.add(componentId);

    for (const targetId of adjacency.get(componentId)) {
      if (!indexes.has(targetId)) {
        visit(targetId);
        lowLinks.set(componentId, Math.min(lowLinks.get(componentId), lowLinks.get(targetId)));
      } else if (onStack.has(targetId)) {
        lowLinks.set(componentId, Math.min(lowLinks.get(componentId), indexes.get(targetId)));
      }
    }

    if (lowLinks.get(componentId) !== indexes.get(componentId)) return;
    const members = [];
    let member;
    do {
      member = stack.pop();
      onStack.delete(member);
      members.push(member);
    } while (member !== componentId);

    const memberSet = new Set(members);
    const internalWires = wires.filter((wire) => (
      memberSet.has(wire.from.componentId) && memberSet.has(wire.to.componentId)
    ));
    if (members.length > 1 || internalWires.some((wire) => wire.from.componentId === wire.to.componentId)) {
      members.sort((left, right) => order.get(left) - order.get(right));
      cycles.push({ componentIds: members, wireIds: internalWires.map((wire) => wire.id) });
    }
  }

  components.forEach((component) => {
    if (!indexes.has(component.id)) visit(component.id);
  });
  cycles.sort((left, right) => order.get(left.componentIds[0]) - order.get(right.componentIds[0]));
  return cycles;
}

/**
 * Evaluate a combinational circuit without reading or mutating the DOM.
 *
 * A graph contains `{ components, wires }`. Each wire uses
 * `{ id, from: { componentId, port }, to: { componentId, port } }`; ports may be
 * their catalog label or zero-based index. Component and wire ids must be unique;
 * INPUT values are keyed by component id and must be numeric 0 or 1.
 *
 * `invalid` has precedence over `cycle`, which has precedence over `incomplete`.
 * Invalid graphs are not evaluated. OUTPUT entries in `componentOutputs` contain
 * the observed input as a one-item array.
 *
 * @param {CircuitGraph} graph
 * @param {Record<string, number>} inputValues
 * @returns {CircuitSimulationResult}
 */
export function simulateCircuit(graph, inputValues = {}) {
  if (!graph || !Array.isArray(graph.components) || !Array.isArray(graph.wires)) {
    return {
      status: "invalid",
      componentOutputs: {},
      wireSignals: {},
      diagnostics: [{
        code: "INVALID_GRAPH",
        message: "电路图必须包含 components 与 wires 数组"
      }],
      evaluationOrder: []
    };
  }
  const components = graph.components;
  const wires = graph.wires;
  const componentMap = new Map(components.map((component) => [component.id, component]));
  const structuralDiagnostics = [];
  const targetDrivers = new Map();
  const seenComponentIds = new Set();
  const duplicateComponentIds = new Set();
  const seenWireIds = new Set();
  const duplicateWireIds = new Set();

  for (const component of components) {
    if (seenComponentIds.has(component.id) && !duplicateComponentIds.has(component.id)) {
      duplicateComponentIds.add(component.id);
      structuralDiagnostics.push({
        code: "DUPLICATE_COMPONENT_ID",
        componentId: component.id,
        message: `元件 id ${component.id} 重复`
      });
    }
    seenComponentIds.add(component.id);
    if (getCircuitDefinition(component.type)) continue;
    structuralDiagnostics.push({
      code: "UNKNOWN_COMPONENT_TYPE",
      componentId: component.id,
      type: component.type,
      message: `元件 ${component.id} 使用了未知类型 ${component.type}`
    });
  }

  for (const wire of wires) {
    const validEndpoint = (endpoint) => endpoint && typeof endpoint === "object"
      && typeof endpoint.componentId === "string" && endpoint.componentId.length > 0
      && (typeof endpoint.port === "string" || Number.isInteger(endpoint.port));
    if (!wire || typeof wire !== "object" || typeof wire.id !== "string" || !wire.id
        || !validEndpoint(wire.from) || !validEndpoint(wire.to)) {
      structuralDiagnostics.push({
        code: "INVALID_WIRE",
        wireId: typeof wire?.id === "string" ? wire.id : "",
        message: "导线必须包含唯一 id 以及有效的 from、to 端点"
      });
      continue;
    }
    if (seenWireIds.has(wire.id) && !duplicateWireIds.has(wire.id)) {
      duplicateWireIds.add(wire.id);
      structuralDiagnostics.push({
        code: "DUPLICATE_WIRE_ID",
        wireId: wire.id,
        message: `导线 id ${wire.id} 重复`
      });
    }
    seenWireIds.add(wire.id);
    const source = componentMap.get(wire.from.componentId);
    const target = componentMap.get(wire.to.componentId);
    const sourceDefinition = source && getCircuitDefinition(source.type);
    const targetDefinition = target && getCircuitDefinition(target.type);

    if (!source) {
      structuralDiagnostics.push({
        code: "UNKNOWN_SOURCE_COMPONENT",
        wireId: wire.id,
        componentId: wire.from.componentId,
        message: `导线 ${wire.id} 引用了不存在的源元件 ${wire.from.componentId}`
      });
    }
    if (!target) {
      structuralDiagnostics.push({
        code: "UNKNOWN_TARGET_COMPONENT",
        wireId: wire.id,
        componentId: wire.to.componentId,
        message: `导线 ${wire.id} 引用了不存在的目标元件 ${wire.to.componentId}`
      });
    }

    if (sourceDefinition && portIndex(sourceDefinition, "from", wire.from.port) < 0) {
      structuralDiagnostics.push({
        code: "INVALID_OUTPUT_PORT",
        wireId: wire.id,
        componentId: source.id,
        port: wire.from.port,
        message: `导线 ${wire.id} 引用了 ${sourceDefinition.label} ${source.id} 不存在的输出端口 ${wire.from.port}`
      });
    }
    if (targetDefinition) {
      const targetPortIndex = portIndex(targetDefinition, "to", wire.to.port);
      if (targetPortIndex < 0) {
        structuralDiagnostics.push({
          code: "INVALID_INPUT_PORT",
          wireId: wire.id,
          componentId: target.id,
          port: wire.to.port,
          message: `导线 ${wire.id} 引用了 ${targetDefinition.label} ${target.id} 不存在的输入端口 ${wire.to.port}`
        });
      } else {
        const targetKey = `${target.id}:${targetPortIndex}`;
        if (!targetDrivers.has(targetKey)) targetDrivers.set(targetKey, []);
        targetDrivers.get(targetKey).push(wire);
      }
    }
  }

  for (const drivers of targetDrivers.values()) {
    if (drivers.length < 2) continue;
    const target = componentMap.get(drivers[0].to.componentId);
    const targetDefinition = getCircuitDefinition(target.type);
    const targetPortIndex = portIndex(targetDefinition, "to", drivers[0].to.port);
    const targetPort = targetDefinition.inputPorts[targetPortIndex];
    structuralDiagnostics.push({
      code: "MULTIPLE_INPUT_DRIVERS",
      componentId: target.id,
      port: targetPort,
      wireIds: drivers.map((wire) => wire.id),
      message: `${targetDefinition.label} ${target.id} 的输入端口 ${targetPort} 被多条导线驱动`
    });
  }

  for (const component of components) {
    if (component.type !== "INPUT" || !Object.hasOwn(inputValues, component.id)) continue;
    const value = inputValues[component.id];
    if (value === 0 || value === 1) continue;
    structuralDiagnostics.push({
      code: "INVALID_INPUT_VALUE",
      componentId: component.id,
      value,
      message: `INPUT ${component.id} 的值必须是 0 或 1`
    });
  }

  if (structuralDiagnostics.length) {
    return {
      status: "invalid",
      componentOutputs: {},
      wireSignals: {},
      diagnostics: structuralDiagnostics,
      evaluationOrder: []
    };
  }

  const incoming = new Map(components.map((component) => [component.id, []]));
  const outgoing = new Map(components.map((component) => [component.id, []]));
  const indegree = new Map(components.map((component) => [component.id, 0]));

  for (const wire of wires) {
    incoming.get(wire.to.componentId).push(wire);
    outgoing.get(wire.from.componentId).push(wire);
    indegree.set(wire.to.componentId, indegree.get(wire.to.componentId) + 1);
  }

  const cycles = findCombinationalCycles(components, wires);
  if (cycles.length) {
    return {
      status: "cycle",
      componentOutputs: Object.fromEntries(components.map((component) => {
        const definition = getCircuitDefinition(component.type);
        const outputCount = component.type === "OUTPUT" ? 1 : definition.outputPorts.length;
        return [component.id, Array(outputCount).fill(null)];
      })),
      wireSignals: Object.fromEntries(wires.map((wire) => [wire.id, null])),
      diagnostics: cycles.map((cycle) => ({
        code: "COMBINATIONAL_CYCLE",
        componentIds: cycle.componentIds,
        wireIds: cycle.wireIds,
        message: `检测到组合逻辑环路：${cycle.componentIds.join(" → ")}`
      })),
      evaluationOrder: []
    };
  }

  const queue = components.filter((component) => indegree.get(component.id) === 0);
  const componentOutputs = {};
  const wireSignals = {};
  const evaluationOrder = [];
  const diagnostics = [];

  while (queue.length) {
    const component = queue.shift();
    const definition = getCircuitDefinition(component.type);
    const inputSignals = Array(definition.inputPorts.length).fill(null);

    for (const wire of incoming.get(component.id)) {
      const source = componentMap.get(wire.from.componentId);
      const sourceDefinition = getCircuitDefinition(source.type);
      const sourcePort = portIndex(sourceDefinition, "from", wire.from.port);
      const targetPort = portIndex(definition, "to", wire.to.port);
      inputSignals[targetPort] = componentOutputs[source.id][sourcePort];
    }

    const connectedInputPorts = new Set(
      incoming.get(component.id).map((wire) => portIndex(definition, "to", wire.to.port))
    );
    definition.inputPorts.forEach((port, index) => {
      if (!connectedInputPorts.has(index)) {
        diagnostics.push({
          code: "MISSING_COMPONENT_INPUT",
          componentId: component.id,
          port,
          message: `${definition.label} ${component.id} 的输入端口 ${port} 未连接`
        });
      }
    });

    if (component.type === "INPUT") {
      if (inputValues[component.id] == null) {
        diagnostics.push({
          code: "MISSING_INPUT_VALUE",
          componentId: component.id,
          message: `INPUT ${component.id} 缺少 0/1 输入值`
        });
      }
      componentOutputs[component.id] = evaluateCircuitComponent("INPUT", [inputValues[component.id]]);
    } else {
      componentOutputs[component.id] = evaluateCircuitComponent(component.type, inputSignals);
    }
    evaluationOrder.push(component.id);

    for (const wire of outgoing.get(component.id)) {
      const sourcePort = portIndex(definition, "from", wire.from.port);
      wireSignals[wire.id] = componentOutputs[component.id][sourcePort];
      const targetId = wire.to.componentId;
      indegree.set(targetId, indegree.get(targetId) - 1);
      if (indegree.get(targetId) === 0) queue.push(componentMap.get(targetId));
    }
  }

  return {
    status: diagnostics.length ? "incomplete" : "settled",
    componentOutputs,
    wireSignals,
    diagnostics,
    evaluationOrder
  };
}
