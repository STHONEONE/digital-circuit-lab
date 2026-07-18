const platformApi = window.learningPlatform?.fetchJson;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function clampPercent(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, Math.round(number))) : 0;
}

function safeDiagramSvg(markup) {
  const parser = new DOMParser();
  const documentNode = parser.parseFromString(String(markup || ""), "image/svg+xml");
  const svg = documentNode.documentElement;
  if (svg.nodeName.toLowerCase() !== "svg" || documentNode.querySelector("parsererror")) return "";
  const allowedTags = new Set([
    "svg", "g", "defs", "marker", "lineargradient", "stop", "path", "rect", "circle",
    "ellipse", "line", "polyline", "polygon", "text", "tspan"
  ]);
  const allowedAttributes = new Set([
    "xmlns", "viewbox", "role", "aria-label", "width", "height", "x", "y", "x1", "y1",
    "x2", "y2", "cx", "cy", "r", "rx", "ry", "d", "points", "fill", "stroke",
    "stroke-width", "stroke-linecap", "stroke-linejoin", "opacity", "transform", "id", "refx",
    "refy", "markerwidth", "markerheight", "orient", "marker-end", "offset", "stop-color",
    "stop-opacity", "font-size", "font-weight", "text-anchor", "dominant-baseline"
  ]);
  [...svg.querySelectorAll("*")].forEach((node) => {
    if (!allowedTags.has(node.nodeName.toLowerCase())) {
      node.remove();
      return;
    }
    [...node.attributes].forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();
      if (!allowedAttributes.has(name)
        || /^on/i.test(name)
        || /(?:javascript:|data:text\/html)/i.test(value)) node.removeAttribute(attribute.name);
    });
  });
  [...svg.attributes].forEach((attribute) => {
    const name = attribute.name.toLowerCase();
    const value = attribute.value.trim();
    if (!allowedAttributes.has(name)
      || /^on/i.test(name)
      || /(?:javascript:|data:text\/html)/i.test(value)) svg.removeAttribute(attribute.name);
  });
  return new XMLSerializer().serializeToString(svg);
}

function setPlatformNotice(element, message, error = false) {
  if (!element) return;
  element.hidden = false;
  element.className = `platform-notice${error ? " error" : ""}`;
  element.textContent = message;
}

function pageNotice(id) {
  let notice = document.querySelector(`#${id}`);
  if (notice) return notice;
  notice = document.createElement("div");
  notice.id = id;
  notice.className = "platform-notice";
  notice.hidden = true;
  const frame = document.querySelector(".platform-page-frame");
  const header = frame?.querySelector(".platform-page-header");
  if (header) header.insertAdjacentElement("afterend", notice);
  else frame?.prepend(notice);
  return notice;
}

function optionLetter(index) {
  return String.fromCharCode(65 + index);
}

function questionAnswerText(question) {
  if (question.type === "single_choice") {
    return `${optionLetter(question.answer)}. ${question.options?.[question.answer] || ""}`;
  }
  return question.answerText || "";
}

async function gradeVariant(question, answer) {
  if (question.type === "single_choice") {
    const correct = Number(answer) === Number(question.answer);
    return {
      correct,
      message: correct ? "回答正确" : "需要继续巩固",
      referenceAnswer: questionAnswerText(question),
      explanation: question.explanation || ""
    };
  }
  return platformApi("/api/answers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      questionId: question.id,
      answer: String(answer),
      practiceMode: "ai_variant"
    })
  });
}

function renderPlatformEvaluation(container, question, result, compact = false) {
  container.className = `platform-feedback visible ${result.correct ? "ok" : "bad"}`;
  const rendered = window.answerFeedback?.renderEvaluation(container, {
    result,
    referenceAnswer: result.referenceAnswer || question.answerText || "",
    explanation: result.explanation || question.explanation || "",
    compact
  });
  if (rendered) return true;
  container.textContent = `${result.message || (result.correct ? "回答正确" : "需要巩固")}\n正确答案已隐藏；需要时可查看解析。`;
  return false;
}

function renderPlatformNotice(container, message) {
  container.className = "platform-feedback visible system-error";
  if (window.answerFeedback?.renderNotice) {
    window.answerFeedback.renderNotice(container, message, "error");
  } else {
    container.textContent = message;
  }
}

function enableDrag(panel, handle) {
  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;
  handle.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button")) return;
    const rect = panel.getBoundingClientRect();
    dragging = true;
    offsetX = event.clientX - rect.left;
    offsetY = event.clientY - rect.top;
    panel.style.left = `${rect.left}px`;
    panel.style.top = `${rect.top}px`;
    panel.style.right = "auto";
    panel.style.bottom = "auto";
    handle.setPointerCapture(event.pointerId);
  });
  handle.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    const maxX = Math.max(8, innerWidth - panel.offsetWidth - 8);
    const maxY = Math.max(8, innerHeight - panel.offsetHeight - 8);
    panel.style.left = `${Math.min(maxX, Math.max(8, event.clientX - offsetX))}px`;
    panel.style.top = `${Math.min(maxY, Math.max(8, event.clientY - offsetY))}px`;
  });
  handle.addEventListener("pointerup", () => { dragging = false; });
  handle.addEventListener("pointercancel", () => { dragging = false; });
}

function openRemediationFloat(response, sourceQuestion) {
  document.querySelector(".platform-remediation-float")?.remove();
  document.querySelector(".platform-remediation-launcher")?.remove();
  const panel = document.createElement("section");
  panel.className = "platform-remediation-float";
  panel.innerHTML = `
    <header class="platform-remediation-header"><strong>AI 错题强化</strong><button type="button" aria-label="关闭">×</button></header>
    <div class="platform-remediation-body"></div>
  `;
  const launcher = document.createElement("button");
  launcher.type = "button";
  launcher.className = "platform-remediation-launcher";
  launcher.textContent = "继续错题强化";
  launcher.hidden = true;
  document.body.append(panel, launcher);
  const header = panel.querySelector(".platform-remediation-header");
  const body = panel.querySelector(".platform-remediation-body");
  header.querySelector("button").addEventListener("click", () => {
    panel.hidden = true;
    launcher.hidden = false;
  });
  launcher.addEventListener("click", () => {
    panel.hidden = false;
    launcher.hidden = true;
  });
  enableDrag(panel, header);

  function renderQuestion(payload, source) {
    body.innerHTML = "";
    const variant = payload.variantQuestion;
    if (!variant) return;
    const title = document.createElement("h3");
    title.textContent = variant.title || "同知识点变式题";
    const text = document.createElement("p");
    text.className = "platform-remediation-question";
    text.textContent = variant.text;
    const answers = document.createElement("div");
    answers.className = "platform-remediation-answers";
    let selected = null;
    let input = null;
    if (variant.type === "single_choice") {
      (variant.options || []).forEach((option, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = `${optionLetter(index)}. ${option}`;
        button.addEventListener("click", () => {
          selected = index;
          answers.querySelectorAll("button").forEach((item) => item.classList.remove("selected"));
          button.classList.add("selected");
        });
        answers.append(button);
      });
    } else {
      input = document.createElement("textarea");
      input.className = "platform-answer-input";
      input.placeholder = "输入变式题答案";
      answers.append(input);
    }
    const submit = document.createElement("button");
    submit.className = "platform-button primary";
    submit.type = "button";
    submit.textContent = "提交答案";
    const feedback = document.createElement("div");
    body.append(title, text, answers, submit, feedback);
    let gradedAttempt = null;
    let generationNote = null;

    async function requestNextVariant() {
      if (!gradedAttempt) return;
      generationNote?.remove();
      generationNote = null;
      submit.disabled = true;
      submit.textContent = "正在生成下一道强化题…";
      try {
        const { answer } = gradedAttempt;
        const next = await platformApi("/api/wrong-remediation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionId: variant.id,
            userAnswer: String(answer)
          })
        });
        if (!next?.ai || !next.variantQuestion) {
          throw new Error(next?.analysis || "暂时无法继续生成强化题，请稍后重试。");
        }
        submit.textContent = "本题已评分";
        const continueButton = document.createElement("button");
        continueButton.className = "platform-button primary";
        continueButton.type = "button";
        continueButton.textContent = "查看讲解并继续下一题";
        continueButton.addEventListener("click", () => renderKnowledge(next, variant));
        body.append(continueButton);
      } catch (error) {
        generationNote = document.createElement("div");
        generationNote.className = "answer-evaluation-notice is-error";
        generationNote.textContent = `下一题暂未生成：${error.message}`;
        feedback.append(generationNote);
        submit.disabled = false;
        submit.textContent = "重试生成下一题";
      }
    }

    submit.addEventListener("click", async () => {
      if (gradedAttempt) {
        await requestNextVariant();
        return;
      }
      const answer = variant.type === "single_choice" ? selected : input?.value.trim();
      if (answer === null || answer === undefined || answer === "") {
        feedback.textContent = variant.type === "single_choice" ? "请先选择一个选项。" : "请先填写答案。";
        return;
      }
      submit.disabled = true;
      submit.textContent = variant.type === "analysis" ? "AI 正在语义评分…" : "正在判题…";
      let result;
      try {
        result = await gradeVariant(variant, answer);
      } catch (error) {
        renderPlatformNotice(feedback, `答案暂未提交成功，当前作答已保留。${error.message}`);
        submit.disabled = false;
        submit.textContent = "重新提交答案";
        return;
      }
      renderPlatformEvaluation(feedback, variant, result, true);
      if (result.correct) {
        submit.textContent = "本轮已完成";
        return;
      }
      gradedAttempt = { answer };
      await requestNextVariant();
    });
  }

  function renderKnowledge(payload, source) {
    body.innerHTML = "";
    const eyebrow = document.createElement("span");
    eyebrow.className = "platform-remediation-eyebrow";
    eyebrow.textContent = "先理解，再练习";
    const title = document.createElement("h3");
    title.textContent = source?.knowledge?.length
      ? `知识点：${source.knowledge.join(" · ")}`
      : "先复习本题知识点";
    const analysis = document.createElement("p");
    analysis.className = "platform-remediation-analysis";
    analysis.textContent = payload.analysis || "已根据错题整理好本轮强化知识点。";
    const start = document.createElement("button");
    start.className = "platform-button primary";
    start.type = "button";
    start.textContent = "我已理解，开始练习";
    start.addEventListener("click", () => renderQuestion(payload, source));
    body.append(eyebrow, title, analysis, start);
  }

  renderKnowledge(response, sourceQuestion);
}

