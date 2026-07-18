import "dotenv/config";
import path from "node:path";
import process from "node:process";
import { createHash, timingSafeEqual } from "node:crypto";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import express from "express";
import multer from "multer";
import { Store } from "./server/store.js";
import { PracticeService } from "./server/practice.js";
import { AiService } from "./server/ai.js";
import { ImportService } from "./server/importer.js";
import { ExperimentLearningService } from "./server/experiment-learning.js";
import {
  createExperimentContext,
  getExperimentDefinition,
  listExperimentGroups
} from "./public/core/experiment-catalog.js";
import { createExperimentRuntime } from "./public/core/experiment-runtime.js";

const root = path.dirname(fileURLToPath(import.meta.url));
const host = process.env.HOST || "0.0.0.0";
const port = Number(process.env.PORT || 8080);
export const app = express();
const dataDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(root, "data");
const store = new Store(dataDir);
const railwayEnvironmentKeys = [
  "RAILWAY_ENVIRONMENT",
  "RAILWAY_ENVIRONMENT_ID",
  "RAILWAY_ENVIRONMENT_NAME",
  "RAILWAY_PROJECT_ID",
  "RAILWAY_PROJECT_NAME",
  "RAILWAY_SERVICE_ID",
  "RAILWAY_SERVICE_NAME",
  "RAILWAY_PUBLIC_DOMAIN",
  "RAILWAY_PRIVATE_DOMAIN",
  "RAILWAY_STATIC_URL",
  "RAILWAY_REPLICA_ID"
];

export function detectsHostedDeployment(environment = process.env) {
  return environment.NODE_ENV === "production"
    || railwayEnvironmentKeys.some((key) => Boolean(String(environment[key] || "").trim()));
}

const hostedDeployment = detectsHostedDeployment();
const ai = new AiService(store);
const practice = new PracticeService(store, ai);
const importer = new ImportService(store, ai);
const evidenceEnabledExperiments = new Set(["fullAdder"]);
const experimentDefinitions = {
  get(experimentId) {
    if (!evidenceEnabledExperiments.has(experimentId)) return null;
    const definition = getExperimentDefinition(experimentId);
    if (!definition) return null;
    return {
      id: definition.id,
      version: definition.version,
      title: definition.title,
      knowledge: definition.knowledge,
      controls: definition.controls.filter((control) => control.kind !== "action").map((control) => control.key),
      totalCases: Number(definition.completion?.requiredCases) || 1,
      evaluate(state) {
        const runtime = createExperimentRuntime(definition.id, { state });
        try {
          return runtime.snapshot().outputs;
        } finally {
          runtime.dispose();
        }
      }
    };
  }
};
const experimentLearning = new ExperimentLearningService(store, experimentDefinitions);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }
});
const selfTestGenerationState = new Map();
const selfTestCooldownMs = 5000;
const ghostPlanState = new Map();
const ghostPlanCacheTtlMs = 2 * 60 * 1000;
const expectedErrorCodes = new Set([
  "AI_NOT_CONFIGURED", "AI_GRADING_UNAVAILABLE", "AI_GRADING_BUSY",
  "AI_GRADING_RATE_LIMITED", "AI_GRADING_CAPACITY", "AI_VARIANT_EXPIRED",
  "AI_VARIANT_NOT_AVAILABLE", "AI_VARIANT_NOT_REGISTERED",
  "AI_GHOST_FAILED", "GHOST_REQUIREMENT_REQUIRED",
  "AI_SELF_TEST_FAILED", "AI_SELF_TEST_UNAVAILABLE",
  "KNOWLEDGE_PRACTICE_NOT_FOUND",
  "IMPORT_ANALYSIS_MISSING_ANSWER",
  "EXPERIMENT_NOT_FOUND", "EXPERIMENT_SESSION_NOT_FOUND", "EXPERIMENT_SESSION_COMPLETED",
  "EXPERIMENT_INPUT_REQUIRED", "EXPERIMENT_INPUT_INVALID", "EXPERIMENT_EVENT_INVALID", "EXPERIMENT_EVENT_CONFLICT",
  "EXPERIMENT_PREDICTION_INVALID", "EXPERIMENT_PREDICTION_REQUIRED", "EXPERIMENT_PREDICTION_LOCKED",
  "EXPERIMENT_CASE_LOCKED", "EXPERIMENT_DEFINITION_VERSION_MISMATCH", "EXPERIMENT_COVERAGE_INCOMPLETE",
  "AI_CONFIG_FORBIDDEN", "AI_CONFIG_INVALID",
  "SHUTDOWN_FORBIDDEN"
]);

