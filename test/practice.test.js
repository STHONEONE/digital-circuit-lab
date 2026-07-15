import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Store } from "../server/store.js";
import { PracticeService } from "../server/practice.js";

function fixture() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "digital-circuit-test-"));
  const store = new Store(dataDir);
  return {
    store,
    practice: new PracticeService(store),
    cleanup: () => fs.rmSync(dataDir, { recursive: true, force: true })
  };
}

function semanticEvaluation(overrides = {}) {
  return {
    score: 91,
    correct: true,
    status: "mastered",
    overallComment: "结论与推理均正确。",
    correctPoints: ["核心结论正确"],
    incorrectPoints: [],
    missingKnowledgePoints: [],
    improvementSuggestions: [],
    gradingMode: "ai_semantic",
    gradingVersion: "semantic-v1",
    ...overrides
  };
}

test("choice answer is judged and persisted", async () => {
  const { store, practice, cleanup } = fixture();
  try {
    const result = await practice.answer({
      questionId: "comb-001",
      answer: "B",
      practiceMode: "self_test"
    });
    assert.equal(result.correct, true);
    assert.equal(store.records.length, 1);
    assert.equal(store.records[0].practiceMode, "self_test");
  } finally {
    cleanup();
  }
});

test("wrong answer enters review and affects learning plan", async () => {
  const { practice, cleanup } = fixture();
  try {
    await practice.answer({
      questionId: "base-007",
      answer: "B",
      practiceMode: "normal"
    });
    assert.equal(practice.wrongReviewDetails().length, 1);
    assert.ok(practice.learningPlan().focusKnowledge.includes("德摩根定律"));
  } finally {
    cleanup();
  }
});

test("targeted practice prioritizes the requested knowledge", () => {
  const { practice, cleanup } = fixture();
  try {
    const questions = practice.targeted("比较器", 5);
    assert.ok(questions.length > 0);
    assert.ok(questions.every((question) => question.knowledge.includes("比较器")));
  } finally {
    cleanup();
  }
});

test("personalized learning uses the local bank without calling AI when enough questions exist", async () => {
  const { store, cleanup } = fixture();
  let calls = 0;
  const practice = new PracticeService(store, {
    async generateSelfTest() {
      calls += 1;
      throw new Error("AI should not be called when the local bank is sufficient");
    }
  });
  try {
    const questions = await practice.selfTest("basic-logic", 8, "local-first-learner");
    assert.equal(calls, 0);
    assert.equal(questions.length, 8);
    assert.ok(questions.every((question) => ["single_choice", "fill_blank", "analysis"].includes(question.type)));
    const typeRank = { single_choice: 0, fill_blank: 1, analysis: 2 };
    assert.deepEqual(questions.map((question) => question.type), [...questions]
      .sort((left, right) => typeRank[left.type] - typeRank[right.type])
      .map((question) => question.type));
  } finally {
    cleanup();
  }
});

test("personalized learning calls AI once only for the local bank shortage", async () => {
  const { store, cleanup } = fixture();
  const localQuestion = store.questions({ scope: "basic-logic" }).find((question) => question.type === "single_choice");
  store.questions = () => [localQuestion];
  let calls = 0;
  let requestedCount = 0;
  const practice = new PracticeService(store, {
    async generateSelfTest(profile) {
      calls += 1;
      requestedCount = profile.count;
      return Array.from({ length: profile.count }, (_, index) => ({
        ...localQuestion,
        id: `ai-shortage-${index}`,
        title: `AI 补充任务 ${index + 1}`,
        text: `AI 补充题干 ${index + 1}`,
        generatedSelfTest: true,
        source: "AI 个性化学习"
      }));
    }
  });
  try {
    const questions = await practice.selfTest("basic-logic", 3, "shortage-learner");
    assert.equal(calls, 1);
    assert.equal(requestedCount, 2);
    assert.equal(questions.length, 3);
  } finally {
    cleanup();
  }
});

