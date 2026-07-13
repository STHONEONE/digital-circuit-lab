# Design QA

- Source visual truth: `C:\Users\STONEO~1\AppData\Local\Temp\codex-clipboard-13beb233-c8b2-4835-9b56-8e8d87cbee1b.png`
- Implementation screenshot: `C:\Users\Stone One\.codex\visualizations\2026\07\11\019f4ec8-3801-7f32-85ac-4f284f0cf20f\left-nav-final-clean.png`
- Scope drawer screenshot: `C:\Users\Stone One\.codex\visualizations\2026\07\11\019f4ec8-3801-7f32-85ac-4f284f0cf20f\left-nav-final-drawer-clean.png`
- Combined comparison: `C:\Users\Stone One\.codex\visualizations\2026\07\11\019f4ec8-3801-7f32-85ac-4f284f0cf20f\left-nav-comparison-final.png`
- Mobile smoke screenshot: `C:\Users\Stone One\.codex\visualizations\2026\07\11\019f4ec8-3801-7f32-85ac-4f284f0cf20f\left-nav-mobile-smoke.png`
- Primary viewport: 1440 × 1024
- State: normal practice, loaded question, transient notices dismissed

## Findings — correction pass

- [Resolved P1] The earlier 190px always-expanded scope panel did not match the reference's narrow navigation rail. The rail is now 112px and the question area starts at x=128.
- [Resolved P1] “练习范围” is now a first-class item inside the Learning Center rail; its detailed choices open in a compact overlay drawer rather than permanently widening the page.
- [Resolved P1] Legacy collapsed-panel state could open an empty drawer. Desktop drawer opening now forces the scope body to be available.
- [Resolved P1] Loading text previously destroyed complex navigation-button markup. Action handling now restores the complete icon/label structure.
- [Resolved P1] Persistent notices obscured the right panel. Success notices now auto-dismiss and all notices can be clicked to close.
- [Resolved P1] Tall questions and explanations could overflow the fixed-height card. Both main and right panels now scroll internally.
- [Resolved P2] The right panel was too narrow and the main panels touched the viewport bottom. It now uses a responsive 320–376px width and preserves a 40px bottom gap at the primary viewport.
- [Resolved P2] Desktop insights created a stray section below the primary console. They are hidden until “学习复盘” is selected.

## Comparison history

- The rejected pass treated the left side as a settings panel and incorrectly accepted a wide rail as a requirement-driven deviation.
- The correction pass rebuilt the information hierarchy to match the supplied reference: logo slot, six vertically ordered icon navigation items, central question console, and a dedicated right learning panel.
- The final same-viewport comparison shows matching left-rail width, central start position, right-panel proportion, panel top alignment, and bottom breathing room. No actionable P0/P1/P2 mismatch remains.

## Required fidelity surfaces

- Typography: existing project typography retained; hierarchy follows the reference.
- Spacing/layout: 112px left rail, 16px content gap, responsive 320–376px right panel, 40px desktop bottom gap.
- Colors/tokens: existing project theme and background retained exactly as requested.
- Image assets: existing circuit background retained. Navigation uses vendored Lucide 0.468.0 icons rather than approximate hand-drawn symbols.
- Copy/content: left navigation labels follow the reference; live question and recommendation content remains data-driven.

## Interaction checks

- Scope drawer opens, supports Escape, restores focus, and closes after a scope selection.
- A legacy `learning-scope-panel-collapsed=1` state cannot leave the desktop drawer empty.
- Learning Center, personalized route, wrong-review, self-test, and learning-review controls retain their existing behavior.
- Complex navigation markup remains intact after asynchronous actions.
- Success notices auto-dismiss; notices are manually dismissible.
- Desktop widths 960, 1024, 1080, and 1440 show the narrow rail without horizontal overflow.
- Mobile 390 × 844 keeps the existing mobile layout, hides desktop-only logo/icons, and has no horizontal overflow.
- Browser console and page errors: none.
- Automated project tests: 11/11 passed.

## Accepted P3 differences

- The target contains a custom hexagonal brand mark, but no source brand asset or Figma node was supplied. The closest Lucide circuit-board icon is used without changing the product theme.
- The implementation keeps the existing animated circuit background and live data-driven diagrams, so content density can differ from the static reference.

