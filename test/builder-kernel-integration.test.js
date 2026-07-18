import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("free-form builder evaluates components through the shared circuit catalog", () => {
  const html = fs.readFileSync(new URL("../public/gate-builder-demo.html", import.meta.url), "utf8");
  assert.match(html, /<script type="module">\s*import \{ evaluateCircuitComponent \}/);
  assert.match(html, /evaluateCircuitComponent\(component\.type, inputs\)/);
  assert.doesNotMatch(html, /function gateOutput\(/);
  assert.doesNotMatch(html, /component\.type === "FULL_ADDER"/);
});
