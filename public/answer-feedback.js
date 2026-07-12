(() => {
  const sectionDefinitions = [
    ["correctPoints", "正确点", "尚未识别到明确得分点"],
    ["incorrectPoints", "错误点", "未发现明显错误"],
    ["missingKnowledgePoints", "遗漏知识点", "未发现明显遗漏"],
    ["improvementSuggestions", "改进建议", "保持当前解题结构，并检查表达是否完整"]
  ];

  const verdicts = {
    mastered: "掌握良好",
    passed: "达到要求",
    partial: "部分得分",
    incorrect: "需要巩固"
  };

  function addEvaluationSection(grid, evaluation, [field, title, emptyMessage]) {
    const section = document.createElement("section");
    section.className = `answer-evaluation-section answer-evaluation-${field}`;
    const heading = document.createElement("h4");
    heading.textContent = title;
    const list = document.createElement("ul");
    const items = Array.isArray(evaluation[field]) ? evaluation[field].filter(Boolean) : [];
    (items.length ? items : [emptyMessage]).forEach((item) => {
      const listItem = document.createElement("li");
      listItem.textContent = String(item);
      if (!items.length) listItem.className = "answer-evaluation-empty";
      list.append(listItem);
    });
    section.append(heading, list);
    grid.append(section);
  }

  function renderEvaluation(container, { result, referenceAnswer = "", explanation = "", compact = false } = {}) {
    const evaluation = result?.evaluation;
    if (!container || !evaluation || !Number.isFinite(Number(evaluation.score))) return null;
    const status = verdicts[evaluation.status] ? evaluation.status : "incorrect";
    container.textContent = "";
    const article = document.createElement("section");
    article.className = `answer-evaluation is-${status}${compact ? " is-compact" : ""}`;
    article.setAttribute("role", "status");
    article.setAttribute("aria-live", "polite");

    const heading = document.createElement("header");
    heading.className = "answer-evaluation-heading";
    const label = document.createElement("span");
    label.className = "answer-evaluation-label";
    label.textContent = "AI 语义判题";
    const score = document.createElement("strong");
    score.className = "answer-evaluation-score";
    score.textContent = `${Math.round(Number(evaluation.score))} / 100`;
    const verdict = document.createElement("span");
    verdict.className = "answer-evaluation-verdict";
    verdict.textContent = verdicts[status];
    heading.append(label, score, verdict);

    const comment = document.createElement("p");
    comment.className = "answer-evaluation-comment";
    comment.textContent = evaluation.overallComment || "AI 已完成语义评分。";

    const grid = document.createElement("div");
    grid.className = "answer-evaluation-grid";
    sectionDefinitions.forEach((definition) => addEvaluationSection(grid, evaluation, definition));

    const reference = document.createElement("details");
    reference.className = "answer-reference";
    const summary = document.createElement("summary");
    summary.textContent = "查看参考答案与解析";
    const referenceBody = document.createElement("div");
    referenceBody.className = "answer-reference-body";
    const answerTitle = document.createElement("strong");
    answerTitle.textContent = "参考答案";
    const answerCopy = document.createElement("p");
    answerCopy.textContent = referenceAnswer || result.referenceAnswer || "暂无参考答案";
    const explanationTitle = document.createElement("strong");
    explanationTitle.textContent = "解析";
    const explanationCopy = document.createElement("p");
    explanationCopy.textContent = explanation || result.explanation || "暂无补充解析";
    referenceBody.append(answerTitle, answerCopy, explanationTitle, explanationCopy);
    reference.append(summary, referenceBody);

    article.append(heading, comment, grid, reference);
    container.append(article);
    return { article, referenceBody };
  }

  function renderNotice(container, message, tone = "error") {
    if (!container) return;
    container.textContent = "";
    const notice = document.createElement("div");
    notice.className = `answer-evaluation-notice is-${tone}`;
    notice.setAttribute("role", "status");
    notice.textContent = message;
    container.append(notice);
  }

  window.answerFeedback = { renderEvaluation, renderNotice };
})();
