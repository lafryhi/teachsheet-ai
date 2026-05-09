import { getTemplatePresentation } from "../templates/templates.js";

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function createQuestionMarkup(question, index, startIndex) {
  return `
    <div class="question">
      <span class="question-number"><strong>${startIndex + index + 1}.</strong></span>
      ${escapeHtml(question.text)}
      ${question.answerLine === false ? "" : '<span class="answer-line"></span>'}
    </div>
  `;
}

function createAnswerKeyMarkup(questions) {
  return questions
    .map((question, index) => `<div class="answer-item">${index + 1}) ${escapeHtml(question.answer)}</div>`)
    .join("");
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
}

export function renderWorksheetPreview({
  worksheetElement,
  grade,
  subjectLabel,
  focusLabel,
  studentName,
  questions,
  allQuestions,
  currentPage,
  totalPages,
  template,
  pageSize,
  worksheetTitle,
  showAnswerKey,
  templateDescription
}) {
  const showAnswerKeyPage = showAnswerKey && currentPage === totalPages;
  const startIndex = (currentPage - 1) * pageSize;

  worksheetElement.innerHTML = `
    <div class="worksheet-header">
      <h2>${escapeHtml(worksheetTitle)}</h2>
      <p>${escapeHtml(template.name)} - Page ${currentPage} of ${totalPages}</p>
      <div class="worksheet-template-summary">
        <span class="template-summary-badge">Active Template</span>
        <span>${escapeHtml(templateDescription || template.description || template.name)}</span>
      </div>
      <div class="meta">
        <div class="meta-item"><strong>Name:</strong> ${escapeHtml(studentName || "________________")}</div>
        <div class="meta-item"><strong>Grade:</strong> ${escapeHtml(grade || "--")}</div>
        <div class="meta-item"><strong>Subject:</strong> ${escapeHtml(subjectLabel)}</div>
        <div class="meta-item"><strong>Focus:</strong> ${escapeHtml(focusLabel)}</div>
      </div>
    </div>
    <div id="questions" class="questions">
      ${questions.map((question, index) => createQuestionMarkup(question, index, startIndex)).join("")}
    </div>
    ${showAnswerKeyPage ? `
      <div class="answer-key">
        <h3>Answer Key</h3>
        <div class="answer-grid">
          ${createAnswerKeyMarkup(allQuestions)}
        </div>
      </div>
    ` : ""}
  `;

  applyTemplatePresentation(worksheetElement, template);
  worksheetElement.dataset.previewPage = String(currentPage);
  worksheetElement.dataset.previewTotalPages = String(totalPages);
  worksheetElement.dataset.templateId = template.id;
}

export function renderEmptyWorksheet(worksheetElement, template) {
  worksheetElement.innerHTML = `
    <div class="worksheet-header">
      <h2>Worksheet</h2>
      <p>${escapeHtml(template.name)} - Choose settings and click Generate Worksheet.</p>
      <div class="worksheet-template-summary">
        <span class="template-summary-badge">Active Template</span>
        <span>${escapeHtml(template.description || template.name)}</span>
      </div>
    </div>
    <div id="questions" class="questions empty">
      <div class="empty-state">
        <h3>No worksheet generated yet.</h3>
        <p>Pick a template, try one of the example prompts, or use the form settings to create a printable worksheet preview.</p>
      </div>
    </div>
  `;

  applyTemplatePresentation(worksheetElement, template);
  worksheetElement.dataset.previewPage = "1";
  worksheetElement.dataset.previewTotalPages = "1";
  worksheetElement.dataset.templateId = template.id;
}
