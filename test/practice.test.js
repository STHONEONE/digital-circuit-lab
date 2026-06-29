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
      answer: "A",
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
      questionId: "base-004",
      answer: "A",
      practiceMode: "normal"
    });
    assert.equal(practice.wrongReviewDetails().length, 1);
    assert.equal(practice.learningPlan().primaryFocus, "德摩根定律");
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