test("AI self-test uses wrong knowledge and registers generated questions for normal grading", async () => {
  const { store, cleanup } = fixture();
  let receivedProfile;
  const generatedQuestion = {
    id: "ai-selftest-fixture-1",
    scope: "basic-logic",
    chapter: "个性化学习",
    title: "德摩根定律巩固",
    type: "single_choice",
    text: "(A·B)' 等价于什么？",
    options: ["A'+B'", "A'·B'", "A+B", "A·B"],
    answer: 0,
    answerText: "A. A'+B'",
    explanation: "根据德摩根定律，乘积取反等于各变量取反后相加。",
    knowledge: ["德摩根定律"],
    keywords: [],
    difficulty: 2,
    generatedSelfTest: true,
    source: "AI 个性化学习"
  };
  const ai = {
    async generateSelfTest(profile) {
      receivedProfile = profile;
      return [generatedQuestion];
    }
  };
  const practice = new PracticeService(store, ai);

  try {
    await practice.answer({ questionId: "base-007", answer: "B", practiceMode: "normal" });
    const originalQuestions = store.questions.bind(store);
    const profileOnlyQuestion = { ...originalQuestions().find((question) => question.id === "base-007"), type: "profile_only" };
    store.questions = (filters = {}) => Object.keys(filters).length ? [profileOnlyQuestion] : originalQuestions(filters);
    const paper = await practice.selfTest("all", 1);

    assert.equal(paper.length, 1);
    assert.equal(receivedProfile.count, 1);
    assert.ok(receivedProfile.weakKnowledge.some((item) => item.name === "德摩根定律"));
    assert.ok(receivedProfile.knowledgeMastery.some((item) => item.name === "德摩根定律"));
    assert.deepEqual(receivedProfile.targetKnowledgePlan, [receivedProfile.weakKnowledge[0].name]);
    assert.equal(store.questions().some((question) => question.id === generatedQuestion.id), false);
    assert.equal(store.question(generatedQuestion.id)?.generatedSelfTest, true);

    const result = await practice.answer({
      questionId: generatedQuestion.id,
      answer: "A",
      practiceMode: "self_test"
    });
    assert.equal(result.correct, true);
    assert.equal(store.records.at(-1).practiceMode, "self_test");
  } finally {
    cleanup();
  }
});

test("AI self-test profile isolates wrong knowledge by learner", async () => {
  const { store, cleanup } = fixture();
  const practice = new PracticeService(store);
  try {
    await practice.answer({
      questionId: "base-007",
      answer: "B",
      practiceMode: "normal",
      learnerId: "learner-a"
    });
    await practice.answer({
      questionId: "base-006",
      answer: "B",
      practiceMode: "normal",
      learnerId: "learner-b"
    });

    const profile = practice.selfTestProfile("all", 5, "learner-a");
    const knowledge = profile.weakKnowledge.map((item) => item.name);
    assert.ok(knowledge.includes("德摩根定律"));
    assert.equal(knowledge.includes("或非门"), false);
    assert.equal(profile.targetKnowledgePlan.length, 5);
    assert.ok(profile.targetKnowledgePlan.every((item) => knowledge.includes(item)));
    assert.equal(store.clearRecords("learner-a"), 1);
    assert.equal(store.records.length, 1);
    assert.equal(store.records[0].learnerId, "learner-b");
  } finally {
    cleanup();
  }
});

test("all learning summaries stay isolated by learner", async () => {
  const { practice, cleanup } = fixture();
  try {
    await practice.answer({
      questionId: "base-007",
      answer: "B",
      practiceMode: "normal",
      learnerId: "learner-a"
    });
    await practice.answer({
      questionId: "base-006",
      answer: "B",
      practiceMode: "targeted",
      learnerId: "learner-b"
    });

    assert.equal(practice.stats("learner-a").answered, 1);
    assert.deepEqual(practice.wrongReviewDetails("learner-a").map((item) => item.question.id), ["base-007"]);
    assert.deepEqual(practice.wrongReviewDetails("learner-b").map((item) => item.question.id), ["base-006"]);
    assert.ok(practice.learningPlan("learner-a").focusKnowledge.includes("德摩根定律"));
    assert.ok(practice.progress("learner-a").knowledge.every((item) => item.knowledge !== "或非门"));
    assert.equal(practice.motivation("learner-a").points, 3);
    assert.equal(practice.motivation("learner-b").points, 3);
    assert.ok(practice.recommend("base-001", "learner-a").every((question) => question.id !== "base-001"));
  } finally {
    cleanup();
  }
});

