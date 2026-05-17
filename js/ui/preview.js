import { getTemplatePresentation } from "../templates/templates.js";
import {
  getLocalizedAnswerText,
  getLocalizedQuestionDisplayText,
  getQuestionDisplayText,
  getScoreTarget,
  getStudentDisplayValue,
  isCompareQuestion,
  parseCompareQuestionText,
  shouldShowTeacherNotes
} from "../core/worksheetPresentation.js";
import {
  getLocalizedWorksheetIntroCopy,
  localizeStoredInstructionText,
  localizeSectionInstruction,
  localizeSectionLabel,
  normalizeLanguage,
  t
} from "./language.js";

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
  return /_{3,}/.test(getQuestionDisplayText(question)) || isCompareQuestion(question);
}

function buildWorksheetIntroText({ identity, pageKind, worksheetModeLabel, focusLabel, language }) {
  if (pageKind === "answer-key") {
    return getLocalizedWorksheetIntroCopy(language, "answer-key");
  }

  if (identity.instructions) {
    return localizeStoredInstructionText(identity.instructions, language);
  }

  if (worksheetModeLabel && focusLabel && normalizeLanguage(language) === "fr") {
    return `${worksheetModeLabel} centré sur ${focusLabel}. Résous les exercices suivants avec soin. Montre ton raisonnement si nécessaire.`;
  }

  if (worksheetModeLabel && focusLabel) {
    return normalizeLanguage(language) === "fr"
      ? `${worksheetModeLabel} centré sur ${focusLabel}. Lis chaque question avec attention et montre clairement ton travail si besoin.`
      : `${worksheetModeLabel} focused on ${focusLabel}. Read each question carefully and show clear working when needed.`;
  }

  return getLocalizedWorksheetIntroCopy(language, "questions");
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

function createScoreFieldMarkup(value, language) {
  const scoreTarget = getScoreTarget(value);

  return `
    <div class="worksheet-identity-field worksheet-identity-field-score">
      <span class="worksheet-identity-label">${escapeHtml(t(language, "score"))}</span>
      <span class="worksheet-identity-score">
        <span class="worksheet-identity-line" aria-hidden="true">${escapeHtml(t(language, "score"))}</span>
        <span class="worksheet-identity-score-target">/ ${escapeHtml(scoreTarget)}</span>
      </span>
    </div>
  `;
}

function createSectionHeaderMarkup(question, variant = "questions", language = "en") {
  if (!question?.sectionLabel) {
    return "";
  }

  return `
    <div class="worksheet-section-header${variant === "answers" ? " is-answer-section" : ""}">
      <div class="worksheet-section-title-row">
        <h3>${escapeHtml(localizeSectionLabel(language, question.sectionLabel, question.sectionKey))}</h3>
        <span class="worksheet-section-chip">${variant === "answers" ? escapeHtml(t(language, "answerGroup")) : escapeHtml(t(language, "section"))}</span>
      </div>
      ${(question.sectionInstruction || question.sectionKey) ? `<p>${escapeHtml(localizeSectionInstruction(language, question.sectionKey, question.sectionInstruction || ""))}</p>` : ""}
    </div>
  `;
}

function createQuestionMarkup(question, questionNumber, language = "en") {
  const isVertical = question.format === "vertical";
  const hasInlineAnswerSpace = questionHasInlineAnswerSpace(question);
  const questionText = getLocalizedQuestionDisplayText(question, language);
  const compareParts = !isVertical ? parseCompareQuestionText(question, language) : null;
  const hint = question.layoutHints || {};
  const questionMarkup = isVertical
    ? `<pre class="question-text question-text-vertical">${escapeHtml(questionText)}</pre>`
    : compareParts
      ? `
        <div class="question-text question-text-compare">
          <span class="question-compare-heading">${escapeHtml(compareParts.heading)}</span>
          <div class="question-compare-row">
            <span class="question-compare-expression">${escapeHtml(compareParts.leftExpression)}</span>
            <span class="question-compare-blank" aria-hidden="true"></span>
            <span class="question-compare-expression">${escapeHtml(compareParts.rightExpression)}</span>
          </div>
        </div>
      `
      : `<span class="question-text">${escapeHtml(questionText)}</span>`;
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

function createQuestionsMarkup(questions, startIndex, language) {
  let lastSectionKey = null;

  return questions.map((question, index) => {
    const questionNumber = question.sequenceIndex || (startIndex + index + 1);
    const shouldRenderSection = index === 0 || question.sectionStart || question.sectionKey !== lastSectionKey;
    lastSectionKey = question.sectionKey;

    return `${shouldRenderSection ? createSectionHeaderMarkup(question, "questions", language) : ""}${createQuestionMarkup(question, questionNumber, language)}`;
  }).join("");
}

function createAnswerKeyMarkup(questions, language) {
  let lastSectionKey = null;

  return questions
    .map((question, index) => {
      const shouldRenderSection = index === 0 || question.sectionKey !== lastSectionKey;
      lastSectionKey = question.sectionKey;

      return `
        ${shouldRenderSection ? createSectionHeaderMarkup(question, "answers", language) : ""}
        <div class="answer-item">
          <span class="answer-item-number">${escapeHtml(String(question.answerIndex || ""))}</span>
          <span class="answer-item-value">${escapeHtml(getLocalizedAnswerText(question, language))}</span>
        </div>
      `;
    })
    .join("");
}

function createIdentityMetaMarkup({ identity, grade, subjectLabel, focusLabel, language }) {
  const baseItems = [
    [t(language, "teacher"), identity.teacherName || "--"],
    [t(language, "level"), grade || "--"],
    [t(language, "subject"), subjectLabel],
    [t(language, "focus"), focusLabel]
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
  ,
  language = "en"
}) {
  const resolvedLanguage = normalizeLanguage(language);
  const subtitle = pageKind === "answer-key" ? t(resolvedLanguage, "answerSheet") : worksheetModeLabel;
  const introText = buildWorksheetIntroText({ identity, pageKind, worksheetModeLabel, focusLabel, language: resolvedLanguage });
  const displayStudentName = getStudentDisplayValue(identity.studentName, "");
  const showTeacherNotes = requestType === "math"
    && shouldShowTeacherNotes(identity.teacherNotes, { currentPage, pageKind });
  const answerHeaderClass = pageKind === "answer-key" ? " worksheet-header-answer-key" : "";

  return `
    <div class="worksheet-header${answerHeaderClass}">
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
        ${createHeaderFieldMarkup(t(resolvedLanguage, "name"), displayStudentName, t(resolvedLanguage, "writeStudentName"))}
        ${createHeaderFieldMarkup(t(resolvedLanguage, "date"), identity.worksheetDate, t(resolvedLanguage, "addDate"))}
        ${createScoreFieldMarkup(identity.scorePoints, resolvedLanguage)}
      </div>
      <div class="worksheet-meta-strip worksheet-meta-strip-extended">
        ${createIdentityMetaMarkup({ identity, grade, subjectLabel, focusLabel, language: resolvedLanguage })}
        <div class="worksheet-meta-pill">
          <strong>${escapeHtml(t(resolvedLanguage, "generated"))}</strong>
          <span>${escapeHtml(generatedAtLabel || "--")}</span>
        </div>
      </div>
      ${createConfidenceStripMarkup(trustSignals)}
      ${showTeacherNotes ? createNotesMarkup(t(resolvedLanguage, "teacherNotes"), identity.teacherNotes) : ""}
    </div>
  `;
}

function createWorksheetFooterMarkup(currentPage, totalPages, language = "en") {
  return `
    <div class="worksheet-footer">
      <span>${escapeHtml(t(language, "generatedBy"))}</span>
      <span>${escapeHtml(t(language, "pageLabel", { current: currentPage, total: totalPages }))}</span>
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
  requestType,
  language = "en"
}) {
  const resolvedLanguage = normalizeLanguage(language);
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
      requestType,
      language: resolvedLanguage
    })}
    ${isAnswerPage ? `
      <div class="answer-key standalone-answer-key">
        <h3>${escapeHtml(t(resolvedLanguage, "answerSheet"))}</h3>
        <div class="answer-grid">
          ${createAnswerKeyMarkup(answerQuestions, resolvedLanguage)}
        </div>
      </div>
    ` : `
      <div id="questions" class="questions${requestType === "math" ? " questions-math" : ""}">
        ${createQuestionsMarkup(questions, questionStartIndex, resolvedLanguage)}
      </div>
    `}
    ${createWorksheetFooterMarkup(currentPage, totalPages, resolvedLanguage)}
  `;

  applyTemplatePresentation(worksheetElement, template);
  worksheetElement.dataset.previewPage = String(currentPage);
  worksheetElement.dataset.previewTotalPages = String(totalPages);
  worksheetElement.dataset.templateId = template.id;
  worksheetElement.dataset.requestType = requestType || "worksheet";
}

export function renderEmptyWorksheet(worksheetElement, template, language = "en") {
  const resolvedLanguage = normalizeLanguage(language);
  worksheetElement.innerHTML = `
    <div class="worksheet-header">
      <h2>${escapeHtml(t(resolvedLanguage, "worksheet"))}</h2>
      <p>${escapeHtml(t(resolvedLanguage, "emptyWorksheetBody"))}</p>
    </div>
    <div id="questions" class="questions empty">
      <div class="empty-state">
        <h3>${escapeHtml(t(resolvedLanguage, "noWorksheetYet"))}</h3>
        <p>${t(resolvedLanguage, "emptyWorksheetHint")}</p>
        <ol class="empty-state-steps">
          <li>${escapeHtml(t(resolvedLanguage, "emptyStep1"))}</li>
          <li>${escapeHtml(t(resolvedLanguage, "emptyStep2"))}</li>
          <li>${escapeHtml(t(resolvedLanguage, "emptyStep3"))}</li>
          <li>${escapeHtml(t(resolvedLanguage, "emptyStep4"))}</li>
        </ol>
        <div class="empty-state-actions">
          <button
            type="button"
            class="empty-state-button"
            data-empty-action="demo"
            data-demo-prompt="grade 4 assessment vertical multiplication"
            data-demo-template="exam-style"
            data-demo-mode="assessment"
          >${escapeHtml(t(resolvedLanguage, "tryDemoWorksheet"))}</button>
          <button type="button" class="empty-state-link" data-empty-action="example-prompt">${escapeHtml(t(resolvedLanguage, "useExamplePrompt"))}</button>
        </div>
      </div>
    </div>
    ${createWorksheetFooterMarkup(1, 1, resolvedLanguage)}
  `;

  applyTemplatePresentation(worksheetElement, template);
  worksheetElement.dataset.previewPage = "1";
  worksheetElement.dataset.previewTotalPages = "1";
  worksheetElement.dataset.templateId = template.id;
  worksheetElement.dataset.requestType = "worksheet";
}