function clientFingerprint(request) {
  const address = String(request.ip || request.socket.remoteAddress || "unknown");
  return createHash("sha256").update(address).digest("hex").slice(0, 24);
}

function learnerId(request) {
  const supplied = String(request.get("X-Learner-Id") || "").trim();
  if (/^[a-zA-Z0-9_-]{1,100}$/.test(supplied)) return supplied;
  return `client-${clientFingerprint(request)}`;
}

function isLoopbackSocket(request) {
  const address = String(request.socket?.remoteAddress || "").replace(/^::ffff:/, "");
  return address === "127.0.0.1" || address === "::1";
}

function adminTokenMatches(request) {
  const expected = String(process.env.AI_CONFIG_ADMIN_TOKEN || "").trim();
  if (!expected) return false;
  const authorization = String(request.get("Authorization") || "");
  const supplied = String(request.get("X-Admin-Token") || authorization.replace(/^Bearer\s+/i, "")).trim();
  const expectedDigest = createHash("sha256").update(expected).digest();
  const suppliedDigest = createHash("sha256").update(supplied).digest();
  return timingSafeEqual(expectedDigest, suppliedDigest);
}

function configurationAuthorized(request) {
  return adminTokenMatches(request) || (!hostedDeployment && isLoopbackSocket(request));
}

function apiError(message, code, status) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function validatedAiConfig(body = {}) {
  const next = {};
  if (Object.hasOwn(body, "apiKey")) {
    const apiKey = String(body.apiKey || "").trim();
    if (apiKey.length > 500) throw apiError("API Key 格式无效。", "AI_CONFIG_INVALID", 400);
    next.apiKey = apiKey;
  }
  if (Object.hasOwn(body, "model")) {
    const model = String(body.model || "").trim();
    if (!/^[a-zA-Z0-9._:/-]{1,120}$/.test(model)) {
      throw apiError("模型名称格式无效。", "AI_CONFIG_INVALID", 400);
    }
    next.model = model;
  }
  if (Object.hasOwn(body, "baseUrl")) {
    let url;
    try {
      url = new URL(String(body.baseUrl || ""));
    } catch {
      throw apiError("AI 服务地址无效。", "AI_CONFIG_INVALID", 400);
    }
    const localHttp = !hostedDeployment && url.protocol === "http:"
      && ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
    if ((url.protocol !== "https:" && !localHttp) || url.username || url.password) {
      throw apiError("AI 服务地址必须使用 HTTPS，且不能包含账号信息。", "AI_CONFIG_INVALID", 400);
    }
    if (hostedDeployment) {
      const allowedOrigins = new Set([
        "https://dashscope.aliyuncs.com",
        "https://api.openai.com",
        process.env.AI_BASE_URL,
        ...String(process.env.AI_ALLOWED_BASE_URLS || "").split(",")
      ].filter(Boolean).map((value) => {
        try { return new URL(String(value).trim()).origin; } catch { return ""; }
      }).filter(Boolean));
      if (!allowedOrigins.has(url.origin)) {
        throw apiError("该 AI 服务地址未列入部署允许列表。", "AI_CONFIG_INVALID", 400);
      }
    }
    next.baseUrl = url.href.replace(/\/$/, "");
  }
  return next;
}

