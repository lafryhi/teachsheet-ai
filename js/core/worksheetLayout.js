import { getTemplatePresentation } from "../templates/templates.js";

function paginateQuestionRows(questions, presentation) {
  const columnsCount = Math.max(1, presentation.columnsCount || 1);
  const rowsPerPageBudget = Math.max(1, presentation.questionsPerPage / columnsCount);
  const pages = [];
  let currentPage = [];
  let currentUnits = 0;
  let currentRow = [];

  function flushRow() {
    if (currentRow.length === 0) {
      return;
    }

    const rowUnits = Math.max(
      ...currentRow.map((question) => (
        (question.layoutHints?.previewUnits || 1) + (question.sectionStart ? (question.layoutHints?.sectionHeaderUnits || 0) : 0)
      ))
    );

    if (currentPage.length > 0 && currentUnits + rowUnits > rowsPerPageBudget) {
      pages.push(currentPage);
      currentPage = [];
      currentUnits = 0;
    }

    currentPage.push(...currentRow);
    currentUnits += rowUnits;
    currentRow = [];
  }

  questions.forEach((question) => {
    if (currentRow.length > 0 && question.sectionStart) {
      flushRow();
    }

    if (currentRow.length >= columnsCount) {
      flushRow();
    }

    currentRow.push(question);
  });

  flushRow();

  if (currentPage.length > 0 || questions.length === 0) {
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

function paginateAnswerPages(questions, templateLike) {
  const presentation = getTemplatePresentation(templateLike);
  const answerColumns = Math.min(4, presentation.columnsCount === 1 ? 3 : 4);
  const rowsPerPageBudget = 18;
  const headerUnits = 0.72;
  const pages = [];
  let currentPage = [];
  let currentRow = [];
  let usedUnits = 0;
  let currentSectionKey = null;

  function startNewPageWithSection(question) {
    if (currentPage.length > 0) {
      pages.push(currentPage);
    }

    currentPage = [];
    usedUnits = question?.sectionKey ? (question.layoutHints?.answerSectionUnits || headerUnits) : 0;
  }

  function flushRow(forceRepeatSectionHeader = false) {
    if (currentRow.length === 0) {
      return;
    }

    const rowUnits = Math.max(...currentRow.map((question) => question.layoutHints?.answerUnits || 1));

    if (currentPage.length > 0 && usedUnits + rowUnits > rowsPerPageBudget) {
      startNewPageWithSection(forceRepeatSectionHeader ? currentRow[0] : null);
    }

    currentPage.push(...currentRow);
    usedUnits += rowUnits;
    currentRow = [];
  }

  questions.forEach((question) => {
    const sectionHeaderUnits = question.layoutHints?.answerSectionUnits || headerUnits;
    const isNewSection = question.sectionKey && question.sectionKey !== currentSectionKey;

    if (currentRow.length > 0 && (currentRow.length >= answerColumns || question.sectionStart || isNewSection)) {
      flushRow(true);
    }

    if (isNewSection) {
      if (currentPage.length > 0 && usedUnits + sectionHeaderUnits > rowsPerPageBudget) {
        startNewPageWithSection(question);
      } else {
        usedUnits += sectionHeaderUnits;
      }
      currentSectionKey = question.sectionKey;
    }

    if (currentRow.length >= answerColumns) {
      flushRow(true);
    }

    currentRow.push(question);
  });

  flushRow(true);

  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  return pages.length > 0 ? pages : [[]];
}

export function getAnswerPageCount(totalQuestions, templateLike, showAnswerKey = true) {
  if (!showAnswerKey || totalQuestions <= 0) {
    return 0;
  }

  return Math.max(1, paginateAnswerPages(Array.from({ length: totalQuestions }, () => ({})), templateLike).length);
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
  const answerPagesMap = showAnswerKey && safeQuestions.length > 0
    ? paginateAnswerPages(safeQuestions, template)
    : [];
  const answerPages = showAnswerKey
    ? (safeQuestions.length > 0
      ? answerPagesMap.length
      : getAnswerPageCount(totalQuestions, template, showAnswerKey))
    : 0;

  return {
    questionPages,
    answerPages,
    totalPages: questionPages + answerPages,
    answerCardsPerPage: getAnswerCardsPerPage(template),
    questionPagesMap,
    answerPagesMap
  };
}
