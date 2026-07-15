const allowedModes = new Set(["normal", "targeted", "wrong_review", "self_test"]);
const personalizedQuestionTypes = new Set(["single_choice", "fill_blank", "analysis"]);
const personalizedTypeRank = Object.freeze({ single_choice: 0, fill_blank: 1, analysis: 2 });

function accuracy(records) {
  if (!records.length) return 0;
  return Math.round(records.filter((record) => record.correct).length * 100 / records.length);
}

function masteryConfidence(uniqueQuestions) {
  if (uniqueQuestions < 3) return "数据不足";
  if (uniqueQuestions < 5) return "低置信度";
  if (uniqueQuestions < 8) return "中置信度";
  return "高置信度";
}

function recordTime(record) {
  const value = Date.parse(record?.answeredAt || "");
  return Number.isFinite(value) ? value : 0;
}

function normalized(text) {
  return String(text || "").toLowerCase().replace(/\s+/g, "");
}

function mode(modeName) {
  return allowedModes.has(modeName) ? modeName : "normal";
}

function serviceError(message, status, code, retryAfterSeconds = 0) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  if (retryAfterSeconds > 0) error.retryAfterSeconds = retryAfterSeconds;
  return error;
}

function positiveOption(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback;
}

function normalizedGeneratedVariant(source) {
  if (!source?.generatedVariant) return null;
  const id = String(source.id || "").trim().slice(0, 160);
  const text = String(source.text || "").trim().slice(0, 4000);
  const type = source.type === "single_choice" ? "single_choice" : "analysis";
  const answerText = String(source.answerText || "").trim().slice(0, 3000);
  if (!id || !text || (type === "analysis" && !answerText)) return null;
  return {
    id,
    scope: String(source.scope || "custom").trim().slice(0, 80) || "custom",
    chapter: String(source.chapter || "AI 变式训练").trim().slice(0, 200),
    type,
    title: String(source.title || "AI 变式题").trim().slice(0, 200),
    text,
    options: type === "single_choice" && Array.isArray(source.options)
      ? source.options.slice(0, 4).map((item) => String(item || "").trim().slice(0, 500))
      : [],
    answer: type === "single_choice" && Number.isInteger(source.answer) ? source.answer : null,
    answerText,
    explanation: String(source.explanation || "").trim().slice(0, 3000),
    knowledge: (Array.isArray(source.knowledge) ? source.knowledge : []).slice(0, 12)
      .map((item) => String(item || "").trim().slice(0, 100)).filter(Boolean),
    keywords: (Array.isArray(source.keywords) ? source.keywords : []).slice(0, 12)
      .map((item) => String(item || "").trim().slice(0, 100)).filter(Boolean),
    difficulty: Math.max(1, Math.min(Number(source.difficulty) || 2, 5)),
    generatedVariant: true,
    source: "AI 变式题"
  };
}

function buildTargetKnowledgePlan(weakKnowledge, availableKnowledge, count) {
  const targets = weakKnowledge.length
    ? weakKnowledge
    : availableKnowledge.map((name) => ({ name, wrongCount: 1 }));
  if (!targets.length) return [];
  const plan = targets.slice(0, count).map((item) => item.name);
  const weighted = targets.flatMap((item) => Array.from(
    { length: Math.max(1, Math.min(Number(item.wrongCount) || 1, 4)) },
    () => item.name
  ));
  for (let index = 0; plan.length < count; index += 1) {
    plan.push(weighted[index % weighted.length]);
  }
  return plan.slice(0, count);
}

function allocateWeightedCounts(total, weightedItems) {
  const safeTotal = Math.max(0, Number(total) || 0);
  const weightTotal = weightedItems.reduce((sum, item) => sum + Math.max(0, item.weight), 0) || 1;
  const allocated = weightedItems.map((item, index) => {
    const exact = safeTotal * Math.max(0, item.weight) / weightTotal;
    return { ...item, index, count: Math.floor(exact), remainder: exact - Math.floor(exact) };
  });
  let remaining = safeTotal - allocated.reduce((sum, item) => sum + item.count, 0);
  [...allocated].sort((left, right) => right.remainder - left.remainder || left.index - right.index)
    .forEach((item) => {
      if (remaining <= 0) return;
      allocated[item.index].count += 1;
      remaining -= 1;
    });
  return new Map(allocated.map((item) => [item.key, item.count]));
}

