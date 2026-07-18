import { randomUUID } from "node:crypto";

function nowIso() {
  return new Date().toISOString();
}

function sessionError(message, code, status = 400) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function sanitizeState(definition, state) {
  const supplied = state && typeof state === "object" ? state : {};
  const next = {};
  for (const control of definition.controls || []) {
    if (!Object.hasOwn(supplied, control)) {
      throw sessionError(`缺少实验输入 ${control}。`, "EXPERIMENT_INPUT_REQUIRED");
    }
    const value = Number(supplied[control]);
    if (value !== 0 && value !== 1) {
      throw sessionError(`实验输入 ${control} 必须为 0 或 1。`, "EXPERIMENT_INPUT_INVALID");
    }
    next[control] = value;
  }
  return next;
}

function caseKey(definition, state) {
  return (definition.controls || []).map((control) => state[control]).join("");
}

function sameOutput(left, right) {
  const keys = Object.keys(right || {});
  return keys.length > 0 && keys.every((key) => Number(left?.[key]) === Number(right[key]));
}

function sanitizeEventId(value) {
  if (value == null || value === "") return "";
  const eventId = String(value).trim();
  if (!/^[a-zA-Z0-9._:-]{1,120}$/.test(eventId)) {
    throw sessionError("实验事件标识格式无效。", "EXPERIMENT_EVENT_INVALID");
  }
  return eventId;
}

function eventSignature(type, key, details = {}) {
  return JSON.stringify({ type, caseKey: key, ...details });
}

function sanitizePrediction(definition, state, suppliedPrediction) {
  const expectedKeys = Object.keys(definition.evaluate(state) || {}).sort();
  const prediction = suppliedPrediction && typeof suppliedPrediction === "object" && !Array.isArray(suppliedPrediction)
    ? suppliedPrediction
    : {};
  const suppliedKeys = Object.keys(prediction).sort();
  if (!expectedKeys.length || suppliedKeys.length !== expectedKeys.length
      || expectedKeys.some((key, index) => key !== suppliedKeys[index])) {
    throw sessionError("预测输出与实验协议不匹配。", "EXPERIMENT_PREDICTION_INVALID");
  }
  const sanitized = {};
  for (const key of expectedKeys) {
    const value = Number(prediction[key]);
    if (value !== 0 && value !== 1) {
      throw sessionError(`预测输出 ${key} 必须为 0 或 1。`, "EXPERIMENT_PREDICTION_INVALID");
    }
    sanitized[key] = value;
  }
  return sanitized;
}

export class ExperimentLearningService {
  constructor(store, definitions) {
    this.store = store;
    this.definitions = definitions;
  }

  start(learnerId, experimentId) {
    const learner = String(learnerId || "").trim();
    const definition = this.definitions.get(experimentId);
    if (!learner || !definition) {
      const error = new Error(!learner ? "学习者身份无效。" : "实验不存在。");
      error.status = !learner ? 400 : 404;
      error.code = !learner ? "LEARNER_REQUIRED" : "EXPERIMENT_NOT_FOUND";
      throw error;
    }
    const active = this.active(learner, definition.id);
    if (active && String(active.definitionVersion) === String(definition.version)) return active;
    if (active) {
      const supersededAt = nowIso();
      active.status = "superseded";
      active.updatedAt = supersededAt;
      active.revision += 1;
      active.events.push({
        type: "session.superseded",
        revision: active.revision,
        createdAt: supersededAt,
        reason: "definition-version-changed"
      });
      this.store.saveExperimentSession(active);
    }
    const startedAt = nowIso();
    return this.store.saveExperimentSession({
      id: randomUUID(),
      learnerId: learner,
      experimentId: definition.id,
      definitionVersion: definition.version,
      title: definition.title,
      knowledge: [...definition.knowledge],
      status: "active",
      revision: 0,
      startedAt,
      updatedAt: startedAt,
      completedAt: "",
      testedCases: [],
      predictions: [],
      runs: [],
      evidence: [],
      coverage: 0,
      hintsUsed: 0,
      checkpoints: [],
      events: [{ type: "session.started", revision: 0, createdAt: startedAt }]
    });
  }

