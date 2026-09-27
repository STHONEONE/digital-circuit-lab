import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright-core";

process.env.PORT = "0";
process.env.AUTO_OPEN_BROWSER = "false";
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "digital-circuit-classic-ui-"));
process.env.DATA_DIR = dataDir;
const { server } = await import("../server.js");
if (!server.listening) await once(server, "listening");
const baseUrl = `http://127.0.0.1:${server.address().port}`;
const browserExecutable = [
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
].filter(Boolean).find((candidate) => fs.existsSync(candidate));
let browser;

test.before(async () => {
  if (browserExecutable) browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
});

test.after(async () => {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(dataDir, { recursive: true, force: true });
});

test("experiment center exposes only the curated classic set", {
  skip: browserExecutable ? false : "Chromium unavailable"
}, async () => {
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/labs.html`, { waitUntil: "networkidle" });
  assert.equal((await page.locator("#experimentBrowserTitle").textContent()).trim(), "课程实验 8");
  assert.equal(await page.locator("[data-experiment-group]").count(), 3);
  assert.equal(await page.locator("[data-experiment-id]").count(), 8);
  for (const removedId of ["multiplexer", "register", "propagationDelay", "hazards"]) {
    assert.equal(await page.locator(`[data-experiment-id="${removedId}"]`).count(), 0);
  }
  await page.getByRole("button", { name: "组合逻辑" }).click();
  await page.getByRole("button", { name: "半加器", exact: true }).click();
  assert.equal((await page.locator("#experimentTitle").textContent()).trim(), "半加器");
  await page.getByRole("button", { name: "时序逻辑" }).click();
  await page.getByRole("button", { name: "T 触发器", exact: true }).click();
  assert.equal((await page.locator("#experimentTitle").textContent()).trim(), "T 触发器");
  await context.close();
});
