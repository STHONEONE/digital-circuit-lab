import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync(new URL("../public/labs.html", import.meta.url), "utf8");
const script = fs.readFileSync(new URL("../public/labs.js", import.meta.url), "utf8");

test("lab shell separates the compact curriculum sidebar from the focused workspace", () => {
  assert.match(html, /<main class="lab-shell">\s*<aside class="experiment-browser"/);
  assert.match(html, /<\/aside>\s*<section id="labWorkspace" class="lab-workspace"/);
  assert.match(html, /<header class="workbench-header">/);
  assert.match(html, /id="experimentObjective"/);
  assert.match(html, /id="workspaceStartButton"/);
  assert.match(html, /class="lab-toolstrip"[\s\S]*id="demoButton"/);
  assert.match(html, /class="simulation-layout"[\s\S]*class="simulation-primary"[\s\S]*class="verification-column"/);
  assert.match(html, /id="fullAdderChallenge"[\s\S]*id="truthPanel"/);
  assert.match(html, /class="lab-lower-grid"[\s\S]*id="experimentEvidencePanel"[\s\S]*class="assistant-panel"/);
  assert.match(html, /assets\/icons\/circuit-board\.svg/);
  assert.match(html, /assets\/icons\/book-open\.svg/);
});

test("catalog rendering keeps accessible item state, progressive disclosure and search feedback", () => {
  assert.match(script, /课程实验 \$\{availableCount\}/);
  assert.match(script, /button\.dataset\.experimentId = definition\.id/);
  assert.match(script, /button\.setAttribute\("aria-pressed"/);
  assert.match(script, /visibleAvailableItems >= 5/);
  assert.match(script, /items\.classList\.toggle\("catalog-preview", limitCombinational\)/);
  assert.match(script, /查看全部 \$\{group\.experimentCount\} 个/);
  assert.match(script, /找到 \$\{visibleCount\} 个实验/);
  assert.match(script, /prefers-reduced-motion: reduce/);
  assert.match(script, /document\.body\.dataset\.currentExperiment = experimentKey/);
  assert.match(script, /elements\.workspaceStartButton\.addEventListener\("click", focusCurrentExperimentAction\)/);
  assert.match(script, /elements\.experimentEvidencePanel\.hidden = !active/);
});
