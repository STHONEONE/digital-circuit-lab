import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright-core";

process.env.PORT = "0";
process.env.AUTO_OPEN_BROWSER = "false";
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "digital-circuit-full-adder-ui-"));
process.env.DATA_DIR = dataDir;
const { server } = await import("../server.js");
if (!server.listening) await once(server, "listening");
const baseUrl = `http://127.0.0.1:${server.address().port}`;
const browserCandidates = [
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
].filter(Boolean);
const browserExecutable = browserCandidates.find((candidate) => fs.existsSync(candidate));
let browser;

test.before(async () => {
  if (browserExecutable) browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
});

test.after(async () => {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(dataDir, { recursive: true, force: true });
});

test("full-adder prediction flow reveals one truth row and survives refresh", {
  skip: browserExecutable ? false : "未找到可用于实验学习流验证的 Chromium 浏览器"
}, async () => {
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/labs.html`, { waitUntil: "networkidle" });

  assert.equal(await page.locator("[data-experiment-group]").count(), 4);
  const openFullAdder = async () => {
    const fullAdderButton = page.getByRole("button", { name: "全加器" });
    if (!await fullAdderButton.isVisible()) await page.getByRole("button", { name: "组合逻辑" }).click();
    await fullAdderButton.click();
  };
  await openFullAdder();
  await page.locator("#fullAdderChallenge:not([hidden])").waitFor();
  assert.match(await page.locator("#coverageText").textContent(), /0\s*\/\s*8/);
  assert.ok(await page.locator("#truthTable .truth-row:not(.header) .masked-output").count() >= 16);
  assert.doesNotMatch(await page.locator("#stateExplanation").textContent(), /S\s*=|Cout\s*=/);
  assert.match(await page.locator("#stateExplanation").textContent(), /预测/);
  assert.equal(await page.locator("#demoButton").isDisabled(), true);
  assert.equal(await page.locator("#screenshotButton").isDisabled(), true);
  const hiddenDiagramLabel = await page.locator("#circuitDiagram svg").getAttribute("aria-label");
  assert.match(hiddenDiagramLabel, /输出尚未验证/);
  assert.doesNotMatch(hiddenDiagramLabel, /S 等于 [01]|Cout 等于 [01]/);
  let tutorRequests = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/lab/stream")) tutorRequests += 1;
  });
  await page.locator("#labQuestion").fill("请直接告诉我 S 和 Cout");
  await page.locator("#askButton").click();
  await page.waitForFunction(() => /先完成当前输入的预测/.test(document.querySelector("#labMessages")?.textContent || ""));
  assert.equal(tutorRequests, 0);

  await page.locator('[data-prediction-output="S"][data-value="0"]').click();
  await page.locator('[data-prediction-output="Cout"][data-value="0"]').click();
  await page.locator("#submitPredictionButton").click();
  await page.locator("#runVerificationButton:not([disabled])").waitFor();
  assert.equal(await page.locator("#controls button").evaluateAll((buttons) => buttons.every((button) => button.disabled)), true);
  assert.equal(await page.locator("[data-prediction-output]").evaluateAll((buttons) => buttons.every((button) => button.disabled)), true);
  assert.equal(await page.locator("#submitPredictionButton").isDisabled(), true);
  assert.equal(await page.locator("#runVerificationButton").isDisabled(), false);
  assert.equal(await page.locator("#screenshotButton").isDisabled(), true);

  await page.reload({ waitUntil: "networkidle" });
  await page.locator("#runVerificationButton:not([disabled])").waitFor();
  assert.equal((await page.locator("#experimentTitle").textContent()).trim(), "全加器");
  assert.match(await page.locator("#predictionFeedback").textContent(), /预测已提交/);
  assert.equal(await page.locator('[data-prediction-output="S"][data-value="0"].active').count(), 1);
  assert.equal(await page.locator('[data-prediction-output="Cout"][data-value="0"].active').count(), 1);
  assert.equal(await page.locator("#controls button").evaluateAll((buttons) => buttons.every((button) => button.disabled)), true);
  assert.equal(await page.locator("[data-prediction-output]").evaluateAll((buttons) => buttons.every((button) => button.disabled)), true);
  assert.equal(await page.locator("#submitPredictionButton").isDisabled(), true);
  assert.equal(await page.locator("#runVerificationButton").isDisabled(), false);
  assert.equal(await page.locator("#screenshotButton").isDisabled(), true);

  await page.locator("#runVerificationButton").click();
  await page.waitForFunction(() => /1\s*\/\s*8/.test(document.querySelector("#coverageText")?.textContent || ""));
  assert.match(await page.locator("#predictionFeedback").textContent(), /预测正确/);
  assert.equal(await page.locator("#truthTable .truth-row.verified").count(), 1);
  assert.equal(await page.locator("#demoButton").isDisabled(), true);
  assert.equal(await page.locator("#screenshotButton").isDisabled(), false);
  assert.equal(await page.locator("#controls button").evaluateAll((buttons) => buttons.every((button) => !button.disabled)), true);
  assert.match(await page.locator("#circuitDiagram svg").getAttribute("aria-label"), /S 等于 0.*Cout 等于 0/);

  await page.reload({ waitUntil: "networkidle" });
  assert.equal((await page.locator("#experimentTitle").textContent()).trim(), "全加器");
  await page.waitForFunction(() => /1\s*\/\s*8/.test(document.querySelector("#coverageText")?.textContent || ""));
  assert.equal(await page.locator("#truthTable .truth-row.verified").count(), 1);
  await context.close();
});

test("completed full-adder report is visible on the learning report page", {
  skip: browserExecutable ? false : "未找到可用于实验报告验证的 Chromium 浏览器"
}, async () => {
  const learnerId = "experiment-report-ui";
  const headers = { "Content-Type": "application/json", "X-Learner-Id": learnerId };
  let session = await fetch(`${baseUrl}/api/experiment-sessions`, {
    method: "POST", headers, body: JSON.stringify({ experimentId: "fullAdder" })
  }).then((response) => response.json());
  for (let index = 0; index < 8; index += 1) {
    const state = { A: (index >> 2) & 1, B: (index >> 1) & 1, Cin: index & 1 };
    const total = state.A + state.B + state.Cin;
    await fetch(`${baseUrl}/api/experiment-sessions/${session.id}/events`, {
      method: "POST", headers,
      body: JSON.stringify({
        type: "prediction.submitted", state,
        prediction: { S: total % 2, Cout: total >= 2 ? 1 : 0 }, hintLevel: 0
      })
    });
    session = await fetch(`${baseUrl}/api/experiment-sessions/${session.id}/events`, {
      method: "POST", headers, body: JSON.stringify({ type: "simulation.run", state })
    }).then((response) => response.json());
  }
  await fetch(`${baseUrl}/api/experiment-sessions/${session.id}/complete`, {
    method: "POST", headers, body: JSON.stringify({ conclusion: "验证了全加器的八种输入组合。" })
  });

  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  await context.addInitScript((id) => localStorage.setItem("digital-circuit-learner-id", id), learnerId);
  const page = await context.newPage();
  await page.goto(`${baseUrl}/learning-review.html`, { waitUntil: "networkidle" });
  await page.locator("#reviewExperimentList .review-experiment-item").first().waitFor();
  const reportText = await page.locator("#reviewExperimentList").textContent();
  assert.match(reportText, /全加器/);
  assert.match(reportText, /100%/);
  assert.match(reportText, /8 条/);
  await context.close();
});

test("experiment focus, guide and screenshot tools work in the rendered lab", {
  skip: browserExecutable ? false : "未找到可用于实验工具验证的 Chromium 浏览器"
}, async () => {
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/labs.html`, { waitUntil: "networkidle" });

  await page.locator("#guideButton").click();
  assert.equal(await page.locator("#experimentGuide").isHidden(), true);
  await page.locator("#guideButton").click();
  assert.equal(await page.locator("#experimentGuide").isVisible(), true);

  await page.locator("#focusButton").click();
  assert.equal(await page.locator("body").evaluate((body) => body.classList.contains("lab-focus-mode")), true);
  assert.equal(await page.locator(".lab-topbar").isHidden(), true);
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("body").evaluate((body) => body.classList.contains("lab-focus-mode")), false);

  const downloadPromise = page.waitForEvent("download");
  await page.locator("#screenshotButton").click();
  const download = await downloadPromise;
  assert.match(download.suggestedFilename(), /^gates-\d+\.png$/);
  await context.close();
});

test("selected experiment and JK state recover after refresh", {
  skip: browserExecutable ? false : "未找到可用于实验恢复验证的 Chromium 浏览器"
}, async () => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/labs.html`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "时序逻辑" }).click();
  await page.getByRole("button", { name: "JK 触发器" }).click();
  const jGroup = page.locator("#controls .control-group").filter({ hasText: "输入 J" });
  await jGroup.getByRole("button", { name: "1", exact: true }).click();
  const clockGroup = page.locator("#controls .control-group").filter({ hasText: "时钟" });
  await clockGroup.getByRole("button", { name: "上升沿" }).click();
  assert.match(await page.locator("#stateExplanation").textContent(), /Q 从 0 变为 1/);

  await page.reload({ waitUntil: "networkidle" });
  assert.equal((await page.locator("#experimentTitle").textContent()).trim(), "JK 触发器");
  assert.match(await page.locator("#stateExplanation").textContent(), /Q 保持 1|Q 从 0 变为 1/);
  await context.close();
});