export class PracticeService {
  constructor(store, ai = null, options = {}) {
    this.store = store;
    this.ai = ai;
    this.now = typeof options.now === "function" ? options.now : () => Date.now();
    this.generatedVariantTtlMs = positiveOption(options.generatedVariantTtlMs, 60 * 60 * 1000);
    this.generatedVariantLimit = positiveOption(options.generatedVariantLimit, 500);
    this.generatedVariants = new Map();
    this.analysisRateWindowMs = positiveOption(options.analysisRateWindowMs, 60 * 1000);
    this.analysisRateLimit = positiveOption(options.analysisRateLimit, 6);
    this.analysisGlobalConcurrency = positiveOption(options.analysisGlobalConcurrency, 8);
    this.analysisActiveCount = 0;
    this.analysisRateStates = new Map();
  }

  generatedVariantKey(learnerId, questionId) {
    return `${String(learnerId || "")}\u0000${String(questionId || "")}`;
  }

  pruneGeneratedVariants(now = this.now()) {
    this.generatedVariants.forEach((entry, key) => {
      if (entry.expiresAt <= now) this.generatedVariants.delete(key);
    });
  }

  registerGeneratedVariant(learnerId, sourceQuestion) {
    const owner = String(learnerId || "").trim();
    const question = normalizedGeneratedVariant(sourceQuestion);
    if (!owner || !question) {
      throw serviceError("AI 变式题注册失败，请重新生成。", 502, "AI_VARIANT_INVALID");
    }
    const now = this.now();
    this.pruneGeneratedVariants(now);
    const key = this.generatedVariantKey(owner, question.id);
    this.generatedVariants.delete(key);
    while (this.generatedVariants.size >= this.generatedVariantLimit) {
      this.generatedVariants.delete(this.generatedVariants.keys().next().value);
    }
    this.generatedVariants.set(key, {
      question,
      owner,
      registeredAt: now,
      expiresAt: now + this.generatedVariantTtlMs
    });
    return question;
  }

  registeredGeneratedVariant(learnerId, questionId) {
    const owner = String(learnerId || "").trim();
    const id = String(questionId || "").trim();
    const key = this.generatedVariantKey(owner, id);
    const entry = this.generatedVariants.get(key);
    const now = this.now();
    if (entry) {
      if (entry.expiresAt <= now) {
        this.generatedVariants.delete(key);
        throw serviceError("这道 AI 变式题已过期，请从原错题重新生成。", 410, "AI_VARIANT_EXPIRED");
      }
      return entry.question;
    }
    this.pruneGeneratedVariants(now);
    const belongsToAnotherLearner = [...this.generatedVariants.values()]
      .some((item) => item.question.id === id && item.owner !== owner);
    if (belongsToAnotherLearner) {
      throw serviceError("这道 AI 变式题不属于当前学习记录，请重新生成。", 404, "AI_VARIANT_NOT_AVAILABLE");
    }
    throw serviceError("未找到有效的 AI 变式题，请从原错题重新生成。", 404, "AI_VARIANT_NOT_REGISTERED");
  }

  questionForLearner(questionId, learnerId) {
    return this.store.question(questionId) || this.registeredGeneratedVariant(learnerId, questionId);
  }

  async wrongRemediation(request, learnerId) {
    if (!this.ai?.wrongRemediation) {
      throw serviceError("AI 错题强化服务当前不可用，请稍后重试。", 503, "AI_REMEDIATION_UNAVAILABLE");
    }
    const question = this.questionForLearner(request.questionId, learnerId);
    let result;
    try {
      result = await this.ai.wrongRemediation(question, request);
    } catch (error) {
      if (!error.status) error.status = 502;
      throw error;
    }
    if (result?.variantQuestion) {
      return {
        ...result,
        variantQuestion: this.registerGeneratedVariant(learnerId, result.variantQuestion)
      };
    }
    return result;
  }

