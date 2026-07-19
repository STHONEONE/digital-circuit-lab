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
  const extensions = await fetch(`${baseUrl}/extensions.html`).then((response) => response.text());
  const topicSimulator = await fetch(`${baseUrl}/extensions/encoder-decoder-simulator.html`).then((response) => response.text());
  const mainStyle = await fetch(`${baseUrl}/styles.css`).then((response) => response.text());
  const labStyle = await fetch(`${baseUrl}/labs.css`).then((response) => response.text());
  const siteNavStyle = await fetch(`${baseUrl}/site-nav.css`).then((response) => response.text());
  const appScript = await fetch(`${baseUrl}/app.js`).then((response) => response.text());
  const labsScript = await fetch(`${baseUrl}/labs.js`).then((response) => response.text());

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
  assert.doesNotMatch(home, /data-no-transition|click-spark/);
  assert.doesNotMatch(home, /site-nav\.css/);
  assert.doesNotMatch(home, /page-transition\.js/);
  assert.match(appHome, /数字电路个性化学习中心/);
  assert.match(appHome, /site-nav\.css/);
  assert.match(appHome, /data-scope="basic-logic"/);
  assert.match(appHome, /data-scope="combinational"/);
  assert.match(appHome, /data-scope="sequential"/);
  assert.match(appHome, /id="practiceSettings"/);
  assert.doesNotMatch(appHome, /id="startPracticeButton"/);
  assert.match(appHome, /id="questionDiagram"/);
  assert.match(appHome, /id="prevButton"/);
  assert.match(appHome, /site-nav__link active" href="\.\/index\.html" aria-current="page"/);
  assert.match(appHome, /href="\.\/gate-builder-demo\.html">电路搭建/);
  assert.match(appHome, /href="\.\/labs\.html">实验中心/);
  assert.doesNotMatch(appHome, /page-transition\.js/);
  assert.match(appHome, /gate-builder-demo\.html/);
  assert.match(appScript, /function renderSvg/);
  assert.match(appScript, /moveQuestion\(-1\)/);
  assert.match(appScript, /focusPracticeWorkspace/);
  assert.doesNotMatch(appScript, /function shuffled/);
  assert.match(appScript, /\/api\/wrong-remediation/);
  assert.match(appScript, /generatedVariant/);
  assert.match(appScript, /orderLearningCenterQuestions/);
  assert.match(appScript, /method: "POST"/);
  assert.match(labs, /数字电路实验中心/);
  assert.match(labs, /site-nav\.css/);
  assert.match(labs, /href="\.\/index\.html">学习中心/);
  assert.match(labs, /href="\.\/gate-builder-demo\.html">电路搭建/);
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
  assert.match(builder, /逻辑表达式工具 ↗/);
  assert.match(builder, /encoder-decoder-simulator\.html\?section=engine&amp;from=builder/);
  assert.match(builder, /target="_blank" rel="noopener"/);
  assert.match(extensions, /专题仿真中心/);
  assert.match(extensions, /\?topic=encoder/);
  assert.match(extensions, /\?topic=decoder/);
  assert.match(extensions, /\?topic=display/);
  assert.match(topicSimulator, /data-action="topic" data-topic="encoder"/);
  assert.match(topicSimulator, /data-action="topic" data-topic="decoder"/);
  assert.match(topicSimulator, /data-action="topic" data-topic="display"/);
  assert.match(topicSimulator, /data-action="open-reference"/);
  assert.match(topicSimulator, /<dialog class="reference-dialog"/);
  assert.match(topicSimulator, /const SECTION_TOPIC/);
  assert.match(topicSimulator, /const isToolMode/);
  assert.doesNotMatch(topicSimulator, /id="experiment-tabs"|data-action="nav"/);
  assert.doesNotMatch(topicSimulator, /<section id="priority16" class="module"/);
  assert.match(topicSimulator, /<details id="priority16-advanced"/);
  assert.match(topicSimulator, /data-action="decoder-device" data-section="hc138"/);
  assert.match(topicSimulator, /data-action="decoder-device" data-section="hc42"/);
  assert.match(topicSimulator, /const legacyPriority16 = requestedSection === "priority16"/);
  assert.match(topicSimulator, /encoderMode: legacyPriority16 \? "hc148" : "normal"/);
  assert.match(topicSimulator, /legacyPriority16\) \$\("priority16-advanced"\)\.open = true/);
  assert.doesNotMatch(topicSimulator, /<details[^>]*(?:truth-table-details|advanced-experiment)[^>]*\sopen(?:\s|>)/);
  for (const id of [
    "priority16-high-controls", "priority16-low-controls", "priority16-result", "priority16-chip-status", "priority16-table",
    "hc138-enable-controls", "hc138-address-controls", "hc138-result", "hc138-output-grid", "hc138-table",
    "cascade-controls", "cascade-chip-status", "cascade-result", "cascade-output-grid",
    "hc42-controls", "hc42-result", "hc42-output-grid", "hc42-table",
    "seven-bcd-controls", "seven-control-pins", "seven-result", "seven-display", "segment-output-grid", "seven-table",
    "multi-int", "multi-frac", "multi-rbi-button", "multi-display", "multi-note"
  ]) {
    assert.match(topicSimulator, new RegExp(`id="${id}"`), `topic simulator should retain #${id}`);
  }
  for (const functionName of ["calcPriority16", "renderPriority16", "calcHc138", "renderCascade", "calcHc42", "calcSeven", "renderMultiDisplay"]) {
    assert.match(topicSimulator, new RegExp(`function ${functionName}\\(`), `topic simulator should retain ${functionName}()`);
  }
  assert.match(builder, /outputLabels/);
  assert.match(builder, /evaluateComponentOutputs/);
  assert.match(builder, /fromPort/);
  assert.doesNotMatch(builder, /switch-control|switch-knob|switch-label|lever-state/);
  assert.doesNotMatch(builder, /handlePortClick|selectedOutput/);
  assert.doesNotMatch(builder, /metrics|componentCount|wireCount|buildCircuitAnalysisText/);
  assert.match(builder, /lamp-bulb/);
  assert.doesNotMatch(builder, /page-transition\.js/);
  assert.doesNotMatch(extensions, /page-transition\.js|data-no-transition/);
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