  active(learnerId, experimentId) {
    return this.store.activeExperimentSession(String(learnerId || ""), experimentId);
  }

  session(learnerId, sessionId) {
    return this.store.experimentSession(String(learnerId || ""), sessionId);
  }

  record(learnerId, sessionId, event) {
    const learner = String(learnerId || "");
    const session = this.store.experimentSession(learner, sessionId);
    if (!session) throw sessionError("实验记录不存在。", "EXPERIMENT_SESSION_NOT_FOUND", 404);
    if (session.status !== "active") throw sessionError("实验已经结束。", "EXPERIMENT_SESSION_COMPLETED", 409);
    const definition = this.definitions.get(session.experimentId);
    if (!definition) throw sessionError("实验定义不存在。", "EXPERIMENT_NOT_FOUND", 404);
    if (String(definition.version) !== String(session.definitionVersion)) {
      throw sessionError("实验定义已更新，请重新开始本实验。", "EXPERIMENT_DEFINITION_VERSION_MISMATCH", 409);
    }
    const type = String(event?.type || "");
    if (!["prediction.submitted", "simulation.run"].includes(type)) {
      throw sessionError("不支持的实验事件。", "EXPERIMENT_EVENT_INVALID");
    }
    const state = sanitizeState(definition, event?.state);
    const key = caseKey(definition, state);
    const eventId = sanitizeEventId(event?.eventId);
    let prediction = null;
    let hintLevel = 0;
    let signature;

    if (type === "prediction.submitted") {
      hintLevel = Math.max(0, Math.min(2, Number(event.hintLevel) || 0));
      prediction = sanitizePrediction(definition, state, event.prediction);
      signature = eventSignature(type, key, { prediction, hintLevel });
    } else {
      signature = eventSignature(type, key);
    }

    if (eventId) {
      const replayed = (session.events || []).find((item) => item.eventId === eventId);
      if (replayed) {
        if (replayed.requestSignature === signature) return session;
        throw sessionError("实验事件标识已用于不同请求。", "EXPERIMENT_EVENT_CONFLICT", 409);
      }
    }

    if (type === "prediction.submitted") {
      const existingPrediction = session.predictions.find((item) => item.caseKey === key);
      if (existingPrediction && sameOutput(existingPrediction.prediction, prediction)
          && Number(existingPrediction.hintLevel || 0) === hintLevel) return session;
      if (session.testedCases.includes(key)) {
        throw sessionError("这组输入已经验证，不能用不同预测覆盖学习证据。", "EXPERIMENT_CASE_LOCKED", 409);
      }
      if (existingPrediction) {
        throw sessionError("本组预测已经提交，请直接运行仿真。", "EXPERIMENT_PREDICTION_LOCKED", 409);
      }
    } else {
      const existingRun = (session.runs || []).find((item) => item.caseKey === key);
      if (existingRun) return session;
      if (session.testedCases.includes(key)) {
        throw sessionError("这组输入已经验证，不能重复生成学习证据。", "EXPERIMENT_CASE_LOCKED", 409);
      }
    }

    const createdAt = nowIso();
    const nextRevision = session.revision + 1;
    if (type === "prediction.submitted") {
      session.predictions.push({
        revision: nextRevision,
        eventId,
        caseKey: key,
        state,
        prediction,
        hintLevel,
        createdAt
      });
      if (hintLevel > 0) session.hintsUsed += 1;
    } else {
      const outputs = definition.evaluate(state);
      const prediction = [...session.predictions].reverse().find((item) => item.caseKey === key);
      if (!prediction) {
        throw sessionError("请先提交本组预测，再运行仿真。", "EXPERIMENT_PREDICTION_REQUIRED", 409);
      }
      const predictionCorrect = sameOutput(prediction.prediction, outputs);
      session.lastRun = { revision: nextRevision, eventId, caseKey: key, state, outputs, predictionCorrect, createdAt };
      session.runs ||= [];
      session.runs.push(session.lastRun);
      if (!session.testedCases.includes(key)) session.testedCases.push(key);
      session.coverage = Number((session.testedCases.length / Math.max(1, definition.totalCases || 1) * 100).toFixed(1));
      const weight = prediction.hintLevel === 0 ? 0.8 : prediction.hintLevel === 1 ? 0.5 : 0.2;
      session.evidence.push({
        type: "experiment.prediction",
        knowledge: [...definition.knowledge],
        caseKey: key,
        correct: predictionCorrect,
        hintLevel: prediction.hintLevel,
        weight,
        createdAt
      });
    }

