import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.PORT = "0";
process.env.AUTO_OPEN_BROWSER = "false";
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "digital-circuit-integration-"));
process.env.DATA_DIR = dataDir;

const { server } = await import("../server.js");
if (!server.listening) await once(server, "listening");
const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}`;

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(dataDir, { recursive: true, force: true });
});

test("health, pages and question APIs are available", async () => {
  const health = await fetch(`${baseUrl}/api/health`).then((response) => response.json());
  const questions = await fetch(`${baseUrl}/api/questions`).then((response) => response.json());
  const basicQuestions = await fetch(`${baseUrl}/api/questions?scope=basic-logic`).then((response) => response.json());
  const combinationQuestions = await fetch(`${baseUrl}/api/questions?scope=combinational`).then((response) => response.json());
  const sequentialQuestions = await fetch(`${baseUrl}/api/questions?scope=sequential`).then((response) => response.json());
  const home = await fetch(`${baseUrl}/`).then((response) => response.text());
  const appHome = await fetch(`${baseUrl}/index.html`).then((response) => response.text());
  const labs = await fetch(`${baseUrl}/labs.html`).then((response) => response.text());
  const builder = await fetch(`${baseUrl}/gate-builder-demo.html`).then((response) => response.text());
  const mainStyle = await fetch(`${baseUrl}/styles.css`).then((response) => response.text());
  const labStyle = await fetch(`${baseUrl}/labs.css`).then((response) => response.text());
  const siteNavStyle = await fetch(`${baseUrl}/site-nav.css`).then((response) => response.text());
  const labsScript = await fetch(`${baseUrl}/labs.js`).then((response) => response.text());
  const transitionScript = await fetch(`${baseUrl}/page-transition.js`).then((response) => response.text());

  assert.equal(health.ok, true);
  assert.equal(questions.length, 36);
  assert.equal(basicQuestions.length, 12);
  assert.equal(combinationQuestions.length, 12);
  assert.equal(sequentialQuestions.length, 12);
  assert.ok(questions.some((question) => question.diagramSvg?.includes("<svg")));
  assert.ok(questions.some((question) => question.explanationSvg?.includes("<svg")));
  assert.match(home, /数字电路智能仿真学习系统/);
  assert.match(home, /集成逻辑门、触发器、译码器与存储器，探索动态信号与时序波形/);
  assert.match(home, /\/assets\/neon-circuit-city-astronaut\.webp/);
  assert.match(home, /data-pixel-home-canvas/);
  assert.match(home, /initPixelHeroCanvas/);
  assert.match(home, /robot-pulse/);
  assert.match(home, /scan-layer/);
  assert.doesNotMatch(home, /digital-human-cutout-transparent\.png/);
  assert.doesNotMatch(home, /circuit-background\.js/);
  assert.match(home, /class="enter-button" href="\.\/index\.html"/);
  assert.match(home, /进入系统/);
  assert.match(home, /逻辑门/);
  assert.match(home, /触发器/);
  assert.match(home, /译码器/);
  assert.match(home, /存储器/);
  assert.match(home, /data-no-transition="true"/);
  assert.doesNotMatch(home, /site-nav\.css/);
  assert.match(home, /page-transition\.js/);
  assert.match(appHome, /数字电路个性化学习中心/);
  assert.match(appHome, /site-nav\.css/);
  assert.match(appHome, /data-scope="basic-logic"/);
  assert.match(appHome, /data-scope="combinational"/);
  assert.match(appHome, /data-scope="sequential"/);
  assert.match(appHome, /id="questionDiagram"/);
  assert.match(appHome, /site-nav__link active" href="\.\/index\.html" aria-current="page"/);
  assert.match(appHome, /href="\.\/gate-builder-demo\.html">实践中心/);
  assert.match(appHome, /href="\.\/labs\.html">实验中心/);
  assert.doesNotMatch(appHome, /page-transition\.js/);
  assert.match(appHome, /gate-builder-demo\.html/);
  assert.match(await fetch(`${baseUrl}/app.js`).then((response) => response.text()), /function renderSvg/);
  assert.match(labs, /交互仿真实验中心/);
  assert.match(labs, /site-nav\.css/);
  assert.match(labs, /href="\.\/index\.html">学习中心/);
  assert.match(labs, /href="\.\/gate-builder-demo\.html">实践中心/);
  assert.match(labs, /site-nav__link active" href="\.\/labs\.html" aria-current="page"/);
  assert.doesNotMatch(labs, /page-transition\.js/);
  assert.match(labs, /gate-builder-demo\.html/);
  assert.match(builder, /门级电路自由搭建与智能分析/);
  assert.match(builder, /AI 电路助教/);
  assert.match(builder, /分析当前电路/);
  assert.match(builder, /回收站/);
  assert.match(builder, /site-nav\.css/);
  assert.match(builder, /href="\.\/index\.html">学习中心/);
  assert.match(builder, /site-nav__link active" href="\.\/gate-builder-demo\.html" aria-current="page"/);
  assert.match(builder, /href="\.\/labs\.html">实验中心/);
  assert.match(builder, /simulationSummary/);
  assert.match(builder, /zoomLevel/);
  assert.match(builder, /setBoardZoom/);
  assert.match(builder, /analysis-resizer/);
  assert.match(builder, /analysisForm/);
  assert.match(builder, /streamCircuitAssistant/);
  assert.match(builder, /circuitSnapshot/);
  assert.match(builder, /component-id/);
  assert.match(builder, /label: `\$\{componentDefs\[component\.type\]\.label\} \$\{component\.id\}`/);
  assert.match(builder, /buildCircuitPurposeText/);
  assert.match(builder, /setupAnalysisResize/);
  assert.match(builder, /\/api\/lab\/stream/);
  assert.match(builder, /startConnectionDrag/);
  assert.match(builder, /finishConnectionDrag/);
  assert.match(builder, /inputSnapRadius/);
  assert.match(builder, /input-toggle/);
  assert.match(builder, /wire-signal-flow/);
  assert.match(builder, /lever-switch/);
  assert.match(builder, /lever-arm/);
  assert.match(builder, /ghostPrompt/);
  assert.match(builder, /ghostLayer/);
  assert.match(builder, /ghostTemplates/);
  assert.match(builder, /halfAdder/);
  assert.match(builder, /fullAdder/);
  assert.match(builder, /mux2/);
  assert.match(builder, /generateGhostGuide/);
  assert.match(builder, /updateGhostEvaluation/);
  assert.match(builder, /ghostGenerateButton\.addEventListener/);
  assert.match(builder, /ghostClearButton\.addEventListener/);
  assert.match(builder, /boardPanX/);
  assert.match(builder, /screenToLogical/);
  assert.match(builder, /logicalToScreen/);
  assert.match(builder, /startBoardPan/);
  assert.match(builder, /updateBoardPan/);
  assert.match(builder, /resetBoardView/);
  assert.match(builder, /library-section/);
  assert.match(builder, /library-panel/);
  assert.match(builder, /--library-width/);
  assert.match(builder, /library-resizer/);
  assert.match(builder, /setupLibraryResize/);
  assert.match(builder, /gate-builder-library-width/);
  assert.match(builder, /library-header/);
  assert.match(builder, /library-scroll/);
  assert.match(builder, /library-items/);
  assert.match(builder, /ghost-helper collapsed/);
  assert.match(builder, /setupGhostHelperToggle/);
  assert.match(builder, /ghostHelperBody/);
  assert.match(builder, /max-height: min\(280px, 30vh\)/);
  assert.match(builder, /overflow-y: auto/);
  assert.match(builder, /grid-template-rows: auto minmax\(0, 1fr\) auto/);
  assert.match(builder, /setupLibraryWheelControl/);
  assert.doesNotMatch(builder, /component-panel|library-viewport|syncLibraryViewport|library-list|library-group/);
  assert.match(builder, /scrollbar-color/);
  assert.match(builder, /\*::-webkit-scrollbar-thumb:hover/);
  assert.match(builder, /overscroll-behavior: contain/);
  assert.match(mainStyle, /\*::-webkit-scrollbar-thumb:hover/);
  assert.match(mainStyle, /scrollbar-color: #00d1ff rgba\(4, 12, 24, \.88\)/);
  assert.match(labStyle, /\*::-webkit-scrollbar-thumb:hover/);
  assert.match(labStyle, /scrollbar-color: #00d1ff rgba\(4, 12, 24, \.88\)/);
  assert.match(siteNavStyle, /\.site-nav/);
  assert.match(siteNavStyle, /\.site-nav \.site-nav__link\.active/);
  assert.match(builder, /CONST 0/);
  assert.match(builder, /CONST 1/);
  assert.match(builder, /NAND/);
  assert.match(builder, /NOR/);
  assert.match(builder, /XNOR/);
  assert.match(builder, /HALF ADDER/);
  assert.match(builder, /FULL ADDER/);
  assert.match(builder, /MUX 4:1/);
  assert.match(builder, /DECODER 2-4/);
  assert.match(builder, /COMPARATOR/);
  assert.match(builder, /PARITY/);
  assert.match(builder, /outputLabels/);
  assert.match(builder, /evaluateComponentOutputs/);
  assert.match(builder, /fromPort/);
  assert.doesNotMatch(builder, /switch-control|switch-knob|switch-label|lever-state/);
  assert.doesNotMatch(builder, /handlePortClick|selectedOutput/);
  assert.doesNotMatch(builder, /metrics|componentCount|wireCount|buildCircuitAnalysisText/);
  assert.match(builder, /lamp-bulb/);
  assert.doesNotMatch(builder, /page-transition\.js/);
  assert.match(transitionScript, /flashPulse/);
  assert.match(transitionScript, /navigateWithLightTransition/);
  assert.match(transitionScript, /body\.page-leave/);
  assert.doesNotMatch(transitionScript, /circuit-core-ring|120vmax|navigateWithCoreBurst/);
  assert.match(labs, /JK 触发器动态时序图/);
  assert.match(labsScript, /name: "基本逻辑门"/);
  assert.match(labsScript, /name: "全加器"/);
  assert.match(labsScript, /两级半加器级联结构/);
  assert.match(labsScript, /第一级半加器 HA1/);
  assert.match(labsScript, /第二级半加器 HA2/);
  assert.doesNotMatch(labsScript, /M342 120 H500/);
  assert.match(labsScript, /name: "3-8 译码器"/);
  assert.match(labsScript, /name: "JK 触发器"/);
  assert.match(labsScript, /class="chip-state-hint"/);
  assert.match(labsScript, /function recordJkPulse/);
  assert.match(labsScript, /function renderTimingSvg/);
  assert.match(labsScript, /M134 83 H312/);
  assert.match(labsScript, /M657 295 H790/);
  assert.doesNotMatch(labsScript, /V22 H250/);
  assert.doesNotMatch(labsScript, /setInterval\(/);
  assert.match(labsScript, /await speak/);
  assert.match(labsScript, /function getDemoNarration/);
  assert.match(labsScript, /utterance\.rate = 1\.28/);
  assert.match(labsScript, /waitForDemoPause\(250, runId\)/);
  assert.doesNotMatch(labsScript, /name: "半加器"/);
  assert.doesNotMatch(labsScript, /name: "D 触发器"/);
});

test("self-test and targeted paper generation return usable lists", async () => {
  const paper = await fetch(`${baseUrl}/api/self-test?count=5`).then((response) => response.json());
  const targeted = await fetch(`${baseUrl}/api/targeted-questions?knowledge=${encodeURIComponent("比较器")}&count=5`)
    .then((response) => response.json());

  assert.equal(paper.length, 5);
  assert.ok(targeted.length > 0);
  assert.ok(targeted.every((question) => question.knowledge.includes("比较器")));
});

test("lab assistant streams a local fallback without an API key", async () => {
  const response = await fetch(`${baseUrl}/api/lab/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question: "为什么当前输出是 0？",
      experimentName: "基本逻辑门",
      experimentState: { A: 0, B: 0, gate: "AND", Y: 0 }
    })
  });
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/event-stream/);
  assert.match(body, /"type":"delta"/);
  assert.match(body, /"type":"done"/);
});
