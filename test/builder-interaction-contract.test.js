import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright-core";

process.env.PORT = "0";
process.env.AUTO_OPEN_BROWSER = "false";
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "digital-circuit-builder-"));
process.env.DATA_DIR = dataDir;

const { server } = await import("../server.js");
if (!server.listening) await once(server, "listening");

const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}`;
const browserCandidates = [
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser"
].filter(Boolean);
const browserExecutable = browserCandidates.find((candidate) => fs.existsSync(candidate));

let browser;

test.before(async () => {
  if (browserExecutable) {
    browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  }
});

test.after(async () => {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(dataDir, { recursive: true, force: true });
});

test("自由搭建至少支持连续 20 步撤销和重做", {
  skip: browserExecutable ? false : "未找到可用于搭建器交互验证的 Chromium 浏览器"
}, async () => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/gate-builder-demo.html`, { waitUntil: "networkidle" });

  const addInput = page.locator('.library-item[data-type="INPUT"]');
  const undo = page.locator("#undoButton");
  const redo = page.locator("#redoButton");

  await assertVisibleAndEnabled(addInput);
  assert.equal(await undo.isDisabled(), true, "初始状态不应允许撤销");
  assert.equal(await redo.isDisabled(), true, "初始状态不应允许重做");

  for (let index = 0; index < 20; index += 1) await addInput.click();
  assert.equal(await page.locator("#board .component").count(), 20);

  for (let index = 0; index < 20; index += 1) await undo.click();
  assert.equal(await page.locator("#board .component").count(), 0);
  assert.equal(await undo.isDisabled(), true);

  for (let index = 0; index < 20; index += 1) await redo.click();
  assert.equal(await page.locator("#board .component").count(), 20);
  assert.equal(await redo.isDisabled(), true);

  await context.close();
});

test("撤销后执行新操作会清空旧的重做历史", {
  skip: browserExecutable ? false : "未找到可用于搭建器交互验证的 Chromium 浏览器"
}, async () => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/gate-builder-demo.html`, { waitUntil: "networkidle" });

  await page.locator('.library-item[data-type="INPUT"]').click();
  await page.locator('.library-item[data-type="OUTPUT"]').click();
  await page.locator("#undoButton").click();
  assert.equal(await page.locator("#redoButton").isDisabled(), false);

  await page.locator('.library-item[data-type="AND"]').click();
  assert.equal(await page.locator("#board .component").count(), 2);
  assert.equal(await page.locator("#redoButton").isDisabled(), true, "新分支建立后不应再重做旧操作");

  await context.close();
});

test("Ctrl/Cmd+Z 与 Ctrl/Cmd+Shift+Z 可撤销和重做画布编辑", {
  skip: browserExecutable ? false : "未找到可用于搭建器交互验证的 Chromium 浏览器"
}, async () => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/gate-builder-demo.html`, { waitUntil: "networkidle" });

  await page.locator('.library-item[data-type="INPUT"]').click();
  await page.locator('.library-item[data-type="OUTPUT"]').click();
  await page.locator('.library-item[data-type="AND"]').click();
  assert.equal(await page.locator("#board .component").count(), 3);

  await page.keyboard.press("Control+z");
  assert.equal(await page.locator("#board .component").count(), 2);
  await page.keyboard.press("Control+Shift+z");
  assert.equal(await page.locator("#board .component").count(), 3);

  await page.keyboard.press("Meta+z");
  assert.equal(await page.locator("#board .component").count(), 2);
  await page.keyboard.press("Meta+Shift+z");
  assert.equal(await page.locator("#board .component").count(), 3);

  await context.close();
});