test("analysis answers use AI semantic grading and persist the evaluation", async () => {
  const { store, cleanup } = fixture();
  let received;
  const ai = {
    async gradeAnalysisAnswer(question, studentAnswer) {
      received = { question, studentAnswer };
      return {
        score: 68,
        correct: false,
        status: "partial",
        overallComment: "主要思路正确，但没有说明或门实现。",
        correctPoints: ["说明了任一输入为 1 时输出为 1"],
        incorrectPoints: [],
        missingKnowledgePoints: ["或门实现"],
        improvementSuggestions: ["补充 F=A+B 及其门电路实现"],
        gradingMode: "ai_semantic",
        gradingVersion: "semantic-v1"
      };
    }
  };
  const practice = new PracticeService(store, ai);

  try {
    const result = await practice.answer({
      questionId: "base-012",
      answer: "两个输入只要有一个是 1，输出就是 1。",
      practiceMode: "normal",
      learnerId: "semantic-learner"
    });

    assert.equal(received.question.id, "base-012");
    assert.equal(received.studentAnswer, "两个输入只要有一个是 1，输出就是 1。");
    assert.equal(result.score, 68);
    assert.equal(result.correct, false);
    assert.equal(result.evaluation.status, "partial");
    assert.deepEqual(result.evaluation.missingKnowledgePoints, ["或门实现"]);
    assert.equal(store.records.length, 1);
    assert.equal(store.records[0].score, 68);
    assert.equal(store.records[0].gradingMode, "ai_semantic");
    assert.equal(store.records[0].learnerId, "semantic-learner");
    assert.deepEqual(practice.wrongReviewDetails("semantic-learner").map((item) => item.question.id), ["base-012"]);
  } finally {
    cleanup();
  }
});

test("generated analysis variants use AI grading without entering normal records", async () => {
  const { store, cleanup } = fixture();
  let gradedQuestion;
  const ai = {
    async wrongRemediation() {
      return {
        ai: true,
        analysis: "先复习触发沿采样。",
        variantQuestion: sourceQuestion
      };
    },
    async gradeAnalysisAnswer(question) {
      gradedQuestion = question;
      return {
        score: 91,
        correct: true,
        status: "mastered",
        overallComment: "结论与推理均正确。",
        correctPoints: ["正确说明了触发沿采样"],
        incorrectPoints: [],
        missingKnowledgePoints: [],
        improvementSuggestions: ["可以补充建立时间概念"],
        gradingMode: "ai_semantic",
        gradingVersion: "semantic-v1"
      };
    }
  };
  const practice = new PracticeService(store, ai);
  const learnerId = "variant-owner";
  const sourceQuestion = {
    id: "ai-var-semantic-fixture",
    type: "analysis",
    title: "D 触发器变式题",
    text: "D 触发器在上升沿如何更新输出？",
    answerText: "在有效上升沿到来时，Q 更新为该时刻采样到的 D。",
    explanation: "D 触发器在有效边沿采样输入。",
    knowledge: ["D 触发器", "边沿触发"],
    generatedVariant: true
  };

  try {
    const remediation = await practice.wrongRemediation({
      questionId: "base-007",
      userAnswer: "错误答案"
    }, learnerId);
    assert.equal(remediation.variantQuestion.id, sourceQuestion.id);
    const result = await practice.answer({
      questionId: sourceQuestion.id,
      sourceQuestion: { ...sourceQuestion, answerText: "客户端篡改的参考答案" },
      answer: "时钟从低变高的一刻，输出取当时的 D。",
      practiceMode: "ai_variant",
      learnerId
    });

    assert.equal(result.score, 91);
    assert.equal(result.correct, true);
    assert.equal(gradedQuestion.answerText, sourceQuestion.answerText);
    assert.equal(store.records.length, 0);
    assert.equal(store.questions().some((question) => question.id === sourceQuestion.id), false);
    assert.equal(store.question(sourceQuestion.id), undefined);
  } finally {
    cleanup();
  }
});

test("forged generated variants are rejected before AI grading", async () => {
  const { store, cleanup } = fixture();
  let gradingCalls = 0;
  const practice = new PracticeService(store, {
    async gradeAnalysisAnswer() {
      gradingCalls += 1;
      throw new Error("不应调用");
    }
  });
  const sourceQuestion = {
    id: "forged-ai-variant",
    type: "analysis",
    text: "伪造题目",
    answerText: "伪造答案",
    generatedVariant: true
  };
  try {
    await assert.rejects(
      () => practice.answer({
        questionId: sourceQuestion.id,
        sourceQuestion,
        answer: "任意答案",
        learnerId: "forged-owner"
      }),
      (error) => error.status === 404 && error.code === "AI_VARIANT_NOT_REGISTERED"
    );
    assert.equal(gradingCalls, 0);
    assert.equal(store.records.length, 0);
  } finally {
    cleanup();
  }
});