final result: passed

## Learning route workbench — 2026-07-13

- Source visual truth: `C:\Users\Stone One\.codex\generated_images\019f4ec8-3801-7f32-85ac-4f284f0cf20f\exec-b54a6a63-f251-4a98-9453-7ec4f6709665.png`
- Implementation screenshot: `C:\Users\Stone One\.codex\visualizations\2026\07\11\019f4ec8-3801-7f32-85ac-4f284f0cf20f\learning-route-workbench-final.png`
- Side-by-side comparison: `C:\Users\Stone One\.codex\visualizations\2026\07\11\019f4ec8-3801-7f32-85ac-4f284f0cf20f\learning-route-workbench-comparison.png`
- Viewport: 1440 × 1024.
- State: new learner with no answer records; `数制与编码` selected by the live learning-plan API.

### Full-view comparison evidence

- Information architecture matches the selected direction: persistent five-item rail, compact page header, knowledge system on the left, learning path in the center, and current task on the right.
- The source's oversized horizontal four-node path was intentionally replaced with four vertically stacked stage cards after user feedback that the center contained too much empty space. The cards now distribute across the available center height and expose the active stage's two immediate actions.
- The primary action remains visible in the first viewport. The knowledge list scrolls inside its own panel instead of increasing the height of all three columns.

### Required fidelity surfaces

- Fonts and typography: existing Chinese system-font stack, title hierarchy, weights, and line lengths are retained. No clipping or unexpected wrapping is visible at 1440 × 1024.
- Spacing and layout rhythm: 112px rail, 14px three-column gaps, matched panel tops and bottoms, and a 620–720px adaptive workspace height. The center path no longer has a large unused lower region.
- Colors and visual tokens: existing navy/cyan/violet theme and restrained border opacity are preserved; the unrelated gold reference palette was not introduced.
- Image quality and asset fidelity: the existing circuit canvas and project icon assets remain sharp. No source illustration or brand asset was replaced by placeholder art.
- Copy and content: labels are specific to digital-circuit learning. Question counts use `最多 5 题` until the API returns the actual available count, avoiding a misleading fixed promise.
- Focused comparison: a separate crop was not needed because the source and implementation contain no new raster content, and the knowledge, stage, and task regions were legible in their original-resolution screenshots.

### Interaction and console checks

- Selecting `德摩根定律` updated the selected knowledge state, current task, and targeted-training description.
- `开始学习` loaded the available targeted question without entering normal practice and replaced the estimated count with the actual count.
- Browser console: 0 errors and 0 warnings.
- Automated project tests: 36/36 passed.

### Comparison history

- Pass 1: the knowledge list expanded the whole workspace, left excess center whitespace, and pushed the primary action close to/below the first viewport.
- Fix: constrained the desktop workspace height, moved overflow into the knowledge panel, distributed the four route stages across the center height, and anchored the primary action at the bottom of the task panel.
- Pass 2 evidence: `C:\Users\Stone One\.codex\visualizations\2026\07\11\019f4ec8-3801-7f32-85ac-4f284f0cf20f\learning-route-workbench-pass2.png`; layout and primary-action visibility passed.
- Final wording fix: changed the unverified fixed `5 题` promise to `最多 5 题`, then updates it from the API response.
- Final evidence: `C:\Users\Stone One\.codex\visualizations\2026\07\11\019f4ec8-3801-7f32-85ac-4f284f0cf20f\learning-route-workbench-final.png` and `C:\Users\Stone One\.codex\visualizations\2026\07\11\019f4ec8-3801-7f32-85ac-4f284f0cf20f\learning-route-workbench-comparison.png`.

### Accepted P3 differences

- The selected concept shows populated mastery percentages; the verified implementation screenshot uses real empty-state learner data, so it correctly shows `未练习` instead of fabricated progress.
- The center path is intentionally denser than the selected concept in direct response to the user's layout feedback.

final result: passed

## AI semantic grading — 2026-07-12