async function generateSelfTestQuestions(body, currentLearnerId) {
  const knowledge = String(body.knowledge || "").trim().slice(0, 80);
  const prepared = knowledge
    ? { profile: practice.knowledgeTestProfile(knowledge, body.scope, body.count, currentLearnerId) }
    : practice.prepareSelfTest(body.scope, body.count, currentLearnerId);
  const needsAi = knowledge ? ai.configured() : prepared.shortage > 0 && ai.configured();
  const previous = selfTestGenerationState.get(currentLearnerId);
  const now = Date.now();
  if (needsAi && previous?.active) {
    const error = new Error("个性化学习任务正在补充，请等待本次生成完成。");
    error.status = 429;
    error.code = "AI_SELF_TEST_BUSY";
    throw error;
  }
  const retryAfterMs = needsAi && previous ? Math.max(0, selfTestCooldownMs - (now - previous.finishedAt)) : 0;
  if (retryAfterMs > 0) {
    const error = new Error(`AI 补充学习任务请求过于频繁，请 ${Math.ceil(retryAfterMs / 1000)} 秒后重试。`);
    error.status = 429;
    error.code = "AI_SELF_TEST_RATE_LIMITED";
    error.retryAfterSeconds = Math.ceil(retryAfterMs / 1000);
    throw error;
  }
  if (needsAi) selfTestGenerationState.set(currentLearnerId, { active: true, finishedAt: 0 });
  try {
    const questions = knowledge
      ? await practice.knowledgeTest(knowledge, body.scope, body.count, currentLearnerId, prepared.profile)
      : await practice.selfTest(body.scope, body.count, currentLearnerId, prepared);
    return { questions, profile: prepared.profile };
  } finally {
    if (needsAi) selfTestGenerationState.set(currentLearnerId, { active: false, finishedAt: Date.now() });
  }
}

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(express.json({ limit: "2mb" }));
app.get("/", (_request, response) => {
  response.sendFile(path.join(root, "public", "home.html"));
});
app.use(express.static(path.join(root, "public")));

app.get("/api/health", (_request, response) => {
  response.json({ ok: true, service: "digital-circuit-smart-learning-platform" });
});

app.get("/api/experiment-catalog", (_request, response) => response.json(listExperimentGroups()));
app.post("/api/experiment-sessions", (request, response, next) => {
  try {
    response.status(201).json(experimentLearning.start(learnerId(request), request.body?.experimentId));
  } catch (error) {
    next(error);
  }
});
app.get("/api/experiment-sessions/active", (request, response) => {
  const session = experimentLearning.active(learnerId(request), String(request.query.experimentId || ""));
  response.status(session ? 200 : 404).json(session || { error: "没有进行中的实验。", code: "EXPERIMENT_SESSION_NOT_FOUND" });
});
app.get("/api/experiment-sessions/:sessionId", (request, response) => {
  const session = experimentLearning.session(learnerId(request), request.params.sessionId);
  response.status(session ? 200 : 404).json(session || { error: "实验记录不存在。", code: "EXPERIMENT_SESSION_NOT_FOUND" });
});
app.post("/api/experiment-sessions/:sessionId/events", (request, response, next) => {
  try {
    response.json(experimentLearning.record(learnerId(request), request.params.sessionId, request.body || {}));
  } catch (error) {
    next(error);
  }
});
app.post("/api/experiment-sessions/:sessionId/complete", (request, response, next) => {
  try {
    response.json(experimentLearning.complete(
      learnerId(request), request.params.sessionId, request.body || {}
    ));
  } catch (error) {
    next(error);
  }
});
app.get("/api/experiment-reports", (request, response) => {
  response.json(experimentLearning.reports(learnerId(request)));
});

