import { getTemplatePresentation } from "../templates/templates.js";

function paginateQuestionRows(questions, presentation) {
  const columnsCount = Math.max(1, presentation.columnsCount || 1);
  const rowsPerPageBudget = Math.max(1, presentation.questionsPerPage / columnsCount);
  const pages = [];
  let currentPage = [];
  let currentUnits = 0;

  for (let index = 0; index < questions.length; index += columnsCount) {
    const rowQuestions = questions.slice(index, index + columnsCount);
    const rowUnits = Math.max(
      ...rowQuestions.map((question) => question.layoutHints?.previewUnits || 1)
    );

    if (currentPage.length > 0 && currentUnits + rowUnits > rowsPerPageBudget) {
      pages.push(currentPage);
      currentPage = [];
      currentUnits = 0;
    }

    currentPage.push(...rowQuestions);
    currentUnits += rowUnits;
  }

  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  return pages.length > 0 ? pages : [[]];
}

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
  questions = [],
  totalQuestions = 0,
  questionsPerPage = 1,
  template,
  showAnswerKey = true
}) {
  const presentation = getTemplatePresentation(template);
  const safeQuestions = Array.isArray(questions) ? questions.filter(Boolean) : [];
  const questionPagesMap = safeQuestions.length > 0
    ? paginateQuestionRows(safeQuestions, {
      ...presentation,
      questionsPerPage
    })
    : [[]];
  const questionPages = safeQuestions.length > 0
    ? questionPagesMap.length
    : getQuestionPageCount(totalQuestions, questionsPerPage);
  const answerPages = getAnswerPageCount(safeQuestions.length || totalQuestions, template, showAnswerKey);

  return {
    questionPages,
    answerPages,
    totalPages: questionPages + answerPages,
    answerCardsPerPage: getAnswerCardsPerPage(template),
    questionPagesMap
  };
}