- Viewport: 1440 × 1024 desktop.
- Evidence: `C:\Users\Stone One\.codex\visualizations\2026\07\11\019f4ec8-3801-7f32-85ac-4f284f0cf20f\semantic-grading-final.png`
- The analysis-answer flow displays a 0–100 score, verdict, overall comment, correct points, incorrect points, missing knowledge points, improvement suggestions, and expandable reference answer/explanation.
- AI request failures preserve the student's answer and use a neutral system-error state instead of presenting the submission as a wrong answer.
- Generated analysis variants use the same semantic grading renderer and remain outside the normal question bank and answer records.
- The server rejects unregistered or cross-learner variants, enforces bounded TTL storage, and limits semantic grading by learner, IP, and global concurrency.
- Browser console: no application errors or warnings; only Chromium's verbose password-autofill advisory was emitted.
- Automated project tests: 36/36 passed.

final result: passed

## Independent learning pages — 2026-07-12

- Viewport: 1440 × 1024 (desktop-first pass requested by the user).
- Visual source: the accepted 112px learning rail and existing project theme documented above; colors and background were intentionally preserved.
- Evidence:
  - `C:\Users\Stone One\.codex\visualizations\2026\07\11\019f4ec8-3801-7f32-85ac-4f284f0cf20f\multipage-learning-center.png`
  - `C:\Users\Stone One\.codex\visualizations\2026\07\11\019f4ec8-3801-7f32-85ac-4f284f0cf20f\multipage-scope.png`
  - `C:\Users\Stone One\.codex\visualizations\2026\07\11\019f4ec8-3801-7f32-85ac-4f284f0cf20f\multipage-route.png`
  - `C:\Users\Stone One\.codex\visualizations\2026\07\11\019f4ec8-3801-7f32-85ac-4f284f0cf20f\multipage-wrong-review.png`
  - `C:\Users\Stone One\.codex\visualizations\2026\07\11\019f4ec8-3801-7f32-85ac-4f284f0cf20f\multipage-self-test.png`
  - `C:\Users\Stone One\.codex\visualizations\2026\07\11\019f4ec8-3801-7f32-85ac-4f284f0cf20f\multipage-learning-review.png`
  - `C:\Users\Stone One\.codex\visualizations\2026\07\11\019f4ec8-3801-7f32-85ac-4f284f0cf20f\multipage-remediation-card.png`

### Verified behavior

- All six rail items are real links with distinct URLs, correct active states, browser back/forward compatibility, and a wipe transition between documents.
- Scope selection navigates from `/scope.html` to `/index.html?scope=basic-logic`; the destination loaded 12 basic-logic questions instead of the full bank.
- Route training opens inside its own page, while self-test papers remain isolated from normal practice.
- Scope, route, wrong review, self-test, and review use materially different page structures rather than a shared content panel with renamed headings.
- The remediation card shows the explanation first, removes it before the question phase, moves by drag (measured from x=886/y=544 to x=666/y=429), generates another round after a wrong variant answer, and exposes a persistent “继续错题强化” launcher after closing.
- Browser console: no application errors on the six-page navigation pass. The expected HTTP 503 in the no-AI local fixture produced a visible, actionable configuration message.
- Automated project tests: 18/18 passed.

final result: passed

## Five-item learning navigation — 2026-07-12

- Viewport: 1440 × 1024 desktop.
- Evidence:
  - `C:\Users\Stone One\.codex\visualizations\2026\07\11\019f4ec8-3801-7f32-85ac-4f284f0cf20f\navigation-practice-settings.png`
  - `C:\Users\Stone One\.codex\visualizations\2026\07\11\019f4ec8-3801-7f32-85ac-4f284f0cf20f\navigation-route-active.png`
- The rail contains exactly five entries: 普通练习、学习路线、错题复盘、阶段自测、学习报告.
- 普通练习 is the default active page. The former scope entry is removed and its knowledge range, question type, question count, source selection, and import controls are embedded above the question console.
- Selecting 组合逻辑、选择题、10 题 loaded the nine matching questions and updated both the settings summary and question counter.
- 学习路线 opened as an independent page and became the only active rail item. The learning report content remained hidden on the normal practice page.
- Icons are consistently 26 × 26 px; spacing and active treatment are uniform, with reduced highlight opacity and no active glow.
- Browser console: no application errors or warnings; Chromium only emitted its verbose password-autofill advisory.

final result: passed
