/**
 * @typedef {Readonly<{
 *   type: string,
 *   label: string,
 *   group: "io" | "gates" | "modules",
 *   inputPorts: readonly string[],
 *   outputPorts: readonly string[]
 * }>} CircuitDefinition
 */

function define(type, label, group, inputPorts, outputPorts) {
  return Object.freeze({
    type,
    label,
    group,
    inputPorts: Object.freeze(inputPorts),
    outputPorts: Object.freeze(outputPorts)
  });
}

const definitions = Object.freeze([
  define("INPUT", "INPUT", "io", [], ["Q"]),
  define("OUTPUT", "OUTPUT", "io", ["IN"], []),
  define("CONST0", "CONST 0", "io", [], ["0"]),
  define("CONST1", "CONST 1", "io", [], ["1"]),
  define("AND", "AND", "gates", ["A", "B"], ["Y"]),
  define("OR", "OR", "gates", ["A", "B"], ["Y"]),
  define("NOT", "NOT", "gates", ["A"], ["Y"]),
  define("XOR", "XOR", "gates", ["A", "B"], ["Y"]),
  define("NAND", "NAND", "gates", ["A", "B"], ["Y"]),
  define("NOR", "NOR", "gates", ["A", "B"], ["Y"]),
  define("XNOR", "XNOR", "gates", ["A", "B"], ["Y"]),
  define("HALF_ADDER", "HALF ADDER", "modules", ["A", "B"], ["S", "C"]),
  define("FULL_ADDER", "FULL ADDER", "modules", ["A", "B", "Cin"], ["S", "Cout"]),
  define("MUX2", "2:1 MUX", "modules", ["D0", "D1", "S"], ["Y"]),
  define("MUX4", "4:1 MUX", "modules", ["D0", "D1", "D2", "D3", "S1", "S0"], ["Y"]),
  define("DECODER24", "2:4 DECODER", "modules", ["A1", "A0"], ["Y0", "Y1", "Y2", "Y3"]),
  define("COMPARATOR", "COMPARATOR", "modules", ["A", "B"], ["A>B", "A=B", "A<B"]),
  define("PARITY", "PARITY", "modules", ["A", "B", "C", "D"], ["P"])
]);

const definitionsByType = new Map(definitions.map((definition) => [definition.type, definition]));

/** @returns {CircuitDefinition | null} */
export function getCircuitDefinition(type) {
  return definitionsByType.get(String(type || "").toUpperCase()) || null;
}

/** @returns {CircuitDefinition[]} */
export function listCircuitDefinitions() {
  return [...definitions];
}

/**
 * Evaluate one catalog component with binary inputs.
 *
 * Unknown component types return `null`. A known component with missing or
 * non-binary inputs returns one `null` per logical output. INPUT accepts its
 * source value as a one-item `inputs` array. OUTPUT similarly returns its
 * observed input as a one-item result although it has no connectable outputs.
 *
 * @param {string} type
 * @param {number[]} inputs
 * @returns {(number | null)[] | null}
 */
export function evaluateCircuitComponent(type, inputs = []) {
  const normalizedType = String(type || "").toUpperCase();
  const definition = getCircuitDefinition(normalizedType);
  if (!definition) return null;

  if (normalizedType === "INPUT") {
    return inputs.length === 1 && (inputs[0] === 0 || inputs[0] === 1) ? [inputs[0]] : [null];
  }
  if (normalizedType === "OUTPUT") {
    return inputs.length === 1 && (inputs[0] === 0 || inputs[0] === 1) ? [inputs[0]] : [null];
  }
  if (normalizedType === "CONST0") return [0];
  if (normalizedType === "CONST1") return [1];
  if (inputs.length !== definition.inputPorts.length || inputs.some((value) => value !== 0 && value !== 1)) {
    return Array(definition.outputPorts.length).fill(null);
  }

  if (normalizedType === "AND") return [inputs.every(Boolean) ? 1 : 0];
  if (normalizedType === "OR") return [inputs.some(Boolean) ? 1 : 0];
  if (normalizedType === "NOT") return [inputs[0] ? 0 : 1];
  if (normalizedType === "XOR") return [inputs.filter(Boolean).length % 2 ? 1 : 0];
  if (normalizedType === "NAND") return [inputs.every(Boolean) ? 0 : 1];
  if (normalizedType === "NOR") return [inputs.some(Boolean) ? 0 : 1];
  if (normalizedType === "XNOR") return [inputs.filter(Boolean).length % 2 ? 0 : 1];
  if (normalizedType === "HALF_ADDER") {
    const [a, b] = inputs;
    return [a ^ b, a & b];
  }
  if (normalizedType === "FULL_ADDER") {
    const sum = inputs[0] + inputs[1] + inputs[2];
    return [sum % 2, sum >= 2 ? 1 : 0];
  }
  if (normalizedType === "MUX2") return [inputs[inputs[2]]];
  if (normalizedType === "MUX4") return [inputs[inputs[4] * 2 + inputs[5]]];
  if (normalizedType === "DECODER24") {
    const selected = inputs[0] * 2 + inputs[1];
    return Array.from({ length: 4 }, (_, index) => index === selected ? 1 : 0);
  }
  if (normalizedType === "COMPARATOR") return [Number(inputs[0] > inputs[1]), Number(inputs[0] === inputs[1]), Number(inputs[0] < inputs[1])];
  if (normalizedType === "PARITY") return [inputs.reduce((value, input) => value ^ input, 0)];

  return Array(definition.outputPorts.length).fill(null);
}