async function requestRemediation(question, answer, result) {
  try {
    const response = await platformApi("/api/wrong-remediation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        questionId: question.id,
        userAnswer: String(answer),
        referenceAnswer: result.referenceAnswer || questionAnswerText(question)
      })
    });
    openRemediationFloat(response, question);
  } catch {
    // The answer feedback remains usable even when the optional AI remediation request fails.
  }
}

class PlatformQuestionRunner {
  constructor(container, { mode, onAnswered, onIndexChange } = {}) {
    this.container = container;
    this.mode = mode || "normal";
    this.onAnswered = onAnswered;
    this.onIndexChange = onIndexChange;
    this.questions = [];
    this.index = 0;
    this.selected = null;
    this.taskId = "";
    this.renderShell();
  }

  renderShell() {
    this.container.innerHTML = `
      <article class="platform-question-card">
        <div class="platform-question-head"><div><p data-runner-chapter>题目</p><h3 data-runner-title>等待加载</h3></div><span class="platform-question-counter" data-runner-counter>0 / 0</span></div>
        <p class="platform-question-text" data-runner-text>正在加载题目...</p>
        <div class="platform-question-diagram" data-runner-diagram></div>
        <div class="platform-options" data-runner-options></div>
        <textarea class="platform-answer-input" data-runner-input placeholder="输入答案" hidden></textarea>
        <div class="platform-question-actions"><button class="platform-button" data-runner-prev type="button">上一题</button><button class="platform-button primary" data-runner-submit type="button">提交答案</button><button class="platform-button" data-runner-next type="button">下一题</button></div>
        <div class="platform-feedback" data-runner-feedback></div>
      </article>
    `;
    this.els = Object.fromEntries([
      "chapter", "title", "counter", "text", "diagram", "options", "input", "prev", "submit", "next", "feedback"
    ].map((name) => [name, this.container.querySelector(`[data-runner-${name}]`)]));
    this.els.prev.addEventListener("click", () => this.move(-1));
    this.els.next.addEventListener("click", () => this.move(1));
    this.els.submit.addEventListener("click", () => this.submit());
  }

  setQuestions(questions, index = 0, taskId = "") {
    this.questions = Array.isArray(questions) ? questions : [];
    this.index = Math.max(0, Math.min(index, this.questions.length - 1));
    this.taskId = taskId || "";
    this.render();
  }

  select(index) {
    if (index < 0 || index >= this.questions.length) return;
    this.index = index;
    this.render();
  }

  move(step) {
    if (!this.questions.length) return;
    this.index = (this.index + step + this.questions.length) % this.questions.length;
    this.render();
  }

  render() {
    const question = this.questions[this.index];
    this.selected = null;
    this.els.feedback.className = "platform-feedback";
    this.els.feedback.textContent = "";
    this.els.options.innerHTML = "";
    this.els.input.value = "";
    this.els.diagram.innerHTML = "";
    if (!question) {
      this.els.chapter.textContent = "暂无题目";
      this.els.title.textContent = "当前没有可作答内容";
      this.els.counter.textContent = "0 / 0";
      this.els.text.textContent = "完成普通练习后再回到这里查看。";
      this.els.input.hidden = true;
      this.els.submit.disabled = true;
      this.els.prev.disabled = true;
      this.els.next.disabled = true;
      this.onIndexChange?.(0, null);
      return;
    }
    this.els.submit.disabled = false;
    this.els.prev.disabled = this.questions.length < 2;
    this.els.next.disabled = this.questions.length < 2;
    this.els.chapter.textContent = question.chapter || "数字电路";
    this.els.title.textContent = question.title || "练习题";
    this.els.counter.textContent = `${this.index + 1} / ${this.questions.length}`;
    this.els.text.textContent = question.text || "";
    if (question.diagramSvg) this.els.diagram.innerHTML = safeDiagramSvg(question.diagramSvg);
    const isChoice = question.type === "single_choice";
    this.els.input.hidden = isChoice;
    if (isChoice) {
      (question.options || []).forEach((option, optionIndex) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "platform-option";
        const letter = document.createElement("strong");
        letter.textContent = optionLetter(optionIndex);
        const copy = document.createElement("span");
        copy.textContent = option;
        button.append(letter, copy);
        button.addEventListener("click", () => {
          this.selected = optionIndex;
          this.els.options.querySelectorAll("button").forEach((item) => item.classList.remove("selected"));
          button.classList.add("selected");
        });
        this.els.options.append(button);
      });
    }
    this.onIndexChange?.(this.index, question);
  }

  async submit() {
    const question = this.questions[this.index];
    if (!question) return;
    const answer = question.type === "single_choice" ? this.selected : this.els.input.value.trim();
    if (answer === null || answer === undefined || answer === "") {
      this.showFeedback(false, question.type === "single_choice" ? "请先选择一个选项。" : "请先填写答案。");
      return;
    }
    this.els.submit.disabled = true;
    this.els.submit.textContent = question.type === "analysis" ? "AI 正在语义评分…" : "正在判题…";
    try {
      const result = await platformApi("/api/answers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: question.id,
          answer: String(answer),
          practiceMode: this.mode,
          taskId: this.taskId
        })
      });
      this.showResult(result, question);
      this.onAnswered?.(result, question, answer, this.index);
      if (!result.correct) requestRemediation(question, answer, result);
    } catch (error) {
      renderPlatformNotice(this.els.feedback, `答案暂未提交成功，当前作答已保留。${error.message}`);
    } finally {
      this.els.submit.disabled = false;
      this.els.submit.textContent = "提交答案";
    }
  }

  showFeedback(ok, text) {
    this.els.feedback.className = `platform-feedback visible ${ok ? "ok" : "bad"}`;
    this.els.feedback.textContent = text;
  }

  showResult(result, question) {
    renderPlatformEvaluation(this.els.feedback, question, result);
  }
}

function createRunner(name, options) {
  const container = document.querySelector(`[data-question-runner="${name}"]`);
  return container ? new PlatformQuestionRunner(container, options) : null;
}

