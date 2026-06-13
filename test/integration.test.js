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
  const home = await fetch(`${baseUrl}/`).then((response) => response.text());
  const labs = await fetch(`${baseUrl}/labs.html`).then((response) => response.text());
  const labsScript = await fetch(`${baseUrl}/labs.js`).then((response) => response.text());

  assert.equal(health.ok, true);
  assert.equal(questions.length, 10);
  assert.match(home, /数字电路交互仿真与个性化学习系统/);
  assert.match(labs, /交互仿真实验中心/);
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
