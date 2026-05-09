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
      <strong>${startIndex + index + 1}.</strong> ${escapeHtml(question.text)} ${question.answerLine === false ? "" : '<span class="answer-line"></span>'}
    </div>
  `;
}

function createAnswerKeyMarkup(questions) {
  return questions.map((question, index) => `<div>${index + 1}) ${escapeHtml(question.answer)}</div>`).join("");
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
  showAnswerKey
}) {
  const showAnswerKeyPage = showAnswerKey && currentPage === totalPages;
  const startIndex = (currentPage - 1) * pageSize;

  worksheetElement.innerHTML = `
    <div class="worksheet-header">
      <h2>${escapeHtml(worksheetTitle)}</h2>
      <p>${escapeHtml(template.name)} · Page ${currentPage} of ${totalPages}</p>
      <div class="meta">
        <div><strong>Name:</strong> ${escapeHtml(studentName || "________________")}</div>
        <div><strong>Grade:</strong> ${escapeHtml(grade || "—")}</div>
        <div><strong>Subject:</strong> ${escapeHtml(subjectLabel)}</div>
        <div><strong>Focus:</strong> ${escapeHtml(focusLabel)}</div>
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
      <p>${escapeHtml(template.name)} · Choose settings and click Generate Worksheet.</p>
    </div>
    <div id="questions" class="questions empty">No worksheet generated yet.</div>
  `;

  applyTemplatePresentation(worksheetElement, template);
  worksheetElement.dataset.previewPage = "1";
  worksheetElement.dataset.previewTotalPages = "1";
  worksheetElement.dataset.templateId = template.id;
}