async function initScopePage() {
  const domains = [
    { id: "basic-logic", name: "基础逻辑", description: "数制、编码、逻辑门、逻辑代数与卡诺图。" },
    { id: "combinational", name: "组合逻辑", description: "编码器、译码器、数据选择器、加法器与比较器。" },
    { id: "sequential", name: "时序逻辑", description: "触发器、寄存器、计数器、波形与状态分析。" }
  ];
  const list = document.querySelector("#scopeDomainList");
  const startLink = document.querySelector("#scopeStartLink");
  let selected = "all";
  const questionGroups = await Promise.all(domains.map(async (domain) => ({
    ...domain,
    questions: await platformApi(`/api/questions?scope=${domain.id}`)
  })));
  const render = () => {
    list.innerHTML = "";
    questionGroups.forEach((domain) => {
      const knowledge = [...new Set(domain.questions.flatMap((question) => question.knowledge || []))].slice(0, 5);
      const button = document.createElement("button");
      button.type = "button";
      button.className = `scope-domain${selected === domain.id ? " selected" : ""}`;
      button.innerHTML = `<div class="scope-domain-title"><strong>${escapeHtml(domain.name)}</strong><span>${domain.questions.length} 道平台题</span></div><div class="scope-domain-copy"><p>${escapeHtml(domain.description)}</p><ul>${knowledge.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div><div class="scope-domain-count">${domain.questions.length}<small>QUESTIONS</small></div>`;
      button.addEventListener("click", () => { selected = selected === domain.id ? "all" : domain.id; startLink.href = `./index.html?scope=${selected}`; render(); });
      list.append(button);
    });
  };
  render();

  const status = document.querySelector("#scopeImportStatus");
  async function renderSources() {
    const sources = await platformApi("/api/sources");
    const container = document.querySelector("#scopeSourceList");
    container.innerHTML = sources.length
      ? sources.map((source) => `<div class="scope-source-item">${escapeHtml(source)}</div>`).join("")
      : '<div class="platform-empty">尚未导入外部题库</div>';
  }
  try { await renderSources(); } catch (error) { setPlatformNotice(status, `题库来源加载失败：${error.message}`, true); }
  document.querySelector("#scopeImportButton").addEventListener("click", async () => {
    const button = document.querySelector("#scopeImportButton");
    const input = document.querySelector("#scopeFileInput");
    if (!input.files[0]) return setPlatformNotice(status, "请先选择 Word 或 PDF 文件。", true);
    const form = new FormData();
    form.append("file", input.files[0]);
    button.disabled = true;
    button.textContent = "正在导入…";
    try {
      const result = await platformApi("/api/import-questions", { method: "POST", body: form });
      setPlatformNotice(status, `已导入 ${result.count || result.imported || result.questions?.length || 0} 道题。`);
      await renderSources();
    } catch (error) {
      setPlatformNotice(status, error.message, true);
    } finally {
      button.disabled = false;
      button.textContent = "导入题库";
    }
  });
  document.querySelector("#scopeClearImportButton").addEventListener("click", async () => {
    if (!confirm("确定清空平台中所有已导入题目吗？内置题库不会受影响。")) return;
    const button = document.querySelector("#scopeClearImportButton");
    button.disabled = true;
    button.textContent = "正在清空…";
    try {
      const result = await platformApi("/api/imported", { method: "DELETE" });
      setPlatformNotice(status, `已清空 ${result.removed || 0} 道导入题。`);
      await renderSources();
    } catch (error) {
      setPlatformNotice(status, error.message, true);
    } finally {
      button.disabled = false;
      button.textContent = "清空导入题";
    }
  });
}

