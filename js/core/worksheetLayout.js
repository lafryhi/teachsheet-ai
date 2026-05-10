import { getTemplatePresentation } from "../templates/templates.js";

function getQuestionPageCount(totalQuestions, questionsPerPage) {
  if (totalQuestions <= 0) {
    return 1;
  }

  return Math.max(1, Math.ceil(totalQuestions / Math.max(questionsPerPage, 1)));
}

export function getAnswerCardsPerPage(templateLike) {
  const presentation = getTemplatePresentation(templateLike);
  const answerColumns = Math.min(4, presentation.columnsCount === 1 ? 3 : 4);
  const rowsPerPage = 18;

  return answerColumns * rowsPerPage;
}

export function getAnswerPageCount(totalQuestions, templateLike, showAnswerKey = true) {
  if (!showAnswerKey || totalQuestions <= 0) {
    return 0;
  }

  return Math.max(1, Math.ceil(totalQuestions / getAnswerCardsPerPage(templateLike)));
}

export function getWorksheetPageBreakdown({
  totalQuestions = 0,
  questionsPerPage = 1,
  template,
  showAnswerKey = true
}) {
  const questionPages = getQuestionPageCount(totalQuestions, questionsPerPage);
  const answerPages = getAnswerPageCount(totalQuestions, template, showAnswerKey);

  return {
    questionPages,
    answerPages,
    totalPages: questionPages + answerPages,
    answerCardsPerPage: getAnswerCardsPerPage(template)
  };
}