test("learning center uses five independent pages and embeds practice settings in normal practice", async () => {
  const pages = await Promise.all([
    "learning-route.html", "wrong-review.html", "self-test.html", "learning-review.html"
  ].map(async (name) => [name, await fetch(`${baseUrl}/${name}`).then((response) => response.text())]));
  const index = await fetch(`${baseUrl}/index.html`).then((response) => response.text());
  const appController = await fetch(`${baseUrl}/app.js`).then((response) => response.text());
  const shell = await fetch(`${baseUrl}/learning-shell.js`).then((response) => response.text());
  const controller = await fetch(`${baseUrl}/learning-pages.js`).then((response) => response.text());
  const styles = await fetch(`${baseUrl}/learning-pages.css`).then((response) => response.text());
  const routePage = pages.find(([name]) => name === "learning-route.html")?.[1] || "";
  const selfTestPage = pages.find(([name]) => name === "self-test.html")?.[1] || "";
  const reviewPage = pages.find(([name]) => name === "learning-review.html")?.[1] || "";

  assert.match(index, /data-learning-page="center"/);
  assert.match(index, /class="sidebar platform-sidebar index-platform-sidebar" data-learning-nav/);
  assert.match(index, /class="legacy-app-controls"/);
  assert.match(index, /learning-shell\.js/);
  assert.match(index, /learning-pages\.css/);
  assert.match(index, /id="practiceSettings"/);
  assert.doesNotMatch(index, /id="practiceTypeSelect"/);
  assert.doesNotMatch(index, /id="practiceCountSelect"/);
  assert.doesNotMatch(index, /id="startPracticeButton"/);
  assert.match(index, /id="desktopInsights" class="desktop-insights" hidden/);
  assert.doesNotMatch(index, /id="scopeNavButton"/);
  assert.match(appController, /new URLSearchParams\(window\.location\.search\)/);
  for (const [name, html] of pages) {
    assert.match(html, /class="platform-sidebar" data-learning-nav/);
    assert.match(html, /learning-shell\.js/);
    assert.match(html, /learning-pages\.js/);
    assert.match(html, /class="platform-page-frame"/);
    assert.ok(html.includes(`data-learning-page="${{
      "learning-route.html": "route",
      "wrong-review.html": "wrong",
      "self-test.html": "self-test",
      "learning-review.html": "review"
    }[name]}"`));
  }
  for (const href of ["index.html", "learning-route.html", "wrong-review.html", "self-test.html", "learning-review.html"]) {
    assert.match(shell, new RegExp(`href: "\\./${href.replace(".", "\\.")}"`));
  }
  assert.doesNotMatch(shell, /scope\.html/);
  assert.match(shell, /label: "普通练习"/);
  assert.match(shell, /label: "知识复习"/);
  assert.match(shell, /label: "个性化学习"/);
  assert.match(shell, /label: "学习报告"/);
  assert.match(shell, /className = "learning-view-frame"/);
  assert.match(shell, /const views = new Map/);
  assert.match(shell, /window\.history\.pushState/);
  assert.match(shell, /window\.parent\.learningPlatform\.switchPage/);
  assert.match(shell, /visiblePage/);
  assert.match(shell, /location\.assign\(destination\.href\)/);
  assert.match(shell, /function installLearningPageRouting\(\)/);
  assert.doesNotMatch(shell, /platform-transition|platform-page-ready|platform-page-leaving/);
  assert.doesNotMatch(shell, /window\.setTimeout\(\(\) => location\.assign/);
  assert.match(controller, /class PlatformQuestionRunner/);
  assert.match(controller, /renderKnowledge\(response, sourceQuestion\)/);
  assert.match(controller, /platform-remediation-launcher/);
  assert.match(routePage, /id="routeKnowledgeGroups"/);
  assert.match(routePage, /id="routeLessonTitle"/);
  assert.match(routePage, /id="routeLessonRules"/);
  assert.match(routePage, /id="routeLessonExample"/);
  assert.match(routePage, /data-route-tab="core"/);
  assert.match(routePage, /data-route-tab="example"/);
  assert.match(routePage, /data-route-tab="practice"/);
  assert.match(routePage, /id="routeLessonDuration"/);
  assert.match(routePage, /生成本知识点练习/);
  assert.match(routePage, /调用 AI 生成当前知识点的专项题/);
  assert.match(routePage, /<h2>知识复习<\/h2>/);
  assert.doesNotMatch(routePage, /<h2>学习路线<\/h2>|路线依据|阶段自测/);
  assert.doesNotMatch(routePage, /route-focus-console|复习指引|当前复习|预计阅读时长|相关知识点|复习顺序|复习依据/);
  assert.doesNotMatch(routePage, /data-question-runner="route"/);
  assert.doesNotMatch(routePage, /id="routeStartButton"/);
  assert.match(controller, /selectedFocus/);
  assert.match(controller, /routeKnowledgeSearch/);
  assert.match(controller, /lessonProfiles/);
  assert.match(controller, /questionsFor/);
  assert.match(controller, /activateRouteTab/);
  assert.match(selfTestPage, /<h2>个性化学习<\/h2>/);
  assert.match(selfTestPage, /学习任务设置/);
  assert.match(selfTestPage, /任务生成依据/);
  assert.match(selfTestPage, /生成并开始学习/);
  assert.doesNotMatch(selfTestPage, /阶段自测|组卷参数|自测卷预览|AI 组卷依据|试卷目录/);
  assert.match(reviewPage, /近 5 题滚动正确率/);
  assert.match(reviewPage, /横轴是作答顺序；纵轴是本次及之前最多 5 题的正确率/);
  assert.match(reviewPage, /最近 10 次作答/);
  assert.match(reviewPage, /data-review-range="recent">最近 10 次/);
  assert.doesNotMatch(reviewPage, /学习任务完成趋势|近 5 个任务/);
  assert.match(controller, /progress\.attempts/);
  assert.match(controller, /progress\.recentAttempts/);
  assert.match(controller, /正确率\(%\)/);
  assert.match(controller, /第\$\{point\.attempt\.sequence\}次/);
  assert.doesNotMatch(controller, /progress\.rounds/);
  assert.match(controller, /总体正确率/);
  assert.match(controller, /最近 10 次正确率/);
  assert.doesNotMatch(controller, /首次正确率|迁移正确率/);
  assert.match(styles, /\.practice-settings/);
  assert.match(styles, /\.learning-view-frame/);
  assert.match(styles, /\.learning-view-frame\[hidden\]/);
  assert.match(styles, /html\.learning-embedded/);
  assert.doesNotMatch(styles, /platform-transition|platform-page-ready|platform-page-leaving/);
  assert.doesNotMatch(styles, /@keyframes\s+platform-(?:enter|wipe)/);
  assert.match(styles, /\.route-workspace/);
  assert.match(styles, /\.route-knowledge-console/);
  assert.match(styles, /\.route-lesson-console/);
  assert.match(styles, /\.route-directory-heading/);
  assert.match(styles, /\.route-lesson-tabs/);
  assert.match(styles, /\.wrong-workspace/);
  assert.match(styles, /\.self-test-paper/);
  assert.match(styles, /\.review-summary/);
  assert.match(styles, /\.review-recent-list/);
});

test("semantic grading feedback assets expose a shared structured renderer", async () => {
  const scriptResponse = await fetch(`${baseUrl}/answer-feedback.js`);
  const styleResponse = await fetch(`${baseUrl}/answer-feedback.css`);
  const script = await scriptResponse.text();
  const styles = await styleResponse.text();

  assert.equal(scriptResponse.status, 200);
  assert.equal(styleResponse.status, 200);
  assert.match(script, /renderEvaluation/);
  assert.match(script, /正确点/);
  assert.match(script, /错误点/);
  assert.match(script, /遗漏知识点/);
  assert.match(script, /改进建议/);
  assert.match(styles, /\.answer-evaluation-grid/);
});

test("variant remediation retries generation without regrading and keeps system errors neutral", async () => {
  const [appScript, pageScript, feedbackStyles] = await Promise.all([
    fetch(`${baseUrl}/app.js`).then((response) => response.text()),
    fetch(`${baseUrl}/learning-pages.js`).then((response) => response.text()),
    fetch(`${baseUrl}/answer-feedback.css`).then((response) => response.text())
  ]);

  assert.match(appScript, /let pendingAiVariantRetry = null/);
  assert.match(appScript, /async function requestNextAiVariant/);
  assert.match(appScript, /if \(pendingAiVariantRetry\)/);
  assert.match(pageScript, /let gradedAttempt = null/);
  assert.match(pageScript, /async function requestNextVariant/);
  assert.match(pageScript, /if \(!next\?\.ai \|\| !next\.variantQuestion\)/);
  assert.match(appScript, /ai-variant-feedback system-error/);
  assert.match(pageScript, /platform-feedback visible system-error/);
  assert.match(feedbackStyles, /\.feedback\.system-error/);
  assert.match(feedbackStyles, /\.platform-feedback\.system-error/);
});

test("learner-aware HTTP endpoints isolate records and reject invalid IDs safely", async () => {
  const answer = (learner, questionId) => fetch(`${baseUrl}/api/answers`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Learner-Id": learner },
    body: JSON.stringify({ questionId, answer: "B", practiceMode: "normal" })
  });
  await answer("learner-http-a", "base-007");
  await answer("learner-http-b", "base-006");

  const headersA = { "X-Learner-Id": "learner-http-a" };
  const headersB = { "X-Learner-Id": "learner-http-b" };
  const [statsA, statsB, wrongA, wrongB, progressA] = await Promise.all([
    fetch(`${baseUrl}/api/stats`, { headers: headersA }).then((response) => response.json()),
    fetch(`${baseUrl}/api/stats`, { headers: headersB }).then((response) => response.json()),
    fetch(`${baseUrl}/api/wrong-review-details`, { headers: headersA }).then((response) => response.json()),
    fetch(`${baseUrl}/api/wrong-review-details`, { headers: headersB }).then((response) => response.json()),
    fetch(`${baseUrl}/api/progress`, { headers: headersA }).then((response) => response.json())
  ]);
  assert.equal(statsA.answered, 1);
  assert.equal(statsB.answered, 1);
  assert.deepEqual(wrongA.map((item) => item.question.id), ["base-007"]);
  assert.deepEqual(wrongB.map((item) => item.question.id), ["base-006"]);
  assert.ok(progressA.knowledge.every((item) => !String(item.knowledge).includes("或非门")));
  assert.equal(progressA.attempts.length, 1);
  assert.equal(progressA.recentAttempts.length, 1);
  assert.equal(progressA.recentAttempts[0].sequence, 1);
  assert.equal(progressA.recentSummary.answered, 1);

  const invalidHeaders = { "X-Learner-Id": "!!!" };
  const invalidStats = await fetch(`${baseUrl}/api/stats`, { headers: invalidHeaders }).then((response) => response.json());
  const invalidDelete = await fetch(`${baseUrl}/api/records`, { method: "DELETE", headers: invalidHeaders }).then((response) => response.json());
  assert.equal(invalidStats.answered, 0);
  assert.equal(invalidDelete.removed, 0);
  assert.equal((await fetch(`${baseUrl}/api/stats`, { headers: headersA }).then((response) => response.json())).answered, 1);
  assert.equal((await fetch(`${baseUrl}/api/stats`, { headers: headersB }).then((response) => response.json())).answered, 1);
});

