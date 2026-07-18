import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright-core";

process.env.PORT = "0";
process.env.AUTO_OPEN_BROWSER = "false";
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "digital-circuit-expanded-ui-"));
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

async function openExperiment(page, groupName, experimentName) {
  const button = page.getByRole("button", { name: experimentName });
  if (!await button.isVisible()) await page.getByRole("button", { name: groupName }).click();
  if (!await button.isVisible()) {
    const showAll = page.locator(".experiment-show-more");
    if (await showAll.isVisible()) await showAll.click();
  }
  await button.click();
}

test("expanded curriculum models are interactive, visualized and restored", {
  skip: browserExecutable ? false : "未找到可用于扩展实验验证的 Chromium 浏览器"
}, async () => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(`${baseUrl}/labs.html`, { waitUntil: "networkidle" });

  await openExperiment(page, "组合逻辑", "多路选择器（MUX）");
  const d3 = page.locator("#controls .control-group").filter({ hasText: "D3" });
  await d3.getByRole("button", { name: "1", exact: true }).click();
  const select = page.locator("#controls .control-group").filter({ hasText: "选择端 S1S0" });
  await select.getByRole("button", { name: "11", exact: true }).click();
  assert.match(await page.locator("#stateExplanation").textContent(), /D3=1.*输出 Y/);
  assert.match(await page.locator("#circuitDiagram").textContent(), /Y\s*1/);
  assert.equal(await page.locator("body").evaluate((body) => body.scrollWidth <= innerWidth + 1), true);

  await page.reload({ waitUntil: "networkidle" });
  assert.equal((await page.locator("#experimentTitle").textContent()).trim(), "多路选择器（MUX）");
  assert.match(await page.locator("#stateExplanation").textContent(), /D3=1/);

  await openExperiment(page, "时序逻辑", "同步计数器");
  const enable = page.locator("#controls .control-group").filter({ hasText: "计数使能" });
  await enable.getByRole("button", { name: "1", exact: true }).click();
  await page.getByRole("button", { name: "时钟上升沿", exact: true }).click();
  assert.match(await page.locator("#stateExplanation").textContent(), /1|0001/);

  await openExperiment(page, "进阶主题", "竞争与冒险");
  for (const input of ["A", "B", "C"]) {
    const group = page.locator("#controls .control-group").filter({ hasText: input });
    await group.getByRole("button", { name: "1", exact: true }).click();
  }
  assert.match(await page.locator("#stateExplanation").textContent(), /毛刺|冒险/);
  assert.deepEqual(pageErrors, []);
  await context.close();
});

test("experiment catalog is a compact accordion with progressive disclosure and search", {
  skip: browserExecutable ? false : "未找到可用于实验目录验证的 Chromium 浏览器"
}, async () => {
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/labs.html`, { waitUntil: "networkidle" });

  assert.equal((await page.locator("#experimentBrowserTitle").textContent()).trim(), "课程实验 22");
  assert.equal(await page.locator('[data-experiment-group="basic-logic"] .experiment-group-toggle').getAttribute("aria-expanded"), "true");
  assert.equal(await page.locator('[data-experiment-group="combinational-logic"] .experiment-group-toggle').getAttribute("aria-expanded"), "false");

  const combination = page.locator('[data-experiment-group="combinational-logic"]');
  await combination.locator(".experiment-group-toggle").click();
  assert.equal(await page.locator('[data-experiment-group="basic-logic"] .experiment-group-toggle').getAttribute("aria-expanded"), "false");
  assert.equal(await combination.locator("button.experiment-item:visible").count(), 5);
  assert.equal((await combination.locator(".experiment-show-more").textContent()).trim(), "查看全部 11 个");
  assert.doesNotMatch(await combination.locator(".experiment-group-items").textContent(), /进入|输出仅由当前输入决定/);

  await combination.getByRole("button", { name: "全加器", exact: true }).click();
  assert.equal(await page.locator("body").getAttribute("data-current-experiment"), "fullAdder");
  assert.equal(await page.locator("#labWorkspace").evaluate((workspace) => document.activeElement === workspace), true);
  assert.equal(await combination.getByRole("button", { name: "全加器", exact: true }).getAttribute("aria-pressed"), "true");

  await combination.locator(".experiment-show-more").click();
  assert.equal(await combination.locator("button.experiment-item:visible").count(), 9);
  assert.match(await combination.locator('[data-experiment-id="halfSubtractor"]').textContent(), /半减器.*规划中/);

  await page.locator("#experimentSearch").fill("半减器");
  assert.equal((await page.locator("#catalogResultSummary").textContent()).trim(), "找到 2 个实验");
  assert.equal(await page.locator('[data-experiment-id="halfSubtractor"]').isVisible(), true);
  await page.locator("#experimentSearch").fill("不存在的实验名称");
  assert.equal((await page.locator("#catalogResultSummary").textContent()).trim(), "找到 0 个实验");
  await page.locator("#experimentSearch").press("Escape");
  assert.equal(await page.locator("#experimentSearch").inputValue(), "");
  assert.equal(await page.locator("#catalogResultSummary").isHidden(), true);

  await context.close();
});

test("invalid persisted experiment controls fall back safely instead of breaking lab startup", {
  skip: browserExecutable ? false : "未找到可用于扩展实验验证的 Chromium 浏览器"
}, async () => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(() => {
    localStorage.setItem("digital-circuit-lab-state-v1", JSON.stringify({
      version: 1,
      experimentKey: "bcdSevenSegment",
      experimentStates: {
        bcdSevenSegment: { digit: 999999 },
        finiteStateMachine: { currentState: "BROKEN", previousState: "BROKEN" },
        register: { Q: "not-binary", previousQ: "111111111111" }
      },
      expandedGroups: ["combinational-logic"],
      jkTimingHistory: [],
      jkCycleNumber: 0
    }));
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(`${baseUrl}/labs.html`, { waitUntil: "networkidle" });

  assert.equal((await page.locator("#experimentTitle").textContent()).trim(), "BCD-7 段译码器");
  assert.equal(await page.locator('[data-experiment-id="bcdSevenSegment"]').isVisible(), true);
  assert.equal(await page.locator('[data-experiment-id="bcdSevenSegment"]').getAttribute("aria-pressed"), "true");
  assert.match(await page.locator("#stateExplanation").textContent(), /数字 0|BCD 0/);
  assert.deepEqual(pageErrors, []);
  await context.close();
});
