import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright-core";

process.env.PORT = "0";
process.env.AUTO_OPEN_BROWSER = "false";
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "digital-circuit-responsive-"));
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

test("390px 实验中心完整显示电路且主要控件适合触摸", {
  skip: browserExecutable ? false : "未找到可用于响应式验证的 Chromium 浏览器"
}, async () => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/labs.html`, { waitUntil: "networkidle" });

  const layout = await page.evaluate(() => {
    const stage = document.querySelector("#circuitDiagram");
    const svg = stage?.querySelector("svg");
    const stageRect = stage?.getBoundingClientRect();
    const svgRect = svg?.getBoundingClientRect();
    const controlSizes = [...document.querySelectorAll("#controls button")].map((button) => {
      const rect = button.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    });

    return {
      viewportWidth: document.documentElement.clientWidth,
      documentWidth: document.documentElement.scrollWidth,
      stageClientWidth: stage?.clientWidth ?? 0,
      stageScrollWidth: stage?.scrollWidth ?? 0,
      stageRect: stageRect && { left: stageRect.left, right: stageRect.right },
      svgRect: svgRect && { left: svgRect.left, right: svgRect.right },
      controlSizes
    };
  });

  assert.equal(layout.documentWidth, layout.viewportWidth, "页面不应产生横向滚动");
  assert.ok(layout.svgRect, "实验电路应渲染为 SVG");
  assert.ok(
    layout.stageScrollWidth <= layout.stageClientWidth + 1,
    `电路应缩放进容器，而不是被裁切（${layout.stageScrollWidth}px > ${layout.stageClientWidth}px）`
  );
  assert.ok(layout.svgRect.left >= layout.stageRect.left - 1, "电路左侧应位于实验容器内");
  assert.ok(layout.svgRect.right <= layout.stageRect.right + 1, "电路右侧应位于实验容器内");
  assert.ok(layout.controlSizes.length > 0, "实验输入控件应已渲染");
  for (const size of layout.controlSizes) {
    assert.ok(size.width >= 44, `触摸控件宽度应至少为 44px，当前为 ${size.width}px`);
    assert.ok(size.height >= 44, `触摸控件高度应至少为 44px，当前为 ${size.height}px`);
  }

  const experimentTargets = [
    { group: "basic-logic", name: "基本逻辑门" },
    { group: "combinational-logic", name: "全加器" },
    { group: "combinational-logic", name: "3-8 译码器" },
    { group: "sequential-logic", name: "JK 触发器" }
  ];
  assert.ok(await page.locator("#experimentTabs button.experiment-item").count() >= 22,
    "核心与扩展实验入口应全部可用");
  for (const target of experimentTargets) {
    const group = page.locator(`[data-experiment-group="${target.group}"]`);
    const toggle = group.locator(".experiment-group-toggle");
    if (await toggle.getAttribute("aria-expanded") !== "true") await toggle.click();
    await group.getByRole("button", { name: target.name }).click();
    const experimentLayout = await page.evaluate(() => {
      const stage = document.querySelector("#circuitDiagram");
      const controls = [...document.querySelectorAll("#controls button")].map((button) => {
        const rect = button.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      });
      return {
        title: document.querySelector("#experimentTitle")?.textContent.trim(),
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
        stageClientWidth: stage?.clientWidth ?? 0,
        stageScrollWidth: stage?.scrollWidth ?? 0,
        controls
      };
    });
    assert.equal(experimentLayout.documentWidth, experimentLayout.viewportWidth, `${experimentLayout.title} 不应导致页面横向滚动`);
    assert.ok(
      experimentLayout.stageScrollWidth <= experimentLayout.stageClientWidth + 1,
      `${experimentLayout.title} 的电路应完整缩放进容器（${experimentLayout.stageScrollWidth}px > ${experimentLayout.stageClientWidth}px）`
    );
    assert.ok(
      experimentLayout.controls.every(({ width, height }) => width >= 44 && height >= 44),
      `${experimentLayout.title} 的主要控件应满足 44px 触摸尺寸`
    );
  }

  await context.close();
});

test("390px 学习中心的 AI 入口不遮挡题号与答题内容", {
  skip: browserExecutable ? false : "未找到可用于响应式验证的 Chromium 浏览器"
}, async () => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/index.html`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => {
    const title = document.querySelector("#title");
    return title && title.textContent.trim() && title.textContent.trim() !== "题目加载中";
  });

  const placement = await page.evaluate(() => {
    const rectangle = (selector) => {
      const element = document.querySelector(selector);
      const rect = element?.getBoundingClientRect();
      return rect && {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height
      };
    };

    return {
      launcher: rectangle("#aiChatLauncher"),
      questionNumber: rectangle("#meta"),
      questionText: rectangle("#questionText"),
      options: rectangle("#options"),
      actions: rectangle(".actions")
    };
  });

  const overlaps = (first, second) => first && second
    && first.left < second.right
    && first.right > second.left
    && first.top < second.bottom
    && first.bottom > second.top;

  assert.ok(placement.launcher, "AI 助教入口应可见");
  assert.ok(placement.launcher.width >= 44, "AI 助教入口宽度应至少为 44px");
  assert.ok(placement.launcher.height >= 44, "AI 助教入口高度应至少为 44px");
  assert.ok(placement.questionNumber.width >= 44, "题号入口宽度应至少为 44px");
  assert.ok(placement.questionNumber.height >= 44, "题号入口高度应至少为 44px");
  assert.equal(overlaps(placement.launcher, placement.questionNumber), false, "AI 入口不应覆盖题号");
  assert.equal(overlaps(placement.launcher, placement.questionText), false, "AI 入口不应覆盖题干");
  assert.equal(overlaps(placement.launcher, placement.options), false, "AI 入口不应覆盖选项");
  assert.equal(overlaps(placement.launcher, placement.actions), false, "AI 入口不应覆盖答题操作");

  await page.getByRole("link", { name: /学习报告/ }).click();
  await page.waitForFunction(() => document.body.dataset.learningPage === "review");
  await page.getByRole("link", { name: /普通练习/ }).click();
  await page.waitForFunction(() => document.body.dataset.learningPage === "center");
  const restoredLauncher = await page.locator("#aiChatLauncher").evaluate((element) => ({
    parentClass: element.parentElement?.className || "",
    visible: Boolean(element.offsetWidth && element.offsetHeight)
  }));
  assert.match(restoredLauncher.parentClass, /question-picker/);
  assert.equal(restoredLauncher.visible, true);

  await context.close();
});

test("390px 专注模式保持实验电路为单列全宽", {
  skip: browserExecutable ? false : "未找到可用于响应式验证的 Chromium 浏览器"
}, async () => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/labs.html`, { waitUntil: "networkidle" });
  await page.locator("#focusButton").click();
  const circuitBox = await page.locator(".circuit-panel").boundingBox();
  const columns = await page.locator(".lab-grid")
    .evaluate((element) => getComputedStyle(element).gridTemplateColumns);
  assert.ok(circuitBox.width > 330, `circuit width was ${circuitBox.width}px`);
  assert.equal(columns.trim().split(/\s+/).length, 1);
  await context.close();
});