async function initRoutePage() {
  const [plan, progress, questions] = await Promise.all([
    platformApi("/api/learning-plan"),
    platformApi("/api/progress"),
    platformApi("/api/questions?scope=all")
  ]);
  let selectedFocus = plan.primaryFocus || "综合基础";
  const progressByKnowledge = new Map((progress.knowledge || []).map((item) => [item.knowledge, item]));
  const scopeOrder = ["basic-logic", "combinational", "sequential", "custom"];
  const scopeLabels = {
    "basic-logic": "基础逻辑",
    combinational: "组合逻辑",
    sequential: "时序逻辑",
    custom: "自定义题库"
  };
  const normalizeScope = (scope) => ({ comb: "combinational", ff: "sequential" })[scope] || scope || "custom";
  const knowledgeByName = new Map();
  (questions || []).forEach((question) => {
    (question.knowledge || []).forEach((name) => {
      if (!knowledgeByName.has(name)) knowledgeByName.set(name, { name, scope: normalizeScope(question.scope) });
    });
  });
  (progress.knowledge || []).forEach((item) => {
    if (!knowledgeByName.has(item.knowledge)) knowledgeByName.set(item.knowledge, { name: item.knowledge, scope: "custom" });
  });
  const lessonProfiles = [
    {
      match: /优先编码器|编码器/,
      summary: "把多个输入状态压缩为较少位的代码输出；优先编码器还要处理多个输入同时有效的情况。",
      concept: "先确认输入和输出位数、有效电平以及优先级方向。普通编码器默认同一时刻只有一个输入有效，优先编码器则输出最高优先级输入对应的编码。",
      method: "从最高优先级输入开始逐项判断，把低优先级输出条件写成“高优先级均无效且当前输入有效”。",
      rules: ["n 位二进制编码可表示最多 2ⁿ 个输入状态。", "多个输入同时有效时，只保留优先级最高者。", "阅读器件符号时先辨认有效电平，低有效端不能直接按高有效理解。"],
      check: "能够根据有效输入确定编码输出，并解释普通编码器与优先编码器的差别。"
    },
    {
      match: /译码器|数据选择器/,
      summary: "利用控制输入在多条信号路径之间建立唯一对应关系，是组合逻辑中常见的选择与分配结构。",
      concept: "译码器把二进制代码展开为独立输出；数据选择器则由选择端决定哪一路数据送到输出。两者都要先确认使能端和有效电平。",
      method: "列出控制变量的二进制组合，再逐行确定被选中的输出或数据通道，最后处理使能条件。",
      rules: ["n 位译码输入通常对应 2ⁿ 个输出。", "数据选择器的选择端决定通道编号，数据端决定最终逻辑值。", "使能无效时，器件输出由其无效状态规定，与选择输入无关。"],
      check: "能够由控制码找出有效输出或被选择的数据通道。"
    },
    {
      match: /半加器|全加器|加法器|比较器/,
      summary: "对二进制数执行算术或大小判断，核心是把每一位的输入、进位和输出关系写清楚。",
      concept: "半加器处理两个本位输入，全加器还接收低位进位；比较器分别判断大于、等于和小于条件。",
      method: "先完成一位电路的真值表和表达式，再通过级联扩展到多位结构，并检查进位或级联输入。",
      rules: ["半加器：S=A⊕B，C=AB。", "全加器：S=A⊕B⊕Cin，进位由至少两个输入为 1 的条件产生。", "多位比较从最高位开始，只有高位相等时才继续比较低位。"],
      check: "能够写出一位运算关系，并说明多位电路如何级联。"
    },
    {
      match: /D 触发器|JK 触发器|SR 触发器|T 触发器|触发器/,
      summary: "在时钟或触发条件到来时保存一位状态，是时序电路分析的基础。",
      concept: "触发器的次态不仅取决于当前输入，还取决于现态。不同类型触发器通过特性表或特性方程描述状态更新。",
      method: "先找有效时钟沿，再读取该时刻输入，最后根据特性表从 Qₙ 推出 Qₙ₊₁；不要在非有效沿随意改变状态。",
      rules: ["D 触发器在有效沿满足 Qₙ₊₁=D。", "T 触发器 T=0 保持、T=1 翻转。", "JK 触发器 00 保持、01 置 0、10 置 1、11 翻转；SR 触发器要注意禁用组合。"],
      check: "能够依据有效时钟沿和输入序列逐拍求出 Q 的变化。"
    },
    {
      match: /移位寄存器|寄存器/,
      summary: "由多个触发器共同保存多位数据，并在时钟作用下完成并行装载或串行移位。",
      concept: "每个触发器保存一位，所有级通常共享时钟。移位方向决定相邻级之间的数据传递关系。",
      method: "画出每一级的现态，从数据入口开始，按一个时钟沿同时更新所有级，避免把同步更新误写成逐级立即传播。",
      rules: ["寄存器位数等于可同时保存的二进制位数。", "移位发生在有效时钟沿，各级使用沿到来前的旧状态。", "串入并出、并入串出等结构的区别在输入输出方式。"],
      check: "能够根据初态、串行输入和时钟次数写出寄存器内容。"
    },
    {
      match: /同步计数器|异步计数器|二进制计数器|模计数器|计数器/,
      summary: "按照时钟脉冲在有限状态之间循环，是典型的时序逻辑状态机。",
      concept: "模 M 计数器包含 M 个有效状态。同步计数器各级共用时钟，异步计数器由前一级输出触发后一级。",
      method: "先确定模数和状态编码，再列状态转移表，最后由触发器特性求激励条件并检查无效状态如何回到有效循环。",
      rules: ["容纳 M 个状态至少需要 ⌈log₂M⌉ 个触发器。", "同步计数器延迟较小；异步计数器结构简单但存在逐级传播延迟。", "非 2ⁿ 模计数器必须设计清零、置数或状态跳转逻辑。"],
      check: "能够确定触发器数量、有效状态序列和下一状态。"
    },
    {
      match: /波形分析|状态分析|状态转移表/,
      summary: "把时钟、输入和现态联系起来，逐个有效时刻推导电路的下一状态和输出。",
      concept: "状态表是离散描述，波形图是时间描述，两者表达的是同一组状态转移关系。",
      method: "标出所有有效时钟沿，建立“现态—输入—次态—输出”表，再把每个次态带入下一拍作为现态。",
      rules: ["只在规定的有效沿更新边沿触发器。", "组合输出可随输入变化，寄存输出通常只在状态更新后变化。", "分析前必须明确初态；没有初态时结果可能不唯一。"],
      check: "能够从电路、状态表或波形中的任一种表示推导另外两种。"
    },
    {
      match: /卡诺图|最小项|逻辑函数化简/,
      summary: "利用相邻项合并消去变量，把逻辑函数化为更容易实现的形式。",
      concept: "最小项对应输入变量的一种唯一取值。卡诺图按照格雷码排列，使几何相邻的单元只有一个变量不同。",
      method: "先准确填图，再用 1、2、4、8… 个单元组成尽可能大的矩形圈，允许重叠并确保所有目标项至少被覆盖一次。",
      rules: ["分组数量必须是 2 的整数次幂。", "分组越大，能够消去的变量越多。", "卡诺图左右边、上下边也相邻；不要遗漏边界合并。"],
      check: "能够从最小项表达式填卡诺图并写出化简结果。"
    },
    {
      match: /德摩根定律|逻辑代数|真值表|逻辑函数实现/,
      summary: "用代数、真值表和门电路三种方式描述同一个逻辑关系。",
      concept: "真值表枚举所有输入组合；逻辑表达式便于推导；门电路体现物理实现。三种表示应能相互转换。",
      method: "复杂表达式先识别运算层级，再使用基本定律逐步变形，每一步都可用真值表抽查关键输入组合。",
      rules: ["德摩根定律：乘积取反等于各项取反后相加；和式取反等于各项取反后相乘。", "吸收律：A+AB=A，A(A+B)=A。", "变量与其反变量满足 A+A′=1、AA′=0。"],
      check: "能够在真值表、逻辑式和门电路之间进行转换并验证等价性。"
    },
    {
      match: /或非门|逻辑门/,
      summary: "用基本逻辑运算建立数字电路的输入输出关系。",
      concept: "与、或、非是基本运算；与非、或非具有完备性，可以独立实现任意逻辑函数。异或常用于奇偶和不等关系。",
      method: "从最内层逻辑门开始逐级计算中间节点，遇到输出端小圆圈先标记取反，再判断整体关系。",
      rules: ["与门要求所有输入为 1 才输出 1。", "或门只要任一输入为 1 就输出 1。", "与非和或非都在基本运算结果后再取反。"],
      check: "能够根据门电路逐级计算输出，并由逻辑式搭建对应电路。"
    },
    {
      match: /二进制转换|十六进制转换|二进制运算|BCD 编码|格雷码|数制与编码/,
      summary: "在不同数制和编码之间保持同一数值或信息含义，是后续数字电路分析的基础。",
      concept: "数制转换保持数值不变，编码转换保持信息含义不变。BCD、格雷码等不能简单当作普通二进制数处理。",
      method: "按位权展开可以统一处理任意进制；二进制与十六进制可从小数点向两侧每四位一组快速互换。",
      rules: ["二进制位权从右到左依次为 2⁰、2¹、2²…。", "十六进制一位对应四位二进制。", "8421 BCD 按十进制数字逐位编码；格雷码相邻状态仅一位变化。"],
      check: "能够区分数值转换与编码转换，并独立完成典型换算。"
    },
    {
      match: /竞争冒险/,
      summary: "同一输入变化通过不同延迟路径到达输出时，可能产生短暂错误脉冲。",
      concept: "竞争描述信号到达先后不同，冒险描述这种竞争在输出端造成的瞬态错误。静态冒险可借助卡诺图检查相邻项是否被共同覆盖。",
      method: "找出可能同时变化的路径，比较传播延迟，并在卡诺图中为相邻项增加冗余覆盖项。",
      rules: ["组合逻辑中的不同路径通常具有不同传播延迟。", "增加共识项可以消除常见静态冒险。", "同步设计还应确保毛刺不会在有效采样时刻被寄存。"],
      check: "能够识别潜在冒险路径并说明常见的消除方法。"
    },
    {
      match: /组合逻辑设计|组合逻辑/,
      summary: "输出只由当前输入决定，不保存历史状态；设计过程强调从需求到真值表再到电路实现。",
      concept: "组合逻辑没有记忆单元和反馈状态。设计时应先定义输入输出含义，再建立完整逻辑关系。",
      method: "按照“需求分析 → 变量定义 → 真值表 → 表达式 → 化简 → 门级实现 → 验证”的顺序完成设计。",
      rules: ["先处理无关项和非法输入，避免真值表含义不清。", "化简目标应结合实际门电路资源，而不只追求项数最少。", "实现后至少用关键边界输入验证输出。"],
      check: "能够把文字需求转换成真值表、逻辑表达式和可验证的门级电路。"
    }
  ];
  const fallbackLesson = {
    summary: "数字电路中的一个基础知识点，需要从输入、输出、约束条件和典型应用四个方面建立理解。",
    concept: "先明确它解决什么问题，再确认信号的有效电平、时钟条件或状态依赖。",
    method: "把抽象描述转换为真值表、状态表、逻辑表达式或波形图，再用题目中的具体输入验证规则。",
    rules: ["先读清输入、输出和有效条件。", "区分组合逻辑的即时关系与时序逻辑的状态更新。", "使用一个典型输入验证结论是否符合定义。"],
    check: "能够用自己的语言说明定义，并在典型题目中正确应用。"
  };

  const lessonFor = (knowledge) => lessonProfiles.find((profile) => profile.match.test(knowledge)) || fallbackLesson;
  const questionsFor = (knowledge) => (questions || []).filter((question) => (question.knowledge || []).includes(knowledge));
  const typeLabels = { single_choice: "选择题", fill_blank: "填空题", analysis: "分析题" };
  const tabButtons = [...document.querySelectorAll("[data-route-tab]")];
  const tabPanels = [...document.querySelectorAll("[data-route-panel]")];
  let activeRouteTab = "core";
  const activateRouteTab = (tabName) => {
    activeRouteTab = tabName;
    tabButtons.forEach((button) => {
      const active = button.dataset.routeTab === tabName;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });
    tabPanels.forEach((panel) => {
      panel.hidden = panel.dataset.routePanel !== tabName;
    });
  };
  tabButtons.forEach((button) => button.addEventListener("click", () => {
    if (!button.disabled) activateRouteTab(button.dataset.routeTab || "core");
  }));

  function renderLesson() {
    const lesson = lessonFor(selectedFocus);
    const matched = questionsFor(selectedFocus).sort((left, right) => Number(!left.explanation) - Number(!right.explanation)
      || Number(left.type !== "single_choice") - Number(right.type !== "single_choice")
      || (left.difficulty || 0) - (right.difficulty || 0));
    const example = matched[0] || null;
    const selectedProgress = progressByKnowledge.get(selectedFocus);
    document.querySelector("#routeLessonTitle").textContent = selectedFocus;
    document.querySelector("#routeLessonMastery").textContent = selectedProgress
      ? selectedProgress.rate === null
        ? `掌握度 数据不足 · ${selectedProgress.confidence || "数据不足"}`
        : `当前掌握度 ${clampPercent(selectedProgress.rate)}% · ${selectedProgress.confidence || "低置信度"}`
      : "尚未形成练习记录";
    document.querySelector("#routeLessonSummary").textContent = `“${selectedFocus}”${lesson.summary}`;
    document.querySelector("#routeLessonConcept").textContent = lesson.concept;
    document.querySelector("#routeLessonMethod").textContent = lesson.method;
    document.querySelector("#routeLessonRules").innerHTML = lesson.rules.map((rule) => `<li>${escapeHtml(rule)}</li>`).join("");
    document.querySelector("#routeLessonCheck").textContent = lesson.check;
    const selectedKnowledge = knowledgeByName.get(selectedFocus);
    document.querySelector("#routePracticeLink").href = `./self-test.html?knowledge=${encodeURIComponent(selectedFocus)}&scope=${encodeURIComponent(selectedKnowledge?.scope || "all")}`;
    document.querySelector("#routeExampleCountLabel").textContent = matched.length ? `${matched.length} 道可用` : "暂无例题";
    document.querySelector("#routeLessonDuration").textContent = matched.length ? "约 8 分钟" : "约 5 分钟";

    const exampleTab = document.querySelector("#routeExampleTab");
    exampleTab.disabled = !example;
    if (example) {
      document.querySelector("#routeExampleTitle").textContent = example.title || `${selectedFocus}例题`;
      document.querySelector("#routeExampleType").textContent = typeLabels[example.type] || "例题";
      document.querySelector("#routeExampleQuestion").textContent = example.text || "";
      document.querySelector("#routeExampleDiagram").innerHTML = safeDiagramSvg(example.diagramSvg);
      document.querySelector("#routeExampleOptions").innerHTML = example.type === "single_choice"
        ? (example.options || []).map((option, index) => `<div><span>${optionLetter(index)}</span><p>${escapeHtml(option)}</p></div>`).join("")
        : "";
      document.querySelector("#routeExampleAnswer").textContent = `参考答案：${questionAnswerText(example) || "请结合上述规则作答"}`;
      document.querySelector("#routeExampleExplanation").textContent = example.explanation || `先识别“${selectedFocus}”的适用条件，再按关键规则逐步推导。`;
    }
    if (!example && activeRouteTab === "example") activeRouteTab = "core";
    activateRouteTab(activeRouteTab);
  }

  const knowledgeGroups = document.querySelector("#routeKnowledgeGroups");
  const search = document.querySelector("#routeKnowledgeSearch");
  const renderKnowledgeGroups = () => {
    const query = search.value.trim().toLocaleLowerCase("zh-CN");
    const groups = new Map(scopeOrder.map((scope) => [scope, []]));
    [...knowledgeByName.values()].forEach((item) => {
      if (query && !item.name.toLocaleLowerCase("zh-CN").includes(query)) return;
      const progressItem = progressByKnowledge.get(item.name);
      groups.get(scopeOrder.includes(item.scope) ? item.scope : "custom").push({
        ...item,
        rate: progressItem?.rate === null || !progressItem ? null : clampPercent(progressItem.rate),
        confidence: progressItem?.confidence || "数据不足"
      });
    });
    const content = scopeOrder.map((scope) => {
      const items = groups.get(scope).sort((left, right) => Number(left.name !== selectedFocus) - Number(right.name !== selectedFocus)
        || (left.rate ?? 101) - (right.rate ?? 101) || left.name.localeCompare(right.name));
      if (!items.length) return "";
      const ratedItems = items.filter((item) => item.rate !== null);
      const average = ratedItems.length ? Math.round(ratedItems.reduce((sum, item) => sum + item.rate, 0) / ratedItems.length) : null;
      return `<details class="route-knowledge-group" ${items.some((item) => item.name === selectedFocus) || query ? "open" : ""}>
        <summary><span>${escapeHtml(scopeLabels[scope])}</span><span>${average === null ? `${items.length} 个知识点` : `${average}%`}</span></summary>
        <div class="route-knowledge-group-items">${items.map((item) => `<button class="route-knowledge-option${item.name === selectedFocus ? " active" : ""}" type="button" data-knowledge="${escapeHtml(item.name)}"><span>${escapeHtml(item.name)}</span><span>${item.rate === null ? item.confidence : `${item.rate}% · ${item.confidence}`}</span></button>`).join("")}</div>
      </details>`;
    }).join("");
    knowledgeGroups.innerHTML = content || '<div class="route-knowledge-empty">没有找到匹配的知识点</div>';
  };
  renderKnowledgeGroups();
  renderLesson();
  search.addEventListener("input", renderKnowledgeGroups);
  knowledgeGroups.addEventListener("click", (event) => {
    const option = event.target.closest("[data-knowledge]");
    if (!option) return;
    selectedFocus = option.dataset.knowledge || selectedFocus;
    renderKnowledgeGroups();
    renderLesson();
  });
}