test("analysis answer requires AI semantic grading and does not persist when unavailable", async () => {
  const headers = { "Content-Type": "application/json", "X-Learner-Id": "semantic-http-learner" };
  const response = await fetch(`${baseUrl}/api/answers`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      questionId: "base-012",
      answer: "只要任一输入为 1，输出就为 1。",
      practiceMode: "normal"
    })
  });
  const body = await response.json();
  const stats = await fetch(`${baseUrl}/api/stats`, { headers }).then((item) => item.json());

  assert.equal(response.status, 503);
  assert.equal(body.code, "AI_GRADING_UNAVAILABLE");
  assert.equal(stats.answered, 0);
});

test("personalized learning uses the local bank without AI configuration", async () => {
  const selfTestResponse = await fetch(`${baseUrl}/api/self-test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ count: 5, scope: "all" })
  });
  const selfTestBody = await selfTestResponse.json();
  const targeted = await fetch(`${baseUrl}/api/targeted-questions?knowledge=${encodeURIComponent("比较器")}&count=5`)
    .then((response) => response.json());

  assert.equal(selfTestResponse.status, 200);
  assert.equal(selfTestBody.length, 5);
  assert.ok(selfTestBody.every((question) => ["single_choice", "fill_blank", "analysis"].includes(question.type)));
  assert.deepEqual(Object.fromEntries(["basic-logic", "combinational", "sequential"].map((scope) => [
    scope,
    selfTestBody.filter((question) => question.scope === scope).length
  ])), { "basic-logic": 2, combinational: 2, sequential: 1 });
  assert.ok(targeted.length > 0);
  assert.ok(targeted.every((question) => question.knowledge.includes("比较器")));
});

test("personalized tasks persist until deletion and wrong review requires manual confirmation", async () => {
  const learner = "task-http-learner";
  const headers = { "Content-Type": "application/json", "X-Learner-Id": learner };
  const createdResponse = await fetch(`${baseUrl}/api/personalized-tasks`, {
    method: "POST",
    headers,
    body: JSON.stringify({ count: 5, scope: "all" })
  });
  const task = await createdResponse.json();
  const choice = task.questions.find((question) => question.type === "single_choice");
  assert.equal(createdResponse.status, 201);
  assert.ok(task.id);
  assert.ok(choice);

  const answerResponse = await fetch(`${baseUrl}/api/answers`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      questionId: choice.id,
      answer: String(choice.answer),
      practiceMode: "self_test",
      taskId: task.id
    })
  });
  const answer = await answerResponse.json();
  const tasks = await fetch(`${baseUrl}/api/personalized-tasks`, { headers }).then((response) => response.json());
  assert.equal(answerResponse.status, 200);
  assert.equal(answer.taskProgress.taskId, task.id);
  assert.ok(tasks[0].answers[choice.id]);

  await fetch(`${baseUrl}/api/answers`, {
    method: "POST",
    headers,
    body: JSON.stringify({ questionId: "comb-001", answer: "A", practiceMode: "normal" })
  });
  await fetch(`${baseUrl}/api/answers`, {
    method: "POST",
    headers,
    body: JSON.stringify({ questionId: "comb-001", answer: "B", practiceMode: "wrong_review" })
  });
  assert.equal((await fetch(`${baseUrl}/api/wrong-review-details`, { headers }).then((response) => response.json())).length, 1);
  const confirmation = await fetch(`${baseUrl}/api/wrong-review/comb-001/confirm`, { method: "POST", headers });
  assert.equal(confirmation.status, 200);
  assert.equal((await fetch(`${baseUrl}/api/wrong-review-details`, { headers }).then((response) => response.json())).length, 0);

  const removed = await fetch(`${baseUrl}/api/personalized-tasks/${task.id}`, { method: "DELETE", headers }).then((response) => response.json());
  assert.equal(removed.removed, true);
});

test("knowledge review requests an AI-only task for the selected knowledge", async () => {
  const response = await fetch(`${baseUrl}/api/personalized-tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Learner-Id": "knowledge-http-learner" },
    body: JSON.stringify({ count: 5, scope: "basic-logic", knowledge: "二进制转换" })
  });
  const body = await response.json();
  assert.equal(response.status, 503);
  assert.equal(body.code, "AI_NOT_CONFIGURED");
});

