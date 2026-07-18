import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { seedQuestions } from "./questions.js";

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2), "utf8");
  fs.renameSync(temporary, file);
}

export class Store {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.importedFile = path.join(dataDir, "imported-questions.json");
    this.recordsFile = path.join(dataDir, "answer-records.json");
    this.wrongReviewFile = path.join(dataDir, "wrong-review-status.json");
    this.personalizedTasksFile = path.join(dataDir, "personalized-learning-tasks.json");
    this.experimentSessionsFile = path.join(dataDir, "experiment-sessions.json");
    this.experimentReportsFile = path.join(dataDir, "experiment-reports.json");
    this.configFile = path.join(dataDir, "ai-config.json");
    this.generatedSelfTestsFile = path.join(dataDir, "generated-self-test-questions.json");
    fs.mkdirSync(dataDir, { recursive: true });
    this.imported = readJson(this.importedFile, []);
    this.records = readJson(this.recordsFile, []);
    this.wrongReview = readJson(this.wrongReviewFile, {});
    this.personalizedTasks = readJson(this.personalizedTasksFile, []);
    this.experimentSessions = readJson(this.experimentSessionsFile, []);
    this.experimentReports = readJson(this.experimentReportsFile, []);
    this.config = readJson(this.configFile, {});
    const generatedSelfTests = readJson(this.generatedSelfTestsFile, []);
    this.generatedSelfTests = Array.isArray(generatedSelfTests) ? generatedSelfTests : [];
    if (!this.wrongReview || typeof this.wrongReview !== "object" || Array.isArray(this.wrongReview)) this.wrongReview = {};
    if (!Array.isArray(this.personalizedTasks)) this.personalizedTasks = [];
    if (!Array.isArray(this.experimentSessions)) this.experimentSessions = [];
    if (!Array.isArray(this.experimentReports)) this.experimentReports = [];
  }

  questions({ scope, source } = {}) {
    return [...seedQuestions, ...this.imported]
      .filter((question) => !scope || scope === "all" || question.scope === scope)
      .filter((question) => !source || question.source === source)
      .sort((left, right) => Number(left.imported) - Number(right.imported)
        || left.id.localeCompare(right.id));
  }

  question(id) {
    return this.questions().find((question) => question.id === id)
      || this.generatedSelfTests.find((question) => question.id === id);
  }

  addGeneratedSelfTestQuestions(questions) {
    const usable = (Array.isArray(questions) ? questions : [])
      .filter((question) => question?.id && question?.text);
    const incomingIds = new Set(usable.map((question) => question.id));
    const combined = [
      ...this.generatedSelfTests.filter((question) => !incomingIds.has(question.id)),
      ...usable
    ];
    const answeredIds = new Set(this.records.map((record) => record.questionId));
    const answeredQuestions = combined.filter((question) => answeredIds.has(question.id));
    const recentUnanswered = combined.filter((question) => !answeredIds.has(question.id)).slice(-200);
    this.generatedSelfTests = [...answeredQuestions, ...recentUnanswered];
    writeJson(this.generatedSelfTestsFile, this.generatedSelfTests);
    return usable;
  }

  sources() {
    return [...new Set(this.imported.map((question) => question.source).filter(Boolean))];
  }

  addImported(questions, source) {
    const normalized = questions.map((question) => ({
      id: `imp-${randomUUID()}`,
      scope: question.scope || "custom",
      chapter: question.chapter || "导入题库",
      title: question.title || "导入题",
      type: question.type || (question.options?.length ? "single_choice" : "analysis"),
      text: question.text || "",
      options: Array.isArray(question.options) ? question.options : [],
      answer: Number.isInteger(question.answer) ? question.answer : null,
      answerText: question.answerText || "",
      explanation: question.explanation || "请结合课堂内容完成本题。",
      knowledge: question.knowledge?.length ? question.knowledge : ["导入题"],
      keywords: Array.isArray(question.keywords) ? question.keywords : [],
      difficulty: Number(question.difficulty) || 2,
      source,
      imported: true
    })).filter((question) => question.text);
    this.imported.push(...normalized);
    writeJson(this.importedFile, this.imported);
    return normalized;
  }

  clearImported() {
    const removed = this.imported.length;
    this.imported = [];
    writeJson(this.importedFile, this.imported);
    return removed;
  }

  addRecord(record) {
    const saved = { id: randomUUID(), answeredAt: new Date().toISOString(), ...record };
    this.records.push(saved);
    writeJson(this.recordsFile, this.records);
    return saved;
  }

  clearRecords(learnerId = "") {
    const before = this.records.length;
    const tasksBefore = this.personalizedTasks.length;
    const sessionsBefore = this.experimentSessions.length;
    const reportsBefore = this.experimentReports.length;
    const reviewBefore = Object.keys(this.wrongReview).length;
    this.records = learnerId
      ? this.records.filter((record) => record.learnerId !== learnerId)
      : [];
    if (learnerId) {
      Object.keys(this.wrongReview).forEach((key) => {
        if (key.startsWith(`${learnerId}\u0000`)) delete this.wrongReview[key];
      });
      this.personalizedTasks = this.personalizedTasks.filter((task) => task.learnerId !== learnerId);
      this.experimentSessions = this.experimentSessions.filter((session) => session.learnerId !== learnerId);
      this.experimentReports = this.experimentReports.filter((report) => report.learnerId !== learnerId);
    } else {
      this.wrongReview = {};
      this.personalizedTasks = [];
      this.experimentSessions = [];
      this.experimentReports = [];
    }
    writeJson(this.recordsFile, this.records);
    writeJson(this.wrongReviewFile, this.wrongReview);
    writeJson(this.personalizedTasksFile, this.personalizedTasks);
    writeJson(this.experimentSessionsFile, this.experimentSessions);
    writeJson(this.experimentReportsFile, this.experimentReports);
    return (before - this.records.length)
      + (tasksBefore - this.personalizedTasks.length)
      + (sessionsBefore - this.experimentSessions.length)
      + (reportsBefore - this.experimentReports.length)
      + (reviewBefore - Object.keys(this.wrongReview).length);
  }

  wrongReviewKey(learnerId, questionId) {
    return `${String(learnerId || "")}\u0000${String(questionId || "")}`;
  }

  wrongReviewConfirmation(learnerId, questionId) {
    return this.wrongReview[this.wrongReviewKey(learnerId, questionId)] || null;
  }

  confirmWrongReview(learnerId, questionId) {
    const state = { confirmedAt: new Date().toISOString() };
    this.wrongReview[this.wrongReviewKey(learnerId, questionId)] = state;
    writeJson(this.wrongReviewFile, this.wrongReview);
    return state;
  }

  confirmedWrongReviewCount(learnerId = "") {
    return Object.entries(this.wrongReview)
      .filter(([key]) => !learnerId || key.startsWith(`${learnerId}\u0000`)).length;
  }

  createPersonalizedTask({ learnerId, scope, title, questions, profile = {} }) {
    const now = new Date().toISOString();
    const task = {
      id: randomUUID(),
      learnerId: String(learnerId || ""),
      title: String(title || "个性化学习任务").slice(0, 100),
      scope: String(scope || "all"),
      createdAt: now,
      updatedAt: now,
      completedAt: "",
      profile: {
        focusKnowledge: Array.isArray(profile.focusKnowledge) ? profile.focusKnowledge.slice(0, 6) : []
      },
      questions: (Array.isArray(questions) ? questions : []).map((question) => ({ ...question })),
      answers: {}
    };
    this.personalizedTasks.unshift(task);
    writeJson(this.personalizedTasksFile, this.personalizedTasks);
    return task;
  }

  personalizedTasksForLearner(learnerId = "") {
    return this.personalizedTasks
      .filter((task) => !learnerId || task.learnerId === learnerId)
      .sort((left, right) => String(right.updatedAt || right.createdAt).localeCompare(String(left.updatedAt || left.createdAt)));
  }

  personalizedTask(learnerId, taskId) {
    return this.personalizedTasks.find((task) => task.id === taskId && task.learnerId === learnerId) || null;
  }

  personalizedTaskQuestion(learnerId, taskId, questionId) {
    return this.personalizedTask(learnerId, taskId)?.questions
      ?.find((question) => question.id === questionId) || null;
  }

  recordPersonalizedTaskAnswer(learnerId, taskId, questionId, correct, recordId = "") {
    const task = this.personalizedTask(learnerId, taskId);
    if (!task || !task.questions.some((question) => question.id === questionId)) return null;
    task.answers ||= {};
    task.answers[questionId] = {
      correct: Boolean(correct),
      answeredAt: new Date().toISOString(),
      recordId
    };
    task.updatedAt = new Date().toISOString();
    const complete = task.questions.length > 0 && task.questions.every((question) => task.answers[question.id]);
    task.completedAt = complete ? (task.completedAt || task.updatedAt) : "";
    writeJson(this.personalizedTasksFile, this.personalizedTasks);
    return task;
  }

  deletePersonalizedTask(learnerId, taskId) {
    const before = this.personalizedTasks.length;
    this.personalizedTasks = this.personalizedTasks.filter((task) => !(task.id === taskId && task.learnerId === learnerId));
    if (before !== this.personalizedTasks.length) writeJson(this.personalizedTasksFile, this.personalizedTasks);
    return before !== this.personalizedTasks.length;
  }

  saveExperimentSession(session) {
    const index = this.experimentSessions.findIndex((item) => item.id === session.id);
    const saved = structuredClone(session);
    if (index >= 0) this.experimentSessions[index] = saved;
    else this.experimentSessions.unshift(saved);
    writeJson(this.experimentSessionsFile, this.experimentSessions);
    return structuredClone(saved);
  }

  experimentSession(learnerId, sessionId) {
    const session = this.experimentSessions.find((item) => (
      item.id === sessionId && item.learnerId === learnerId
    ));
    return session ? structuredClone(session) : null;
  }

  activeExperimentSession(learnerId, experimentId) {
    const session = this.experimentSessions.find((item) => (
      item.learnerId === learnerId
      && item.experimentId === experimentId
      && item.status === "active"
    ));
    return session ? structuredClone(session) : null;
  }

  saveExperimentReport(report) {
    const index = this.experimentReports.findIndex((item) => item.id === report.id);
    const saved = structuredClone(report);
    if (index >= 0) this.experimentReports[index] = saved;
    else this.experimentReports.unshift(saved);
    writeJson(this.experimentReportsFile, this.experimentReports);
    return structuredClone(saved);
  }

  experimentReportsForLearner(learnerId = "") {
    return this.experimentReports
      .filter((report) => !learnerId || report.learnerId === learnerId)
      .sort((left, right) => String(right.completedAt).localeCompare(String(left.completedAt)))
      .map((report) => structuredClone(report));
  }

  experimentEvidenceForLearner(learnerId = "") {
    return this.experimentSessions
      .filter((session) => !learnerId || session.learnerId === learnerId)
      .flatMap((session) => (session.evidence || []).map((evidence) => ({
        ...structuredClone(evidence),
        sessionId: session.id,
        experimentId: session.experimentId
      })));
  }

  aiConfig() {
    return {
      apiKey: this.config.apiKey || process.env.DASHSCOPE_API_KEY || "",
      baseUrl: this.config.baseUrl || process.env.AI_BASE_URL
        || "https://dashscope.aliyuncs.com/compatible-mode/v1",
      model: this.config.model || process.env.AI_MODEL || "qwen-plus"
    };
  }

  saveAiConfig(config) {
    this.config = {
      apiKey: String(config.apiKey || this.config.apiKey || "").trim(),
      baseUrl: String(config.baseUrl || this.config.baseUrl
        || "https://dashscope.aliyuncs.com/compatible-mode/v1").trim().replace(/\/$/, ""),
      model: String(config.model || this.config.model || "qwen-plus").trim()
    };
    writeJson(this.configFile, this.config);
    return this.aiConfig();
  }
}
