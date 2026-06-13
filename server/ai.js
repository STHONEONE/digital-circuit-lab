import { ChatOpenAI } from "@langchain/openai";

function contentText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map((part) => typeof part === "string" ? part : part?.text || "").join("");
}

function cleanJson(text) {
  const cleaned = String(text || "").replace(/^```json\s*/i, "").replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "").trim();
  const objectStart = cleaned.indexOf("{");
  const arrayStart = cleaned.indexOf("[");
  const start = arrayStart >= 0 && (objectStart < 0 || arrayStart < objectStart) ? arrayStart : objectStart;
  const end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
  if (start < 0 || end < start) throw new Error("AI 未返回合法 JSON");
  return cleaned.slice(start, end + 1);
}

export class AiService {
  constructor(store) {
    this.store = store;
  }

  configured() {
    return Boolean(this.store.aiConfig().apiKey);
  }

  model({ temperature = 0.2, maxTokens = 700 } = {}) {
    const config = this.store.aiConfig();
    if (!config.apiKey) throw new Error("未配置 AI Key");
    return new ChatOpenAI({
      apiKey: config.apiKey,
      model: config.model,
      temperature,
      maxTokens,
      streamUsage: false,
      timeout: 45000,
      configuration: {
        baseURL: config.baseUrl
      }
    });
  }

  messages(question, request) {
    const history = String(request.history || "").slice(-2500);
    const userParts = [
      "请讲解下面这道数字电路题目，不判断学生答案对错，也不要分析学生个人错因。",
      `题目：${question.text}`,
      `题型：${question.type}`,
      `知识点：${(question.knowledge || []).join("、")}`,
      `参考答案：${question.answerText || ""}`,
      `教材式解析：${question.explanation || ""}`
    ];
    if (request.experimentState) {
      userParts.push(`当前仿真实验状态：${JSON.stringify(request.experimentState)}`);
    }
    if (history) userParts.push(`本次对话历史：\n${history}`);
    if (request.mode === "variant") {
      userParts.push("生成 2 道同知识点变式题，每题给出简短参考答案。");
    } else if (request.followup) {
      userParts.push(`学生追问：${request.followup}`, "围绕追问简洁解释，不判断学生答案。");
    } else {
      userParts.push("按“考查点、解题思路、关键步骤、易混点”四部分简洁回答，控制在 500 字以内。");
    }
    return [
      {
        role: "system",
        content: "你是大学数字电路课程的智能助教。回答准确、简洁、分点清楚。"
          + "布尔表达式优先使用普通字符，例如 F=A·B、Q(n+1)=D、Y0 上方横线可写成“非Y0”。"
          + "需要 LaTeX 时只使用 $...$ 或 $$...$$，不要使用代码块和复杂环境。"
      },
      { role: "user", content: userParts.join("\n") }
    ];
  }

  localExplanation(question, request) {
    if (request.mode === "variant") {
      return `当前未配置 AI Key。\n变式方向：${(question.knowledge || []).join("、")}`
        + "\n1. 替换输入条件或初始状态。\n2. 保持知识点，改变题型。\n3. 做对后逐步提高难度。";
    }
    return `当前使用本地讲解。\n本题考查：${(question.knowledge || []).join("、")}`
      + `\n参考答案：${question.answerText || ""}\n解析：${question.explanation || ""}`;
  }

  async streamTutor(question, request, onChunk) {
    if (!this.configured()) {
      onChunk(this.localExplanation(question, request));
      return false;
    }
    const stream = await this.model({
      maxTokens: request.mode === "variant" ? 900 : 700
    }).stream(this.messages(question, request));
    let emitted = false;
    for await (const chunk of stream) {
      const text = contentText(chunk.content);
      if (text) {
        emitted = true;
        onChunk(text);
      }
    }
    if (!emitted) throw new Error("大模型没有返回有效内容");
    return true;
  }

  async streamExperiment(request, onChunk) {
    const experimentName = String(request.experimentName || "数字电路实验");
    const state = request.experimentState || {};
    const question = String(request.question || "请解释当前实验状态");
    if (!this.configured()) {
      onChunk(`当前使用本地实验讲解。\n实验：${experimentName}\n状态：${JSON.stringify(state)}\n`
        + "请观察输入、输出和真值表之间的对应关系。配置 AI Key 后可获得动态推导。");
      return false;
    }
    const stream = await this.model({ maxTokens: 650 }).stream([
      {
        role: "system",
        content: "你是大学数字电路交互实验助教。必须结合实验状态回答，说明输入如何决定输出。"
          + "回答简洁、分点清楚，不虚构页面上不存在的器件。"
      },
      {
        role: "user",
        content: `实验：${experimentName}\n当前状态：${JSON.stringify(state)}\n学生问题：${question}`
      }
    ]);
    let emitted = false;
    for await (const chunk of stream) {
      const text = contentText(chunk.content);
      if (text) {
        emitted = true;
        onChunk(text);
      }
    }
    if (!emitted) throw new Error("大模型没有返回有效内容");
    return true;
  }

  async parseQuestions(text, source) {
    if (!this.configured()) return [];
    const prompt = [
      "把下面的数字电路课后习题整理成 JSON，只输出 {\"questions\":[...]}。",
      "字段：title,scope,chapter,type,text,options,answer,answerText,explanation,knowledge,keywords,difficulty。",
      "scope 只能是 comb、ff、custom；选择题 type=single_choice，answer 是从 0 开始的序号。",
      `来源：${source}`,
      String(text).slice(0, 18000)
    ].join("\n");
    const result = await this.model({ temperature: 0.1, maxTokens: 2500 }).invoke([
      { role: "system", content: "你是数字电路题库整理助手，只输出合法 JSON。" },
      { role: "user", content: prompt }
    ]);
    const parsed = JSON.parse(cleanJson(contentText(result.content)));
    return Array.isArray(parsed) ? parsed : parsed.questions || [];
  }
}
