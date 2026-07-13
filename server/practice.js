const allowedModes = new Set(["normal", "targeted", "wrong_review", "self_test"]);

function accuracy(records) {
  if (!records.length) return 0;
  return Math.round(records.filter((record) => record.correct).length * 100 / records.length);
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
    const storedQuestion = this.store.question(request.questionId);
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

    if (storedQuestion) {
      this.store.addRecord({
        questionId: question.id,
        userAnswer,
        correct,
        knowledge: question.knowledge || [],
        practiceMode: mode(request.practiceMode),
        focusKnowledge: request.focusKnowledge || "",
        ...(evaluation ? {
          score: evaluation.score,
          gradingMode: evaluation.gradingMode,
          gradingStatus: evaluation.status,
          gradingVersion: evaluation.gradingVersion,
          gradingEvaluation: evaluation
        } : {}),
        ...(request.learnerId ? { learnerId: request.learnerId } : {})
      });
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
        evaluation
      };
    }

    return {
      correct,
      message: correct ? "回答正确" : "需要巩固",
      referenceAnswer: question.type === "single_choice"
        ? `${String.fromCharCode(65 + question.answer)}. ${question.options[question.answer]}`
        : question.answerText,
      explanation: question.explanation,
      matchedKeywords
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
    return {
      answered: records.length,
      correctRate: accuracy(records),
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
    const latest = new Map();
    const attempts = new Map();
    this.recordsForLearner(learnerId).forEach((record) => {
      latest.set(record.questionId, record);
      if (!record.correct) attempts.set(record.questionId, (attempts.get(record.questionId) || 0) + 1);
    });
    return [...latest.entries()].filter(([, record]) => !record.correct)
      .map(([id, record]) => ({
        question: this.store.question(id),
        wrongAttempts: attempts.get(id) || 1,
        latestAttempt: {
          userAnswer: record.userAnswer || "",
          answeredAt: record.answeredAt || "",
          evaluation: record.gradingEvaluation || null
        }
      }))
      .filter((item) => item.question)
      .sort((left, right) => right.wrongAttempts - left.wrongAttempts);
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
      const rate = accuracy(records);
      return {
        knowledge,
        attempts: records.length,
        correct: records.filter((record) => record.correct).length,
        rate,
        status: rate >= 80 ? "已掌握" : rate >= 60 ? "提升中" : "需巩固"
      };
    }).sort((left, right) => left.rate - right.rate || left.knowledge.localeCompare(right.knowledge));
  }

  learningPlan(learnerId = "") {
    const records = this.recordsForLearner(learnerId);
    const knowledge = this.knowledgeStats(learnerId);
    let focusKnowledge = knowledge.filter((item) => item.rate < 80)
      .slice(0, 3).map((item) => item.knowledge);
    if (!focusKnowledge.length) {
      focusKnowledge = [...new Set(this.store.questions().flatMap((question) => question.knowledge || []))].slice(0, 3);
    }
    const primaryFocus = focusKnowledge[0] || "综合基础";
    const targeted = records.filter((record) => record.practiceMode === "targeted").length;
    const selfTests = records.filter((record) => record.practiceMode === "self_test").length;
    const unresolved = this.wrongReviewDetails(learnerId).length;
    const hasRecords = records.length > 0;
    return {
      focusKnowledge,
      primaryFocus,
      steps: [
        {
          order: 1, title: "诊断薄弱点",
          detail: hasRecords ? `当前优先巩固：${focusKnowledge.join("、")}` : "先完成一轮智能组卷自测。",
          status: hasRecords ? "已完成" : "进行中"
        },
        {
          order: 2, title: "针对训练",
          detail: targeted ? `已完成 ${targeted} 次针对练习。` : `围绕“${primaryFocus}”完成至少 3 题。`,
          status: targeted >= 3 ? "已完成" : "进行中"
        },
        {
          order: 3, title: "错题复盘",
          detail: unresolved ? `还有 ${unresolved} 道错题需要复盘。` : "当前没有待复盘错题。",
          status: unresolved ? "待完成" : hasRecords ? "已完成" : "待完成"
        },
        {
          order: 4, title: "阶段自测",
          detail: selfTests ? `已记录 ${selfTests} 次自测答题。` : "训练后完成阶段自测。",
          status: selfTests >= 5 ? "已完成" : "待完成"
        }
      ],
      review: hasRecords && knowledge.length
        ? `已完成 ${records.length} 次作答；当前“${knowledge[0].knowledge}”正确率为 ${knowledge[0].rate}%，下一轮优先安排该方向。`
        : "尚未形成学习轨迹。建议先进行 AI 阶段自测，完成初始诊断。"
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
      focusKnowledge: [...new Set(targetKnowledgePlan)],
      targetKnowledgePlan,
      availableKnowledge,
      wrongQuestions
    };
  }

  async selfTest(scope, count, learnerId = "") {
    if (!this.ai?.generateSelfTest) {
      const error = new Error("阶段自测的大模型服务不可用，请稍后重试。");
      error.status = 503;
      error.code = "AI_SELF_TEST_UNAVAILABLE";
      throw error;
    }
    const questions = await this.ai.generateSelfTest(this.selfTestProfile(scope, count, learnerId));
    return this.store.addGeneratedSelfTestQuestions(questions);
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
    const records = this.recordsForLearner(learnerId);
    const rounds = [];
    for (let start = 0, index = 1; start < records.length; start += 5, index += 1) {
      const batch = records.slice(start, start + 5);
      const counts = Object.groupBy
        ? Object.groupBy(batch, (record) => mode(record.practiceMode))
        : batch.reduce((result, record) => {
          const key = mode(record.practiceMode);
          result[key] = [...(result[key] || []), record];
          return result;
        }, {});
      const dominant = Object.entries(counts).sort((left, right) => right[1].length - left[1].length)[0]?.[0] || "normal";
      rounds.push({
        round: `第${index}轮`,
        answered: batch.length,
        correctRate: accuracy(batch),
        mode: { normal: "普通练习", targeted: "针对训练", wrong_review: "错题复盘", self_test: "阶段自测" }[dominant]
      });
    }
    const size = Math.min(5, records.length);
    const baselineRate = size ? accuracy(records.slice(0, size)) : 0;
    const recentRate = size ? accuracy(records.slice(-size)) : 0;
    const personalized = records.filter((record) => ["targeted", "wrong_review"].includes(record.practiceMode));
    const personalizedRate = accuracy(personalized);
    const improvement = recentRate - baselineRate;
    let conclusion = "完成至少 3 次针对训练或累计 10 次作答后，系统将验证个性化方向。";
    if (personalized.length >= 3) {
      conclusion = personalizedRate >= baselineRate + 10
        ? "针对训练正确率高于初始水平，当前个性化学习方向有效。"
        : personalizedRate >= baselineRate
          ? "针对训练已达到初始水平，建议继续当前方向并增加练习量。"
          : "针对训练仍低于初始水平，系统将增加基础题和错题复盘。";
    }
    return {
      rounds,
      knowledge: this.knowledgeStats(learnerId),
      effectiveness: {
        baselineRate, recentRate, improvement,
        personalizedAttempts: personalized.length,
        personalizedRate,
        directionEffective: personalized.length >= 3 && personalizedRate >= baselineRate + 10,
        conclusion
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
    if (records.length >= 5) badges.push("初次自测");
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
        ? "完成第一组自测，系统就能为你生成专属学习路线。"
        : this.wrongReviewDetails(learnerId).length
          ? `本轮优先攻克 ${this.learningPlan(learnerId).primaryFocus}，每订正一道错题都会推动路线前进。`
          : "当前错题已清零，可以通过阶段自测验证掌握是否稳定。"
    };
  }
}
