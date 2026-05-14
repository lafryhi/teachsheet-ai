import { getTemplatePresentation } from "../templates/templates.js";

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatMultilineText(value = "") {
  return escapeHtml(value).replaceAll("\n", "<br />");
}

function questionHasInlineAnswerSpace(question) {
  return /_{3,}/.test(String(question?.text || ""));
}

function buildWorksheetIntroText({ identity, pageKind, worksheetModeLabel, focusLabel }) {
  if (pageKind === "answer-key") {
    return "Use this page as the reference key for quick checking and classroom correction.";
  }

  if (identity.instructions) {
    return identity.instructions;
  }

  if (worksheetModeLabel && focusLabel) {
    return `${worksheetModeLabel} focused on ${focusLabel}. Read each question carefully and show clear working when needed.`;
  }

  return "Read each question carefully, keep your work neat, and complete every answer in the space provided.";
}

function createHeaderFieldMarkup(label, value, placeholder = "Write here") {
  return `
    <div class="worksheet-identity-field">
      <span class="worksheet-identity-label">${escapeHtml(label)}</span>
      <span class="worksheet-identity-value${value ? "" : " is-empty"}">
        ${value ? escapeHtml(value) : `<span class="worksheet-identity-line" aria-hidden="true">${escapeHtml(placeholder)}</span>`}
      </span>
    </div>
  `;
}

function createSectionHeaderMarkup(question, variant = "questions") {
  if (!question?.sectionLabel) {
    return "";
  }

  return `
    <div class="worksheet-section-header${variant === "answers" ? " is-answer-section" : ""}">
      <div class="worksheet-section-title-row">
        <h3>${escapeHtml(question.sectionLabel)}</h3>
        <span class="worksheet-section-chip">${variant === "answers" ? "Answer Group" : "Section"}</span>
      </div>
      ${question.sectionInstruction ? `<p>${escapeHtml(question.sectionInstruction)}</p>` : ""}
    </div>
  `;
}

function createQuestionMarkup(question, questionNumber) {
  const isVertical = question.format === "vertical";
  const hasInlineAnswerSpace = questionHasInlineAnswerSpace(question);
  const hint = question.layoutHints || {};
  const questionMarkup = isVertical
    ? `<pre class="question-text question-text-vertical">${escapeHtml(question.text)}</pre>`
    : `<span class="question-text">${escapeHtml(question.text)}</span>`;
  const questionStyles = [
    hint.previewUnits > 1.35 ? "--question-card-min-height: 148px" : "",
    hint.answerLineWidth ? `--question-card-answer-width: ${Math.round(hint.answerLineWidth * 3.2)}px` : "",
    hint.answerAreaHeight ? `--question-card-answer-height: ${Math.max(20, Math.round(hint.answerAreaHeight * 2.2))}px` : ""
  ].filter(Boolean).join("; ");

  return `
    <div class="question${isVertical ? " question-vertical" : ""}"${questionStyles ? ` style="${questionStyles}"` : ""}>
      <span class="question-number">${questionNumber}</span>
      <div class="question-content">
        ${questionMarkup}
        ${question.answerLine === false || hasInlineAnswerSpace ? "" : '<span class="answer-line"></span>'}
      </div>
    </div>
  `;
}

function createQuestionsMarkup(questions, startIndex) {
  let lastSectionKey = null;

  return questions.map((question, index) => {
    const questionNumber = question.sequenceIndex || (startIndex + index + 1);
    const shouldRenderSection = index === 0 || question.sectionStart || question.sectionKey !== lastSectionKey;
    lastSectionKey = question.sectionKey;

    return `${shouldRenderSection ? createSectionHeaderMarkup(question) : ""}${createQuestionMarkup(question, questionNumber)}`;
  }).join("");
}

function createAnswerKeyMarkup(questions) {
  let lastSectionKey = null;

  return questions
    .map((question, index) => {
      const shouldRenderSection = index === 0 || question.sectionKey !== lastSectionKey;
      lastSectionKey = question.sectionKey;

      return `
        ${shouldRenderSection ? createSectionHeaderMarkup(question, "answers") : ""}
        <div class="answer-item">
          <span class="answer-item-number">${escapeHtml(String(question.answerIndex || ""))}</span>
          <span class="answer-item-value">${escapeHtml(question.answer)}</span>
        </div>
      `;
    })
    .join("");
}

function createIdentityMetaMarkup({ identity, grade, subjectLabel, focusLabel }) {
  const baseItems = [
    ["Teacher", identity.teacherName || "--"],
    ["Level", grade || "--"],
    ["Subject", subjectLabel],
    ["Focus", focusLabel]
  ];

  return baseItems.map(([label, value]) => `
    <div class="worksheet-meta-pill">
      <strong>${escapeHtml(label)}</strong>
      <span>${escapeHtml(value)}</span>
    </div>
  `).join("");
}

