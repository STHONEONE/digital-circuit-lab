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
    this.configFile = path.join(dataDir, "ai-config.json");
    fs.mkdirSync(dataDir, { recursive: true });
    this.imported = readJson(this.importedFile, []);
    this.records = readJson(this.recordsFile, []);
    this.config = readJson(this.configFile, {});
  }

  questions({ scope, source } = {}) {
    return [...seedQuestions, ...this.imported]
      .filter((question) => !scope || scope === "all" || question.scope === scope)
      .filter((question) => !source || question.source === source)
      .sort((left, right) => Number(left.imported) - Number(right.imported)
        || left.id.localeCompare(right.id));
  }

  question(id) {
    return this.questions().find((question) => question.id === id);
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
    this.records.push({ id: randomUUID(), answeredAt: new Date().toISOString(), ...record });
    writeJson(this.recordsFile, this.records);
  }

  clearRecords() {
    const removed = this.records.length;
    this.records = [];
    writeJson(this.recordsFile, this.records);
    return removed;
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