  analysisRateKeys(request) {
    const supplied = Array.isArray(request.analysisRateKeys) ? request.analysisRateKeys : [];
    const keys = supplied.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 4);
    if (!keys.length) keys.push(`learner:${String(request.learnerId || "anonymous")}`);
    return [...new Set(keys)];
  }

  pruneAnalysisRateStates(now = this.now()) {
    this.analysisRateStates.forEach((state, key) => {
      state.timestamps = state.timestamps.filter((timestamp) => now - timestamp < this.analysisRateWindowMs);
      if (!state.active && !state.timestamps.length) this.analysisRateStates.delete(key);
    });
  }

  async runLimitedAnalysisGrading(request, action) {
    const now = this.now();
    this.pruneAnalysisRateStates(now);
    const keys = this.analysisRateKeys(request);
    const states = keys.map((key) => {
      const state = this.analysisRateStates.get(key) || { active: 0, timestamps: [] };
      state.timestamps = state.timestamps.filter((timestamp) => now - timestamp < this.analysisRateWindowMs);
      return { key, state };
    });
    if (states.some(({ state }) => state.active > 0)) {
      throw serviceError("AI 正在评阅上一份答案，请等待完成后再提交。", 429, "AI_GRADING_BUSY", 1);
    }
    const limited = states.find(({ state }) => state.timestamps.length >= this.analysisRateLimit);
    if (limited) {
      const retryAfterMs = this.analysisRateWindowMs - (now - limited.state.timestamps[0]);
      const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
      throw serviceError(`AI 判题请求较频繁，请 ${retryAfterSeconds} 秒后重试。`, 429,
        "AI_GRADING_RATE_LIMITED", retryAfterSeconds);
    }
    if (this.analysisActiveCount >= this.analysisGlobalConcurrency) {
      throw serviceError("当前 AI 判题任务较多，请稍后重试。", 429, "AI_GRADING_CAPACITY", 2);
    }
    states.forEach(({ key, state }) => {
      state.active += 1;
      state.timestamps.push(now);
      this.analysisRateStates.set(key, state);
    });
    this.analysisActiveCount += 1;
    try {
      return await action();
    } finally {
      states.forEach(({ state }) => { state.active = Math.max(0, state.active - 1); });
      this.analysisActiveCount = Math.max(0, this.analysisActiveCount - 1);
    }
  }

  async answer(request) {
    const taskQuestion = request.taskId
      ? this.store.personalizedTaskQuestion(request.learnerId, request.taskId, request.questionId)
      : null;
    const storedQuestion = taskQuestion || this.store.question(request.questionId);
    const question = storedQuestion || this.registeredGeneratedVariant(request.learnerId, request.questionId);
    const userAnswer = String(request.answer ?? "").trim();
    if (!userAnswer) {
      const error = new Error(question.type === "single_choice" ? "请先选择一个选项。" : "请先填写答案。");
      error.status = 400;
      error.code = "ANSWER_REQUIRED";
      throw error;
    }
    if (userAnswer.length > 3000) {
      const error = new Error("答案内容过长，请精简到 3000 字以内后重试。");
      error.status = 400;
      error.code = "ANSWER_TOO_LONG";
      throw error;
    }
    let correct = false;
    let matchedKeywords = [];
    let evaluation = null;

    if (question.type === "single_choice") {
      const upper = userAnswer.toUpperCase();
      const value = /^[A-Z]$/.test(upper) ? upper.charCodeAt(0) - 65 : Number(upper);
      correct = value === question.answer;
    } else if (question.type === "analysis") {
      if (!this.ai?.gradeAnalysisAnswer) {
        const error = new Error("AI 语义判题服务当前不可用，请稍后重试。");
        error.status = 503;
        error.code = "AI_GRADING_UNAVAILABLE";
        throw error;
      }
      evaluation = await this.runLimitedAnalysisGrading(request,
        () => this.ai.gradeAnalysisAnswer(question, userAnswer));
      correct = evaluation.correct;
    } else {
      matchedKeywords = (question.keywords || [])
        .filter((keyword) => normalized(userAnswer).includes(normalized(keyword)));
      const required = Math.max(2, Math.ceil((question.keywords || []).length * 0.45));
      correct = question.keywords?.length > 0 && matchedKeywords.length >= required;
    }

    let taskProgress = null;
    if (storedQuestion) {
      const existingAttempts = this.recordsForLearner(request.learnerId)
        .filter((record) => record.questionId === question.id);
      const savedRecord = this.store.addRecord({
        questionId: question.id,
        userAnswer,
        correct,
        knowledge: question.knowledge || [],
        practiceMode: mode(request.practiceMode),
        focusKnowledge: request.focusKnowledge || "",
        taskId: request.taskId || "",
        isTransfer: Boolean(request.isTransfer),
        isFirstAttempt: existingAttempts.length === 0,
        ...(evaluation ? {
          score: evaluation.score,
          gradingMode: evaluation.gradingMode,
          gradingStatus: evaluation.status,
          gradingVersion: evaluation.gradingVersion,
          gradingEvaluation: evaluation
        } : {}),
        ...(request.learnerId ? { learnerId: request.learnerId } : {})
      });
      if (request.taskId) {
        const task = this.store.recordPersonalizedTaskAnswer(
          request.learnerId,
          request.taskId,
          question.id,
          correct,
          savedRecord.id
        );
        if (task) {
          taskProgress = {
            taskId: task.id,
            answered: Object.keys(task.answers || {}).length,
            total: task.questions.length,
            completed: Boolean(task.completedAt)
          };
        }
      }
    }

    if (evaluation) {
      const messages = {
        mastered: "语义评分：掌握良好",
        passed: "语义评分：达到要求",
        partial: "语义评分：已答对部分要点，继续补充",
        incorrect: "语义评分：当前判断需要调整"
      };
      return {
        correct,
        score: evaluation.score,
        message: messages[evaluation.status] || "AI 语义评分已完成",
        referenceAnswer: question.answerText,
        explanation: question.explanation,
        matchedKeywords: [],
        evaluation,
        taskProgress
      };
    }

    return {
      correct,
      message: correct ? "回答正确" : "需要巩固",
      referenceAnswer: question.type === "single_choice"
        ? `${String.fromCharCode(65 + question.answer)}. ${question.options[question.answer]}`
        : question.answerText,
      explanation: question.explanation,
      matchedKeywords,
      taskProgress
    };
  }

  recordsForLearner(learnerId = "") {
    if (!learnerId) return this.store.records;
    return this.store.records.filter((record) => record.learnerId === learnerId);
  }

  wrongKnowledgeCounts(scope = "all", learnerId = "") {
    const counts = {};
    this.recordsForLearner(learnerId).filter((record) => {
      if (record.correct) return false;
      if (!scope || scope === "all") return true;
      return this.store.question(record.questionId)?.scope === scope;
    }).forEach((record) => {
      (record.knowledge || []).forEach((item) => {
        counts[item] = (counts[item] || 0) + 1;
      });
    });
    return counts;
  }

  stats(learnerId = "") {
    const records = this.recordsForLearner(learnerId);
    const firstByQuestion = new Map();
    records.forEach((record) => {
      if (!firstByQuestion.has(record.questionId)) firstByQuestion.set(record.questionId, record);
    });
    const firstAttempts = [...firstByQuestion.values()];
    const transferAttempts = records.filter((record) => record.isTransfer);
    return {
      answered: records.length,
      correctRate: accuracy(records),
      uniqueQuestions: firstAttempts.length,
      firstCorrectRate: firstAttempts.length >= 3 ? accuracy(firstAttempts) : null,
      transferAttempts: transferAttempts.length,
      transferCorrectRate: transferAttempts.length >= 3 ? accuracy(transferAttempts) : null,
      wrongKnowledge: this.wrongKnowledgeCounts("all", learnerId)
    };
  }

  recommend(currentId, learnerId = "") {
    const current = this.store.question(currentId);
    const weak = Object.entries(this.wrongKnowledgeCounts("all", learnerId))
      .sort((left, right) => right[1] - left[1]).slice(0, 3).map(([name]) => name);
    const targets = weak.length ? weak : (current?.knowledge || []);
    return this.store.questions().filter((question) => question.id !== currentId)
      .map((question) => ({
        question,
        score: targets.filter((item) => question.knowledge?.includes(item)).length * 10
          + Number(question.scope === current?.scope) * 2
          + Math.max(0, 3 - Math.abs((question.difficulty || 2) - (current?.difficulty || 2)))
      }))
      .sort((left, right) => right.score - left.score)
      .slice(0, 4).map((entry) => entry.question);
  }

  wrongReviewDetails(learnerId = "") {
    const grouped = new Map();
    this.recordsForLearner(learnerId).filter((record) => !record.correct).forEach((record) => {
      const records = grouped.get(record.questionId) || [];
      records.push(record);
      grouped.set(record.questionId, records);
    });
    return [...grouped.entries()].map(([id, wrongRecords]) => {
      const latestWrong = wrongRecords.at(-1);
      const confirmation = this.store.wrongReviewConfirmation(learnerId, id);
      const confirmedAt = Date.parse(confirmation?.confirmedAt || "") || 0;
      return {
        question: this.store.question(id),
        wrongAttempts: wrongRecords.length,
        latestAttempt: {
          userAnswer: latestWrong.userAnswer || "",
          answeredAt: latestWrong.answeredAt || "",
          evaluation: latestWrong.gradingEvaluation || null
        },
        confirmedAt: confirmation?.confirmedAt || "",
        active: recordTime(latestWrong) > confirmedAt
      };
    }).filter((item) => item.active)
      .filter((item) => item.question)
      .sort((left, right) => right.wrongAttempts - left.wrongAttempts);
  }

  confirmWrongReview(questionId, learnerId = "") {
    const question = this.store.question(questionId);
    const hasWrongRecord = this.recordsForLearner(learnerId)
      .some((record) => record.questionId === questionId && !record.correct);
    if (!question || !hasWrongRecord) {
      throw serviceError("只能确认已记录的错题。", 404, "WRONG_REVIEW_NOT_FOUND");
    }
    return this.store.confirmWrongReview(learnerId, questionId);
  }

  knowledgeStats(learnerId = "") {
    const groups = new Map();
    this.recordsForLearner(learnerId).forEach((record) => {
      (record.knowledge || []).forEach((item) => {
        if (!groups.has(item)) groups.set(item, []);
        groups.get(item).push(record);
      });
    });
    return [...groups.entries()].map(([knowledge, records]) => {
      const firstByQuestion = new Map();
      records.forEach((record) => {
        if (!firstByQuestion.has(record.questionId)) firstByQuestion.set(record.questionId, record);
      });
      const uniqueRecords = [...firstByQuestion.values()];
      const uniqueQuestions = uniqueRecords.length;
      const hasSufficientEvidence = uniqueQuestions >= 3;
      const rate = hasSufficientEvidence ? accuracy(uniqueRecords) : null;
      return {
        knowledge,
        attempts: records.length,
        correct: records.filter((record) => record.correct).length,
        uniqueQuestions,
        rate,
        confidence: masteryConfidence(uniqueQuestions),
        status: !hasSufficientEvidence ? "数据不足" : rate >= 80 ? "已掌握" : rate >= 60 ? "提升中" : "需巩固"
      };
    }).sort((left, right) => (left.rate ?? -1) - (right.rate ?? -1) || left.knowledge.localeCompare(right.knowledge));
  }

  learningPlan(learnerId = "") {
    const records = this.recordsForLearner(learnerId);
    const knowledge = this.knowledgeStats(learnerId);
    let focusKnowledge = knowledge.filter((item) => item.rate === null || item.rate < 80)
      .slice(0, 3).map((item) => item.knowledge);
    if (!focusKnowledge.length) {
      focusKnowledge = [...new Set(this.store.questions().flatMap((question) => question.knowledge || []))].slice(0, 3);
    }
    const primaryFocus = focusKnowledge[0] || "综合基础";
    const selfTests = records.filter((record) => record.practiceMode === "self_test").length;
    const unresolved = this.wrongReviewDetails(learnerId).length;
    const hasRecords = records.length > 0;
    return {
      focusKnowledge,
      primaryFocus,
      steps: [
        {
          order: 1, title: "诊断薄弱点",
          detail: hasRecords ? `当前优先巩固：${focusKnowledge.join("、")}` : "先完成一轮个性化学习任务。",
          status: hasRecords ? "已完成" : "进行中"
        },
        {
          order: 2, title: "知识复习",
          detail: `围绕“${primaryFocus}”回顾核心概念、关键规则和辅助例题。`,
          status: hasRecords ? "已安排" : "待开始"
        },
        {
          order: 3, title: "错题复盘",
          detail: unresolved ? `还有 ${unresolved} 道错题需要复盘。` : "当前没有待复盘错题。",
          status: unresolved ? "待完成" : hasRecords ? "已完成" : "待完成"
        },
        {
          order: 4, title: "个性化学习",
          detail: selfTests ? `已记录 ${selfTests} 次个性化学习作答。` : "复习后完成针对性学习任务。",
          status: selfTests >= 5 ? "已完成" : "待完成"
        }
      ],
      review: hasRecords && knowledge.length
        ? `已完成 ${records.length} 次作答；当前“${knowledge[0].knowledge}”正确率为 ${knowledge[0].rate}%，建议优先复习该知识点。`
        : "尚未形成学习记录。建议先进入个性化学习，完成基础任务并建立掌握度。"
    };
  }

  selectBankQuestions(scope, count, learnerId = "") {
    const weak = this.wrongKnowledgeCounts("all", learnerId);
    const answered = new Set(this.recordsForLearner(learnerId).map((record) => record.questionId));
    return this.store.questions({ scope }).map((question) => ({
      question,
      score: Number(!answered.has(question.id)) * 5
        + (question.knowledge || []).reduce((sum, item) => sum + (weak[item] || 0) * 10, 0)
        + (question.difficulty || 0)
    })).sort((left, right) => right.score - left.score)
      .slice(0, Math.max(1, Math.min(Number(count) || 5, 20)))
      .map((entry) => entry.question);
  }

  selectPersonalizedBankQuestions(profile, learnerId = "") {
    const count = Math.max(1, Math.min(Number(profile?.count) || 5, 10));
    const weak = new Map((profile?.weakKnowledge || []).map((item) => [item.name, Number(item.wrongCount) || 0]));
    const mastery = new Map((profile?.knowledgeMastery || []).map((item) => [item.name, Number(item.rate) || 0]));
    const targetPriority = new Map();
    (profile?.targetKnowledgePlan || []).forEach((name, index) => {
      if (!targetPriority.has(name)) targetPriority.set(name, count - index);
    });
    const answered = new Set(this.recordsForLearner(learnerId).map((record) => record.questionId));
    const ranked = this.store.questions({ scope: profile?.scope || "all" })
      .filter((question) => personalizedQuestionTypes.has(question.type))
      .map((question) => {
        const knowledge = question.knowledge || [];
        const score = Number(!answered.has(question.id)) * 8
          + knowledge.reduce((sum, name) => sum + (weak.get(name) || 0) * 18, 0)
          + knowledge.reduce((sum, name) => sum + (targetPriority.get(name) || 0) * 3, 0)
          + knowledge.reduce((sum, name) => sum + (mastery.has(name) ? (100 - mastery.get(name)) / 8 : 0), 0)
          + Math.max(0, 5 - Math.abs((Number(question.difficulty) || 2) - 3));
        return { question, score };
      })
      .sort((left, right) => right.score - left.score
        || String(left.question.id).localeCompare(String(right.question.id)));

    const nonChoiceTarget = count >= 2 ? Math.max(1, Math.round(count * 0.25)) : 0;
    const pickQuestions = (pool, total, nonChoiceCount) => {
      const chosen = [
        ...pool.filter((entry) => entry.question.type === "single_choice").slice(0, total - nonChoiceCount),
        ...pool.filter((entry) => entry.question.type !== "single_choice").slice(0, nonChoiceCount)
      ];
      const chosenIds = new Set(chosen.map((entry) => entry.question.id));
      for (const entry of pool) {
        if (chosen.length >= total) break;
        if (!chosenIds.has(entry.question.id)) {
          chosen.push(entry);
          chosenIds.add(entry.question.id);
        }
      }
      return chosen;
    };
    let selected;
    if (profile?.scope === "all" && !weak.size) {
      const scopeWeights = [
        { key: "basic-logic", weight: 3 },
        { key: "combinational", weight: 2 },
        { key: "sequential", weight: 1 }
      ];
      const scopeCounts = allocateWeightedCounts(count, scopeWeights);
      const nonChoiceCounts = allocateWeightedCounts(nonChoiceTarget,
        scopeWeights.map((item) => ({ key: item.key, weight: scopeCounts.get(item.key) })));
      selected = scopeWeights.flatMap(({ key }) => pickQuestions(
        ranked.filter((entry) => entry.question.scope === key),
        scopeCounts.get(key),
        Math.min(nonChoiceCounts.get(key), scopeCounts.get(key))
      ));
    } else {
      selected = pickQuestions(ranked, count, nonChoiceTarget);
    }
    return selected.sort((left, right) => (personalizedTypeRank[left.question.type] ?? 9)
      - (personalizedTypeRank[right.question.type] ?? 9)
      || right.score - left.score
      || String(left.question.id).localeCompare(String(right.question.id)))
      .slice(0, count)
      .map((entry) => entry.question);
  }

  selfTestProfile(scope, count, learnerId = "") {
    const selectedScope = scope && scope !== "all" ? String(scope) : "all";
    const selectedCount = Math.max(1, Math.min(Number(count) || 5, 10));
    const weakKnowledge = Object.entries(this.wrongKnowledgeCounts(selectedScope, learnerId))
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, 10)
      .map(([name, wrongCount]) => ({ name: String(name).slice(0, 80), wrongCount }));
    const availableKnowledge = [...new Set(this.store.questions({ scope: selectedScope })
      .flatMap((question) => question.knowledge || []))]
      .map((name) => String(name).slice(0, 80)).slice(0, 24);
    const knowledgeMastery = this.knowledgeStats(learnerId)
      .filter((item) => availableKnowledge.includes(item.knowledge))
      .slice(0, 16)
      .map((item) => ({
        name: String(item.knowledge).slice(0, 80),
        rate: item.rate,
        attempts: item.attempts,
        status: item.status
      }));
    const targetKnowledgePlan = buildTargetKnowledgePlan(
      weakKnowledge,
      availableKnowledge,
      selectedCount
    );
    const seenQuestions = new Set();
    const wrongQuestions = [...this.recordsForLearner(learnerId)].reverse()
      .filter((record) => !record.correct)
      .map((record) => ({ record, question: this.store.question(record.questionId) }))
      .filter(({ question }) => question
        && (selectedScope === "all" || question.scope === selectedScope)
        && !seenQuestions.has(question.id)
        && seenQuestions.add(question.id))
      .slice(0, 8)
      .map(({ record, question }) => ({
        text: String(question.text || "").slice(0, 600),
        type: question.type,
        knowledge: (question.knowledge || []).slice(0, 8)
          .map((item) => String(item).slice(0, 80)),
        difficulty: question.difficulty || 2,
        userAnswer: String(record.userAnswer || "").slice(0, 300)
      }));

    return {
      scope: selectedScope,
      count: selectedCount,
      weakKnowledge,
      knowledgeMastery,
      focusKnowledge: [...new Set(targetKnowledgePlan)],
      targetKnowledgePlan,
      availableKnowledge,
      wrongQuestions
    };
  }

  selfTestNeedsAi(scope, count, learnerId = "") {
    return this.prepareSelfTest(scope, count, learnerId).shortage > 0;
  }

  prepareSelfTest(scope, count, learnerId = "") {
    const profile = this.selfTestProfile(scope, count, learnerId);
    const localQuestions = this.selectPersonalizedBankQuestions(profile, learnerId);
    return {
      profile,
      localQuestions,
      shortage: profile.count - localQuestions.length
    };
  }

  async selfTest(scope, count, learnerId = "", prepared = null) {
    const plan = prepared || this.prepareSelfTest(scope, count, learnerId);
    const { profile, localQuestions, shortage } = plan;
    if (shortage <= 0) return localQuestions;
    if (!this.ai?.generateSelfTest) {
      const error = new Error("个性化学习任务生成服务不可用，请稍后重试。");
      error.status = 503;
      error.code = "AI_SELF_TEST_UNAVAILABLE";
      throw error;
    }

    const remainingTargets = [...profile.targetKnowledgePlan];
    localQuestions.forEach((question) => {
      const index = remainingTargets.findIndex((name) => question.knowledge?.includes(name));
      if (index >= 0) remainingTargets.splice(index, 1);
    });
    const targetKnowledgePlan = remainingTargets.slice(0, shortage);
    const fallbackTargets = profile.targetKnowledgePlan.length
      ? profile.targetKnowledgePlan
      : profile.availableKnowledge;
    for (let index = 0; targetKnowledgePlan.length < shortage && fallbackTargets.length; index += 1) {
      targetKnowledgePlan.push(fallbackTargets[index % fallbackTargets.length]);
    }

    const desiredNonChoice = profile.count >= 2 ? Math.max(1, Math.round(profile.count * 0.25)) : 0;
    const localNonChoice = localQuestions.filter((question) => question.type !== "single_choice").length;
    const analysisCount = Math.min(shortage, Math.max(0, desiredNonChoice - localNonChoice));
    const choiceCount = shortage - analysisCount;
    const targetSet = new Set(targetKnowledgePlan);
    const relevantWrongQuestions = profile.wrongQuestions
      .filter((question) => question.knowledge?.some((name) => targetSet.has(name)));
    const supplementProfile = {
      scope: profile.scope,
      count: shortage,
      choiceCount,
      analysisCount,
      targetKnowledgePlan,
      focusKnowledge: [...new Set(targetKnowledgePlan)],
      weakKnowledge: profile.weakKnowledge.filter((item) => targetSet.has(item.name)).slice(0, 6),
      knowledgeMastery: profile.knowledgeMastery.filter((item) => targetSet.has(item.name)).slice(0, 6),
      availableKnowledge: [...new Set([...targetKnowledgePlan, ...profile.availableKnowledge])].slice(0, 12),
      wrongQuestions: (relevantWrongQuestions.length ? relevantWrongQuestions : profile.wrongQuestions).slice(0, 3),
      excludeQuestions: localQuestions.slice(0, 8).map((question) => String(question.text || "").slice(0, 140))
    };
    const generated = await this.ai.generateSelfTest(supplementProfile);
    const localTexts = new Set(localQuestions.map((question) => normalized(question.text)));
    const uniqueGenerated = generated.filter((question) => !localTexts.has(normalized(question.text)));
    if (uniqueGenerated.length !== shortage) {
      throw serviceError("AI 补充任务与本地题库重复，请稍后重试。", 502, "AI_SELF_TEST_FAILED");
    }
    const registered = this.store.addGeneratedSelfTestQuestions(uniqueGenerated);
    return [...localQuestions, ...registered].sort((left, right) =>
      (personalizedTypeRank[left.type] ?? 9) - (personalizedTypeRank[right.type] ?? 9));
  }

  targeted(knowledge, count, learnerId = "") {
    const focus = String(knowledge || Object.entries(this.wrongKnowledgeCounts("all", learnerId))
      .sort((left, right) => right[1] - left[1])[0]?.[0] || "").trim();
    const matched = this.store.questions()
      .filter((question) => !focus || question.knowledge?.includes(focus))
      .sort((left, right) => left.difficulty - right.difficulty)
      .slice(0, Math.max(1, Math.min(Number(count) || 5, 20)));
    return matched.length ? matched : this.selectBankQuestions(null, count, learnerId);
  }

  progress(learnerId = "") {
    const records = [...this.recordsForLearner(learnerId)]
      .sort((left, right) => recordTime(left) - recordTime(right));
    const tasks = this.store.personalizedTasksForLearner(learnerId);
    const practiceModeLabels = {
      normal: "普通练习",
      targeted: "针对练习",
      wrong_review: "错题复盘",
      self_test: "个性化学习"
    };
    const attempts = records.map((record, index) => {
      const question = this.store.question(record.questionId);
      const rollingWindow = records.slice(Math.max(0, index - 4), index + 1);
      return {
        sequence: index + 1,
        questionId: record.questionId,
        questionTitle: question?.title || question?.text || `题目 ${record.questionId}`,
        correct: Boolean(record.correct),
        answeredAt: record.answeredAt || "",
        practiceMode: mode(record.practiceMode),
        practiceModeLabel: practiceModeLabels[mode(record.practiceMode)],
        knowledge: Array.isArray(record.knowledge) ? record.knowledge.slice(0, 3) : [],
        rollingAccuracy: accuracy(rollingWindow),
        isFirstAttempt: Boolean(record.isFirstAttempt),
        isTransfer: Boolean(record.isTransfer)
      };
    });
    const recentRecords = records.slice(-10);
    const baselineRecords = records.slice(0, Math.min(10, records.length));
    const nextTask = tasks.find((task) => !task.completedAt) || null;
    const baselineRate = accuracy(baselineRecords);
    const recentRate = accuracy(recentRecords);
    const personalized = records.filter((record) => ["targeted", "wrong_review", "self_test"].includes(record.practiceMode));
    return {
      attempts,
      recentAttempts: attempts.slice(-10).reverse(),
      recentSummary: {
        answered: recentRecords.length,
        correct: recentRecords.filter((record) => record.correct).length,
        accuracy: accuracy(recentRecords)
      },
      tasks: {
        total: tasks.length,
        completed: tasks.filter((task) => task.completedAt).length,
        active: tasks.filter((task) => !task.completedAt).length,
        nextTask: nextTask ? {
          id: nextTask.id,
          title: nextTask.title,
          answered: Object.keys(nextTask.answers || {}).length,
          total: nextTask.questions.length,
          scope: nextTask.scope
        } : null
      },
      knowledge: this.knowledgeStats(learnerId),
      effectiveness: {
        baselineRate,
        recentRate,
        improvement: recentRate - baselineRate,
        personalizedAttempts: personalized.length,
        personalizedRate: accuracy(personalized),
        directionEffective: records.length >= 10 && recentRate >= baselineRate + 10,
        conclusion: records.length
          ? "已根据全部作答记录生成趋势与最近练习反馈。"
          : "完成作答后，这里会立即记录结果并更新学习趋势。"
      },
      unresolvedWrong: this.wrongReviewDetails(learnerId).length
    };
  }

  motivation(learnerId = "") {
    const records = this.recordsForLearner(learnerId);
    const correct = records.filter((record) => record.correct).length;
    const wrong = new Set();
    const corrected = new Set();
    records.forEach((record) => {
      if (!record.correct) wrong.add(record.questionId);
      if (record.correct && wrong.has(record.questionId)) corrected.add(record.questionId);
    });
    const points = correct * 10 + (records.length - correct) * 3 + corrected.size * 15;
    const days = new Set(records.map((record) => record.answeredAt?.slice(0, 10)).filter(Boolean));
    let streakDays = 0;
    if (days.size) {
      let cursor = new Date([...days].sort().at(-1));
      while (days.has(cursor.toISOString().slice(0, 10))) {
        streakDays += 1;
        cursor.setUTCDate(cursor.getUTCDate() - 1);
      }
    }
    const badges = [];
    if (records.length) badges.push("完成首次练习");
    if (records.length >= 5) badges.push("首次个性化学习");
    if (corrected.size) badges.push("错题攻克");
    if (streakDays >= 3) badges.push("连续学习");
    if (records.length >= 5 && records.slice(-5).every((record) => record.correct)) badges.push("五题连对");
    return {
      points,
      level: Math.floor(points / 100) + 1,
      nextLevelPoints: (Math.floor(points / 100) + 1) * 100,
      streakDays,
      correctedMistakes: corrected.size,
      badges,
      message: !records.length
        ? "完成一轮练习，系统就能为你推荐优先复习的知识点。"
        : this.wrongReviewDetails(learnerId).length
          ? `本轮优先复习 ${this.learningPlan(learnerId).primaryFocus}，每订正一道错题都会更新巩固重点。`
          : "当前错题已清零，可以通过个性化学习任务继续巩固掌握。"
    };
  }
}
