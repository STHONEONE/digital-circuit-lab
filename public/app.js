let questions = [];
let sources = [];
let currentScope = "all";
let currentSource = "";
let currentIndex = 0;
let selectedOption = null;
let practiceMode = "normal";
let currentFocusKnowledge = "";
let lastChatQuestionId = "";
let tutorConversation = [];
let activePracticeModule = "normal";
const completedSelfTestQuestions = new Set();
const correctedReviewQuestions = new Set();
const wrongReviewAttempts = new Map();
const scopePanelStorageKey = "learning-scope-panel-collapsed";

const modeLabels = {
  normal: "普通练习",
  targeted: "针对训练",
  wrong_review: "错题复盘",
  self_test: "智能组卷"
};

const els = {
  refreshButton: document.querySelector("#refreshButton"),
  shutdownButton: document.querySelector("#shutdownButton"),
  systemNotice: document.querySelector("#systemNotice"),
  scopePanel: document.querySelector("#scopePanel"),
  scopePanelBody: document.querySelector("#scopePanelBody"),
  scopeToggleButton: document.querySelector("#scopeToggleButton"),
  fileInput: document.querySelector("#fileInput"),
  fileName: document.querySelector("#fileName"),
  importButton: document.querySelector("#importButton"),
  clearImportButton: document.querySelector("#clearImportButton"),
  importStatus: document.querySelector("#importStatus"),
  sourceList: document.querySelector("#sourceList"),
  chapter: document.querySelector("#chapter"),
  title: document.querySelector("#title"),
  meta: document.querySelector("#meta"),
  questionPickerPanel: document.querySelector("#questionPickerPanel"),
  knowledge: document.querySelector("#knowledge"),
  questionText: document.querySelector("#questionText"),
  questionDiagram: document.querySelector("#questionDiagram"),
  options: document.querySelector("#options"),
  answerInput: document.querySelector("#answerInput"),
  prevButton: document.querySelector("#prevButton"),
  submitButton: document.querySelector("#submitButton"),
  nextButton: document.querySelector("#nextButton"),
  feedback: document.querySelector("#feedback"),
  aiKeyInput: document.querySelector("#aiKeyInput"),
  baseUrlInput: document.querySelector("#baseUrlInput"),
  modelInput: document.querySelector("#modelInput"),
  saveAiButton: document.querySelector("#saveAiButton"),
  aiConfigStatus: document.querySelector("#aiConfigStatus"),
  explainButton: document.querySelector("#explainButton"),
  variantButton: document.querySelector("#variantButton"),
  aiOutput: document.querySelector("#aiOutput"),
  followupInput: document.querySelector("#followupInput"),
  followupButton: document.querySelector("#followupButton"),
  aiChatLauncher: document.querySelector("#aiChatLauncher"),
  aiChatPanel: document.querySelector("#aiChatPanel"),
  closeChatButton: document.querySelector("#closeChatButton"),
  toggleAiConfigButton: document.querySelector("#toggleAiConfigButton"),
  aiConfigDrawer: document.querySelector("#aiConfigDrawer"),
  chatStatus: document.querySelector("#chatStatus"),
  recommendations: document.querySelector("#recommendations"),
  rightPanelTitle: document.querySelector("#rightPanelTitle"),
  rightPanelSubtitle: document.querySelector("#rightPanelSubtitle"),
  rightPanelBadge: document.querySelector("#rightPanelBadge"),
  answered: document.querySelector("#answered"),
  rate: document.querySelector("#rate"),
  weakness: document.querySelector("#weakness"),
  clearRecordsButton: document.querySelector("#clearRecordsButton"),
  planButton: document.querySelector("#planButton"),
  wrongReviewButton: document.querySelector("#wrongReviewButton"),
  targetedButton: document.querySelector("#targetedButton"),
  normalPracticeButton: document.querySelector("#normalPracticeButton"),
  selfTestButton: document.querySelector("#selfTestButton"),
  paperCount: document.querySelector("#paperCount"),
  practiceModeStatus: document.querySelector("#practiceModeStatus"),
  planFocus: document.querySelector("#planFocus"),
  learningPlan: document.querySelector("#learningPlan"),
  routeReview: document.querySelector("#routeReview"),
  level: document.querySelector("#level"),
  points: document.querySelector("#points"),
  streak: document.querySelector("#streak"),
  motivationMessage: document.querySelector("#motivationMessage"),
  badges: document.querySelector("#badges"),
  trajectory: document.querySelector("#trajectory"),
  effectiveness: document.querySelector("#effectiveness"),
  knowledgeProgress: document.querySelector("#knowledgeProgress"),
  coreCenter: document.querySelector(".core-center")
};

async function loadAll() {
  showSystemNotice("正在加载题库和学习数据…");
  try {
    await Promise.all([loadQuestions(), loadSources(), loadDashboard(), loadAiConfig()]);
    renderSources();
    setActivePracticeModule(activePracticeModule);
    renderQuestion();
    showSystemNotice("学习数据已加载，个性化学习功能可以使用。", "ok", true);
  } catch (error) {
    showSystemNotice(`初始化失败：${error.message}。请刷新页面；若仍失败，请确认正在运行最新 jar。`, "error");
    showFeedback(false, error.message);
  }
}

