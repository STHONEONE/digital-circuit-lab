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
  container.textContent = `${result.message || (result.correct ? "回答正确" : "需要巩固")}\n参考答案：${result.referenceAnswer || ""}\n\n${result.explanation || ""}`;
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

  setQuestions(questions, index = 0) {
    this.questions = Array.isArray(questions) ? questions : [];
    this.index = Math.max(0, Math.min(index, this.questions.length - 1));
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
        body: JSON.stringify({ questionId: question.id, answer: String(answer), practiceMode: this.mode })
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
  const [plan, progress] = await Promise.all([platformApi("/api/learning-plan"), platformApi("/api/progress")]);
  const steps = document.querySelector("#routeSteps");
  steps.innerHTML = (plan.steps || []).map((step) => `<div class="route-step ${step.status === "已完成" ? "done" : step.status === "进行中" ? "active" : ""}"><span class="route-step-index">${escapeHtml(step.order)}</span><div class="route-step-copy"><strong>${escapeHtml(step.title)}</strong><p>${escapeHtml(step.detail)}</p></div><span class="route-step-state">${escapeHtml(step.status)}</span></div>`).join("");
  document.querySelector("#routeFocusName").textContent = plan.primaryFocus || "综合基础";
  document.querySelector("#routeFocusCopy").textContent = plan.review || "完成一轮练习后形成更精确的学习路线。";
  const knowledgeList = document.querySelector("#routeKnowledgeList");
  knowledgeList.innerHTML = (progress.knowledge || []).slice(0, 6).map((item) => `<div class="route-knowledge-item"><span>${escapeHtml(item.knowledge)}</span><span>${clampPercent(item.rate)}%</span></div>`).join("") || '<div class="platform-empty">暂无知识点记录</div>';
  const runner = createRunner("route", { mode: "targeted" });
  const status = pageNotice("routeStatus");
  document.querySelector("#routeStartButton").addEventListener("click", async () => {
    const button = document.querySelector("#routeStartButton");
    button.disabled = true;
    button.textContent = "正在准备训练…";
    try {
      const questions = await platformApi(`/api/targeted-questions?knowledge=${encodeURIComponent(plan.primaryFocus || "")}&count=5`);
      const section = document.querySelector("#routePracticeSection");
      section.hidden = false;
      runner.setQuestions(questions);
      setPlatformNotice(status, `已准备 ${questions.length} 道针对训练题，作答记录只计入本轮路线。`);
      section.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      setPlatformNotice(status, `训练准备失败：${error.message}`, true);
    } finally {
      button.disabled = false;
      button.textContent = "重新生成本轮训练";
    }
  });
}