function createNotesMarkup(label, value = "") {
  if (!value) {
    return "";
  }

  return `
    <div class="worksheet-notes-block">
      <strong>${escapeHtml(label)}</strong>
      <p>${formatMultilineText(value)}</p>
  </div>
  `;
}

function createConfidenceStripMarkup(trustSignals = []) {
  if (!Array.isArray(trustSignals) || trustSignals.length === 0) {
    return "";
  }

  return `
    <div class="worksheet-confidence-strip">
      ${trustSignals.map((signal) => `<span class="worksheet-confidence-chip">${escapeHtml(signal)}</span>`).join("")}
    </div>
  `;
}

function createWorksheetHeaderMarkup({
  identity,
  grade,
  subjectLabel,
  focusLabel,
  worksheetSubtitle,
  worksheetModeLabel,
  difficultyLabel,
  generatedAtLabel,
  trustSignals,
  currentPage,
  totalPages,
  pageKind,
  requestType
}) {
  const subtitle = pageKind === "answer-key" ? "Answer Sheet" : worksheetModeLabel;
  const introText = buildWorksheetIntroText({ identity, pageKind, worksheetModeLabel, focusLabel });

  return `
    <div class="worksheet-header">
      ${identity.schoolName ? `<div class="worksheet-school">${escapeHtml(identity.schoolName)}</div>` : ""}
      <div class="worksheet-title-row">
        <div class="worksheet-title-block">
          <h2>${escapeHtml(identity.worksheetTitle || "Worksheet")}</h2>
          ${worksheetSubtitle ? `<div class="worksheet-subtitle">${escapeHtml(worksheetSubtitle)}</div>` : ""}
          ${subtitle ? `<div class="worksheet-page-type">${escapeHtml(subtitle)}</div>` : ""}
        </div>
        <div class="worksheet-title-aside">
          ${difficultyLabel && pageKind !== "answer-key" ? `<div class="worksheet-difficulty-badge">${escapeHtml(difficultyLabel)}</div>` : ""}
          <div class="worksheet-page-badge">Page ${currentPage} of ${totalPages}</div>
        </div>
      </div>
      <p class="worksheet-intro">${formatMultilineText(introText)}</p>
      <div class="worksheet-divider" aria-hidden="true"></div>
      <div class="worksheet-identity-row">
        ${createHeaderFieldMarkup("Name", identity.studentName, "Write student name")}
        ${createHeaderFieldMarkup("Date", identity.worksheetDate, "Add date")}
        ${createHeaderFieldMarkup("Score", identity.scorePoints, "Mark score")}
      </div>
      <div class="worksheet-meta-strip worksheet-meta-strip-extended">
        ${createIdentityMetaMarkup({ identity, grade, subjectLabel, focusLabel })}
        <div class="worksheet-meta-pill">
          <strong>Generated</strong>
          <span>${escapeHtml(generatedAtLabel || "--")}</span>
        </div>
      </div>
      ${createConfidenceStripMarkup(trustSignals)}
      ${requestType === "math" ? createNotesMarkup("Teacher Notes", identity.teacherNotes) : ""}
    </div>
  `;
}

function createWorksheetFooterMarkup(currentPage, totalPages) {
  return `
    <div class="worksheet-footer">
      <span>Generated by TeachSheet AI</span>
      <span>Page ${currentPage} of ${totalPages}</span>
    </div>
  `;
}

