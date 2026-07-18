import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Store } from "../server/store.js";
import { ExperimentLearningService } from "../server/experiment-learning.js";
import { PracticeService } from "../server/practice.js";

function fixture() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "digital-circuit-experiment-"));
  const store = new Store(dataDir);
  const definitions = {
    get(experimentId) {
      if (experimentId !== "full-adder") return null;
      return {
        id: "full-adder",
        version: 1,
        title: "全加器",
        knowledge: ["全加器", "二进制加法", "进位逻辑"],
        controls: ["A", "B", "Cin"],
        totalCases: 8,
        evaluate(state) {
          const total = state.A + state.B + state.Cin;
          return { S: total % 2, Cout: total >= 2 ? 1 : 0 };
        }
      };
    }
  };
  return {
    dataDir,
    store,
    learning: new ExperimentLearningService(store, definitions),
    cleanup: () => fs.rmSync(dataDir, { recursive: true, force: true })
  };
}

test("learner can start and recover an active full-adder experiment session", () => {
  const { dataDir, learning, cleanup } = fixture();
  try {
    const started = learning.start("learner-a", "full-adder");

    assert.equal(started.learnerId, "learner-a");
    assert.equal(started.experimentId, "full-adder");
    assert.equal(started.definitionVersion, 1);
    assert.equal(started.status, "active");
    assert.equal(started.revision, 0);
    assert.equal(started.events[0].type, "session.started");

    const reloaded = new ExperimentLearningService(new Store(dataDir), {
      get: (id) => id === "full-adder" ? {
        id,
        version: 1,
        title: "全加器",
        knowledge: ["全加器"],
        controls: ["A", "B", "Cin"],
        totalCases: 8
      } : null
    });
    assert.equal(reloaded.active("learner-a", "full-adder").id, started.id);
  } finally {
    cleanup();
  }
});

test("a definition upgrade supersedes an incompatible active session", () => {
  const { store, learning, cleanup } = fixture();
  try {
    const original = learning.start("learner-a", "full-adder");
    const upgraded = new ExperimentLearningService(store, {
      get: (id) => id === "full-adder" ? {
        id,
        version: 2,
        title: "全加器",
        knowledge: ["全加器"],
        controls: ["A", "B", "Cin"],
        totalCases: 8,
        evaluate: (state) => ({ S: state.A ^ state.B ^ state.Cin, Cout: 0 })
      } : null
    });
    const restarted = upgraded.start("learner-a", "full-adder");
    assert.notEqual(restarted.id, original.id);
    assert.equal(restarted.definitionVersion, 2);
    assert.equal(store.experimentSession("learner-a", original.id).status, "superseded");
  } finally {
    cleanup();
  }
});

test("prediction and simulation run create grounded coverage evidence", () => {
  const { learning, cleanup } = fixture();
  try {
    const session = learning.start("learner-a", "full-adder");
    const predicted = learning.record("learner-a", session.id, {
      type: "prediction.submitted",
      state: { A: 1, B: 0, Cin: 1 },
      prediction: { S: 0, Cout: 1 },
      hintLevel: 0
    });
    assert.equal(predicted.revision, 1);
    assert.equal(predicted.predictions.length, 1);

    const simulated = learning.record("learner-a", session.id, {
      type: "simulation.run",
      state: { A: 1, B: 0, Cin: 1 },
      outputs: { S: 1, Cout: 0 }
    });

    assert.equal(simulated.revision, 2);
    assert.deepEqual(simulated.lastRun.outputs, { S: 0, Cout: 1 });
    assert.equal(simulated.lastRun.predictionCorrect, true);
    assert.deepEqual(simulated.testedCases, ["101"]);
    assert.equal(simulated.coverage, 12.5);
    assert.equal(simulated.evidence.length, 1);
    assert.equal(simulated.evidence[0].weight, 0.8);
  } finally {
    cleanup();
  }
});