async function initWrongPage() {
  const list = document.querySelector("#wrongList");
  const summary = document.querySelector("#wrongDirectorySummary");
  const status = pageNotice("wrongStatus");
  let details = [];
  const runner = createRunner("wrong", {
    mode: "wrong_review",
    onIndexChange(index) {
      list.querySelectorAll("button").forEach((button, buttonIndex) => button.classList.toggle("active", buttonIndex === index));
    },
    onAnswered(result, _question, _answer, index) {
      if (result.correct) {
        setPlatformNotice(status, "订正成功，这道题已从待复盘目录移除。即将加载下一题。");
        window.setTimeout(() => load().catch((error) => setPlatformNotice(status, error.message, true)), 1200);
        return;
      }
      if (details[index]) details[index].wrongAttempts = (Number(details[index].wrongAttempts) || 0) + 1;
      renderList();
    }
  });
  function renderList() {
    summary.textContent = details.length ? `还有 ${details.length} 道题需要订正` : "当前错题已经清零";
    list.innerHTML = "";
    details.forEach((item, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.classList.toggle("active", index === runner.index);
      button.innerHTML = `<span class="wrong-attempts">${Math.max(1, Number(item.wrongAttempts) || 1)}</span><span><strong>${escapeHtml(item.question.title)}</strong><small>${escapeHtml((item.question.knowledge || []).join(" · "))}</small></span>`;
      button.addEventListener("click", () => runner.select(index));
      list.append(button);
    });
  }
  async function load() {
    details = await platformApi("/api/wrong-review-details");
    renderList();
    runner.setQuestions(details.map((item) => item.question));
  }
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
  const completed = new Set();
  let questions = [];
  const runner = createRunner("self-test", {
    mode: "self_test",
    onIndexChange(index) {
      directory.querySelectorAll("button").forEach((button, buttonIndex) => button.classList.toggle("active", buttonIndex === index));
    },
    onAnswered(_result, question) {
      completed.add(question.id);
      renderDirectory();
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
  document.querySelector("#generateSelfTestButton").addEventListener("click", async () => {
    const button = document.querySelector("#generateSelfTestButton");
    button.disabled = true;
    button.textContent = "AI 正在组卷…";
    setPlatformNotice(status, "大模型正在分析错题知识点并生成新试卷。请稍候...");
    try {
      questions = await platformApi("/api/self-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: document.querySelector("#selfTestScope").value,
          count: document.querySelector("#selfTestCount").value
        })
      });
      completed.clear();
      runner.setQuestions(questions);
      renderDirectory();
      paper.classList.add("active");
      setPlatformNotice(status, `AI 阶段自测已生成，共 ${questions.length} 题。`);
      paper.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      const message = /AI Key|未配置|AI_SELF_TEST_UNAVAILABLE/i.test(error.message)
        ? "AI 组卷服务尚未配置。请先返回“普通练习”，在右下角“AI 助教 → 设置”中完成配置，再回来生成试卷。"
        : error.message;
      setPlatformNotice(status, message, true);
    } finally {
      button.disabled = false;
      button.textContent = "重新生成 AI 阶段自测";
    }
  });
}

async function initReviewPage() {
  const status = pageNotice("reviewStatus");
  async function load() {
    const [stats, progress, motivation] = await Promise.all([
      platformApi("/api/stats"), platformApi("/api/progress"), platformApi("/api/motivation")
    ]);
    document.querySelector("#reviewSummary").innerHTML = [
      [stats.answered || 0, "累计作答"],
      [`${stats.correctRate || 0}%`, "总体正确率"],
      [`Lv.${motivation.level || 1}`, "当前等级"],
      [motivation.streakDays || 0, "连续学习天数"]
    ].map(([value, label]) => `<div class="review-metric"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`).join("");
    const rounds = document.querySelector("#reviewRoundList");
    rounds.innerHTML = (progress.rounds || []).length
      ? progress.rounds.map((round) => {
        const rate = clampPercent(round.correctRate);
        return `<div class="review-round"><span>${escapeHtml(round.round)}<br>${escapeHtml(round.mode)}</span><div class="review-progress-track"><i style="width:${rate}%"></i></div><strong>${rate}%</strong></div>`;
      }).join("")
      : '<div class="platform-empty">完成 5 次作答后生成第一轮趋势</div>';
    const knowledge = document.querySelector("#reviewKnowledgeList");
    knowledge.innerHTML = (progress.knowledge || []).length
      ? progress.knowledge.slice(0, 10).map((item) => `<div class="review-knowledge-row"><span>${escapeHtml(item.knowledge)}<br><small>${escapeHtml(item.status)} · ${Math.max(0, Number(item.attempts) || 0)} 次</small></span><strong>${clampPercent(item.rate)}%</strong></div>`).join("")
      : '<div class="platform-empty">暂无知识点记录</div>';
    document.querySelector("#reviewMessage").textContent = motivation.message || "继续完成练习，形成更完整的学习轨迹。";
  }
  document.querySelector("#reviewRefreshButton").addEventListener("click", async () => {
    try {
      await load();
      setPlatformNotice(status, "学习数据已刷新。");
    } catch (error) {
      setPlatformNotice(status, `刷新失败：${error.message}`, true);
    }
  });
  document.querySelector("#reviewClearButton").addEventListener("click", async () => {
    if (!confirm("确定清空当前浏览器的学习记录吗？")) return;
    try {
      const result = await platformApi("/api/records", { method: "DELETE" });
      await load();
      setPlatformNotice(status, `已清空当前学习者的 ${result.removed || 0} 条记录。`);
    } catch (error) {
      setPlatformNotice(status, `清空失败：${error.message}`, true);
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
