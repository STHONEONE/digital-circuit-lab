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
  assert.match(await page.locator("#stateExplanation").textContent(), /数字 0|BCD 0/);
  assert.deepEqual(pageErrors, []);
  await context.close();
});