async function initWrongPage() {
  const list = document.querySelector("#wrongList");
  const summary = document.querySelector("#wrongDirectorySummary");
  const filters = document.querySelector("#wrongKnowledgeFilters");
  const filteredCount = document.querySelector("#wrongFilteredCount");
  const reviewCount = document.querySelector("#wrongReviewCount");
  const knowledgeCount = document.querySelector("#wrongKnowledgeCount");
  const diagnosis = document.querySelector("#wrongDiagnosis");
  const pathKnowledge = document.querySelector("#wrongPathKnowledge");
  const pathExplanation = document.querySelector("#wrongPathExplanation");
  const variantStatus = document.querySelector("#wrongVariantStatus");
  const knowledgeLesson = document.querySelector("#wrongKnowledgeLesson");
  const variantPreview = document.querySelector("#wrongVariantPreview");
  const variantHint = document.querySelector("#wrongVariantHint");
  const focusAnswerButton = document.querySelector("#wrongFocusAnswerButton");
  const status = pageNotice("wrongStatus");
  let details = [];
  let visibleDetails = [];
  let selectedKnowledge = "all";

  function displayAttemptAnswer(item) {
    const question = item?.question;
    const answer = item?.latestAttempt?.userAnswer;
    if (!question || answer === undefined || answer === null || answer === "") return "暂无历史作答记录";
    if (question.type !== "single_choice") return String(answer);
    const index = /^[A-Z]$/i.test(String(answer))
      ? String(answer).toUpperCase().charCodeAt(0) - 65
      : Number(answer);
    return Number.isInteger(index) && index >= 0 && index < (question.options?.length || 0)
      ? `${optionLetter(index)}. ${question.options?.[index] || ""}`
      : String(answer);
  }

  function diagnosisText(item) {
    const evaluation = item?.latestAttempt?.evaluation;
    if (evaluation?.overallComment) return evaluation.overallComment;
    const knowledge = item?.question?.knowledge || [];
    return knowledge.length
      ? `上次作答未能正确运用“${knowledge.join("、")}”。建议先核对输入条件与输出规则，再重新判断。`
      : "上次作答与参考答案不一致。建议重新梳理解题条件和推理步骤。";
  }

  function renderQuestionContext(item) {
    const question = item?.question;
    if (!question) {
      diagnosis.hidden = true;
      knowledgeLesson.hidden = true;
      variantPreview.hidden = true;
      variantHint.hidden = true;
      focusAnswerButton.disabled = true;
      return;
    }
    diagnosis.hidden = false;
    knowledgeLesson.hidden = false;
    variantPreview.hidden = false;
    variantHint.hidden = false;
    diagnosis.innerHTML = `
      <div class="wrong-diagnosis-heading"><div><span>上次作答对照</span><h3>看清错误，再完成订正</h3></div><span class="wrong-diagnosis-tag">待订正</span></div>
      <div class="wrong-answer-compare">
        <div class="wrong-answer-block is-wrong"><span>你的答案</span><strong>${escapeHtml(displayAttemptAnswer(item))}</strong></div>
        <details class="wrong-answer-block is-correct"><summary>需要时查看参考答案</summary><strong>${escapeHtml(questionAnswerText(question) || "暂无参考答案")}</strong></details>
      </div>
      <div class="wrong-ai-diagnosis"><span>错因提示</span><p>${escapeHtml(diagnosisText(item))}</p></div>
      <button id="wrongConfirmMasteredButton" class="platform-button wrong-confirm-button" type="button">我已掌握，移出错题目录</button>`;
    pathKnowledge.textContent = (question.knowledge || []).join(" · ") || question.title || "数字电路综合知识";
    pathExplanation.textContent = question.explanation || `先回顾“${(question.knowledge || ["本题知识点"]).join("、")}”的核心规则，再回到题目逐项验证。`;
    variantStatus.textContent = "等待本题订正";
    focusAnswerButton.disabled = false;
    diagnosis.querySelector("#wrongConfirmMasteredButton")?.addEventListener("click", async () => {
      const button = diagnosis.querySelector("#wrongConfirmMasteredButton");
      button.disabled = true;
      try {
        await platformApi(`/api/wrong-review/${encodeURIComponent(question.id)}/confirm`, { method: "POST" });
        setPlatformNotice(status, "已按你的确认移出错题目录；历史错题记录会继续保留。", false);
        await load();
      } catch (error) {
        setPlatformNotice(status, `确认失败：${error.message}`, true);
      } finally {
        button.disabled = false;
      }
    });
  }

  const runner = createRunner("wrong", {
    mode: "wrong_review",
    onIndexChange(index, question) {
      list.querySelectorAll("button").forEach((button, buttonIndex) => button.classList.toggle("active", buttonIndex === index));
      renderQuestionContext(visibleDetails.find((item) => item.question?.id === question?.id));
    },
    onAnswered(result, question, _answer, index) {
      if (result.correct) {
        setPlatformNotice(status, "已记录本次订正；错题会继续保留，确认掌握后可手动移出目录。", false);
        return;
      }
      const item = visibleDetails[index];
      if (item) item.wrongAttempts = (Number(item.wrongAttempts) || 0) + 1;
      variantStatus.textContent = "AI 强化已推送";
      renderList();
    }
  });

  function renderFilters() {
    const counts = new Map();
    details.forEach((item) => (item.question?.knowledge || []).forEach((name) => counts.set(name, (counts.get(name) || 0) + 1)));
    const entries = [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
    knowledgeCount.textContent = `${entries.length} 个薄弱知识点`;
    filters.innerHTML = "";
    const frequentEntries = entries.slice(0, 4).map(([name, count]) => [name, name, count]);
    [["all", "全部错题", details.length], ...frequentEntries].forEach(([value, label, count]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = selectedKnowledge === value ? "active" : "";
      button.innerHTML = `<span>${escapeHtml(label)}</span><strong>${count}</strong>`;
      button.addEventListener("click", () => {
        selectedKnowledge = value;
        renderFilters();
        renderList(true);
      });
      filters.append(button);
    });
  }

  function renderList() {
    const resetRunner = arguments[0] === true;
    visibleDetails = selectedKnowledge === "all"
      ? details
      : details.filter((item) => item.question?.knowledge?.includes(selectedKnowledge));
    summary.textContent = details.length ? `待复盘 ${details.length} 题` : "当前错题已经清零";
    reviewCount.textContent = `待复盘 ${details.length} 题`;
    filteredCount.textContent = `${visibleDetails.length} 题`;
    list.innerHTML = "";
    visibleDetails.forEach((item, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.classList.toggle("active", index === runner.index);
      button.innerHTML = `<span class="wrong-attempts">${Math.max(1, Number(item.wrongAttempts) || 1)}</span><span><strong>${escapeHtml(item.question.title)}</strong><small>${escapeHtml((item.question.knowledge || []).join(" · "))}</small><em>${Math.max(1, Number(item.wrongAttempts) || 1)} 次错误</em></span>`;
      button.addEventListener("click", () => runner.select(index));
      list.append(button);
    });
    if (!visibleDetails.length) list.innerHTML = '<div class="wrong-list-empty">这个知识点下没有待复盘题目。</div>';
    if (resetRunner) runner.setQuestions(visibleDetails.map((item) => item.question));
  }
  async function load() {
    details = await platformApi("/api/wrong-review-details");
    const availableKnowledge = new Set(details.flatMap((item) => item.question?.knowledge || []));
    if (selectedKnowledge !== "all" && !availableKnowledge.has(selectedKnowledge)) selectedKnowledge = "all";
    renderFilters();
    renderList();
    runner.setQuestions(visibleDetails.map((item) => item.question));
  }
  focusAnswerButton.addEventListener("click", () => {
    const target = document.querySelector("[data-runner-options] button") || document.querySelector("[data-runner-input]");
    target?.focus({ preventScroll: false });
    document.querySelector(".wrong-desk")?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
  document.querySelector("#wrongRefreshButton").addEventListener("click", async () => {
    try {
      await load();
      setPlatformNotice(status, details.length ? `已刷新，还有 ${details.length} 道待订正题。` : "错题目录已清零。");
    } catch (error) {
      setPlatformNotice(status, `刷新失败：${error.message}`, true);
    }
  });
  await load();
}

async function initSelfTestPage() {
  const status = document.querySelector("#selfTestStatus");
  const paper = document.querySelector("#selfTestPaper");
  const directory = document.querySelector("#paperDirectoryList");
  const savedTaskList = document.querySelector("#savedTaskList");
  const savedTaskCount = document.querySelector("#savedTaskCount");
  const scopeSelect = document.querySelector("#selfTestScope");
  const countSelect = document.querySelector("#selfTestCount");
  const scopeButtons = [...document.querySelectorAll("[data-self-test-scopes] button")];
  const pageParams = new URLSearchParams(location.search);
  const knowledgeFocus = String(pageParams.get("knowledge") || "").trim().slice(0, 80);
  const knowledgeScope = String(pageParams.get("scope") || "all");
  const completed = new Set();
  const scopeLabels = {
    all: "全部知识范围",
    "basic-logic": "基础逻辑",
    combinational: "组合逻辑",
    sequential: "时序逻辑"
  };
  const scopeFallbacks = {
    all: ["基础逻辑", "组合逻辑", "时序逻辑"],
    "basic-logic": ["逻辑门", "逻辑函数", "布尔代数"],
    combinational: ["编码与译码", "数据选择", "算术逻辑"],
    sequential: ["触发器", "寄存器", "计数器"]
  };
  let weakKnowledge = [];
  let questions = [];
  let activeTaskId = "";
  let savedTasks = [];
  if (knowledgeFocus && scopeLabels[knowledgeScope]) {
    scopeSelect.value = knowledgeScope;
    scopeSelect.disabled = true;
    scopeButtons.forEach((button) => { button.disabled = true; });
    document.querySelector(".self-test-panel-heading h3").textContent = `${knowledgeFocus}专项设置`;
    document.querySelector("#selfTestSourceNote").textContent = "本任务只围绕知识复习页选定的知识点生成";
    document.querySelector(".self-test-rationale-list").innerHTML = `<li><span>1</span><div><strong>指定知识点</strong><p>全部题目围绕“${escapeHtml(knowledgeFocus)}”</p></div></li><li><span>2</span><div><strong>AI 动态生成</strong><p>调用大模型生成新的专项练习题</p></div></li><li><span>3</span><div><strong>掌握度更新</strong><p>完成作答后更新该知识点掌握证据</p></div></li>`;
  }
  const runner = createRunner("self-test", {
    mode: "self_test",
    onIndexChange(index) {
      directory.querySelectorAll("button").forEach((button, buttonIndex) => button.classList.toggle("active", buttonIndex === index));
    },
    onAnswered(_result, question) {
      completed.add(question.id);
      renderDirectory();
      loadSavedTasks().catch(() => {});
    }
  });
  function renderDirectory() {
    document.querySelector("#paperProgress").textContent = `${completed.size} / ${questions.length}`;
    directory.innerHTML = "";
    questions.forEach((question, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.classList.toggle("completed", completed.has(question.id));
      button.classList.toggle("active", index === runner.index);
      button.innerHTML = `<strong>${index + 1}</strong><span>${escapeHtml(question.title)}</span>`;
      button.addEventListener("click", () => runner.select(index));
      directory.append(button);
    });
  }
  function openTask(task, { scroll = false } = {}) {
    if (!task) return;
    activeTaskId = task.id;
    questions = Array.isArray(task.questions) ? task.questions : [];
    completed.clear();
    Object.keys(task.answers || {}).forEach((questionId) => completed.add(questionId));
    runner.setQuestions(questions, 0, activeTaskId);
    renderDirectory();
    paper.classList.add("active");
    if (scroll) paper.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function renderSavedTasks() {
    savedTaskCount.textContent = `${savedTasks.length} 份`;
    if (!savedTasks.length) {
      savedTaskList.innerHTML = '<div class="saved-task-empty">还没有保存的学习任务；生成后可在这里随时继续。</div>';
      return;
    }
    savedTaskList.innerHTML = "";
    savedTasks.forEach((task) => {
      const answered = Object.keys(task.answers || {}).length;
      const card = document.createElement("article");
      card.className = "saved-task-card";
      card.innerHTML = `<div class="saved-task-card-head"><strong>${escapeHtml(task.title || "个性化学习任务")}</strong><span class="saved-task-card-status">${task.completedAt ? "已完成" : "进行中"}</span></div><small>${answered} / ${(task.questions || []).length} 题 · ${escapeHtml((task.profile?.focusKnowledge || []).slice(0, 2).join("、") || "综合巩固")}</small><div class="saved-task-card-actions"><button class="platform-button primary" type="button">${task.completedAt ? "查看题单" : "继续任务"}</button><button class="platform-button danger" type="button">删除</button></div>`;
      const [openButton, deleteButton] = card.querySelectorAll("button");
      openButton.addEventListener("click", () => openTask(task, { scroll: true }));
      deleteButton.addEventListener("click", async () => {
        if (!confirm("确定删除这份学习任务吗？删除后不能恢复。")) return;
        await platformApi(`/api/personalized-tasks/${encodeURIComponent(task.id)}`, { method: "DELETE" });
        if (activeTaskId === task.id) {
          activeTaskId = "";
          questions = [];
          completed.clear();
          paper.classList.remove("active");
        }
        await loadSavedTasks();
      });
      savedTaskList.append(card);
    });
  }
  async function loadSavedTasks() {
    savedTasks = await platformApi("/api/personalized-tasks");
    renderSavedTasks();
    return savedTasks;
  }
  function visibleWeakKnowledge() {
    const selectedScope = scopeSelect.value;
    const filtered = selectedScope === "all"
      ? weakKnowledge
      : weakKnowledge.filter((item) => item.scope === selectedScope);
    return filtered.slice(0, 3);
  }
  function renderConfigPreview() {
    const count = Number(countSelect.value) || 5;
    const analysisCount = count >= 2 ? Math.max(1, Math.round(count * .25)) : 0;
    const choiceCount = count - analysisCount;
    const selectedScope = scopeSelect.value;
    const weak = visibleWeakKnowledge();
    const coverage = knowledgeFocus
      ? [{ name: knowledgeFocus, detail: "AI 知识点专项", weight: 1 }]
      : weak.length
      ? weak.map((item) => ({ name: item.name, detail: `${item.wrongCount} 次待巩固`, weight: item.wrongCount }))
      : scopeFallbacks[selectedScope].map((name, index) => ({ name, detail: "基础巩固覆盖", weight: 3 - index }));
    const totalWeight = coverage.reduce((sum, item) => sum + item.weight, 0) || 1;
    const quotas = coverage.map((item, index) => {
      const exact = count * item.weight / totalWeight;
      return { index, count: Math.floor(exact), remainder: exact - Math.floor(exact) };
    });
    let remaining = count - quotas.reduce((sum, item) => sum + item.count, 0);
    [...quotas].sort((left, right) => right.remainder - left.remainder || left.index - right.index)
      .forEach((item) => {
        if (remaining <= 0) return;
        quotas[item.index].count += 1;
        remaining -= 1;
      });
    document.querySelector("#selfTestPreviewScope").textContent = `覆盖${scopeLabels[selectedScope]}`;
    document.querySelector("#selfTestPaperTotal").textContent = `共 ${count} 题`;
    document.querySelector("#selfTestChoiceCount").textContent = `${choiceCount} 题`;
    document.querySelector("#selfTestAnalysisCount").textContent = `${analysisCount} 题`;
    document.querySelector("#selfTestDuration").textContent = `约 ${Math.max(12, Math.round(count * 2.5))} 分钟`;
    document.querySelector("#selfTestCoverageList").innerHTML = coverage.map((item, index) => {
      const quota = quotas[index].count;
      return `<div class="self-test-coverage-item"><span>${String(index + 1).padStart(2, "0")}</span><div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.detail)}</small></div><em>约 ${quota} 题</em></div>`;
    }).join("");
    scopeButtons.forEach((button) => button.classList.toggle("active", button.dataset.value === selectedScope));
  }
  function renderWeakKnowledge() {
    const weak = visibleWeakKnowledge();
    const list = document.querySelector("#selfTestWeakList");
    const summary = document.querySelector("#selfTestWeakSummary");
    const note = document.querySelector("#selfTestSourceNote");
    if (knowledgeFocus) {
      summary.textContent = `专项：${knowledgeFocus}`;
      note.hidden = false;
      note.textContent = "不使用错题优先级，只针对当前知识点生成";
      list.innerHTML = `<div class="self-test-weak-item"><span>${escapeHtml(knowledgeFocus)}</span><strong>专项</strong><div class="self-test-weak-track"><i style="width:100%"></i></div></div>`;
      return;
    }
    if (!weak.length) {
      summary.textContent = "暂无薄弱点记录";
      note.hidden = true;
      list.innerHTML = '<div class="self-test-source-loading">将按所选范围生成基础巩固任务</div>';
      return;
    }
    note.hidden = false;
    const maximum = Math.max(...weak.map((item) => item.wrongCount), 1);
    summary.textContent = `${weak.length} 个重点方向`;
    note.textContent = "来自当前学习账号的未订正错题记录";
    list.innerHTML = weak.map((item) => `<div class="self-test-weak-item"><span>${escapeHtml(item.name)}</span><strong>${item.wrongCount} 次</strong><div class="self-test-weak-track"><i style="width:${Math.max(24, Math.round(item.wrongCount / maximum * 100))}%"></i></div></div>`).join("");
  }
  scopeButtons.forEach((button) => button.addEventListener("click", () => {
    scopeSelect.value = button.dataset.value;
    renderWeakKnowledge();
    renderConfigPreview();
  }));
  scopeSelect.addEventListener("change", () => {
    renderWeakKnowledge();
    renderConfigPreview();
  });
  countSelect.addEventListener("change", renderConfigPreview);
  try {
    const details = await platformApi("/api/wrong-review-details");
    const counts = new Map();
    details.forEach((item) => (item.question?.knowledge || []).forEach((name) => {
      const key = `${item.question?.scope || "all"}\u0000${name}`;
      const current = counts.get(key) || { name, scope: item.question?.scope || "all", wrongCount: 0 };
      current.wrongCount += Math.max(1, Number(item.wrongAttempts) || 1);
      counts.set(key, current);
    }));
    weakKnowledge = [...counts.values()].sort((left, right) => right.wrongCount - left.wrongCount || left.name.localeCompare(right.name));
  } catch {
    weakKnowledge = [];
  }
  try {
    await loadSavedTasks();
    const requestedTaskId = pageParams.get("task");
    const task = requestedTaskId ? savedTasks.find((item) => item.id === requestedTaskId) : knowledgeFocus ? null : savedTasks.find((item) => !item.completedAt);
    if (task) openTask(task);
  } catch (error) {
    savedTaskList.innerHTML = `<div class="saved-task-empty">任务列表加载失败：${escapeHtml(error.message)}</div>`;
  }
  renderWeakKnowledge();
  renderConfigPreview();
  document.querySelector("#generateSelfTestButton").addEventListener("click", async () => {
    const button = document.querySelector("#generateSelfTestButton");
    button.disabled = true;
    button.innerHTML = knowledgeFocus
      ? `<span>正在生成${escapeHtml(knowledgeFocus)}专项题…</span><small>由大模型动态生成</small>`
      : "<span>正在生成学习任务…</span><small>优先从本地题库匹配薄弱知识点</small>";
    setPlatformNotice(status, knowledgeFocus
      ? `正在调用大模型生成“${knowledgeFocus}”专项练习，请稍候...`
      : "正在根据错题记录、掌握程度和薄弱知识点组合针对性学习任务；仅在题库不足时由 AI 补充。请稍候...");
    try {
      const task = await platformApi("/api/personalized-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: document.querySelector("#selfTestScope").value,
          count: document.querySelector("#selfTestCount").value,
          knowledge: knowledgeFocus || undefined
        })
      });
      await loadSavedTasks();
      openTask(task, { scroll: true });
      setPlatformNotice(status, `${knowledgeFocus ? `“${knowledgeFocus}”专项` : "个性化学习"}任务已保存，共 ${(task.questions || []).length} 题，可随时继续。`);
    } catch (error) {
      const message = /AI Key|未配置|AI_SELF_TEST_UNAVAILABLE/i.test(error.message)
        ? "个性化学习服务尚未配置。请先返回“普通练习”，在右下角“AI 助教 → 设置”中完成配置，再回来生成学习任务。"
        : error.message;
      setPlatformNotice(status, message, true);
    } finally {
      button.disabled = false;
      button.innerHTML = "<span>重新生成学习任务</span>";
    }
  });
}

async function initReviewPage() {
  const status = document.querySelector("#reviewMessage");
  let reportData = null;
  let trendRange = "all";
  let loadPromise = null;
  const metricIcons = {
    answered: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18H6zM9 8h6M9 12h6M9 16h4"/></svg>',
    accuracy: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="m14 10 5-5M16 5h3v3"/></svg>',
    review: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4h8M9 2h6v4H9zM6 4H4v17h16V4h-2M8 11h8M8 15h5"/></svg>',
    streak: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2c1 4-2 5-2 8 0 2 1 3 3 3 3 0 4-3 3-6 3 3 4 6 3 9-1 4-4 6-8 6s-8-3-8-8c0-4 2-7 6-10-1 4 0 6 2 7-1-4 0-7 1-9z"/></svg>'
  };
  function setReviewNotice(message, error = false) {
    status.textContent = message;
    status.className = `report-inline-notice${error ? " error" : ""}`;
  }
  function renderMetric(icon, label, value, note) {
    return `<article class="review-metric"><span class="review-metric-icon">${metricIcons[icon]}</span><div class="review-metric-copy"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(note)}</small></div></article>`;
  }
  function formatAttemptTime(value) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "时间未知";
    return new Intl.DateTimeFormat("zh-CN", {
      month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false
    }).format(date);
  }
  function renderTrend() {
    if (!reportData) return;
    const source = reportData.progress.attempts || [];
    const attempts = trendRange === "recent" ? source.slice(-10) : source;
    const chart = document.querySelector("#reviewTrendChart");
    if (!attempts.length) {
      chart.innerHTML = '<div class="review-chart-empty"><span>完成一次作答后<br>这里会立即出现答题趋势</span></div>';
      return;
    }
    const width = 760;
    const height = 276;
    const left = 42;
    const right = 16;
    const top = 24;
    const bottom = 42;
    const usableWidth = width - left - right;
    const usableHeight = height - top - bottom;
    const points = attempts.map((attempt, index) => {
      const x = attempts.length === 1 ? left + usableWidth / 2 : left + (usableWidth * index / (attempts.length - 1));
      const rate = clampPercent(attempt.rollingAccuracy);
      const y = top + usableHeight * (1 - rate / 100);
      return { x, y, rate, attempt };
    });
    const line = points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
    const area = `M ${points[0].x.toFixed(1)} ${top + usableHeight} ${points.map((point) => `L ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ")} L ${points.at(-1).x.toFixed(1)} ${top + usableHeight} Z`;
    const grid = [0, 25, 50, 75, 100].map((value) => {
      const y = top + usableHeight * (1 - value / 100);
      return `<line class="review-chart-grid" x1="${left}" y1="${y}" x2="${width - right}" y2="${y}"/><text class="review-chart-axis" x="2" y="${y + 3}">${value}</text>`;
    }).join("");
    const labelStep = Math.max(1, Math.ceil(points.length / 8));
    const labels = points.map((point, index) => {
      const showAxis = points.length <= 10 || index === 0 || index === points.length - 1 || index % labelStep === 0;
      const showValue = points.length <= 10 || index === points.length - 1 || index % labelStep === 0;
      const outcome = point.attempt.correct ? "正确" : "错误";
      const title = `第 ${point.attempt.sequence} 次 · ${outcome} · 近 5 题正确率 ${point.rate}%`;
      return `<circle class="review-chart-dot ${point.attempt.correct ? "correct" : "wrong"}" cx="${point.x}" cy="${point.y}" r="4.5"><title>${escapeHtml(title)}</title></circle>${showValue ? `<text class="review-chart-value" x="${point.x}" y="${Math.max(12, point.y - 10)}">${point.rate}%</text>` : ""}${showAxis ? `<text class="review-chart-axis" x="${point.x}" y="${height - 15}" text-anchor="middle">第${point.attempt.sequence}次</text>` : ""}`;
    }).join("");
    chart.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="全部作答的近五题滚动正确率趋势图"><defs><linearGradient id="reviewLineGradient" x1="0" x2="1"><stop stop-color="#22d3ee"/><stop offset="1" stop-color="#6366f1"/></linearGradient><linearGradient id="reviewAreaGradient" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#22d3ee" stop-opacity=".2"/><stop offset="1" stop-color="#22d3ee" stop-opacity="0"/></linearGradient></defs><text class="review-chart-axis" x="2" y="12">正确率(%)</text>${grid}<path class="review-chart-area" d="${area}"/><polyline class="review-chart-line" points="${line}"/>${labels}<text class="review-chart-axis" x="${width - right}" y="${height - 2}" text-anchor="end">作答顺序</text></svg>`;
  }
  function renderRecentAttempts(progress) {
    const attempts = progress.recentAttempts || [];
    const summary = progress.recentSummary || {};
    document.querySelector("#reviewRecentSummary").textContent = attempts.length
      ? `${summary.correct || 0} / ${summary.answered || 0} 正确 · ${summary.accuracy || 0}%`
      : "暂无记录";
    document.querySelector("#reviewRecentList").innerHTML = attempts.length
      ? attempts.map((attempt) => {
        const knowledge = (attempt.knowledge || []).join("、") || "综合知识";
        return `<article class="review-recent-item ${attempt.correct ? "correct" : "wrong"}"><span class="review-recent-result" aria-label="${attempt.correct ? "回答正确" : "回答错误"}">${attempt.correct ? "✓" : "×"}</span><div class="review-recent-copy"><div><strong><b>#${attempt.sequence}</b>${escapeHtml(attempt.questionTitle)}</strong><span>${attempt.correct ? "正确" : "错误"}</span></div><p><span>${escapeHtml(attempt.practiceModeLabel || "普通练习")} · ${escapeHtml(knowledge)}</span><time datetime="${escapeHtml(attempt.answeredAt || "")}">${escapeHtml(formatAttemptTime(attempt.answeredAt))}</time></p></div></article>`;
      }).join("")
      : '<div class="review-recent-empty"><strong>还没有作答记录</strong><span>完成任何一道练习后，本次结果都会出现在这里。</span></div>';
  }
  function renderExperimentReports(reports = []) {
    document.querySelector("#reviewExperimentCount").textContent = `${reports.length} 份`;
    document.querySelector("#reviewExperimentList").innerHTML = reports.length
      ? reports.slice(0, 6).map((report) => {
        const evidence = report.evidenceSummary || {};
        const conclusion = report.conclusion || "已完成实验，尚未填写结论。";
        return `<article class="review-experiment-item"><div class="review-experiment-head"><div><strong>${escapeHtml(report.title || "数字电路实验")}</strong><span>${escapeHtml(formatAttemptTime(report.completedAt))}</span></div><b>${clampPercent(report.coverage)}%</b></div><div class="review-experiment-metrics"><span>覆盖 ${(report.testedCases || []).length} 组</span><span>${Math.max(0, Number(evidence.independent) || 0)} 条独立证据</span><span>预测 ${clampPercent(evidence.score)}%</span><span>${escapeHtml(evidence.confidence || "数据不足")}</span></div><p>${escapeHtml(conclusion)}</p></article>`;
      }).join("")
      : '<div class="review-experiment-empty"><strong>还没有实验报告</strong><span>在实验中心完成预测、仿真和结论后，这里会显示可追溯的学习证据。</span><a href="./labs.html">前往实验中心</a></div>';
  }
  function renderReport(stats, progress, experimentReports = []) {
    reportData = { stats, progress, experimentReports };
    const knowledge = [...(progress.knowledge || [])].sort((left, right) => (left.rate ?? -1) - (right.rate ?? -1));
    const weak = knowledge.filter((item) => item.rate === null || clampPercent(item.rate) < 80);
    const activeTask = progress.tasks?.nextTask || null;
    const recent = progress.recentSummary || { answered: 0, correct: 0, accuracy: 0 };
    document.querySelector("#reviewPeriod").textContent = `数据更新于 ${new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())} · 记录全部作答`;
    document.querySelector("#reviewHeadline").innerHTML = stats.answered
      ? `已记录 <em>${stats.answered}</em> 次作答，最近 ${recent.answered} 次正确率为 ${recent.accuracy}%`
      : experimentReports.length
        ? `已完成 <em>${experimentReports.length}</em> 份实验报告，预测与检查点已计入掌握度证据。`
        : "完成任何一道练习或实验后，这里都会立即记录并反馈学习结果。";
    document.querySelector("#reviewSummary").innerHTML = [
      renderMetric("answered", "作答次数", `${stats.answered || 0} 次`, "包含重复练习与订正"),
      renderMetric("streak", "独立题数", `${stats.uniqueQuestions || 0} 道`, "重复作答不重复计数"),
      renderMetric("accuracy", "总体正确率", stats.answered ? `${stats.correctRate || 0}%` : "暂无数据", "统计全部已记录作答"),
      renderMetric("review", "最近 10 次正确率", recent.answered ? `${recent.accuracy || 0}%` : "暂无数据", recent.answered ? `${recent.correct || 0} / ${recent.answered} 次回答正确` : "完成作答后显示")
    ].join("");
    renderRecentAttempts(progress);
    renderExperimentReports(experimentReports);
    document.querySelector("#reviewWeakCount").textContent = `${weak.length} 项`;
    document.querySelector("#reviewKnowledgeList").innerHTML = weak.length
      ? weak.slice(0, 4).map((item, index) => {
        const rate = item.rate === null ? "数据不足" : `${clampPercent(item.rate)}%`;
        const width = item.rate === null ? 0 : clampPercent(item.rate);
        return `<article class="review-knowledge-row"><div class="review-knowledge-row-head"><span class="review-knowledge-index">${index + 1}</span><span>${escapeHtml(item.knowledge)}</span><strong>${rate}</strong></div><div class="review-progress-track"><i style="width:${width}%"></i></div><small>${escapeHtml(item.status)} · ${escapeHtml(item.confidence || "数据不足")} · ${Math.max(0, Number(item.uniqueQuestions) || 0)} 道独立题</small></article>`;
      }).join("")
      : '<div class="review-knowledge-empty"><strong>暂未形成知识点证据</strong><span>完成独立题后，这里会显示掌握度与可信度。</span></div>';
    const nextFocus = weak[0]?.knowledge || knowledge[0]?.knowledge || "综合基础";
    document.querySelector("#reviewAdvice").innerHTML = `<strong>${activeTask ? "优先完成当前任务" : `下一步建议：${escapeHtml(nextFocus)}`}</strong><p>${activeTask ? `你有一份进行中的任务，已完成 ${activeTask.answered} / ${activeTask.total} 题。` : "先生成一份推荐任务，系统会根据错题记录和掌握证据安排练习。"}</p>`;
    const taskHref = activeTask ? `./self-test.html?task=${encodeURIComponent(activeTask.id)}` : "./self-test.html";
    const taskTitle = activeTask ? "继续今日推荐任务" : "生成今日推荐任务";
    const taskDetail = activeTask ? `${activeTask.answered} / ${activeTask.total} 题待继续` : "根据当前学习记录生成针对性任务";
    document.querySelector("#reviewActions").innerHTML = `<a class="review-action-link primary" href="${taskHref}"><span>1</span><span><strong>${taskTitle}</strong><small>${taskDetail}</small></span><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5"/></svg></a>`;
    renderTrend();
  }
  async function load() {
    if (loadPromise) return loadPromise;
    loadPromise = Promise.all([
      platformApi("/api/stats"), platformApi("/api/progress"), platformApi("/api/experiment-reports")
    ]).then(([stats, progress, experimentReports]) => renderReport(stats, progress, experimentReports));
    try {
      return await loadPromise;
    } finally {
      loadPromise = null;
    }
  }
  const refreshReport = () => load().catch((error) => setReviewNotice(`自动更新失败：${error.message}`, true));
  window.addEventListener("storage", (event) => {
    if (event.key !== "digital-circuit-learning-data-version" || !event.newValue) return;
    try {
      const change = JSON.parse(event.newValue);
      if (change.learnerId !== window.learningPlatform?.learnerId) return;
    } catch {
      return;
    }
    refreshReport();
  });
  window.addEventListener("focus", refreshReport);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refreshReport();
  });
  document.querySelectorAll("[data-review-range]").forEach((button) => button.addEventListener("click", () => {
    trendRange = button.dataset.reviewRange;
    document.querySelectorAll("[data-review-range]").forEach((item) => item.classList.toggle("active", item === button));
    renderTrend();
  }));
  document.querySelector("#reviewRefreshButton").addEventListener("click", async () => {
    const button = document.querySelector("#reviewRefreshButton");
    button.disabled = true;
    try {
      await load();
      setReviewNotice("学习数据已刷新。");
    } catch (error) {
      setReviewNotice(`刷新失败：${error.message}`, true);
    } finally {
      button.disabled = false;
    }
  });
  document.querySelector("#reviewClearButton").addEventListener("click", async () => {
    if (!confirm("确定清空当前浏览器的学习记录吗？")) return;
    try {
      const result = await platformApi("/api/records", { method: "DELETE" });
      await load();
      setReviewNotice(`已清空当前学习者的 ${result.removed || 0} 条记录。`);
    } catch (error) {
      setReviewNotice(`清空失败：${error.message}`, true);
    }
  });
  await load();
}

async function initializeLearningPage() {
  if (!platformApi) return;
  const page = document.body.dataset.learningPage;
  try {
    if (page === "scope") await initScopePage();
    if (page === "route") await initRoutePage();
    if (page === "wrong") await initWrongPage();
    if (page === "self-test") await initSelfTestPage();
    if (page === "review") await initReviewPage();
  } catch (error) {
    const frame = document.querySelector(".platform-page-frame");
    const notice = document.createElement("div");
    notice.className = "platform-notice error";
    notice.textContent = `页面加载失败：${error.message}`;
    frame?.prepend(notice);
  }
}

initializeLearningPage();