test("registered variants expire and cannot be used by another learner", async () => {
  const { store, cleanup } = fixture();
  let now = 1000;
  let gradingCalls = 0;
  const practice = new PracticeService(store, {
    async gradeAnalysisAnswer() {
      gradingCalls += 1;
      return semanticEvaluation();
    }
  }, { now: () => now, generatedVariantTtlMs: 100 });
  const sourceQuestion = {
    id: "owned-ai-variant",
    type: "analysis",
    text: "说明 D 触发器如何采样。",
    answerText: "在有效时钟沿采样 D。",
    generatedVariant: true
  };
  try {
    practice.registerGeneratedVariant("learner-owner", sourceQuestion);
    await assert.rejects(
      () => practice.answer({
        questionId: sourceQuestion.id,
        answer: "在时钟沿采样。",
        learnerId: "learner-other"
      }),
      (error) => error.status === 404 && error.code === "AI_VARIANT_NOT_AVAILABLE"
    );
    now = 1100;
    await assert.rejects(
      () => practice.answer({
        questionId: sourceQuestion.id,
        answer: "在时钟沿采样。",
        learnerId: "learner-owner"
      }),
      (error) => error.status === 410 && error.code === "AI_VARIANT_EXPIRED"
    );
    assert.equal(gradingCalls, 0);
    assert.equal(store.records.length, 0);
  } finally {
    cleanup();
  }
});

test("generated variant registry stays bounded", () => {
  const { store, cleanup } = fixture();
  const practice = new PracticeService(store, null, { generatedVariantLimit: 2 });
  const variant = (id) => ({
    id,
    type: "analysis",
    text: `题目 ${id}`,
    answerText: `答案 ${id}`,
    generatedVariant: true
  });
  try {
    practice.registerGeneratedVariant("bounded-owner", variant("bounded-1"));
    practice.registerGeneratedVariant("bounded-owner", variant("bounded-2"));
    practice.registerGeneratedVariant("bounded-owner", variant("bounded-3"));
    assert.equal(practice.generatedVariants.size, 2);
    assert.throws(
      () => practice.registeredGeneratedVariant("bounded-owner", "bounded-1"),
      (error) => error.code === "AI_VARIANT_NOT_REGISTERED"
    );
    assert.equal(practice.registeredGeneratedVariant("bounded-owner", "bounded-3").id, "bounded-3");
  } finally {
    cleanup();
  }
});

test("analysis rate limiting does not affect choice or fill-blank grading", async () => {
  const { store, cleanup } = fixture();
  let gradingCalls = 0;
  const practice = new PracticeService(store, {
    async gradeAnalysisAnswer() {
      gradingCalls += 1;
      return semanticEvaluation();
    }
  }, { analysisRateLimit: 1, analysisRateWindowMs: 60_000 });
  const rateKeys = ["learner:rate-owner", "ip:rate-ip"];
  try {
    await practice.answer({
      questionId: "base-012",
      answer: "F=A+B，可由或门实现。",
      learnerId: "rate-owner",
      analysisRateKeys: rateKeys
    });
    await assert.rejects(
      () => practice.answer({
        questionId: "comb-012",
        answer: "先列真值表，再写表达式并化简。",
        learnerId: "rotated-learner",
        analysisRateKeys: ["learner:rotated-learner", "ip:rate-ip"]
      }),
      (error) => error.status === 429 && error.code === "AI_GRADING_RATE_LIMITED"
        && error.retryAfterSeconds > 0
    );
    await assert.rejects(
      () => practice.answer({
        questionId: "comb-012",
        answer: "先列真值表，再写表达式并化简。",
        learnerId: "rate-owner",
        analysisRateKeys: ["learner:rate-owner", "ip:rotated-ip"]
      }),
      (error) => error.status === 429 && error.code === "AI_GRADING_RATE_LIMITED"
    );
    const choice = await practice.answer({
      questionId: "comb-001",
      answer: "B",
      learnerId: "rate-owner",
      analysisRateKeys: rateKeys
    });
    const fillBlank = await practice.answer({
      questionId: "base-004",
      answer: "01011001，也可以写成 0101 1001",
      learnerId: "rate-owner",
      analysisRateKeys: rateKeys
    });
    assert.equal(choice.correct, true);
    assert.equal(fillBlank.correct, true);
    assert.equal(gradingCalls, 1);
    assert.equal(store.records.length, 3);
  } finally {
    cleanup();
  }
});