function applyTemplatePresentation(worksheetElement, template) {
  const presentation = getTemplatePresentation(template);

  worksheetElement.style.setProperty("--worksheet-font-family", presentation.fontFamily);
  worksheetElement.style.setProperty("--questions-columns", presentation.columns);
  worksheetElement.style.setProperty("--questions-gap", `${presentation.questionsGap}px`);
  worksheetElement.style.setProperty("--question-font-size", `${presentation.fontSize}px`);
  worksheetElement.style.setProperty("--question-padding", `${presentation.questionPadding}px`);
  worksheetElement.style.setProperty("--question-radius", `${presentation.questionRadius}px`);
  worksheetElement.style.setProperty("--question-border-style", presentation.questionBorderStyle);
  worksheetElement.style.setProperty("--question-background", presentation.questionBackground);
  worksheetElement.style.setProperty("--question-line-height", String(presentation.questionLineHeight));
  worksheetElement.style.setProperty("--answer-columns", presentation.answerColumns);
  worksheetElement.style.setProperty("--answer-gap", `${presentation.answerGap}px`);
  worksheetElement.style.setProperty("--answer-line-width", `${presentation.answerLineWidth}px`);
  worksheetElement.style.setProperty("--question-min-height", `${presentation.questionMinHeight}px`);
  worksheetElement.style.setProperty("--vertical-question-min-height", `${presentation.verticalQuestionMinHeight}px`);
  worksheetElement.style.setProperty("--answer-card-min-height", `${presentation.answerCardMinHeight}px`);
  worksheetElement.style.setProperty("--worksheet-page-padding", `${presentation.previewPadding}px`);
  worksheetElement.style.setProperty("--worksheet-page-background", presentation.visualTheme.pageBackground);
  worksheetElement.style.setProperty("--worksheet-page-border", presentation.visualTheme.pageBorder);
  worksheetElement.style.setProperty("--worksheet-accent", presentation.visualTheme.titleColor);
  worksheetElement.style.setProperty("--worksheet-body-text", presentation.visualTheme.textColor);
  worksheetElement.style.setProperty("--worksheet-muted", presentation.visualTheme.mutedText);
  worksheetElement.style.setProperty("--worksheet-subtle", presentation.visualTheme.subtleText);
  worksheetElement.style.setProperty("--worksheet-divider", presentation.visualTheme.dividerColor);
  worksheetElement.style.setProperty("--worksheet-badge-background", presentation.visualTheme.badgeBackground);
  worksheetElement.style.setProperty("--worksheet-field-background", presentation.visualTheme.fieldBackground);
  worksheetElement.style.setProperty("--worksheet-field-border", presentation.visualTheme.fieldBorder);
  worksheetElement.style.setProperty("--worksheet-meta-background", presentation.visualTheme.metaBackground);
  worksheetElement.style.setProperty("--worksheet-meta-border", presentation.visualTheme.metaBorder);
  worksheetElement.style.setProperty("--worksheet-notes-background", presentation.visualTheme.notesBackground);
  worksheetElement.style.setProperty("--worksheet-notes-border", presentation.visualTheme.notesBorder);
  worksheetElement.style.setProperty("--worksheet-question-border", presentation.visualTheme.questionBorder);
  worksheetElement.style.setProperty("--worksheet-question-shadow", presentation.visualTheme.questionShadow);
  worksheetElement.style.setProperty("--worksheet-answer-background", presentation.visualTheme.answerBackground);
  worksheetElement.style.setProperty("--worksheet-answer-border", presentation.visualTheme.answerBorder);
  worksheetElement.style.setProperty("--worksheet-footer-line", presentation.visualTheme.footerLine);
}

export function renderWorksheetPreview({
  worksheetElement,
  grade,
  subjectLabel,
  focusLabel,
  worksheetSubtitle,
  questions,
  answerQuestions,
  currentPage,
  totalPages,
  template,
  pageSize,
  showAnswerKey,
  pageKind,
  worksheetModeLabel,
  difficultyLabel,
  generatedAtLabel,
  trustSignals,
  identity,
  requestType
}) {
  const isAnswerPage = pageKind === "answer-key" && showAnswerKey;
  const questionStartIndex = (currentPage - 1) * pageSize;

  worksheetElement.innerHTML = `
    ${createWorksheetHeaderMarkup({
      identity,
      grade,
      subjectLabel,
      focusLabel,
      worksheetSubtitle,
      worksheetModeLabel,
      difficultyLabel,
      generatedAtLabel,
      trustSignals,
      currentPage,
      totalPages,
      pageKind,
      requestType
    })}
    ${isAnswerPage ? `
      <div class="answer-key standalone-answer-key">
        <h3>Answer Sheet</h3>
        <div class="answer-grid">
          ${createAnswerKeyMarkup(answerQuestions)}
        </div>
      </div>
    ` : `
      <div id="questions" class="questions${requestType === "math" ? " questions-math" : ""}">
        ${createQuestionsMarkup(questions, questionStartIndex)}
      </div>
    `}
    ${createWorksheetFooterMarkup(currentPage, totalPages)}
  `;

  applyTemplatePresentation(worksheetElement, template);
  worksheetElement.dataset.previewPage = String(currentPage);
  worksheetElement.dataset.previewTotalPages = String(totalPages);
  worksheetElement.dataset.templateId = template.id;
  worksheetElement.dataset.requestType = requestType || "worksheet";
}

export function renderEmptyWorksheet(worksheetElement, template) {
  worksheetElement.innerHTML = `
    <div class="worksheet-header">
      <h2>Worksheet</h2>
      <p>Start with a prompt or choose settings manually, then generate a printable classroom-ready worksheet.</p>
    </div>
    <div id="questions" class="questions empty">
      <div class="empty-state">
        <h3>No worksheet generated yet.</h3>
        <p>Try an example prompt, pick a teacher mode, and generate a worksheet to preview sections, page numbering, and the printable answer sheet.</p>
      </div>
    </div>
    ${createWorksheetFooterMarkup(1, 1)}
  `;

  applyTemplatePresentation(worksheetElement, template);
  worksheetElement.dataset.previewPage = "1";
  worksheetElement.dataset.previewTotalPages = "1";
  worksheetElement.dataset.templateId = template.id;
  worksheetElement.dataset.requestType = "worksheet";
}
