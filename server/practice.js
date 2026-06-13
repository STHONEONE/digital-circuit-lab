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

export class PracticeService {
  constructor(store) {
    this.store = store;
  }

  answer(request) {
    const question = this.store.question(request.questionId);
    if (!question) throw new Error("题目不存在");
    const userAnswer = String(request.answer || "").trim();
    let correct = false;
    let matchedKeywords = [];

    if (question.type === "single_choice") {
      const upper = userAnswer.toUpperCase();
      const value = /^[A-Z]$/.test(upper) ? upper.charCodeAt(0) - 65 : Number(upper);
      correct = value === question.answer;
    } else {
      matchedKeywords = (question.keywords || [])
        .filter((keyword) => normalized(userAnswer).includes(normalized(keyword)));
      const required = Math.max(2, Math.ceil((question.keywords || []).length * 0.45));
      correct = question.keywords?.length > 0 && matchedKeywords.length >= required;
    }

    this.store.addRecord({
      questionId: question.id,
      userAnswer,
      correct,
      knowledge: question.knowledge || [],
      practiceMode: mode(request.practiceMode),
      focusKnowledge: request.focusKnowledge || ""
    });

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

  wrongKnowledgeCounts() {
    const counts = {};
    this.store.records.filter((record) => !record.correct).forEach((record) => {
      (record.knowledge || []).forEach((item) => {
        counts[item] = (counts[item] || 0) + 1;
      });
    });
    return counts;
  }

  stats() {
    return {
      answered: this.store.records.length,
      correctRate: accuracy(this.store.records),
      wrongKnowledge: this.wrongKnowledgeCounts()
    };
  }

  recommend(currentId) {
    const current = this.store.question(currentId);
    const weak = Object.entries(this.wrongKnowledgeCounts())
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

  wrongReviewDetails() {
    const latest = new Map();
    const attempts = new Map();
    this.store.records.forEach((record) => {
      latest.set(record.questionId, record);
      if (!record.correct) attempts.set(record.questionId, (attempts.get(record.questionId) || 0) + 1);
    });
    return [...latest.entries()].filter(([, record]) => !record.correct)
      .map(([id]) => ({ question: this.store.question(id), wrongAttempts: attempts.get(id) || 1 }))
      .filter((item) => item.question)
      .sort((left, right) => right.wrongAttempts - left.wrongAttempts);
  }

  knowledgeStats() {
    const groups = new Map();
    this.store.records.forEach((record) => {
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

  learningPlan() {
    const knowledge = this.knowledgeStats();
    let focusKnowledge = knowledge.filter((item) => item.rate < 80)
      .slice(0, 3).map((item) => item.knowledge);
    if (!focusKnowledge.length) {
      focusKnowledge = [...new Set(this.store.questions().flatMap((question) => question.knowledge || []))].slice(0, 3);
    }
    const primaryFocus = focusKnowledge[0] || "综合基础";
    const targeted = this.store.records.filter((record) => record.practiceMode === "targeted").length;
    const selfTests = this.store.records.filter((record) => record.practiceMode === "self_test").length;
    const unresolved = this.wrongReviewDetails().length;
    const hasRecords = this.store.records.length > 0;
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
        ? `已完成 ${this.store.records.length} 次作答；当前“${knowledge[0].knowledge}”正确率为 ${knowledge[0].rate}%，下一轮优先安排该方向。`
        : "尚未形成学习轨迹。建议先进行智能组卷自测，完成初始诊断。"
    };
  }

  selfTest(scope, count) {
    const weak = this.wrongKnowledgeCounts();
    const answered = new Set(this.store.records.map((record) => record.questionId));
    return this.store.questions({ scope }).map((question) => ({
      question,
      score: Number(!answered.has(question.id)) * 5
        + (question.knowledge || []).reduce((sum, item) => sum + (weak[item] || 0) * 10, 0)
        + (question.difficulty || 0)
    })).sort((left, right) => right.score - left.score)
      .slice(0, Math.max(1, Math.min(Number(count) || 5, 20)))
      .map((entry) => entry.question);
  }

  targeted(knowledge, count) {
    const focus = String(knowledge || Object.entries(this.wrongKnowledgeCounts())
      .sort((left, right) => right[1] - left[1])[0]?.[0] || "").trim();
    const matched = this.store.questions()
      .filter((question) => !focus || question.knowledge?.includes(focus))
      .sort((left, right) => left.difficulty - right.difficulty)
      .slice(0, Math.max(1, Math.min(Number(count) || 5, 20)));
    return matched.length ? matched : this.selfTest(null, count);
  }

  progress() {
    const records = this.store.records;
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
      knowledge: this.knowledgeStats(),
      effectiveness: {
        baselineRate, recentRate, improvement,
        personalizedAttempts: personalized.length,
        personalizedRate,
        directionEffective: personalized.length >= 3 && personalizedRate >= baselineRate + 10,
        conclusion
      },
      unresolvedWrong: this.wrongReviewDetails().length
    };
  }

  motivation() {
    const records = this.store.records;
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
        : this.wrongReviewDetails().length
          ? `本轮优先攻克 ${this.learningPlan().primaryFocus}，每订正一道错题都会推动路线前进。`
          : "当前错题已清零，可以通过阶段自测验证掌握是否稳定。"
    };
  }
}