test("AI ghost planning reports unavailable AI so the browser can use its template fallback", async () => {
  const response = await fetch(`${baseUrl}/api/ghost-plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requirement: "搭建半加器",
      canvas: { components: [], wires: [] }
    })
  });
  const body = await response.json();

  assert.equal(response.status, 503);
  assert.equal(body.code, "AI_NOT_CONFIGURED");
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

test("wrong-answer remediation stream requires AI configuration for variant generation", async () => {
  const response = await fetch(`${baseUrl}/api/tutor/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      questionId: "base-007",
      mode: "wrong_remediation",
      userAnswer: "B. A + B"
    })
  });
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/event-stream/);
  assert.match(body, /无法调用大模型生成个性化错因分析和变式题/);
  assert.match(body, /"ai":false/);
});

test("wrong-answer remediation endpoint returns no generated variant without AI configuration", async () => {
  const response = await fetch(`${baseUrl}/api/wrong-remediation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      questionId: "base-007",
      userAnswer: "B. A + B",
      referenceAnswer: "A. A·B"
    })
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ai, false);
  assert.equal(body.variantQuestion, null);
  assert.match(body.analysis, /未配置 AI Key/);
});

test("wrong-answer remediation rejects an unregistered client-supplied variant", async () => {
  const response = await fetch(`${baseUrl}/api/wrong-remediation`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Learner-Id": "forged-remediation-owner" },
    body: JSON.stringify({
      questionId: "temporary-ai-variant",
      sourceQuestion: {
        id: "temporary-ai-variant",
        type: "single_choice",
        text: "与门输入为 1 和 0 时输出是什么？",
        options: ["0", "1", "高阻态", "不确定"],
        answer: 0,
        knowledge: ["与门"]
      },
      userAnswer: "B. 1",
      referenceAnswer: "A. 0"
    })
  });
  const body = await response.json();
  assert.equal(response.status, 404);
  assert.equal(body.code, "AI_VARIANT_NOT_REGISTERED");
  assert.match(body.error, /未找到有效的 AI 变式题/);
});
