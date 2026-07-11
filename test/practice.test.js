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

test("choice answer is judged and persisted", () => {
  const { store, practice, cleanup } = fixture();
  try {
    const result = practice.answer({
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

test("wrong answer enters review and affects learning plan", () => {
  const { practice, cleanup } = fixture();
  try {
    practice.answer({
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

test("AI self-test uses wrong knowledge and registers generated questions for normal grading", async () => {
  const { store, cleanup } = fixture();
  let receivedProfile;
  const generatedQuestion = {
    id: "ai-selftest-fixture-1",
    scope: "basic-logic",
    chapter: "AI 阶段自测",
    title: "德摩根定律自测",
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
    source: "AI 阶段自测"
  };
  const ai = {
    async generateSelfTest(profile) {
      receivedProfile = profile;
      return [generatedQuestion];
    }
  };
  const practice = new PracticeService(store, ai);

  try {
    practice.answer({ questionId: "base-007", answer: "B", practiceMode: "normal" });
    const paper = await practice.selfTest("all", 1);

    assert.equal(paper.length, 1);
    assert.equal(receivedProfile.count, 1);
    assert.ok(receivedProfile.weakKnowledge.some((item) => item.name === "德摩根定律"));
    assert.deepEqual(receivedProfile.targetKnowledgePlan, [receivedProfile.weakKnowledge[0].name]);
    assert.equal(store.questions().some((question) => question.id === generatedQuestion.id), false);
    assert.equal(store.question(generatedQuestion.id)?.generatedSelfTest, true);

    const result = practice.answer({
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

test("AI self-test profile isolates wrong knowledge by learner", () => {
  const { store, cleanup } = fixture();
  const practice = new PracticeService(store);
  try {
    practice.answer({
      questionId: "base-007",
      answer: "B",
      practiceMode: "normal",
      learnerId: "learner-a"
    });
    practice.answer({
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