test("a case cannot reveal outputs before prediction or earn duplicate evidence", () => {
  const { learning, cleanup } = fixture();
  try {
    const session = learning.start("learner-a", "full-adder");
    assert.throws(() => learning.record("learner-a", session.id, {
      type: "simulation.run",
      state: { A: 1, B: 1, Cin: 0 }
    }), (error) => error.code === "EXPERIMENT_PREDICTION_REQUIRED" && error.status === 409);

    learning.record("learner-a", session.id, {
      type: "prediction.submitted",
      state: { A: 1, B: 1, Cin: 0 },
      prediction: { S: 0, Cout: 1 },
      hintLevel: 0
    });
    assert.throws(() => learning.record("learner-a", session.id, {
      type: "prediction.submitted",
      state: { A: 1, B: 1, Cin: 0 },
      prediction: { S: 1, Cout: 0 },
      hintLevel: 0
    }), (error) => error.code === "EXPERIMENT_PREDICTION_LOCKED" && error.status === 409);
    const verified = learning.record("learner-a", session.id, {
      type: "simulation.run",
      state: { A: 1, B: 1, Cin: 0 }
    });
    assert.equal(verified.evidence.length, 1);
    assert.throws(() => learning.record("learner-a", session.id, {
      type: "prediction.submitted",
      state: { A: 1, B: 1, Cin: 0 },
      prediction: { S: 1, Cout: 0 }
    }), (error) => error.code === "EXPERIMENT_CASE_LOCKED" && error.status === 409);
    assert.equal(learning.session("learner-a", session.id).evidence.length, 1);
  } finally {
    cleanup();
  }
});

test("lost experiment event responses can be retried idempotently", () => {
  const { learning, cleanup } = fixture();
  try {
    const session = learning.start("learner-a", "full-adder");
    const predictionEvent = {
      eventId: "prediction-110",
      type: "prediction.submitted",
      state: { A: 1, B: 1, Cin: 0 },
      prediction: { S: 0, Cout: 1 },
      hintLevel: 0
    };
    const predicted = learning.record("learner-a", session.id, predictionEvent);
    const predictionRetry = learning.record("learner-a", session.id, predictionEvent);
    assert.equal(predictionRetry.revision, predicted.revision);
    assert.equal(predictionRetry.events.length, predicted.events.length);
    assert.equal(predictionRetry.predictions.length, 1);

    assert.throws(() => learning.record("learner-a", session.id, {
      ...predictionEvent,
      prediction: { S: 1, Cout: 0 }
    }), (error) => error.code === "EXPERIMENT_EVENT_CONFLICT" && error.status === 409);

    const runEvent = {
      eventId: "simulation-110",
      type: "simulation.run",
      state: { A: 1, B: 1, Cin: 0 }
    };
    const verified = learning.record("learner-a", session.id, runEvent);
    const runRetry = learning.record("learner-a", session.id, runEvent);
    assert.equal(runRetry.revision, verified.revision);
    assert.equal(runRetry.events.length, verified.events.length);
    assert.equal(runRetry.runs.length, 1);
    assert.equal(runRetry.evidence.length, 1);
    assert.deepEqual(runRetry.runs[0].outputs, { S: 0, Cout: 1 });

    const legacyPredictionRetry = learning.record("learner-a", session.id, {
      type: "prediction.submitted",
      state: { A: 1, B: 1, Cin: 0 },
      prediction: { S: 0, Cout: 1 },
      hintLevel: 0
    });
    const legacyRunRetry = learning.record("learner-a", session.id, {
      type: "simulation.run",
      state: { A: 1, B: 1, Cin: 0 }
    });
    assert.equal(legacyPredictionRetry.revision, verified.revision);
    assert.equal(legacyRunRetry.revision, verified.revision);
    assert.equal(legacyRunRetry.evidence.length, 1);
  } finally {
    cleanup();
  }
});