function setActivePracticeModule(module, pending = false) {
  activePracticeModule = module;
  document.querySelectorAll(".practice-mode-button").forEach((button) => {
    const active = button.dataset.practiceModule === module;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  if (module === "self_test" && pending) {
    els.rightPanelTitle.textContent = "正在智能组卷";
    els.rightPanelSubtitle.textContent = "正在结合当前范围和薄弱知识点选择题目";
    els.rightPanelBadge.textContent = "生成中";
    els.recommendations.className = "review-directory paper-directory";
    els.recommendations.innerHTML = '<div class="review-directory-empty pending">试卷生成后，这里会显示可点击的题目目录。</div>';
  }
}

function setScopePanelCollapsed(collapsed) {
  if (!els.scopePanel || !els.scopePanelBody || !els.scopeToggleButton) return;
  els.scopePanel.classList.toggle("is-collapsed", collapsed);
  els.scopePanelBody.setAttribute("aria-hidden", String(collapsed));
  els.scopeToggleButton.setAttribute("aria-expanded", String(!collapsed));
  els.scopeToggleButton.textContent = collapsed ? "展开" : "收起";
  localStorage.setItem(scopePanelStorageKey, collapsed ? "1" : "0");
}

function setupScopePanelToggle() {
  if (!els.scopePanel || !els.scopeToggleButton) return;
  const collapsed = localStorage.getItem(scopePanelStorageKey) === "1";
  setScopePanelCollapsed(collapsed);
  els.scopeToggleButton.addEventListener("click", () => {
    setScopePanelCollapsed(!els.scopePanel.classList.contains("is-collapsed"));
  });
}

function showSystemNotice(message, type = "", autoHide = false) {
  els.systemNotice.hidden = false;
  els.systemNotice.className = `system-notice ${type}`.trim();
  els.systemNotice.textContent = message;
  if (autoHide) {
    window.clearTimeout(showSystemNotice.timer);
    showSystemNotice.timer = window.setTimeout(() => {
      els.systemNotice.hidden = true;
    }, 2600);
  }
}

function shuffled(list) {
  const result = [...list];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

async function runAction(button, action, pendingText) {
  const originalText = button?.textContent;
  if (button) {
    button.disabled = true;
    if (pendingText) button.textContent = pendingText;
  }
  try {
    await action();
  } catch (error) {
    showSystemNotice(`操作失败：${error.message}`, "error");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
}

async function loadQuestions() {
  const params = new URLSearchParams();
  if (currentScope !== "all") params.set("scope", currentScope);
  if (currentSource) params.set("source", currentSource);
  const loadedQuestions = await fetchJson(`/api/questions?${params.toString()}`);
  questions = practiceMode === "normal" && currentScope === "all" && !currentSource
    ? shuffled(loadedQuestions)
    : loadedQuestions;
  currentIndex = Math.min(currentIndex, Math.max(0, questions.length - 1));
}

async function loadSources() {
  sources = await fetchJson("/api/sources");
}

async function loadDashboard() {
  const [stats, plan, progress, motivation] = await Promise.all([
    fetchJson("/api/stats"),
    fetchJson("/api/learning-plan"),
    fetchJson("/api/progress"),
    fetchJson("/api/motivation")
  ]);
  renderStats(stats);
  renderLearningPlan(plan);
  renderProgress(progress);
  renderMotivation(motivation);
  return plan;
}

function renderStats(stats) {
  els.answered.textContent = stats.answered || 0;
  els.rate.textContent = `${stats.correctRate || 0}%`;
  const wrong = stats.wrongKnowledge || {};
  const lines = Object.entries(wrong)
    .sort((left, right) => right[1] - left[1])
    .map(([name, count]) => `${name}: ${count} 次`);
  els.weakness.textContent = lines.length ? lines.join("\n") : "暂无错题数据";
}

function renderLearningPlan(plan) {
  currentFocusKnowledge = plan.primaryFocus || "";
  els.planFocus.textContent = currentFocusKnowledge || "综合基础";
  els.routeReview.textContent = plan.review || "完成练习后生成路线复盘。";
  els.learningPlan.innerHTML = "";

  (plan.steps || []).forEach((step) => {
    const item = document.createElement("div");
    item.className = `plan-step ${step.status === "已完成" ? "done" : step.status === "进行中" ? "active" : ""}`;

    const order = document.createElement("span");
    order.className = "plan-order";
    order.textContent = step.order;

    const copy = document.createElement("div");
    copy.className = "plan-copy";
    const title = document.createElement("strong");
    title.textContent = step.title;
    const detail = document.createElement("small");
    detail.textContent = step.detail;
    copy.append(title, detail);

    const state = document.createElement("span");
    state.className = "plan-state";
    state.textContent = step.status;
    item.append(order, copy, state);
    els.learningPlan.append(item);
  });
}

function renderProgress(progress) {
  const rounds = progress.rounds || [];
  els.trajectory.innerHTML = "";
  els.trajectory.classList.toggle("empty", rounds.length === 0);
  if (!rounds.length) {
    els.trajectory.innerHTML = '<div class="trajectory-empty-title">暂无学习轮次</div><small>完成 5 次答题后，这里会显示每轮正确率变化。</small>';
  } else {
    rounds.forEach((round) => {
      const item = document.createElement("div");
      item.className = "trajectory-item";
      item.title = `${round.mode}，${round.answered} 次作答，正确率 ${round.correctRate}%`;

      const bar = document.createElement("div");
      bar.className = "trajectory-bar";
      bar.style.height = `${Math.max(4, round.correctRate)}%`;
      const roundName = document.createElement("span");
      roundName.className = "trajectory-round";
      roundName.textContent = round.round;
      const rate = document.createElement("strong");
      rate.textContent = `${round.correctRate}%`;
      const label = document.createElement("small");
      label.textContent = `${round.answered}题 / ${round.mode}`;
      item.append(bar, roundName, rate, label);
      els.trajectory.append(item);
    });
  }

  const effect = progress.effectiveness || {};
  const sign = (effect.improvement || 0) > 0 ? "+" : "";
  const targetedText = (effect.personalizedAttempts || 0) > 0
    ? `，针对训练正确率 ${effect.personalizedRate || 0}%`
    : "";
  els.effectiveness.textContent = `${effect.conclusion || "完成更多练习后，系统会判断个性化训练是否有效。"} 初始正确率 ${effect.baselineRate || 0}%，最近正确率 ${effect.recentRate || 0}%，变化 ${sign}${effect.improvement || 0}%${targetedText}`;

  els.knowledgeProgress.innerHTML = "";
  const knowledge = (progress.knowledge || []).slice(0, 6);
  const coreProgress = knowledge.length
    ? Math.round(knowledge.reduce((sum, item) => sum + (item.rate || 0), 0) / knowledge.length)
    : 0;
  if (els.coreCenter) els.coreCenter.textContent = `${coreProgress}%`;
  if (!knowledge.length) {
    els.knowledgeProgress.textContent = "完成答题后显示各知识点掌握度。";
  }
  knowledge.forEach((item) => {
    const row = document.createElement("div");
    row.className = "knowledge-row";
    row.title = `${item.knowledge}：${item.attempts} 次作答，${item.status}`;

    const name = document.createElement("span");
    name.textContent = item.knowledge;
    const track = document.createElement("span");
    track.className = "progress-track";
    const fill = document.createElement("i");
    fill.style.width = `${item.rate}%`;
    track.append(fill);
    const rate = document.createElement("strong");
    rate.textContent = `${item.rate}%`;
    row.append(name, track, rate);
    els.knowledgeProgress.append(row);
  });
}
function renderMotivation(motivation) {
  els.level.innerHTML = `<small>当前等级</small><strong>Lv.${motivation.level || 1}</strong>`;
  els.points.textContent = motivation.points || 0;
  els.streak.textContent = motivation.streakDays || 0;
  els.motivationMessage.textContent = motivation.message || "完成练习后，这里会说明当前学习状态和下一步建议。";
  els.badges.innerHTML = "";
  (motivation.badges || []).forEach((badge) => {
    const item = document.createElement("span");
    item.textContent = badge;
    els.badges.append(item);
  });
}
async function loadAiConfig() {
  const config = await fetchJson("/api/ai-config");
  els.baseUrlInput.value = config.baseUrl || "https://dashscope.aliyuncs.com/compatible-mode/v1";
  els.modelInput.value = config.model || "qwen-plus";
  els.aiConfigStatus.textContent = config.configured
    ? `AI 已配置：${els.modelInput.value}`
    : "未配置 AI Key，讲解会使用本地兜底。";
}

async function saveAiConfig() {
  const payload = {
    apiKey: els.aiKeyInput.value.trim(),
    baseUrl: els.baseUrlInput.value.trim(),
    model: els.modelInput.value.trim()
  };
  if (!payload.apiKey) {
    els.aiConfigStatus.textContent = "请先填写百炼 API Key。";
    return;
  }
  const config = await fetchJson("/api/ai-config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  els.aiKeyInput.value = "";
  els.aiConfigStatus.textContent = config.configured ? "AI 配置已保存，可以开始讲解。" : "AI 配置未生效。";
}

function renderSources() {
  els.sourceList.innerHTML = "";
  const all = document.createElement("button");
  all.type = "button";
  all.textContent = "平台题库";
  all.className = currentSource ? "" : "active";
  all.addEventListener("click", async () => {
    currentSource = "";
    await returnToNormalPractice();
  });
  els.sourceList.append(all);

  sources.forEach((source) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `导入：${source}`;
    button.className = currentSource === source ? "active" : "";
    button.addEventListener("click", async () => {
      currentSource = source;
      await returnToNormalPractice();
    });
    els.sourceList.append(button);
  });
}

function currentQuestion() {
  return questions[currentIndex];
}

function trustedSvg(svg) {
  const value = String(svg || "").trim();
  return /^<svg[\s>]/i.test(value) && !/<script|on\w+=|javascript:/i.test(value) ? value : "";
}

function renderSvg(target, svg, caption = "") {
  if (!target) return;
  const safeSvg = trustedSvg(svg);
  target.innerHTML = "";
  target.hidden = !safeSvg;
  if (!safeSvg) return;

  const figure = document.createElement("figure");
  figure.className = "svg-figure";
  const image = document.createElement("div");
  image.className = "svg-figure__image";
  image.innerHTML = safeSvg;
  figure.append(image);

  if (caption) {
    const figcaption = document.createElement("figcaption");
    figcaption.textContent = caption;
    figure.append(figcaption);
  }
  target.append(figure);
}

function renderQuestion() {
  const question = currentQuestion();
  selectedOption = null;
  els.feedback.textContent = "";
  els.feedback.className = "feedback";
  const hasQuestions = questions.length > 0;
  if (els.prevButton) els.prevButton.disabled = !hasQuestions;
  if (els.nextButton) els.nextButton.disabled = !hasQuestions;

  if (!question) {
    renderSvg(els.questionDiagram, "");
    els.chapter.textContent = "暂无";
    els.title.textContent = "暂无题目";
    els.meta.textContent = "0 / 0";
    renderQuestionPicker();
    els.questionText.textContent = practiceMode === "wrong_review"
      ? "当前没有待复盘错题，继续保持。"
      : "请导入题库，或切换练习范围。";
    els.knowledge.innerHTML = "";
    els.options.innerHTML = "";
    els.answerInput.style.display = "none";
    renderRightPanel();
    updateChatQuestion(null);
    return;
  }

  els.chapter.textContent = `${question.chapter || "数字电路"} · ${modeLabels[practiceMode]}`;
  els.title.textContent = question.title || "未命名题目";
  els.meta.textContent = `${currentIndex + 1} / ${questions.length} · 难度 ${question.difficulty || 2}`;
  renderQuestionPicker();
  els.questionText.textContent = question.text;
  renderSvg(els.questionDiagram, question.diagramSvg, "题目示意");
  els.knowledge.innerHTML = "";
  (question.knowledge || []).forEach((item) => {
    const tag = document.createElement("span");
    tag.textContent = item;
    els.knowledge.append(tag);
  });

  els.options.innerHTML = "";
  const isChoice = question.type === "single_choice";
  els.answerInput.style.display = isChoice ? "none" : "block";
  els.answerInput.value = "";

  if (isChoice) {
    (question.options || []).forEach((option, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.innerHTML = `<strong>${String.fromCharCode(65 + index)}</strong><span>${escapeHtml(option)}</span>`;
      button.addEventListener("click", () => {
        selectedOption = index;
        [...els.options.children].forEach((item, itemIndex) => {
          item.classList.toggle("selected", itemIndex === index);
        });
      });
      els.options.append(button);
    });
  }
  renderRightPanel();
  updateChatQuestion(question);
}

function renderQuestionPicker() {
  if (!els.questionPickerPanel) return;
  els.questionPickerPanel.innerHTML = "";
  questions.forEach((_question, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "question-number-button";
    button.classList.toggle("current", index === currentIndex);
    button.textContent = index + 1;
    button.setAttribute("aria-label", `第 ${index + 1} 题`);
    button.addEventListener("click", () => {
      currentIndex = index;
      els.questionPickerPanel.hidden = true;
      els.meta?.setAttribute("aria-expanded", "false");
      renderQuestion();
    });
    els.questionPickerPanel.append(button);
  });
}

function moveQuestion(step) {
  if (!questions.length) return;
  currentIndex = (currentIndex + step + questions.length) % questions.length;
  renderQuestion();
}

async function submitAnswer() {
  const question = currentQuestion();
  if (!question) return;

  const isChoice = question.type === "single_choice";
  const answer = isChoice ? String(selectedOption ?? "") : els.answerInput.value.trim();
  if (!answer) {
    showFeedback(false, "请先作答。");
    return;
  }

  const result = await fetchJson("/api/answers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      questionId: question.id,
      answer,
      practiceMode,
      focusKnowledge: currentFocusKnowledge
    })
  });
  const text = `${result.message}\n参考答案：${result.referenceAnswer || ""}\n\n${result.explanation || ""}`;
  showFeedback(result.correct, text, question.explanationSvg);
  if (activePracticeModule === "self_test") {
    completedSelfTestQuestions.add(question.id);
    renderSelfTestDirectory();
  }
  if (activePracticeModule === "wrong_review" && result.correct) {
    correctedReviewQuestions.add(question.id);
    renderWrongReviewDirectory();
  } else if (activePracticeModule === "wrong_review") {
    wrongReviewAttempts.set(question.id, (wrongReviewAttempts.get(question.id) || 0) + 1);
    renderWrongReviewDirectory();
  }
  els.practiceModeStatus.textContent = `当前：${modeLabels[practiceMode]} · 已完成第 ${currentIndex + 1} 题`;
  await Promise.all([loadDashboard(), ["wrong_review", "self_test"].includes(activePracticeModule)
    ? Promise.resolve()
    : loadRecommendations()]);
}

function showFeedback(ok, text, svg = "") {
  els.feedback.className = `feedback ${ok ? "ok" : "bad"}`;
  els.feedback.textContent = text;
  const safeSvg = trustedSvg(svg);
  if (safeSvg) {
    const diagram = document.createElement("div");
    diagram.className = "answer-diagram";
    renderSvg(diagram, safeSvg, "答案解析图");
    els.feedback.append(diagram);
  }
}

async function loadRecommendations() {
  if (activePracticeModule === "wrong_review") {
    renderWrongReviewDirectory();
    return;
  }
  if (activePracticeModule === "self_test") {
    renderSelfTestDirectory();
    return;
  }
  const question = currentQuestion();
  setRecommendationHeading();
  els.recommendations.className = "recommendations";
  els.recommendations.innerHTML = "";
  if (!question) return;
  const list = await fetchJson(`/api/recommendations?questionId=${encodeURIComponent(question.id)}`);
  list.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `${item.title} · ${(item.knowledge || []).join("/")}`;
    button.addEventListener("click", () => {
      let index = questions.findIndex((questionItem) => questionItem.id === item.id);
      if (index < 0) {
        questions.push(item);
        index = questions.length - 1;
      }
      currentIndex = index;
      renderQuestion();
    });
    els.recommendations.append(button);
  });
}