app.get("/api/questions", (request, response) => {
  response.json(store.questions({ scope: request.query.scope, source: request.query.source }));
});
app.get("/api/sources", (_request, response) => response.json(store.sources()));
app.post("/api/answers", async (request, response, next) => {
  try {
    const currentLearnerId = learnerId(request);
    response.json(await practice.answer({
      ...request.body,
      learnerId: currentLearnerId,
      analysisRateKeys: [
        `learner:${currentLearnerId}`,
        `ip:${clientFingerprint(request)}`
      ]
    }));
  } catch (error) {
    next(error);
  }
});
app.get("/api/recommendations", (request, response) => response.json(
  practice.recommend(request.query.questionId, learnerId(request))
));
app.get("/api/stats", (request, response) => response.json(practice.stats(learnerId(request))));
app.get("/api/learning-plan", (request, response) => response.json(practice.learningPlan(learnerId(request))));
app.post("/api/self-test", async (request, response, next) => {
  try {
    const result = await generateSelfTestQuestions(request.body || {}, learnerId(request));
    response.json(result.questions);
    return;
  } catch (error) {
    next(error);
    return;
  }

  const body = request.body || {};
  const currentLearnerId = learnerId(request);
  const clientKey = currentLearnerId;
  const prepared = practice.prepareSelfTest(body.scope, body.count, currentLearnerId);
  const needsAi = prepared.shortage > 0 && ai.configured();
  const now = Date.now();
  const previous = selfTestGenerationState.get(clientKey);
  if (needsAi && previous?.active) {
    return response.status(429).json({
      code: "AI_SELF_TEST_BUSY",
      error: "个性化学习任务正在补充，请等待本次生成完成。"
    });
  }
  const retryAfterMs = needsAi && previous
    ? Math.max(0, selfTestCooldownMs - (now - previous.finishedAt))
    : 0;
  if (retryAfterMs > 0) {
    const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);
    response.set("Retry-After", String(retryAfterSeconds));
    return response.status(429).json({
      code: "AI_SELF_TEST_RATE_LIMITED",
      error: `AI 补充学习任务请求过于频繁，请 ${retryAfterSeconds} 秒后重试。`
    });
  }
  if (needsAi) {
    selfTestGenerationState.set(clientKey, { active: true, finishedAt: 0 });
  }
  try {
    response.json(await practice.selfTest(body.scope, body.count, currentLearnerId, prepared));
  } catch (error) {
    next(error);
  } finally {
    if (needsAi) {
      selfTestGenerationState.set(clientKey, { active: false, finishedAt: Date.now() });
      if (selfTestGenerationState.size > 1000) {
        const staleBefore = Date.now() - 60 * 60 * 1000;
        selfTestGenerationState.forEach((state, key) => {
          if (!state.active && state.finishedAt < staleBefore) selfTestGenerationState.delete(key);
        });
      }
    }
  }
});
app.get("/api/wrong-review", (request, response) => {
  response.json(practice.wrongReviewDetails(learnerId(request)).map((item) => item.question));
});
app.post("/api/personalized-tasks", async (request, response, next) => {
  try {
    const currentLearnerId = learnerId(request);
    const result = await generateSelfTestQuestions(request.body || {}, currentLearnerId);
    response.status(201).json(store.createPersonalizedTask({
      learnerId: currentLearnerId,
      scope: request.body?.scope,
      title: request.body?.knowledge ? `${String(request.body.knowledge).slice(0, 80)}专项巩固` : undefined,
      questions: result.questions,
      profile: result.profile
    }));
  } catch (error) {
    next(error);
  }
});
app.get("/api/personalized-tasks", (request, response) => response.json(
  store.personalizedTasksForLearner(learnerId(request))
));
app.get("/api/personalized-tasks/:taskId", (request, response) => {
  const task = store.personalizedTask(learnerId(request), request.params.taskId);
  if (!task) return response.status(404).json({ error: "未找到该学习任务。", code: "LEARNING_TASK_NOT_FOUND" });
  response.json(task);
});
app.delete("/api/personalized-tasks/:taskId", (request, response) => response.json({
  removed: store.deletePersonalizedTask(learnerId(request), request.params.taskId)
}));
app.get("/api/wrong-review-details", (request, response) => response.json(
  practice.wrongReviewDetails(learnerId(request))
));
app.post("/api/wrong-review/:questionId/confirm", (request, response, next) => {
  try {
    response.json(practice.confirmWrongReview(request.params.questionId, learnerId(request)));
  } catch (error) {
    next(error);
  }
});
app.get("/api/targeted-questions", (request, response) => {
  response.json(practice.targeted(request.query.knowledge, request.query.count, learnerId(request)));
});
app.get("/api/progress", (request, response) => response.json(practice.progress(learnerId(request))));
app.get("/api/motivation", (request, response) => response.json(practice.motivation(learnerId(request))));
app.delete("/api/records", (request, response) => response.json({
  removed: store.clearRecords(learnerId(request))
}));
app.delete("/api/imported", (_request, response) => response.json({ removed: store.clearImported() }));

