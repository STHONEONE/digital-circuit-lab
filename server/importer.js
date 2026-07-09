import mammoth from "mammoth";
// Import the library implementation directly. The package entry point runs a
// bundled demo when loaded from ESM and otherwise tries to read its test PDF.
import pdf from "pdf-parse/lib/pdf-parse.js";

function countCjk(text) {
  return (String(text).match(/[\u4e00-\u9fff]/g) || []).length;
}

function fixUploadedName(name = "导入题库") {
  const raw = String(name || "导入题库");
  try {
    const decoded = Buffer.from(raw, "latin1").toString("utf8");
    return countCjk(decoded) > countCjk(raw) ? decoded : raw;
  } catch {
    return raw;
  }
}

function normalizeText(text) {
  return String(text || "")
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function scopeFromChapter(chapter) {
  if (/基础/.test(chapter)) return "basic-logic";
  if (/组合/.test(chapter)) return "combinational";
  if (/时序/.test(chapter)) return "sequential";
  return "custom";
}

function normalizeType(type, optionCount) {
  if (/选择/.test(type) || optionCount > 0) return "single_choice";
  if (/填空/.test(type)) return "fill_blank";
  return "analysis";
}

function splitList(value) {
  return String(value || "")
    .split(/[;；、,，/]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function optionAnswerIndex(answerText, options) {
  const letter = String(answerText || "").trim().match(/^[A-D]/i)?.[0]?.toUpperCase();
  if (letter) return letter.charCodeAt(0) - 65;
  const normalized = String(answerText || "").trim();
  const found = options.findIndex((option) => option.trim() === normalized);
  return found >= 0 ? found : null;
}

function field(block, label, stopLabels = []) {
  const labels = [label, ...stopLabels].join("|");
  const pattern = new RegExp(`${label}[：:]\\s*([\\s\\S]*?)(?=\\n(?:${labels})[：:]|$)`);
  return block.match(pattern)?.[1]?.trim() || "";
}

export function parseStructuredQuestions(text, source = "导入题库") {
  const normalized = normalizeText(text);
  if (!normalized) return [];

  const lines = normalized.split("\n").map((line) => line.trim()).filter(Boolean);
  const blocks = [];
  let current = [];

  for (const line of lines) {
    if (/^\d+\s*[.、．]\s*(?:【[^】]+】)?/.test(line) && current.length) {
      blocks.push(current.join("\n"));
      current = [line];
    } else {
      current.push(line);
    }
  }
  if (current.length) blocks.push(current.join("\n"));

  return blocks
    .map((block) => {
      const head = block.match(/^(\d+)\s*[.、．]\s*(?:【([^】]+)】)?\s*([^\n]*)/);
      if (!head) return null;

      const title = (head[3] || `导入题 ${head[1]}`).trim();
      const chapter = field(block, "专题", ["题干", "A\\.", "答案", "解析", "知识点", "难度"]) || "导入题库";
      const questionText = field(block, "题干", ["A\\.", "答案", "解析", "知识点", "难度"]);
      const answerText = field(block, "答案", ["解析", "知识点", "难度"]);
      const explanation = field(block, "解析", ["知识点", "难度"]);
      const knowledgeText = field(block, "知识点", ["难度"]);
      const difficulty = Number(field(block, "难度")) || 2;

      const options = [];
      for (const option of block.matchAll(/(?:^|\n)([A-D])\s*[.．、]\s*([^\n]+)/g)) {
        options[option[1].toUpperCase().charCodeAt(0) - 65] = option[2].trim();
      }

      const textValue = questionText || block
        .replace(/^(\d+)\s*[.、．]\s*(?:【([^】]+)】)?\s*([^\n]*)\n?/, "")
        .replace(/\n[A-D]\s*[.．、]\s*[^\n]+/g, "")
        .replace(/\n答案[：:][\s\S]*$/g, "")
        .trim();

      if (!textValue) return null;

      const compactOptions = options.filter((option) => option !== undefined);
      return {
        scope: scopeFromChapter(chapter),
        chapter,
        title,
        type: normalizeType(head[2] || "", compactOptions.length),
        text: textValue,
        options: compactOptions,
        answer: optionAnswerIndex(answerText, compactOptions),
        answerText,
        explanation: explanation || "请结合题干和参考答案完成本题。",
        knowledge: splitList(knowledgeText).length ? splitList(knowledgeText) : [chapter],
        keywords: splitList(`${title}；${knowledgeText}`),
        difficulty,
        source
      };
    })
    .filter(Boolean);
}

function fallbackQuestion(text, source) {
  return [{
    scope: "custom",
    chapter: "导入题库",
    title: `${source} 导入题`,
    type: "analysis",
    text: String(text).slice(0, 1600),
    options: [],
    answerText: "请根据课堂讲解或教材答案补充参考答案。",
    explanation: "这是从文档提取的题目文本。建议按“1.【选择题】题名 / 题干 / A.选项 / 答案 / 解析”的结构整理后再导入。",
    knowledge: ["导入题"],
    keywords: ["导入题"],
    difficulty: 2
  }];
}

export class ImportService {
  constructor(store, aiService) {
    this.store = store;
    this.aiService = aiService;
  }

  async extract(file) {
    const name = fixUploadedName(file.originalname);
    const lower = name.toLowerCase();
    if (lower.endsWith(".docx")) {
      const result = await mammoth.extractRawText({ buffer: file.buffer });
      return result.value;
    }
    if (lower.endsWith(".pdf")) {
      const result = await pdf(file.buffer);
      return result.text;
    }
    throw new Error("仅支持 .docx 和文字型 .pdf 文件");
  }

  async import(file) {
    if (!file) throw new Error("请先选择文件");
    const source = fixUploadedName(file.originalname);
    const text = (await this.extract(file)).trim();
    if (!text) throw new Error("没有提取到文字。扫描版 PDF 需要先进行 OCR。");

    let questions = parseStructuredQuestions(text, source);
    if (!questions.length) {
      try {
        questions = await this.aiService.parseQuestions(text, source);
      } catch {
        questions = [];
      }
    }
    if (!questions.length) questions = fallbackQuestion(text, source);
    const saved = this.store.addImported(questions, source);
    return { count: saved.length, questions: saved };
  }
}
