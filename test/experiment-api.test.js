import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.PORT = "0";
process.env.AUTO_OPEN_BROWSER = "false";
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "digital-circuit-experiment-api-"));
process.env.DATA_DIR = dataDir;

const { server } = await import("../server.js");
if (!server.listening) await once(server, "listening");
const baseUrl = `http://127.0.0.1:${server.address().port}`;
const headers = { "Content-Type": "application/json", "X-Learner-Id": "experiment-api-learner" };

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(dataDir, { recursive: true, force: true });
});

test("full-adder experiment API persists prediction, trusted runs and report", async () => {
  const startResponse = await fetch(`${baseUrl}/api/experiment-sessions`, {
    method: "POST", headers, body: JSON.stringify({ experimentId: "fullAdder" })
  });
  assert.equal(startResponse.status, 201);
  let session = await startResponse.json();

  for (let index = 0; index < 8; index += 1) {
    const state = { A: (index >> 2) & 1, B: (index >> 1) & 1, Cin: index & 1 };
    const total = state.A + state.B + state.Cin;
    const prediction = { S: total % 2, Cout: total >= 2 ? 1 : 0 };
    await fetch(`${baseUrl}/api/experiment-sessions/${session.id}/events`, {
      method: "POST", headers,
      body: JSON.stringify({ type: "prediction.submitted", state, prediction, hintLevel: 0 })
    });
    const runResponse = await fetch(`${baseUrl}/api/experiment-sessions/${session.id}/events`, {
      method: "POST", headers,
      body: JSON.stringify({ type: "simulation.run", state, outputs: { S: 9, Cout: 9 } })
    });
    assert.equal(runResponse.status, 200);
    session = await runResponse.json();
  }

  assert.equal(session.coverage, 100);
  assert.deepEqual(session.lastRun.outputs, { S: 1, Cout: 1 });
  const completionResponse = await fetch(`${baseUrl}/api/experiment-sessions/${session.id}/complete`, {
    method: "POST", headers,
    body: JSON.stringify({ conclusion: "已验证全部八种输入组合。" })
  });
  assert.equal(completionResponse.status, 200);
  const completed = await completionResponse.json();
  assert.equal(completed.report.evidenceSummary.score, 100);

  const reports = await fetch(`${baseUrl}/api/experiment-reports`, { headers }).then((response) => response.json());
  assert.equal(reports.length, 1);
  assert.equal(reports[0].learnerId, "experiment-api-learner");
});

test("experiment event API safely replays a lost response", async () => {
  const retryHeaders = {
    "Content-Type": "application/json",
    "X-Learner-Id": "experiment-retry-learner"
  };
  const session = await fetch(`${baseUrl}/api/experiment-sessions`, {
    method: "POST", headers: retryHeaders, body: JSON.stringify({ experimentId: "fullAdder" })
  }).then((response) => response.json());
  const eventUrl = `${baseUrl}/api/experiment-sessions/${session.id}/events`;
  const prediction = {
    eventId: "api-prediction-000",
    type: "prediction.submitted",
    state: { A: 0, B: 0, Cin: 0 },
    prediction: { S: 0, Cout: 0 },
    hintLevel: 0
  };
  const firstPrediction = await fetch(eventUrl, {
    method: "POST", headers: retryHeaders, body: JSON.stringify(prediction)
  }).then((response) => response.json());
  const retriedPredictionResponse = await fetch(eventUrl, {
    method: "POST", headers: retryHeaders, body: JSON.stringify(prediction)
  });
  assert.equal(retriedPredictionResponse.status, 200);
  const retriedPrediction = await retriedPredictionResponse.json();
  assert.equal(retriedPrediction.revision, firstPrediction.revision);
  assert.equal(retriedPrediction.events.length, firstPrediction.events.length);

  const conflictResponse = await fetch(eventUrl, {
    method: "POST", headers: retryHeaders,
    body: JSON.stringify({ ...prediction, prediction: { S: 1, Cout: 0 } })
  });
  assert.equal(conflictResponse.status, 409);
  assert.equal((await conflictResponse.json()).code, "EXPERIMENT_EVENT_CONFLICT");

  const run = {
    eventId: "api-simulation-000",
    type: "simulation.run",
    state: { A: 0, B: 0, Cin: 0 }
  };
  const firstRun = await fetch(eventUrl, {
    method: "POST", headers: retryHeaders, body: JSON.stringify(run)
  }).then((response) => response.json());
  const retriedRunResponse = await fetch(eventUrl, {
    method: "POST", headers: retryHeaders, body: JSON.stringify(run)
  });
  assert.equal(retriedRunResponse.status, 200);
  const retriedRun = await retriedRunResponse.json();
  assert.equal(retriedRun.revision, firstRun.revision);
  assert.equal(retriedRun.events.length, firstRun.events.length);
  assert.equal(retriedRun.evidence.length, 1);
  assert.deepEqual(retriedRun.runs[0].outputs, { S: 0, Cout: 0 });
});

test("lab tutor context ignores forged outputs and uses trusted runtime results", async () => {
  const response = await fetch(`${baseUrl}/api/lab/stream`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      experimentId: "fullAdder",
      revision: 7,
      state: { A: 1, B: 0, Cin: 1 },
      experimentState: { outputs: { S: 9, Cout: 9 } },
      question: "为什么产生进位？"
    })
  });
  const stream = await response.text();
  const delta = stream.split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => JSON.parse(line.replace(/^data:\s*/, "")))
    .find((event) => event.type === "delta")?.text || "";
  assert.equal(response.status, 200);
  assert.match(delta, /experiment-context\/v1/);
  assert.match(delta, /"Cout":1/);
  assert.doesNotMatch(delta, /"Cout":9/);
});

test("report sessions are exposed only for experiments with a completed evidence protocol", async () => {
  const response = await fetch(`${baseUrl}/api/experiment-sessions`, {
    method: "POST", headers, body: JSON.stringify({ experimentId: "gates" })
  });
  assert.equal(response.status, 404);
  const body = await response.json();
  assert.equal(body.code, "EXPERIMENT_NOT_FOUND");
});

test("clearing learning records also removes experiment reports and mastery evidence", async () => {
  const before = await fetch(`${baseUrl}/api/experiment-reports`, { headers }).then((response) => response.json());
  assert.equal(before.length, 1);
  const clearResponse = await fetch(`${baseUrl}/api/records`, { method: "DELETE", headers });
  assert.equal(clearResponse.status, 200);
  const cleared = await clearResponse.json();
  assert.ok(cleared.removed >= 2);
  const reports = await fetch(`${baseUrl}/api/experiment-reports`, { headers }).then((response) => response.json());
  assert.deepEqual(reports, []);
  const progress = await fetch(`${baseUrl}/api/progress`, { headers }).then((response) => response.json());
  assert.equal(progress.knowledge.some((item) => item.name === "全加器" && item.evidenceCount > 0), false);
});
