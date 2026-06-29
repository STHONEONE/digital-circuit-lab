import "dotenv/config";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import express from "express";
import multer from "multer";
import { Store } from "./server/store.js";
import { PracticeService } from "./server/practice.js";
import { AiService } from "./server/ai.js";
import { ImportService } from "./server/importer.js";

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 8080);
export const app = express();
const dataDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(root, "data");
const store = new Store(dataDir);
const practice = new PracticeService(store);
const ai = new AiService(store);
const importer = new ImportService(store, ai);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }
});

app.disable("x-powered-by");
app.use(express.json({ limit: "2mb" }));
app.get("/", (_request, response) => {
  response.sendFile(path.join(root, "public", "home.html"));
});
app.use(express.static(path.join(root, "public")));

app.get("/api/health", (_request, response) => {
  response.json({ ok: true, service: "digital-circuit-smart-learning-platform" });
});

app.get("/api/questions", (request, response) => {
  response.json(store.questions({ scope: request.query.scope, source: request.query.source }));
});
app.get("/api/sources", (_request, response) => response.json(store.sources()));
app.post("/api/answers", (request, response) => response.json(practice.answer(request.body)));
app.get("/api/recommendations", (request, response) => response.json(practice.recommend(request.query.questionId)));
app.get("/api/stats", (_request, response) => response.json(practice.stats()));
app.get("/api/learning-plan", (_request, response) => response.json(practice.learningPlan()));
app.get("/api/self-test", (request, response) => {
  response.json(practice.selfTest(request.query.scope, request.query.count));
});
app.get("/api/wrong-review", (_request, response) => {
  response.json(practice.wrongReviewDetails().map((item) => item.question));
});
app.get("/api/wrong-review-details", (_request, response) => response.json(practice.wrongReviewDetails()));
app.get("/api/targeted-questions", (request, response) => {
  response.json(practice.targeted(request.query.knowledge, request.query.count));
});
app.get("/api/progress", (_request, response) => response.json(practice.progress()));
app.get("/api/motivation", (_request, response) => response.json(practice.motivation()));
app.delete("/api/records", (_request, response) => response.json({ removed: store.clearRecords() }));
app.delete("/api/imported", (_request, response) => response.json({ removed: store.clearImported() }));

app.get("/api/ai-config", (_request, response) => {
  const config = store.aiConfig();
  response.json({ configured: Boolean(config.apiKey), baseUrl: config.baseUrl, model: config.model });
});
app.post("/api/ai-config", (request, response) => {
  const config = store.saveAiConfig(request.body);
  response.json({ configured: Boolean(config.apiKey), baseUrl: config.baseUrl, model: config.model });
});

app.post("/api/tutor/stream", async (request, response) => {
  const startedAt = Date.now();
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
  const send = (event) => response.write(`data: ${JSON.stringify(event)}\n\n`);
  try {
    const usedAi = await ai.streamTutor(question, request.body, (text) => send({ type: "delta", text }));
    send({ type: "done", ai: usedAi, elapsedMs: Date.now() - startedAt });
  } catch (error) {
    send({ type: "error", error: error.message });
  } finally {
    response.end();
  }
});

app.post("/api/lab/stream", async (request, response) => {
  const startedAt = Date.now();
  response.status(200);
  response.set({
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no"
  });
  response.flushHeaders();
  const send = (event) => response.write(`data: ${JSON.stringify(event)}\n\n`);
  try {
    const usedAi = await ai.streamExperiment(request.body, (text) => send({ type: "delta", text }));
    send({ type: "done", ai: usedAi, elapsedMs: Date.now() - startedAt });
  } catch (error) {
    send({ type: "error", error: error.message });
  } finally {
    response.end();
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
app.post("/api/shutdown", (_request, response) => {
  response.json({ ok: true });
  setTimeout(() => server.close(() => process.exit(0)), 250);
});

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(error.status || 400).json({ error: error.message || "服务器处理失败" });
});

server = app.listen(port, () => {
  const actualPort = server.address().port;
  const url = `http://localhost:${actualPort}`;
  console.log(`数字电路智能学习平台已启动：${url}`);
  if (String(process.env.AUTO_OPEN_BROWSER || "true").toLowerCase() === "true") {
    const command = process.platform === "win32"
      ? ["cmd", ["/c", "start", "", url]]
      : process.platform === "darwin"
        ? ["open", [url]]
        : ["xdg-open", [url]];
    const child = spawn(command[0], command[1], { detached: true, stdio: "ignore", windowsHide: true });
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
