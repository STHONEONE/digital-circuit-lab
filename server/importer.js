import mammoth from "mammoth";
// Import the library implementation directly. The package entry point runs a
// bundled demo when loaded from ESM and otherwise tries to read its test PDF.
import pdf from "pdf-parse/lib/pdf-parse.js";

function fallbackQuestion(text, source) {
  return [{
    scope: "custom",
    chapter: "导入题库",
    title: `${source} 导入题`,
    type: "analysis",
    text: String(text).slice(0, 1600),
    options: [],
    answerText: "请根据课堂讲解或教材答案补充参考答案。",
    explanation: "这是从文档提取的题目文本。配置 AI 后可自动拆分并整理为多道题。",
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
    const name = file.originalname || "导入题库";
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
    const text = (await this.extract(file)).trim();
    if (!text) throw new Error("没有提取到文字。扫描版 PDF 需要先进行 OCR。");
    let questions = [];
    try {
      questions = await this.aiService.parseQuestions(text, file.originalname);
    } catch {
      questions = [];
    }
    if (!questions.length) questions = fallbackQuestion(text, file.originalname);
    const saved = this.store.addImported(questions, file.originalname);
    return { count: saved.length, questions: saved };
  }
}