app.get("/api/ai-config", (_request, response) => {
  const config = store.aiConfig();
  response.json({ configured: Boolean(config.apiKey), baseUrl: config.baseUrl, model: config.model });
});
app.post("/api/ai-config", (request, response, next) => {
  try {
    if (!configurationAuthorized(request)) {
      throw apiError("公开部署不允许匿名修改 AI 配置。", "AI_CONFIG_FORBIDDEN", 403);
    }
    const config = store.saveAiConfig(validatedAiConfig(request.body));
    response.json({ configured: Boolean(config.apiKey), baseUrl: config.baseUrl, model: config.model });
  } catch (error) {
    next(error);
  }
});

app.post("/api/tutor/stream", async (request, response) => {
  const startedAt = Date.now();
  const controller = new AbortController();
  response.once("close", () => {
    if (!response.writableEnded) controller.abort();
  });
  const question = store.question(request.body.questionId);
  if (!question) return response.status(404).json({ error: "题目不存在" });
  response.status(200);
  response.set({
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no"
  });
  response.flushHeaders();
  const send = (event) => !controller.signal.aborted && !response.writableEnded
    && response.write(`data: ${JSON.stringify(event)}\n\n`);
  try {
    const usedAi = await ai.streamTutor(question, request.body, (text) => send({ type: "delta", text }), {
      signal: controller.signal
    });
    send({ type: "done", ai: usedAi, elapsedMs: Date.now() - startedAt });
  } catch (error) {
    if (error.name !== "AbortError") send({ type: "error", error: error.message });
  } finally {
    if (!response.writableEnded) response.end();
  }
});

app.post("/api/wrong-remediation", async (request, response, next) => {
  try {
    const currentLearnerId = learnerId(request);
    response.json(await practice.wrongRemediation(request.body, currentLearnerId));
  } catch (error) {
    next(error);
  }
});

app.post("/api/lab/stream", async (request, response) => {
  const startedAt = Date.now();
  const controller = new AbortController();
  response.once("close", () => {
    if (!response.writableEnded) controller.abort();
  });
  response.status(200);
  response.set({
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no"
  });
  response.flushHeaders();
  const send = (event) => !controller.signal.aborted && !response.writableEnded
    && response.write(`data: ${JSON.stringify(event)}\n\n`);
  try {
    let tutorRequest = request.body || {};
    if (tutorRequest.experimentId) {
      const clientContext = createExperimentContext(tutorRequest.experimentId, {
        inputs: tutorRequest.state || tutorRequest.inputs || {},
        revision: tutorRequest.revision
      });
      const runtime = createExperimentRuntime(clientContext.experimentId, {
        state: clientContext.inputs,
        revision: clientContext.revision
      });
      const snapshot = runtime.snapshot();
      runtime.dispose();
      tutorRequest = {
        question: tutorRequest.question,
        history: tutorRequest.history,
        experimentName: clientContext.title,
        experimentState: {
          ...clientContext,
          simulation: {
            inputs: snapshot.inputs,
            outputs: snapshot.outputs,
            signals: snapshot.signals,
            activeTruthRow: snapshot.activeTruthRow,
            explanation: snapshot.explanation,
            status: snapshot.status
          }
        }
      };
    }
    const usedAi = await ai.streamExperiment(tutorRequest, (text) => send({ type: "delta", text }), {
      signal: controller.signal
    });
    send({ type: "done", ai: usedAi, elapsedMs: Date.now() - startedAt });
  } catch (error) {
    if (error.name !== "AbortError") send({ type: "error", error: error.message });
  } finally {
    if (!response.writableEnded) response.end();
  }
});