test("移动端可点输出端再点输入端连线，并可用 Esc 或按钮取消", {
  skip: browserExecutable ? false : "未找到可用于搭建器交互验证的 Chromium 浏览器"
}, async () => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true
  });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/gate-builder-demo.html`, { waitUntil: "networkidle" });

  const viewport = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  assert.equal(viewport.scrollWidth, viewport.clientWidth, "移动端搭建器不应产生横向页面滚动");

  await page.locator("#exampleButton").tap();
  for (const selector of ["#undoButton", "#redoButton", "#runButton", "#clearButton", "#exampleButton"]) {
    const box = await page.locator(selector).boundingBox();
    assert.ok(box.width >= 44 && box.height >= 44,
      `${selector} touch target was ${box.width}x${box.height}`);
  }
  const outputA = page.locator('.component[data-id="C1"] .port.out');
  const outputB = page.locator('.component[data-id="C2"] .port.out');
  const lampInput = page.locator('.component[data-id="C4"] .port.in');
  const cancel = page.locator("#cancelWireButton");
  const portBox = await outputA.boundingBox();
  assert.ok(portBox.width >= 44 && portBox.height >= 44,
    `port touch target was ${portBox.width}x${portBox.height}`);

  assert.equal((await page.locator('.component[data-id="C4"] .lamp-bulb').textContent()).trim(), "0");
  await outputA.tap();
  assert.equal(await cancel.isVisible(), true, "选择输出端后应显示取消连线按钮");
  assert.equal(await outputA.getAttribute("aria-pressed"), "true");
  const boardRect = await page.locator("#board").boundingBox();
  assert.ok(boardRect.x >= 0 && boardRect.x + boardRect.width <= 390, "移动端画布应完整位于视口内");
  await lampInput.tap();
  assert.equal(await cancel.isVisible(), false);
  assert.equal((await page.locator('.component[data-id="C4"] .lamp-bulb').textContent()).trim(), "1");

  await outputB.tap();
  assert.equal(await cancel.isVisible(), true);
  await page.keyboard.press("Escape");
  assert.equal(await cancel.isVisible(), false, "Escape 应取消待连接状态");

  await outputB.tap();
  await cancel.tap();
  assert.equal(await cancel.isVisible(), false, "取消按钮应退出待连接状态");

  await context.close();
});

test("桌面端仍可从输出端拖动到输入端完成连线", {
  skip: browserExecutable ? false : "未找到可用于搭建器交互验证的 Chromium 浏览器"
}, async () => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/gate-builder-demo.html`, { waitUntil: "networkidle" });
  await page.locator("#exampleButton").click();

  const source = page.locator('.component[data-id="C1"] .port.out');
  const target = page.locator('.component[data-id="C4"] .port.in');
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  assert.ok(sourceBox && targetBox, "桌面连线端口应位于可交互画布内");

  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 8 });
  await page.mouse.up();

  assert.equal((await page.locator('.component[data-id="C4"] .lamp-bulb').textContent()).trim(), "1");
  assert.equal(await page.locator("#cancelWireButton").isVisible(), false, "拖线完成后不应误进入点按连线状态");
  await page.locator("#undoButton").click();
  assert.equal((await page.locator('.component[data-id="C4"] .lamp-bulb').textContent()).trim(), "0", "撤销应恢复原连线");
  await page.locator("#redoButton").click();
  assert.equal((await page.locator('.component[data-id="C4"] .lamp-bulb').textContent()).trim(), "1", "重做应恢复新连线");

  await context.close();
});

test("加载示例和清空画布都可作为单一步骤撤销", {
  skip: browserExecutable ? false : "未找到可用于搭建器交互验证的 Chromium 浏览器"
}, async () => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/gate-builder-demo.html`, { waitUntil: "networkidle" });

  await page.locator("#exampleButton").click();
  assert.equal(await page.locator("#board .component").count(), 4);
  await page.locator("#undoButton").click();
  assert.equal(await page.locator("#board .component").count(), 0, "一次撤销应整体移除示例电路");
  await page.locator("#redoButton").click();
  assert.equal(await page.locator("#board .component").count(), 4);

  await page.locator("#clearButton").click();
  assert.equal(await page.locator("#board .component").count(), 0);
  await page.locator("#undoButton").click();
  assert.equal(await page.locator("#board .component").count(), 4, "一次撤销应整体恢复清空前的电路");

  await context.close();
});

test("输入切换和删除模块都可撤销与重做", {
  skip: browserExecutable ? false : "未找到可用于搭建器交互验证的 Chromium 浏览器"
}, async () => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/gate-builder-demo.html`, { waitUntil: "networkidle" });
  await page.locator("#exampleButton").click();

  const inputValue = () => page.locator('.component[data-id="C1"] .bit-button__value').textContent();
  await page.locator('.component[data-id="C1"] .input-toggle').click();
  assert.equal((await inputValue()).trim(), "0");
  await page.locator("#undoButton").click();
  assert.equal((await inputValue()).trim(), "1");
  await page.locator("#redoButton").click();
  assert.equal((await inputValue()).trim(), "0");

  await page.locator('.component[data-id="C3"] .delete-component').click();
  assert.equal(await page.locator("#board .component").count(), 3);
  await page.locator("#undoButton").click();
  assert.equal(await page.locator("#board .component").count(), 4);
  await page.locator("#redoButton").click();
  assert.equal(await page.locator("#board .component").count(), 3);

  await context.close();
});

test("拖动元件只生成一步历史并可恢复位置", {
  skip: browserExecutable ? false : "未找到可用于搭建器交互验证的 Chromium 浏览器"
}, async () => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/gate-builder-demo.html`, { waitUntil: "networkidle" });
  await page.locator("#exampleButton").click();

  const component = page.locator('.component[data-id="C3"]');
  const before = await component.boundingBox();
  assert.ok(before);
  await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
  await page.mouse.down();
  await page.mouse.move(before.x + before.width / 2 + 90, before.y + before.height / 2 + 45, { steps: 8 });
  await page.mouse.up();

  const moved = await component.boundingBox();
  assert.ok(moved.x > before.x + 60, "元件应随拖动移动");
  await page.locator("#undoButton").click();
  const undone = await component.boundingBox();
  assert.ok(Math.abs(undone.x - before.x) < 2 && Math.abs(undone.y - before.y) < 2, "一次撤销应恢复拖动前位置");
  await page.locator("#redoButton").click();
  const redone = await component.boundingBox();
  assert.ok(Math.abs(redone.x - moved.x) < 2 && Math.abs(redone.y - moved.y) < 2, "一次重做应恢复拖动后位置");

  await context.close();
});

async function assertVisibleAndEnabled(locator) {
  assert.equal(await locator.isVisible(), true);
  assert.equal(await locator.isEnabled(), true);
}
