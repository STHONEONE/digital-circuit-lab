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

  const steps = document.querySelector("#routeSteps");
  const stepNotes = {
    1: ["查看近期错题分布", "确认本轮优先知识点"],
    2: ["完成本轮针对练习", "错题自动进入复盘队列"],
    3: ["先查看知识点讲解", "完成独立变式题"],
    4: ["AI 根据错题自动组卷", "检验掌握是否稳定"]
  };
  const renderSteps = () => {
    const routeSteps = plan.steps || [];
    const progressingIndex = routeSteps.findIndex((step) => step.status === "进行中");
    const pendingIndex = routeSteps.findIndex((step) => step.status !== "已完成");
    const activeIndex = progressingIndex >= 0 ? progressingIndex : Math.max(0, pendingIndex);
    steps.innerHTML = routeSteps.map((step, index) => {
      const isDone = step.status === "已完成";
      const isActive = index === activeIndex && !isDone;
      const notes = isActive ? (stepNotes[step.order] || []).map((note) => `<span class="route-step-note">${escapeHtml(note)}</span>`).join("") : "";
      const detail = Number(step.order) === 2 && selectedFocus !== plan.primaryFocus
        ? `围绕“${selectedFocus}”完成本轮针对练习。`
        : step.detail;
      const displayStatus = isActive ? "当前阶段" : step.status === "进行中" ? "待下一步" : step.status;
      return `<article class="route-step ${isDone ? "done" : isActive ? "active" : ""}">
        <span class="route-step-index">${escapeHtml(step.order)}</span>
        <div class="route-step-main"><div class="route-step-copy"><strong>${escapeHtml(step.title)}</strong><p>${escapeHtml(detail)}</p></div><span class="route-step-state">${escapeHtml(displayStatus)}</span></div>
        ${notes ? `<div class="route-step-notes">${notes}</div>` : ""}
      </article>`;
    }).join("");
    const doneCount = routeSteps.filter((step) => step.status === "已完成").length;
    const progressSummary = document.querySelector("#routeProgressSummary");
    if (progressSummary) progressSummary.textContent = `${doneCount} / ${routeSteps.length || 4}`;
    document.querySelector("#routeHeaderProgress").textContent = `${doneCount} / ${routeSteps.length || 4} 阶段完成`;
  };
  renderSteps();

  document.querySelector("#routeEvidenceCopy").textContent = plan.review || "完成一轮练习后，系统会更新路线依据。";
  const focusName = document.querySelector("#routeFocusName");
  const focusCopy = document.querySelector("#routeFocusCopy");
  const knowledgeList = document.querySelector("#routeKnowledgeList");
  const renderFocus = () => {
    const selectedProgress = progressByKnowledge.get(selectedFocus);
    focusName.textContent = selectedFocus;
    focusCopy.textContent = selectedProgress
      ? `当前正确率为 ${clampPercent(selectedProgress.rate)}%。本轮先补齐概念与解题步骤，再进行针对训练。`
      : "该知识点尚未形成稳定记录。本轮将先完成基础诊断，再安排针对训练。";
    const related = [...(progress.knowledge || [])]
      .sort((left, right) => Number(left.knowledge !== selectedFocus) - Number(right.knowledge !== selectedFocus) || left.rate - right.rate)
      .slice(0, 4);
    knowledgeList.innerHTML = related.map((item) => `<div class="route-knowledge-item"><span>${escapeHtml(item.knowledge)}</span><span>${clampPercent(item.rate)}%</span></div>`).join("") || '<div class="platform-empty">暂无知识点记录</div>';
  };

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
        rate: progressItem ? clampPercent(progressItem.rate) : null
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
        <div class="route-knowledge-group-items">${items.map((item) => `<button class="route-knowledge-option${item.name === selectedFocus ? " active" : ""}" type="button" data-knowledge="${escapeHtml(item.name)}"><span>${escapeHtml(item.name)}</span><span>${item.rate === null ? "未练习" : `${item.rate}%`}</span></button>`).join("")}</div>
      </details>`;
    }).join("");
    knowledgeGroups.innerHTML = content || '<div class="route-knowledge-empty">没有找到匹配的知识点</div>';
  };
  renderKnowledgeGroups();
  renderFocus();
  search.addEventListener("input", renderKnowledgeGroups);
  knowledgeGroups.addEventListener("click", (event) => {
    const option = event.target.closest("[data-knowledge]");
    if (!option) return;
    selectedFocus = option.dataset.knowledge || selectedFocus;
    document.querySelector("#routeQuestionCountLabel").textContent = "最多 5 题";
    renderKnowledgeGroups();
    renderFocus();
    renderSteps();
  });

  const runner = createRunner("route", { mode: "targeted" });
  const status = pageNotice("routeStatus");
  document.querySelector("#routeStartButton").addEventListener("click", async () => {
    const button = document.querySelector("#routeStartButton");
    button.disabled = true;
    button.textContent = "正在准备训练…";
    try {
      const questions = await platformApi(`/api/targeted-questions?knowledge=${encodeURIComponent(selectedFocus)}&count=5`);
      const section = document.querySelector("#routePracticeSection");
      section.hidden = false;
      runner.setQuestions(questions);
      document.querySelector("#routeQuestionCountLabel").textContent = `${questions.length} 题`;
      setPlatformNotice(status, `已围绕“${selectedFocus}”准备 ${questions.length} 道针对训练题，作答记录只计入本轮路线。`);
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
    const answerText = questionAnswerText(question) || "暂无参考答案";
    diagnosis.innerHTML = `
      <div class="wrong-diagnosis-heading"><div><span>上次作答对照</span><h3>看清错误，再完成订正</h3></div><span class="wrong-diagnosis-tag">待订正</span></div>
      <div class="wrong-answer-compare">
        <div class="wrong-answer-block is-wrong"><span>你的答案</span><strong>${escapeHtml(displayAttemptAnswer(item))}</strong></div>
        <div class="wrong-answer-block is-correct"><span>正确答案</span><strong>${escapeHtml(answerText)}</strong></div>
      </div>
      <div class="wrong-ai-diagnosis"><span>AI 错因诊断</span><p>${escapeHtml(diagnosisText(item))}</p></div>`;
    pathKnowledge.textContent = (question.knowledge || []).join(" · ") || question.title || "数字电路综合知识";
    pathExplanation.textContent = question.explanation || `先回顾“${(question.knowledge || ["本题知识点"]).join("、")}”的核心规则，再回到题目逐项验证。`;
    variantStatus.textContent = "等待本题订正";
    focusAnswerButton.disabled = false;
  }

  const runner = createRunner("wrong", {
    mode: "wrong_review",
    onIndexChange(index, question) {
      list.querySelectorAll("button").forEach((button, buttonIndex) => button.classList.toggle("active", buttonIndex === index));
      renderQuestionContext(visibleDetails.find((item) => item.question?.id === question?.id));
    },
    onAnswered(result, question, _answer, index) {
      if (result.correct) {
        setPlatformNotice(status, "订正成功，这道题已从待复盘目录移除。即将加载下一题。");
        window.setTimeout(() => load().catch((error) => setPlatformNotice(status, error.message, true)), 1200);
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
  const scopeSelect = document.querySelector("#selfTestScope");
  const countSelect = document.querySelector("#selfTestCount");
  const scopeButtons = [...document.querySelectorAll("[data-self-test-scopes] button")];
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
    const coverage = weak.length
      ? weak.map((item) => ({ name: item.name, detail: `${item.wrongCount} 次待巩固`, weight: item.wrongCount }))
      : scopeFallbacks[selectedScope].map((name, index) => ({ name, detail: "初始诊断覆盖", weight: 3 - index }));
    const totalWeight = coverage.reduce((sum, item) => sum + item.weight, 0) || 1;
    document.querySelector("#selfTestPreviewScope").textContent = `覆盖${scopeLabels[selectedScope]}`;
    document.querySelector("#selfTestPaperTotal").textContent = `共 ${count} 题`;
    document.querySelector("#selfTestChoiceCount").textContent = `${choiceCount} 题`;
    document.querySelector("#selfTestAnalysisCount").textContent = `${analysisCount} 题`;
    document.querySelector("#selfTestDuration").textContent = `约 ${Math.max(12, Math.round(count * 2.5))} 分钟`;
    document.querySelector("#selfTestCoverageList").innerHTML = coverage.map((item, index) => {
      const quota = Math.max(1, Math.round(count * item.weight / totalWeight));
      return `<div class="self-test-coverage-item"><span>${String(index + 1).padStart(2, "0")}</span><div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.detail)}</small></div><em>约 ${quota} 题</em></div>`;
    }).join("");
    scopeButtons.forEach((button) => button.classList.toggle("active", button.dataset.value === selectedScope));
  }
  function renderWeakKnowledge() {
    const weak = visibleWeakKnowledge();
    const list = document.querySelector("#selfTestWeakList");
    const summary = document.querySelector("#selfTestWeakSummary");
    const note = document.querySelector("#selfTestSourceNote");
    if (!weak.length) {
      summary.textContent = "暂无薄弱点记录";
      note.hidden = true;
      list.innerHTML = '<div class="self-test-source-loading">将按所选范围生成初始诊断卷</div>';
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
  renderWeakKnowledge();
  renderConfigPreview();
  document.querySelector("#generateSelfTestButton").addEventListener("click", async () => {
    const button = document.querySelector("#generateSelfTestButton");
    button.disabled = true;
    button.innerHTML = "<span>AI 正在分析并组卷…</span><small>正在匹配薄弱知识点</small>";
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
      button.innerHTML = "<span>重新生成阶段自测</span>";
    }
  });
}

async function initReviewPage() {
  const status = document.querySelector("#reviewMessage");
  let reportData = null;
  let trendRange = "all";
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
  function renderTrend() {
    if (!reportData) return;
    const source = reportData.progress.rounds || [];
    const rounds = trendRange === "recent" ? source.slice(-5) : source;
    const chart = document.querySelector("#reviewTrendChart");
    if (!rounds.length) {
      chart.innerHTML = '<div class="review-chart-empty"><span>完成 5 次作答后<br>这里会出现第一段正确率趋势</span></div>';
      return;
    }
    const width = 520;
    const height = 276;
    const left = 42;
    const right = 12;
    const top = 24;
    const bottom = 46;
    const usableWidth = width - left - right;
    const usableHeight = height - top - bottom;
    const points = rounds.map((round, index) => {
      const x = rounds.length === 1 ? left + usableWidth / 2 : left + (usableWidth * index / (rounds.length - 1));
      const rate = clampPercent(round.correctRate);
      const y = top + usableHeight * (1 - rate / 100);
      return { x, y, rate, round };
    });
    const line = points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
    const area = `M ${points[0].x.toFixed(1)} ${top + usableHeight} ${points.map((point) => `L ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ")} L ${points.at(-1).x.toFixed(1)} ${top + usableHeight} Z`;
    const grid = [0, 25, 50, 75, 100].map((value) => {
      const y = top + usableHeight * (1 - value / 100);
      return `<line class="review-chart-grid" x1="${left}" y1="${y}" x2="${width - right}" y2="${y}"/><text class="review-chart-axis" x="2" y="${y + 3}">${value}</text>`;
    }).join("");
    const labels = points.map((point, index) => {
      const showLabel = rounds.length <= 8 || index === 0 || index === rounds.length - 1 || index % 2 === 0;
      return `<circle class="review-chart-dot" cx="${point.x}" cy="${point.y}" r="4"/><text class="review-chart-value" x="${point.x}" y="${Math.max(12, point.y - 10)}">${point.rate}%</text>${showLabel ? `<text class="review-chart-axis" x="${point.x}" y="${height - 17}" text-anchor="middle">${escapeHtml(point.round.round)}</text>` : ""}`;
    }).join("");
    chart.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="学习轮次正确率趋势图"><defs><linearGradient id="reviewLineGradient" x1="0" x2="1"><stop stop-color="#22d3ee"/><stop offset="1" stop-color="#6366f1"/></linearGradient><linearGradient id="reviewAreaGradient" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#22d3ee" stop-opacity=".2"/><stop offset="1" stop-color="#22d3ee" stop-opacity="0"/></linearGradient></defs>${grid}<path class="review-chart-area" d="${area}"/><polyline class="review-chart-line" points="${line}"/>${labels}</svg>`;
  }
  function renderReport(stats, progress, motivation) {
    reportData = { stats, progress, motivation };
    const knowledge = [...(progress.knowledge || [])].sort((left, right) => left.rate - right.rate);
    const weak = knowledge.filter((item) => clampPercent(item.rate) < 80);
    const improvement = Number(progress.effectiveness?.improvement) || 0;
    const direction = improvement > 0 ? `提升 <em>${improvement}%</em>` : improvement < 0 ? `回落 <em>${Math.abs(improvement)}%</em>` : "保持稳定";
    document.querySelector("#reviewPeriod").textContent = `数据更新于 ${new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())} · 每 5 题形成一个学习轮次`;
    document.querySelector("#reviewHeadline").innerHTML = stats.answered
      ? `已完成 <em>${stats.answered}</em> 题，近期正确率较初始水平${direction}`
      : "完成一轮练习后，系统会为你生成个性化成长摘要。";
    document.querySelector("#reviewSummary").innerHTML = [
      renderMetric("answered", "累计练习", `${stats.answered || 0} 题`, `${(progress.rounds || []).length} 个学习轮次`),
      renderMetric("accuracy", "总体正确率", `${stats.correctRate || 0}%`, `近期 ${progress.effectiveness?.recentRate || 0}%`),
      renderMetric("review", "待复盘", `${progress.unresolvedWrong || 0} 题`, motivation.correctedMistakes ? `已攻克 ${motivation.correctedMistakes} 题` : "订正后自动移出"),
      renderMetric("streak", "连续学习", `${motivation.streakDays || 0} 天`, `当前 Lv.${motivation.level || 1}`)
    ].join("");
    document.querySelector("#reviewWeakCount").textContent = `${weak.length} 项`;
    document.querySelector("#reviewKnowledgeList").innerHTML = weak.length
      ? weak.slice(0, 4).map((item, index) => `<article class="review-knowledge-row"><div class="review-knowledge-row-head"><span class="review-knowledge-index">${index + 1}</span><span>${escapeHtml(item.knowledge)}</span><strong>${clampPercent(item.rate)}%</strong></div><div class="review-progress-track"><i style="width:${clampPercent(item.rate)}%"></i></div><small>${escapeHtml(item.status)} · 已练习 ${Math.max(0, Number(item.attempts) || 0)} 次</small></article>`).join("")
      : '<div class="review-knowledge-empty"><strong>暂未发现明显薄弱点</strong><span>继续练习以积累更完整的知识点数据</span></div>';
    const primaryFocus = weak[0]?.knowledge || knowledge[0]?.knowledge || "综合基础";
    document.querySelector("#reviewAdvice").innerHTML = `<strong>${stats.answered ? `下一步优先：${escapeHtml(primaryFocus)}` : "先完成一轮练习"}</strong><p>${escapeHtml(motivation.message || progress.effectiveness?.conclusion || "继续完成练习，形成更完整的学习轨迹。")}</p>`;
    const chevron = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5"/></svg>';
    document.querySelector("#reviewActions").innerHTML = `
      <a class="review-action-link primary" href="./learning-route.html"><span>1</span><span><strong>巩固薄弱知识点</strong><small>围绕“${escapeHtml(primaryFocus)}”继续训练</small></span>${chevron}</a>
      <a class="review-action-link" href="./wrong-review.html"><span>2</span><span><strong>完成错题复盘</strong><small>${progress.unresolvedWrong || 0} 道题等待订正</small></span>${chevron}</a>
      <a class="review-action-link" href="./self-test.html"><span>3</span><span><strong>进行阶段自测</strong><small>验证本轮学习成果</small></span>${chevron}</a>`;
    renderTrend();
  }
  async function load() {
    const [stats, progress, motivation] = await Promise.all([
      platformApi("/api/stats"), platformApi("/api/progress"), platformApi("/api/motivation")
    ]);
    renderReport(stats, progress, motivation);
  }
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