app.post("/api/ghost-plan", async (request, response, next) => {
  const startedAt = Date.now();
  const body = request.body || {};
  const cacheKey = createHash("sha256").update(JSON.stringify({
    learnerId: learnerId(request),
    requirement: String(body.requirement || "").trim().slice(0, 600),
    canvas: body.canvas || {}
  })).digest("hex");
  const now = Date.now();
  const cached = ghostPlanState.get(cacheKey);
  if (cached?.result && cached.expiresAt > now) {
    return response.json({ plan: cached.result, cached: true, elapsedMs: Date.now() - startedAt });
  }
  if (cached?.promise) {
    try {
      const plan = await cached.promise;
      return response.json({ plan, cached: true, elapsedMs: Date.now() - startedAt });
    } catch (error) {
      return next(error);
    }
  }

  const promise = ai.generateGhostPlan(body);
  ghostPlanState.set(cacheKey, { promise, result: null, expiresAt: now + ghostPlanCacheTtlMs });
  try {
    const plan = await promise;
    ghostPlanState.set(cacheKey, {
      promise: null,
      result: plan,
      expiresAt: Date.now() + ghostPlanCacheTtlMs
    });
    if (ghostPlanState.size > 200) {
      const staleBefore = Date.now();
      ghostPlanState.forEach((entry, key) => {
        if (!entry.promise && entry.expiresAt <= staleBefore) ghostPlanState.delete(key);
      });
    }
    response.json({ plan, cached: false, elapsedMs: Date.now() - startedAt });
  } catch (error) {
    ghostPlanState.delete(cacheKey);
    next(error);
  }
});

app.post("/api/import-questions", upload.single("file"), async (request, response, next) => {
  try {
    response.json(await importer.import(request.file));
  } catch (error) {
    next(error);
  }
});

export let server;
app.post("/api/shutdown", (request, response) => {
  if (hostedDeployment || !isLoopbackSocket(request)) {
    return response.status(403).json({ error: "公开部署不允许远程关闭服务。", code: "SHUTDOWN_FORBIDDEN" });
  }
  response.json({ ok: true });
  setTimeout(() => server.close(() => process.exit(0)), 250);
});

app.use((error, _request, response, _next) => {
  if (!expectedErrorCodes.has(error.code)) console.error(error);
  if (error.retryAfterSeconds > 0) response.set("Retry-After", String(error.retryAfterSeconds));
  response.status(error.status || 400).json({
    error: error.message || "服务器处理失败",
    ...(error.code ? { code: error.code } : {})
  });
});

server = app.listen(port, host, () => {
  const actualPort = server.address().port;
  const url = `http://localhost:${actualPort}`;
  console.log(`数字电路智能学习平台已启动：${url} (${host})`);
  const shouldAutoOpenBrowser = String(
    process.env.AUTO_OPEN_BROWSER
      ?? (hostedDeployment ? "false" : "true"),
  ).toLowerCase() === "true";
  if (shouldAutoOpenBrowser) {
    const command = process.platform === "win32"
      ? ["cmd", ["/c", "start", "", url]]
      : process.platform === "darwin"
        ? ["open", [url]]
        : ["xdg-open", [url]];
    const child = spawn(command[0], command[1], { detached: true, stdio: "ignore", windowsHide: true });
    child.on("error", () => {});
    child.unref();
  }
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Startup failed: port ${port} is already in use.`);
    console.error("Close the program using that port, then run start.bat again.");
  } else {
    console.error("Startup failed:", error);
  }
  process.exitCode = 1;
  setTimeout(() => process.exit(1), 100);
});