test("global analysis concurrency rejects excess AI work while choices remain available", async () => {
  const { store, cleanup } = fixture();
  let markStarted;
  let releaseGrading;
  const started = new Promise((resolve) => { markStarted = resolve; });
  const release = new Promise((resolve) => { releaseGrading = resolve; });
  const practice = new PracticeService(store, {
    async gradeAnalysisAnswer() {
      markStarted();
      await release;
      return semanticEvaluation();
    }
  }, { analysisGlobalConcurrency: 1, analysisRateLimit: 10 });
  try {
    const first = practice.answer({
      questionId: "base-012",
      answer: "F=A+B，可由或门实现。",
      learnerId: "global-a",
      analysisRateKeys: ["learner:global-a", "ip:global-a"]
    });
    await started;
    await assert.rejects(
      () => practice.answer({
        questionId: "comb-012",
        answer: "列真值表，写表达式并化简。",
        learnerId: "global-b",
        analysisRateKeys: ["learner:global-b", "ip:global-b"]
      }),
      (error) => error.status === 429 && error.code === "AI_GRADING_CAPACITY"
    );
    const choice = await practice.answer({
      questionId: "comb-001",
      answer: "B",
      learnerId: "global-b",
      analysisRateKeys: ["learner:global-b", "ip:global-b"]
    });
    assert.equal(choice.correct, true);
    releaseGrading();
    await first;
    assert.equal(store.records.length, 2);
  } finally {
    releaseGrading?.();
    cleanup();
  }
});

test("failed AI grading does not create a wrong-answer record", async () => {
  const { store, cleanup } = fixture();
  const ai = {
    async gradeAnalysisAnswer() {
      const error = new Error("AI 语义判题请求失败，请稍后重试。");
      error.status = 502;
      error.code = "AI_GRADING_FAILED";
      throw error;
    }
  };
  const practice = new PracticeService(store, ai);
  try {
    await assert.rejects(
      () => practice.answer({ questionId: "base-012", answer: "任一输入为 1 时输出为 1。" }),
      (error) => error.code === "AI_GRADING_FAILED"
    );
    assert.equal(store.records.length, 0);
    assert.equal(practice.wrongReviewDetails().length, 0);
  } finally {
    cleanup();
  }
});

test("wrong review remains until the learner manually confirms mastery", async () => {
  const { practice, cleanup } = fixture();
  try {
    await practice.answer({ questionId: "comb-001", answer: "A", learnerId: "manual-review" });
    await practice.answer({ questionId: "comb-001", answer: "B", practiceMode: "wrong_review", learnerId: "manual-review" });
    assert.equal(practice.wrongReviewDetails("manual-review").length, 1);

    practice.confirmWrongReview("comb-001", "manual-review");
    assert.equal(practice.wrongReviewDetails("manual-review").length, 0);

    await practice.answer({ questionId: "comb-001", answer: "A", learnerId: "manual-review" });
    assert.equal(practice.wrongReviewDetails("manual-review").length, 1);
  } finally {
    cleanup();
  }
});

test("saved personalized tasks retain their questions and completion state", async () => {
  const { store, practice, cleanup } = fixture();
  try {
    const questions = await practice.selfTest("basic-logic", 5, "task-learner");
    const task = store.createPersonalizedTask({ learnerId: "task-learner", scope: "basic-logic", questions });
    const choice = task.questions.find((question) => question.type === "single_choice");
    assert.ok(choice);

    await practice.answer({
      questionId: choice.id,
      answer: String(choice.answer),
      practiceMode: "self_test",
      learnerId: "task-learner",
      taskId: task.id
    });
    const saved = store.personalizedTask("task-learner", task.id);
    assert.ok(saved.answers[choice.id]);
    assert.equal(saved.answers[choice.id].correct, true);
    assert.equal(store.personalizedTasksForLearner("task-learner").length, 1);
  } finally {
    cleanup();
  }
});

test("mastery waits for three independent questions and reports confidence", async () => {
  const { store, practice, cleanup } = fixture();
  try {
    const questionGroups = new Map();
    store.questions().filter((question) => question.type === "single_choice").forEach((question) => {
      (question.knowledge || []).forEach((knowledge) => {
        const items = questionGroups.get(knowledge) || [];
        items.push(question);
        questionGroups.set(knowledge, items);
      });
    });
    const [knowledge, candidates] = [...questionGroups.entries()].find(([, items]) => items.length >= 3);
    await Promise.all(candidates.slice(0, 2).map((question) => practice.answer({
      questionId: question.id,
      answer: String(question.answer),
      learnerId: "mastery-learner"
    })));
    const first = practice.knowledgeStats("mastery-learner").find((item) => item.knowledge === knowledge);
    assert.equal(first.rate, null);
    assert.equal(first.confidence, "数据不足");

    const third = candidates[2];
    await practice.answer({ questionId: third.id, answer: String(third.answer), learnerId: "mastery-learner" });
    const second = practice.knowledgeStats("mastery-learner").find((item) => item.knowledge === knowledge);
    assert.ok(["低置信度", "中置信度", "高置信度"].includes(second.confidence));
  } finally {
    cleanup();
  }
});