function setRecommendationHeading() {
  els.rightPanelTitle.textContent = "同类推荐";
  els.rightPanelSubtitle.textContent = "结合当前题目与薄弱知识点";
  els.rightPanelBadge.textContent = "推荐";
}

function renderRightPanel() {
  if (activePracticeModule === "wrong_review") {
    renderWrongReviewDirectory();
  } else if (activePracticeModule === "self_test") {
    renderSelfTestDirectory();
  } else {
    loadRecommendations();
  }
}

function renderSelfTestDirectory() {
  const completedCount = questions.filter((question) => completedSelfTestQuestions.has(question.id)).length;
  els.rightPanelTitle.textContent = "试卷目录";
  els.rightPanelSubtitle.textContent = questions.length
    ? `本次组卷进度：已完成 ${completedCount} / ${questions.length}`
    : "当前范围没有可用于组卷的题目";
  els.rightPanelBadge.textContent = questions.length ? `${completedCount}/${questions.length}` : "空试卷";
  els.recommendations.innerHTML = "";
  els.recommendations.className = "review-directory paper-directory";

  if (!questions.length) {
    const empty = document.createElement("div");
    empty.className = "review-directory-empty";
    empty.textContent = "请调整练习范围或导入更多题目后重新组卷。";
    els.recommendations.append(empty);
    return;
  }

  questions.forEach((question, index) => {
    const completed = completedSelfTestQuestions.has(question.id);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "review-directory-item paper-directory-item";
    button.classList.toggle("current", index === currentIndex);
    button.classList.toggle("completed", completed);
    button.setAttribute("aria-current", index === currentIndex ? "true" : "false");
    button.title = question.text || question.title;

    const number = document.createElement("span");
    number.className = "review-directory-number";
    number.textContent = completed ? "✓" : index + 1;

    const copy = document.createElement("span");
    copy.className = "review-directory-copy";
    const title = document.createElement("strong");
    title.textContent = question.title || `第 ${index + 1} 题`;
    const knowledge = document.createElement("small");
    knowledge.textContent = (question.knowledge || []).join(" / ") || "综合知识点";
    const meta = document.createElement("span");
    meta.className = "review-directory-meta";
    const difficulty = document.createElement("span");
    difficulty.textContent = `难度 ${question.difficulty || 2}`;
    const status = document.createElement("span");
    status.textContent = completed ? "已完成" : "未作答";
    meta.append(difficulty, status);
    copy.append(title, knowledge, meta);
    button.append(number, copy);
    button.addEventListener("click", () => {
      currentIndex = index;
      renderQuestion();
      document.querySelector(".practice")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    els.recommendations.append(button);
  });
}

function renderWrongReviewDirectory() {
  const correctedCount = questions.filter((question) => correctedReviewQuestions.has(question.id)).length;
  els.rightPanelTitle.textContent = "错题目录";
  els.rightPanelSubtitle.textContent = questions.length
    ? `本轮复盘进度：已订正 ${correctedCount} / ${questions.length}`
    : "当前没有待复盘错题";
  els.rightPanelBadge.textContent = questions.length ? `${correctedCount}/${questions.length}` : "完成";
  els.recommendations.innerHTML = "";
  els.recommendations.className = "review-directory";

  if (!questions.length) {
    const empty = document.createElement("div");
    empty.className = "review-directory-empty";
    empty.textContent = "当前错题已经全部订正，可以继续阶段自测。";
    els.recommendations.append(empty);
    return;
  }

  questions.forEach((question, index) => {
    const corrected = correctedReviewQuestions.has(question.id);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "review-directory-item";
    button.classList.toggle("current", index === currentIndex);
    button.classList.toggle("corrected", corrected);

    const number = document.createElement("span");
    number.className = "review-directory-number";
    number.textContent = corrected ? "✓" : index + 1;

    const copy = document.createElement("span");
    copy.className = "review-directory-copy";
    const title = document.createElement("strong");
    title.textContent = question.title || `错题 ${index + 1}`;
    const knowledge = document.createElement("small");
    knowledge.textContent = (question.knowledge || []).join(" / ") || "综合知识点";
    const meta = document.createElement("span");
    meta.className = "review-directory-meta";
    const attempts = document.createElement("span");
    attempts.textContent = `累计错 ${wrongReviewAttempts.get(question.id) || 1} 次`;
    const status = document.createElement("span");
    status.textContent = corrected ? "已订正" : "待复盘";
    meta.append(attempts, status);
    copy.append(title, knowledge, meta);
    button.append(number, copy);
    button.addEventListener("click", () => {
      currentIndex = index;
      renderQuestion();
      document.querySelector(".practice")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    els.recommendations.append(button);
  });
}

async function setPracticeSet(url, mode, status, focus = "") {
  const list = await fetchJson(url);
  questions = list;
  currentIndex = 0;
  practiceMode = mode;
  if (focus) currentFocusKnowledge = focus;
  els.practiceModeStatus.textContent = `${status} · 共 ${list.length} 题`;
  renderQuestion();
  showSystemNotice(list.length
    ? `${status}已生成，可以从第 1 题开始作答。`
    : `${status}暂无题目。`, list.length ? "ok" : "");
}

async function startPersonalizedRoute() {
  setActivePracticeModule("route");
  const plan = await loadDashboard();
  const focus = plan.primaryFocus || "";
  await setPracticeSet(
    `/api/targeted-questions?knowledge=${encodeURIComponent(focus)}&count=5`,
    "targeted",
    `推荐路线第 2 步：针对训练（${focus || "综合基础"}）`,
    focus
  );
}

async function composeSelfTest() {
  setActivePracticeModule("self_test", true);
  completedSelfTestQuestions.clear();
  const count = els.paperCount.value;
  const params = new URLSearchParams({ count });
  if (currentScope !== "all") params.set("scope", currentScope);
  try {
    await setPracticeSet(`/api/self-test?${params.toString()}`, "self_test", "智能组卷自测");
  } catch (error) {
    els.rightPanelTitle.textContent = "组卷失败";
    els.rightPanelSubtitle.textContent = "请检查题库后重试";
    els.rightPanelBadge.textContent = "失败";
    els.recommendations.className = "review-directory paper-directory";
    els.recommendations.innerHTML = `<div class="review-directory-empty error">${escapeHtml(error.message)}</div>`;
    throw error;
  }
}

async function startWrongReview() {
  setActivePracticeModule("wrong_review");
  correctedReviewQuestions.clear();
  wrongReviewAttempts.clear();
  const details = await fetchJson("/api/wrong-review-details");
  details.forEach((item) => {
    if (item.question?.id) {
      wrongReviewAttempts.set(item.question.id, item.wrongAttempts || 1);
    }
  });
  questions = details.map((item) => item.question).filter(Boolean);
  currentIndex = 0;
  practiceMode = "wrong_review";
  els.practiceModeStatus.textContent = `错题复盘 · 共 ${questions.length} 题`;
  renderQuestion();
  showSystemNotice(questions.length
    ? `已加载 ${questions.length} 道待复盘错题。`
    : "当前没有待复盘错题。", questions.length ? "ok" : "");
}

async function startTargetedPractice() {
  setActivePracticeModule("targeted");
  const plan = await loadDashboard();
  const focus = plan.primaryFocus || "";
  await setPracticeSet(
    `/api/targeted-questions?knowledge=${encodeURIComponent(focus)}&count=5`,
    "targeted",
    `针对性出题（${focus || "综合基础"}）`,
    focus
  );
}

async function returnToNormalPractice() {
  setActivePracticeModule("normal");
  practiceMode = "normal";
  currentIndex = 0;
  await loadQuestions();
  els.practiceModeStatus.textContent = "当前：普通练习";
  renderSources();
  renderQuestion();
  showSystemNotice(`已返回普通练习，共 ${questions.length} 题。`, "ok", true);
}

function openChat() {
  els.aiChatPanel.hidden = false;
  els.aiChatLauncher.hidden = true;
  window.setTimeout(() => {
    restoreChatPosition();
    els.followupInput.focus();
  }, 0);
}

function closeChat() {
  els.aiChatPanel.hidden = true;
  els.aiChatLauncher.hidden = false;
}

const chatPositionStorageKey = "digital-circuit-ai-chat-position";
let chatDragState = null;
let chatResizeState = null;

function canDragChatPanel() {
  return window.matchMedia("(pointer: fine)").matches && !window.matchMedia("(max-width: 780px)").matches;
}

function isChatDragIgnored(target) {
  return Boolean(target.closest("button, input, textarea, select, a, .chat-header-actions"));
}

function resetChatPosition(clearSaved = true) {
  els.aiChatPanel.style.left = "";
  els.aiChatPanel.style.top = "";
  els.aiChatPanel.style.right = "";
  els.aiChatPanel.style.bottom = "";
  els.aiChatPanel.style.width = "";
  els.aiChatPanel.style.height = "";
  if (clearSaved) {
    localStorage.removeItem(chatPositionStorageKey);
  }
}

function getChatSizeLimits() {
  return {
    minWidth: 340,
    minHeight: 420,
    maxWidth: Math.max(340, window.innerWidth - 16),
    maxHeight: Math.max(420, window.innerHeight - 24)
  };
}

function getSavedChatState() {
  const saved = localStorage.getItem(chatPositionStorageKey);
  if (!saved) return null;

  try {
    return JSON.parse(saved);
  } catch {
    localStorage.removeItem(chatPositionStorageKey);
    return null;
  }
}

function saveChatState(patch = {}) {
  const saved = getSavedChatState() || {};
  const rect = els.aiChatPanel.getBoundingClientRect();
  const nextState = {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
    ...saved,
    ...patch
  };
  localStorage.setItem(chatPositionStorageKey, JSON.stringify(nextState));
}

function applyChatSize(width, height, persist = true) {
  const rect = els.aiChatPanel.getBoundingClientRect();
  const limits = getChatSizeLimits();
  const nextWidth = Math.min(Math.max(limits.minWidth, width), limits.maxWidth);
  const nextHeight = Math.min(Math.max(limits.minHeight, height), limits.maxHeight);

  els.aiChatPanel.style.width = `${Math.round(nextWidth)}px`;
  els.aiChatPanel.style.height = `${Math.round(nextHeight)}px`;

  const boundedLeft = Math.min(rect.left, window.innerWidth - nextWidth - 8);
  const boundedTop = Math.min(rect.top, window.innerHeight - nextHeight - 8);
  applyChatPosition(boundedLeft, boundedTop, false);

  if (persist) {
    saveChatState({ width: nextWidth, height: nextHeight });
  }
}

function applyChatBounds(left, top, width, height, persist = true) {
  const limits = getChatSizeLimits();
  const margin = 8;
  let nextWidth = Math.min(Math.max(limits.minWidth, width), limits.maxWidth);
  let nextHeight = Math.min(Math.max(limits.minHeight, height), limits.maxHeight);
  let nextLeft = left;
  let nextTop = top;

  if (nextLeft < margin) {
    nextWidth -= margin - nextLeft;
    nextLeft = margin;
  }
  if (nextTop < margin) {
    nextHeight -= margin - nextTop;
    nextTop = margin;
  }

  nextWidth = Math.min(Math.max(limits.minWidth, nextWidth), limits.maxWidth);
  nextHeight = Math.min(Math.max(limits.minHeight, nextHeight), limits.maxHeight);
  nextLeft = Math.min(Math.max(margin, nextLeft), window.innerWidth - nextWidth - margin);
  nextTop = Math.min(Math.max(margin, nextTop), window.innerHeight - nextHeight - margin);

  els.aiChatPanel.style.left = `${Math.round(nextLeft)}px`;
  els.aiChatPanel.style.top = `${Math.round(nextTop)}px`;
  els.aiChatPanel.style.right = "auto";
  els.aiChatPanel.style.bottom = "auto";
  els.aiChatPanel.style.width = `${Math.round(nextWidth)}px`;
  els.aiChatPanel.style.height = `${Math.round(nextHeight)}px`;

  if (persist) {
    saveChatState({
      left: nextLeft,
      top: nextTop,
      width: nextWidth,
      height: nextHeight
    });
  }
}

function applyChatPosition(left, top, persist = true) {
  const rect = els.aiChatPanel.getBoundingClientRect();
  const margin = 8;
  const maxLeft = Math.max(margin, window.innerWidth - rect.width - margin);
  const maxTop = Math.max(margin, window.innerHeight - rect.height - margin);
  const nextLeft = Math.min(Math.max(margin, left), maxLeft);
  const nextTop = Math.min(Math.max(margin, top), maxTop);

  els.aiChatPanel.style.left = `${Math.round(nextLeft)}px`;
  els.aiChatPanel.style.top = `${Math.round(nextTop)}px`;
  els.aiChatPanel.style.right = "auto";
  els.aiChatPanel.style.bottom = "auto";

  if (persist) {
    saveChatState({ left: nextLeft, top: nextTop });
  }
}

function restoreChatPosition() {
  if (!canDragChatPanel()) {
    resetChatPosition(false);
    return;
  }

  const position = getSavedChatState();
  if (!position) return;

  if (Number.isFinite(position.width) && Number.isFinite(position.height)) {
    applyChatSize(position.width, position.height, false);
  }
  if (Number.isFinite(position.left) && Number.isFinite(position.top)) {
    applyChatPosition(position.left, position.top, false);
  }
  if (
    Number.isFinite(position.left) ||
    Number.isFinite(position.top) ||
    Number.isFinite(position.width) ||
    Number.isFinite(position.height)
  ) {
    saveChatState();
  }
}

function setupChatDrag() {
  const handle = els.aiChatPanel.querySelector(".chat-header");
  if (!handle || !window.PointerEvent) return;

  handle.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || !canDragChatPanel() || isChatDragIgnored(event.target)) return;

    const rect = els.aiChatPanel.getBoundingClientRect();
    chatDragState = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top
    };
    els.aiChatPanel.classList.add("dragging");
    handle.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  handle.addEventListener("pointermove", (event) => {
    if (!chatDragState || chatDragState.pointerId !== event.pointerId) return;
    applyChatPosition(event.clientX - chatDragState.offsetX, event.clientY - chatDragState.offsetY, false);
  });

  function endDrag(event) {
    if (!chatDragState || chatDragState.pointerId !== event.pointerId) return;
    const rect = els.aiChatPanel.getBoundingClientRect();
    applyChatPosition(rect.left, rect.top, true);
    els.aiChatPanel.classList.remove("dragging");
    chatDragState = null;
    if (handle.hasPointerCapture(event.pointerId)) {
      handle.releasePointerCapture(event.pointerId);
    }
  }

  handle.addEventListener("pointerup", endDrag);
  handle.addEventListener("pointercancel", endDrag);
  handle.addEventListener("dblclick", (event) => {
    if (!isChatDragIgnored(event.target)) {
      resetChatPosition(true);
    }
  });

  window.addEventListener("resize", () => {
    if (els.aiChatPanel.hidden) return;
    if (!canDragChatPanel()) {
      resetChatPosition(false);
      return;
    }
    restoreChatPosition();
  });
}

function setupChatResize() {
  if (!window.PointerEvent) return;

  const resizeZone = 10;

  function getResizeDirection(event) {
    const rect = els.aiChatPanel.getBoundingClientRect();
    const nearLeft = event.clientX <= rect.left + resizeZone;
    const nearRight = event.clientX >= rect.right - resizeZone;
    const nearTop = event.clientY <= rect.top + resizeZone;
    const nearBottom = event.clientY >= rect.bottom - resizeZone;
    let horizontal = "";
    let vertical = "";

    if (nearLeft) horizontal = "w";
    if (nearRight) horizontal = "e";
    if (nearTop) vertical = "n";
    if (nearBottom) vertical = "s";

    return `${vertical}${horizontal}`;
  }

  function cursorForDirection(direction) {
    if (direction === "n" || direction === "s") return "ns-resize";
    if (direction === "e" || direction === "w") return "ew-resize";
    if (direction === "ne" || direction === "sw") return "nesw-resize";
    if (direction === "nw" || direction === "se") return "nwse-resize";
    return "";
  }

  els.aiChatPanel.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || !canDragChatPanel()) return;
    const rect = els.aiChatPanel.getBoundingClientRect();
    const direction = getResizeDirection(event);
    if (!direction) return;

    chatResizeState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      width: rect.width,
      height: rect.height,
      left: rect.left,
      top: rect.top,
      direction
    };
    els.aiChatPanel.classList.add("resizing");
    els.aiChatPanel.dataset.resizeDirection = direction;
    els.aiChatPanel.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  els.aiChatPanel.addEventListener("pointermove", (event) => {
    if (!chatResizeState && canDragChatPanel()) {
      const direction = getResizeDirection(event);
      els.aiChatPanel.style.cursor = cursorForDirection(direction);
    }

    if (!chatResizeState || chatResizeState.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - chatResizeState.startX;
    const deltaY = event.clientY - chatResizeState.startY;
    const direction = chatResizeState.direction;
    let nextLeft = chatResizeState.left;
    let nextTop = chatResizeState.top;
    let nextWidth = chatResizeState.width;
    let nextHeight = chatResizeState.height;

    if (direction.includes("e")) {
      nextWidth = chatResizeState.width + deltaX;
    }
    if (direction.includes("s")) {
      nextHeight = chatResizeState.height + deltaY;
    }
    if (direction.includes("w")) {
      nextLeft = chatResizeState.left + deltaX;
      nextWidth = chatResizeState.width - deltaX;
    }
    if (direction.includes("n")) {
      nextTop = chatResizeState.top + deltaY;
      nextHeight = chatResizeState.height - deltaY;
    }

    applyChatBounds(nextLeft, nextTop, nextWidth, nextHeight, false);
  });

  els.aiChatPanel.addEventListener("pointerleave", () => {
    if (!chatResizeState) {
      els.aiChatPanel.style.cursor = "";
    }
  });

  function endResize(event) {
    if (!chatResizeState || chatResizeState.pointerId !== event.pointerId) return;
    const rect = els.aiChatPanel.getBoundingClientRect();
    saveChatState({
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height
    });
    els.aiChatPanel.classList.remove("resizing");
    delete els.aiChatPanel.dataset.resizeDirection;
    els.aiChatPanel.style.cursor = "";
    chatResizeState = null;
    if (els.aiChatPanel.hasPointerCapture(event.pointerId)) {
      els.aiChatPanel.releasePointerCapture(event.pointerId);
    }
  }

  els.aiChatPanel.addEventListener("pointerup", endResize);
  els.aiChatPanel.addEventListener("pointercancel", endResize);
}

const mathCommandSymbols = {
  "\\cdot": "·",
  "\\times": "×",
  "\\oplus": "⊕",
  "\\otimes": "⊗",
  "\\land": "∧",
  "\\wedge": "∧",
  "\\lor": "∨",
  "\\vee": "∨",
  "\\neg": "¬",
  "\\sim": "∼",
  "\\equiv": "≡",
  "\\rightarrow": "→",
  "\\Rightarrow": "⇒",
  "\\leftrightarrow": "↔",
  "\\sum": "Σ",
  "\\left": "",
  "\\right": ""
};

function findClosingDelimiter(text, start, delimiter) {
  let index = start;
  while (index < text.length) {
    const found = text.indexOf(delimiter, index);
    if (found < 0) return -1;
    if (found === 0 || text[found - 1] !== "\\") return found;
    index = found + delimiter.length;
  }
  return -1;
}

function findClosingBrace(text, start) {
  let depth = 0;
  for (let index = start; index < text.length; index += 1) {
    if (text[index] === "{") depth += 1;
    if (text[index] === "}") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function readMathArgument(text, start) {
  if (text[start] === "{") {
    const end = findClosingBrace(text, start);
    if (end >= 0) {
      return { content: text.slice(start + 1, end), end: end + 1 };
    }
  }
  return { content: text[start] || "", end: Math.min(start + 1, text.length) };
}

function appendMathExpression(parent, expression) {
  let index = 0;
  while (index < expression.length) {
    const remaining = expression.slice(index);
    const wrapper = ["\\overline", "\\bar", "\\mathrm", "\\text"]
      .find((command) => remaining.startsWith(`${command}{`));
    if (wrapper) {
      const braceStart = index + wrapper.length;
      const braceEnd = findClosingBrace(expression, braceStart);
      if (braceEnd >= 0) {
        const span = document.createElement("span");
        if (wrapper === "\\overline" || wrapper === "\\bar") {
          span.className = "math-overline";
        }
        const content = expression.slice(braceStart + 1, braceEnd);
        if (wrapper === "\\text") {
          span.textContent = content;
        } else {
          appendMathExpression(span, content);
        }
        parent.append(span);
        index = braceEnd + 1;
        continue;
      }
    }

    if (expression[index] === "_" || expression[index] === "^") {
      const argument = readMathArgument(expression, index + 1);
      const script = document.createElement(expression[index] === "_" ? "sub" : "sup");
      appendMathExpression(script, argument.content);
      parent.append(script);
      index = argument.end;
      continue;
    }

    if (expression[index] === "{") {
      const braceEnd = findClosingBrace(expression, index);
      if (braceEnd >= 0) {
        appendMathExpression(parent, expression.slice(index + 1, braceEnd));
        index = braceEnd + 1;
        continue;
      }
    }

    if (expression[index] === "\\") {
      const command = remaining.match(/^\\[A-Za-z]+/)?.[0];
      if (command) {
        parent.append(document.createTextNode(mathCommandSymbols[command] || command.slice(1)));
        index += command.length;
        continue;
      }
      if (remaining.length > 1) {
        parent.append(document.createTextNode(remaining[1]));
        index += 2;
        continue;
      }
    }

    parent.append(document.createTextNode(expression[index]));
    index += 1;
  }
}

function createMathNode(expression, block = false) {
  const node = document.createElement(block ? "div" : "span");
  node.className = `chat-math${block ? " block" : ""}`;
  appendMathExpression(node, expression.trim());
  return node;
}

function renderChatContent(bubble, text) {
  const fragment = document.createDocumentFragment();
  let cursor = 0;
  const delimiters = [
    { open: "$$", close: "$$", block: true },
    { open: "\\[", close: "\\]", block: true },
    { open: "\\(", close: "\\)", block: false },
    { open: "$", close: "$", block: false }
  ];

  while (cursor < text.length) {
    let next = null;
    delimiters.forEach((delimiter) => {
      const position = text.indexOf(delimiter.open, cursor);
      if (position >= 0 && (!next || position < next.position
          || (position === next.position && delimiter.open.length > next.delimiter.open.length))) {
        next = { position, delimiter };
      }
    });

    if (!next) {
      fragment.append(document.createTextNode(text.slice(cursor)));
      break;
    }
    if (next.position > cursor) {
      fragment.append(document.createTextNode(text.slice(cursor, next.position)));
    }

    const contentStart = next.position + next.delimiter.open.length;
    const closeIndex = findClosingDelimiter(text, contentStart, next.delimiter.close);
    if (closeIndex < 0) {
      fragment.append(document.createTextNode(text.slice(next.position)));
      break;
    }
    fragment.append(createMathNode(text.slice(contentStart, closeIndex), next.delimiter.block));
    cursor = closeIndex + next.delimiter.close.length;
  }

  bubble.replaceChildren(fragment);
}

function appendChatMessage(role, text, temporary = false) {
  const message = document.createElement("div");
  message.className = `chat-message ${role}`;
  if (temporary) message.dataset.temporary = "true";

  if (role === "assistant") {
    const avatar = document.createElement("span");
    avatar.className = "chat-avatar";
    avatar.textContent = "AI";
    message.append(avatar);
  }

  const bubble = document.createElement("div");
  bubble.className = `chat-bubble${temporary ? " thinking" : ""}`;
  renderChatContent(bubble, text);
  message.append(bubble);
  els.aiOutput.append(message);
  els.aiOutput.scrollTop = els.aiOutput.scrollHeight;
  return message;
}

function updateChatQuestion(question) {
  const questionId = question?.id || "";
  if (questionId === lastChatQuestionId) return;
  lastChatQuestionId = questionId;
  tutorConversation = [];
  if (question) {
    appendChatMessage("system", `当前题目：${question.title || "未命名题目"}`);
    els.chatStatus.textContent = `正在讨论：${question.title || "当前题目"}`;
  } else {
    appendChatMessage("system", "当前没有可讲解的题目");
    els.chatStatus.textContent = "请先选择一道题目";
  }
}

function conversationHistory() {
  return tutorConversation.slice(-4)
    .map((item) => `${item.role === "user" ? "学生" : "助教"}：${item.text.slice(0, 500)}`)
    .join("\n");
}

async function streamTutor(payload, onDelta) {
  const response = await fetch("/api/tutor/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok || !response.body) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `请求失败（${response.status}）`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let result = { ai: false, elapsedMs: 0 };

  const consumeLine = (line) => {
    const payload = line.trim().replace(/^data:\s*/, "");
    if (!payload) return;
    const event = JSON.parse(payload);
    if (event.type === "delta") {
      onDelta(event.text || "");
    } else if (event.type === "done") {
      result = { ai: Boolean(event.ai), elapsedMs: Number(event.elapsedMs || 0) };
    } else if (event.type === "error") {
      throw new Error(event.error || "AI 回复失败");
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    lines.forEach(consumeLine);
    if (done) break;
  }
  if (buffer.trim()) consumeLine(buffer);
  return result;
}

async function askTutor(mode, followup = "") {
  const question = currentQuestion();
  openChat();
  if (!question) {
    appendChatMessage("system", "请先选择一道题目，我才能结合题目讲解。");
    return;
  }

  const userText = mode === "variant"
    ? "请根据当前题目生成几道同知识点的变式题。"
    : mode === "explain"
      ? "请讲解当前题目的考查点和解题思路。"
      : followup.trim();
  if (!userText) return;

  const history = conversationHistory();
  appendChatMessage("user", userText);
  tutorConversation.push({ role: "user", text: userText });
  const thinking = appendChatMessage("assistant", "正在连接 AI…", true);
  const bubble = thinking.querySelector(".chat-bubble");
  let replyText = "";

  try {
    const response = await streamTutor({
      questionId: question.id,
      mode,
      followup: mode === "followup" ? userText : "",
      history
    }, (chunk) => {
      if (!chunk) return;
      if (!replyText) {
        bubble.replaceChildren();
        bubble.classList.remove("thinking");
        bubble.classList.add("streaming");
        els.chatStatus.textContent = "AI 正在回复…";
      }
      replyText += chunk;
      renderChatContent(bubble, replyText);
      els.aiOutput.scrollTop = els.aiOutput.scrollHeight;
    });
    bubble.classList.remove("thinking", "streaming");
    thinking.removeAttribute("data-temporary");
    if (!replyText) {
      replyText = "AI 没有返回有效内容，请重试。";
      renderChatContent(bubble, replyText);
    }
    tutorConversation.push({ role: "assistant", text: replyText });
    const elapsed = response.elapsedMs > 0 ? ` · ${(response.elapsedMs / 1000).toFixed(1)} 秒` : "";
    els.chatStatus.textContent = response.ai
      ? `AI 已回复${elapsed}，可继续追问`
      : "本地讲解模式，可继续追问";
  } catch (error) {
    bubble.classList.remove("thinking", "streaming");
    renderChatContent(bubble, replyText
      ? `${replyText}\n\n回复中断：${error.message}`
      : `暂时无法回复：${error.message}`);
    throw error;
  }
}

async function importFile() {
  const file = els.fileInput.files[0];
  if (!file) {
    els.importStatus.textContent = "请先选择文件。";
    return;
  }
  const form = new FormData();
  form.append("file", file);
  els.importStatus.textContent = "正在导入，请稍等...";
  try {
    const result = await fetchJson("/api/import-questions", { method: "POST", body: form });
    els.importStatus.textContent = `导入成功：新增 ${result.count} 道题。`;
    currentSource = file.name;
    currentIndex = 0;
    practiceMode = "normal";
    setActivePracticeModule("normal");
    await loadAll();
  } catch (error) {
    els.importStatus.textContent = error.message;
  }
}

async function clearImported() {
  const result = await fetchJson("/api/imported", { method: "DELETE" });
  els.importStatus.textContent = `已清空导入题：${result.removed || 0} 道。`;
  currentSource = "";
  practiceMode = "normal";
  setActivePracticeModule("normal");
  await loadAll();
}

async function clearRecords() {
  const ok = confirm("确定清空全部学习记录吗？学习路线、积分和进步轨迹会重新开始。");
  if (!ok) return;
  const result = await fetchJson("/api/records", { method: "DELETE" });
  practiceMode = "normal";
  setActivePracticeModule("normal");
  els.practiceModeStatus.textContent = `已清空 ${result.removed || 0} 条学习记录`;
  await loadAll();
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "请求失败");
  }
  return data;
}

async function shutdownSystem() {
  const ok = confirm("确定退出系统吗？这会关闭后台 Node.js 服务。");
  if (!ok) return;
  try {
    await fetchJson("/api/shutdown", { method: "POST" });
    document.body.innerHTML = `<div class="shutdown-page">
      <h1>系统已退出</h1>
      <p>后台服务正在关闭，可以关闭这个浏览器页面。</p>
    </div>`;
  } catch (error) {
    alert("退出失败：" + error.message);
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

window.addEventListener("error", (event) => {
  showSystemNotice(`页面脚本错误：${event.message || "未知错误"}`, "error");
});

window.addEventListener("unhandledrejection", (event) => {
  const message = event.reason?.message || String(event.reason || "未知错误");
  showSystemNotice(`操作失败：${message}`, "error");
});

document.querySelectorAll(".segments button").forEach((button) => {
  button.addEventListener("click", () => runAction(button, async () => {
    document.querySelectorAll(".segments button").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    currentScope = button.dataset.scope;
    currentIndex = 0;
    await returnToNormalPractice();
  }, "切换中…"));
});

els.refreshButton?.addEventListener("click", () => runAction(els.refreshButton, loadAll, "刷新中…"));
els.shutdownButton.addEventListener("click", shutdownSystem);
els.saveAiButton.addEventListener("click", () => runAction(els.saveAiButton, saveAiConfig, "保存中…"));
els.submitButton.addEventListener("click", () => runAction(els.submitButton, submitAnswer, "判题中…"));
els.prevButton?.addEventListener("click", () => moveQuestion(-1));
els.nextButton.addEventListener("click", () => moveQuestion(1));
els.meta?.addEventListener("click", (event) => {
  event.stopPropagation();
  if (!els.questionPickerPanel || !questions.length) return;
  const nextHidden = !els.questionPickerPanel.hidden;
  els.questionPickerPanel.hidden = nextHidden;
  els.meta.setAttribute("aria-expanded", String(!nextHidden));
});
document.addEventListener("click", (event) => {
  if (!els.questionPickerPanel || els.questionPickerPanel.hidden) return;
  if (event.target === els.meta || els.questionPickerPanel.contains(event.target)) return;
  els.questionPickerPanel.hidden = true;
  els.meta?.setAttribute("aria-expanded", "false");
});
els.aiChatLauncher.addEventListener("click", openChat);
els.closeChatButton.addEventListener("click", closeChat);
setupChatDrag();
setupChatResize();
els.toggleAiConfigButton.addEventListener("click", () => {
  els.aiConfigDrawer.hidden = !els.aiConfigDrawer.hidden;
  els.toggleAiConfigButton.textContent = els.aiConfigDrawer.hidden ? "设置" : "收起";
});
els.explainButton.addEventListener("click", () => runAction(els.explainButton, () => askTutor("explain"), "生成中…"));
els.variantButton.addEventListener("click", () => runAction(els.variantButton, () => askTutor("variant"), "生成中…"));
els.followupButton.addEventListener("click", () => {
  const followup = els.followupInput.value.trim();
  if (!followup) return;
  runAction(els.followupButton, async () => {
    els.followupInput.value = "";
    await askTutor("followup", followup);
  }, "发送中…");
});
els.followupInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    els.followupButton.click();
  }
});
els.fileInput.addEventListener("change", () => {
  els.fileName.textContent = els.fileInput.files[0]?.name || "选择 Word / PDF";
});
els.importButton.addEventListener("click", () => runAction(els.importButton, importFile, "导入中…"));
els.clearImportButton.addEventListener("click", () => runAction(els.clearImportButton, clearImported, "清空中…"));
els.clearRecordsButton.addEventListener("click", () => runAction(els.clearRecordsButton, clearRecords, "清空中…"));
els.planButton.addEventListener("click", () => runAction(els.planButton, startPersonalizedRoute, "生成中…"));
els.selfTestButton.addEventListener("click", () => runAction(els.selfTestButton, composeSelfTest, "组卷中…"));
els.wrongReviewButton.addEventListener("click", () => runAction(els.wrongReviewButton, startWrongReview, "加载中…"));
els.targetedButton.addEventListener("click", () => runAction(els.targetedButton, startTargetedPractice, "出题中…"));
els.normalPracticeButton.addEventListener("click", () => runAction(els.normalPracticeButton, returnToNormalPractice, "返回中…"));

setupScopePanelToggle();
loadAll();
