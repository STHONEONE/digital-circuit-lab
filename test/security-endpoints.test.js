import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.PORT = "0";
process.env.AUTO_OPEN_BROWSER = "false";
process.env.RAILWAY_ENVIRONMENT_ID = "test-environment-id";
process.env.AI_CONFIG_ADMIN_TOKEN = "test-admin-token";
process.env.AI_ALLOWED_BASE_URLS = "https://allowed.example/v1";
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "digital-circuit-security-"));
process.env.DATA_DIR = dataDir;

const { detectsHostedDeployment, server } = await import("../server.js");
if (!server.listening) await once(server, "listening");
const baseUrl = `http://127.0.0.1:${server.address().port}`;

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(dataDir, { recursive: true, force: true });
});

test("Railway built-in environment signals are treated as hosted deployments", () => {
  for (const key of [
    "RAILWAY_ENVIRONMENT_ID",
    "RAILWAY_ENVIRONMENT_NAME",
    "RAILWAY_PROJECT_ID",
    "RAILWAY_PUBLIC_DOMAIN",
    "RAILWAY_SERVICE_ID",
    "RAILWAY_REPLICA_ID"
  ]) {
    assert.equal(detectsHostedDeployment({ [key]: "railway-value" }), true, key);
  }
  assert.equal(detectsHostedDeployment({ NODE_ENV: "production" }), true);
  assert.equal(detectsHostedDeployment({}), false);
});

test("hosted deployment blocks anonymous AI configuration changes", async () => {
  const response = await fetch(`${baseUrl}/api/ai-config`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ baseUrl: "https://allowed.example/v1", model: "safe-model" })
  });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, "AI_CONFIG_FORBIDDEN");
});

test("admin configuration accepts only allowed HTTPS providers and never returns the key", async () => {
  const headers = {
    "Content-Type": "application/json",
    "X-Admin-Token": "test-admin-token"
  };
  const rejected = await fetch(`${baseUrl}/api/ai-config`, {
    method: "POST", headers,
    body: JSON.stringify({ baseUrl: "https://attacker.example/v1", model: "safe-model" })
  });
  assert.equal(rejected.status, 400);
  assert.equal((await rejected.json()).code, "AI_CONFIG_INVALID");

  const accepted = await fetch(`${baseUrl}/api/ai-config`, {
    method: "POST", headers,
    body: JSON.stringify({ apiKey: "server-secret", baseUrl: "https://allowed.example/v1", model: "safe-model" })
  });
  assert.equal(accepted.status, 200);
  const body = await accepted.json();
  assert.equal(body.configured, true);
  assert.equal(body.baseUrl, "https://allowed.example/v1");
  assert.equal(JSON.stringify(body).includes("server-secret"), false);
});

test("hosted deployment cannot be stopped through the public API", async () => {
  const response = await fetch(`${baseUrl}/api/shutdown`, { method: "POST" });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, "SHUTDOWN_FORBIDDEN");
  assert.equal((await fetch(`${baseUrl}/api/health`).then((item) => item.json())).ok, true);
});