    session.revision = nextRevision;
    session.updatedAt = createdAt;
    session.events.push({ type, eventId, requestSignature: signature, revision: nextRevision, state, createdAt });
    return this.store.saveExperimentSession(session);
  }

  saveReport(learner, session, details = {}) {
    const completedAt = session.completedAt || nowIso();
    const weightedTotal = session.evidence.reduce((sum, item) => sum + item.weight, 0);
    const weightedCorrect = session.evidence.reduce((sum, item) => sum + (item.correct ? item.weight : 0), 0);
    const score = weightedTotal ? Math.round(weightedCorrect / weightedTotal * 100) : 0;
    const independent = new Set(session.evidence.map((item) => item.caseKey)).size;
    const independentNoHint = new Set(session.evidence
      .filter((item) => item.hintLevel === 0)
      .map((item) => item.caseKey)).size;
    return this.store.saveExperimentReport({
      id: randomUUID(),
      sessionId: session.id,
      learnerId: learner,
      experimentId: session.experimentId,
      definitionVersion: session.definitionVersion,
      title: session.title,
      knowledge: [...session.knowledge],
      startedAt: session.startedAt,
      completedAt,
      durationSeconds: Math.max(0, Math.round((Date.parse(completedAt) - Date.parse(session.startedAt)) / 1000)),
      coverage: session.coverage,
      testedCases: [...session.testedCases],
      runs: structuredClone(session.runs || []),
      hintsUsed: session.hintsUsed,
      conclusion: String(details.conclusion || "").trim().slice(0, 2000),
      evidenceSummary: {
        independent,
        independentNoHint,
        score,
        confidence: independentNoHint >= 6 ? "高置信度" : independentNoHint >= 3 ? "中置信度" : "数据不足"
      }
    });
  }

  complete(learnerId, sessionId, details = {}) {
    const learner = String(learnerId || "");
    const session = this.store.experimentSession(learner, sessionId);
    if (!session) throw sessionError("实验记录不存在。", "EXPERIMENT_SESSION_NOT_FOUND", 404);
    if (session.status === "completed") {
      const existing = this.reports(learner).find((report) => report.sessionId === session.id);
      return { session, report: existing || this.saveReport(learner, session, details) };
    }
    const definition = this.definitions.get(session.experimentId);
    if (!definition) throw sessionError("实验定义不存在。", "EXPERIMENT_NOT_FOUND", 404);
    if (String(definition.version) !== String(session.definitionVersion)) {
      throw sessionError("实验定义已更新，请重新开始本实验。", "EXPERIMENT_DEFINITION_VERSION_MISMATCH", 409);
    }
    if (session.testedCases.length < Math.max(1, definition.totalCases || 1)) {
      throw sessionError("请先完成全部实验状态验证。", "EXPERIMENT_COVERAGE_INCOMPLETE", 409);
    }
    const completedAt = nowIso();
    session.status = "completed";
    session.completedAt = completedAt;
    session.updatedAt = completedAt;
    session.revision += 1;
    session.events.push({ type: "experiment.completed", revision: session.revision, createdAt: completedAt });
    const savedSession = this.store.saveExperimentSession(session);
    const report = this.saveReport(learner, savedSession, details);
    return { session: savedSession, report };
  }

  reports(learnerId) {
    return this.store.experimentReportsForLearner(String(learnerId || ""));
  }
}