test("prediction must match the experiment output contract", () => {
  const { learning, cleanup } = fixture();
  try {
    const session = learning.start("learner-a", "full-adder");
    for (const prediction of [{ S: 0 }, { S: 0, Cout: 1, forged: 1 }, { S: 7, Cout: 1 }]) {
      assert.throws(() => learning.record("learner-a", session.id, {
        type: "prediction.submitted",
        state: { A: 1, B: 1, Cin: 0 },
        prediction
      }), (error) => error.code === "EXPERIMENT_PREDICTION_INVALID");
    }
  } finally {
    cleanup();
  }
});

test("completed truth-table coverage produces a persistent experiment report", () => {
  const { store, learning, cleanup } = fixture();
  try {
    let session = learning.start("learner-a", "full-adder");
    for (let index = 0; index < 8; index += 1) {
      const state = { A: (index >> 2) & 1, B: (index >> 1) & 1, Cin: index & 1 };
      const total = state.A + state.B + state.Cin;
      const prediction = { S: total % 2, Cout: total >= 2 ? 1 : 0 };
      session = learning.record("learner-a", session.id, {
        type: "prediction.submitted", state, prediction, hintLevel: 0
      });
      session = learning.record("learner-a", session.id, {
        type: "simulation.run", state
      });
    }

    const completed = learning.complete("learner-a", session.id, {
      conclusion: "全加器的和位是三输入异或，至少两个输入为 1 时产生进位。"
    });

    assert.equal(completed.session.status, "completed");
    assert.equal(completed.report.coverage, 100);
    assert.equal(completed.report.testedCases.length, 8);
    assert.equal(completed.report.evidenceSummary.independent, 8);
    assert.equal(completed.report.evidenceSummary.score, 100);
    assert.equal(completed.report.conclusion.includes("至少两个输入"), true);
    assert.equal(learning.reports("learner-a")[0].id, completed.report.id);

    store.experimentReports = [];
    const recovered = learning.complete("learner-a", session.id, { conclusion: "恢复报告" });
    assert.equal(recovered.report.sessionId, session.id);
    assert.equal(learning.reports("learner-a").length, 1);
  } finally {
    cleanup();
  }
});

test("independent no-hint experiment predictions contribute to mastery evidence", () => {
  const { store, learning, cleanup } = fixture();
  try {
    let session = learning.start("learner-a", "full-adder");
    for (let index = 0; index < 3; index += 1) {
      const state = { A: 0, B: (index >> 1) & 1, Cin: index & 1 };
      const total = state.A + state.B + state.Cin;
      session = learning.record("learner-a", session.id, {
        type: "prediction.submitted",
        state,
        prediction: { S: total % 2, Cout: total >= 2 ? 1 : 0 },
        hintLevel: 0
      });
      session = learning.record("learner-a", session.id, { type: "simulation.run", state });
    }

    const mastery = new PracticeService(store).knowledgeStats("learner-a")
      .find((item) => item.knowledge === "全加器");
    assert.equal(mastery.rate, 100);
    assert.equal(mastery.uniqueQuestions, 0);
    assert.equal(mastery.experimentPredictions, 3);
    assert.equal(mastery.evidenceCount, 3);
    assert.equal(mastery.confidence, "低置信度");
  } finally {
    cleanup();
  }
});

test("heavily hinted predictions do not by themselves claim mastery", () => {
  const { store, learning, cleanup } = fixture();
  try {
    let session = learning.start("learner-a", "full-adder");
    for (let index = 0; index < 3; index += 1) {
      const state = { A: 0, B: (index >> 1) & 1, Cin: index & 1 };
      const total = state.A + state.B + state.Cin;
      session = learning.record("learner-a", session.id, {
        type: "prediction.submitted",
        state,
        prediction: { S: total % 2, Cout: total >= 2 ? 1 : 0 },
        hintLevel: 2
      });
      session = learning.record("learner-a", session.id, { type: "simulation.run", state });
    }
    const mastery = new PracticeService(store).knowledgeStats("learner-a")
      .find((item) => item.knowledge === "全加器");
    assert.equal(mastery.rate, null);
    assert.equal(mastery.status, "数据不足");
    assert.equal(mastery.independentExperimentPredictions, 0);
  } finally {
    cleanup();
  }
});
