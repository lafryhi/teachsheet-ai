import {
  ANSWER_SECTION_HEADER_HEIGHT,
  PDF_PAGE_LAYOUT,
  QUESTION_SECTION_HEADER_HEIGHT,
  buildCompactDescriptorLine,
  buildDensityProfile,
  getAdaptivePdfMetrics,
  getFooterMetrics,
  getIdentityFieldHeight,
  getNotesBlockHeight,
  getPdfLayoutMetrics,
  normalizePrintWorksheetTitle,
  paginateRows,
  resolveAnswerColumnCount
} from "./printLayoutShared.js";
import {
  isCompareQuestion,
  parseCompareQuestionText,
  shouldShowTeacherNotes
} from "./worksheetPresentation.js";
import { getTemplatePresentation } from "../templates/templates.js";

function questionHasInlineAnswerSpace(question) {
  return /_{3,}/.test(String(question?.text || "")) || isCompareQuestion(question);
}

function buildWorksheetIntroText({ identity, pageKind, worksheetModeLabel, focusLabel }) {
  if (pageKind === "answer-key") {
    return "Use this answer sheet for checking and classroom correction.";
  }

  if (identity.instructions) {
    return identity.instructions;
  }

  return worksheetModeLabel && focusLabel
    ? `${worksheetModeLabel} focused on ${focusLabel}. Read each question carefully and show clear working when needed.`
    : "Read each question carefully and keep your work neat.";
}

function normalizeWhitespace(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

function estimateCharsPerLine(width, fontSize, factor = 0.17) {
  const estimatedCharWidth = Math.max(1.35, fontSize * factor);
  return Math.max(8, Math.floor(width / estimatedCharWidth));
}

function estimateWrappedLineCount(text, width, fontSize, options = {}) {
  const rawText = String(text || "");
  const segments = rawText.split("\n");
  const factor = options.monospace
    ? 0.18
    : (fontSize <= 8.5 ? 0.155 : 0.17);
  const charsPerLine = estimateCharsPerLine(width, fontSize, factor);

  return Math.max(1, segments.reduce((total, segment) => {
    const normalized = normalizeWhitespace(segment);

    if (!normalized) {
      return total + 1;
    }

    return total + Math.max(1, Math.ceil(normalized.length / charsPerLine));
  }, 0));
}

function measureEstimatedHeaderHeight({
  identity,
  metrics,
  grade,
  subjectLabel,
  focusLabel,
  worksheetModeLabel,
  margins,
  pageWidth,
  pageKind,
  currentPage = 1
}) {
  const descriptorLine = buildCompactDescriptorLine({
    pageKind,
    grade,
    subjectLabel,
    focusLabel,
    worksheetModeLabel
  });
  const descriptorLines = descriptorLine
    ? estimateWrappedLineCount(
      descriptorLine,
      pageWidth - margins.left - margins.right,
      metrics.titleSubtitleFontSize
    )
    : 0;
  const introText = buildWorksheetIntroText({ identity, pageKind, worksheetModeLabel, focusLabel });
  const introLines = identity.instructions || pageKind === "answer-key"
    ? estimateWrappedLineCount(
      introText,
      pageWidth - margins.left - margins.right,
      metrics.introFontSize
    )
    : 0;
  const titleText = normalizePrintWorksheetTitle(identity.worksheetTitle || "Worksheet", subjectLabel, focusLabel);
  const titleLines = estimateWrappedLineCount(
    titleText,
    pageWidth - margins.left - margins.right - 12,
    metrics.titleFontSize,
    { title: true }
  );
  let y = margins.top;

  if (identity.schoolName) {
    y += metrics.schoolGap;
  }

  y += Math.max(metrics.titleGap, titleLines * metrics.titleLineUnit);

  if (descriptorLines > 0) {
    y += Math.max(metrics.descriptorMinHeight, descriptorLines * metrics.descriptorLineUnit);
  }

  y += getIdentityFieldHeight(metrics);

  if (introLines > 0) {
    y += metrics.introTopGap;
    y += Math.max(3.8, introLines * metrics.introLineHeight);
  }

  if (shouldShowTeacherNotes(identity.teacherNotes, { currentPage, pageKind })) {
    const notesLines = estimateWrappedLineCount(
      identity.teacherNotes,
      pageWidth - margins.left - margins.right - (metrics.notesPadding * 2),
      metrics.introFontSize
    );
    y += metrics.notesTopGap;
    y += getNotesBlockHeight(notesLines, metrics) + 1.4;
  }

  return (y + metrics.headerBottomGap) - margins.top;
}

function buildEstimatedQuestionRows(questions, presentation, metrics, columnWidth) {
  const rows = [];
  const columnsCount = presentation.columnsCount;
  const lineHeight = metrics.questionLineHeight;
  const horizontalPadding = metrics.questionPadding;
  const answerAreaHeight = metrics.answerAreaHeight;
  let currentRowQuestions = [];

  function flushRow() {
    if (!currentRowQuestions.length) {
      return;
    }

    const rowQuestions = currentRowQuestions.map((question, index) => {
      const absoluteIndex = question.sequenceIndex || (questions.indexOf(question) + 1);
      const hasInlineAnswerSpace = questionHasInlineAnswerSpace(question);
      const hint = question.layoutHints || {};
      const textWidth = Math.max(
        18,
        columnWidth - (horizontalPadding * 2) - (question.format === "vertical" ? 2 : (index === 0 ? 8 : 0))
      );
      const compareParts = parseCompareQuestionText(question.text);
      const textLines = question.format === "vertical"
        ? String(question.text || "").split("\n").length
        : compareParts
          ? (
            estimateWrappedLineCount(compareParts.heading, textWidth, metrics.questionFontSize)
            + Math.max(
              estimateWrappedLineCount(compareParts.leftExpression, Math.max(18, (textWidth - 26) / 2), metrics.questionFontSize),
              estimateWrappedLineCount(compareParts.rightExpression, Math.max(18, (textWidth - 26) / 2), metrics.questionFontSize)
            )
          )
          : estimateWrappedLineCount(question.text, textWidth, metrics.questionFontSize);
      const answerReserve = question.answerLine !== false && !hasInlineAnswerSpace
        ? (hint.answerAreaHeight || answerAreaHeight)
        : 0;
      const baseHeight = (textLines * lineHeight) + answerReserve + 9.4;

      return {
        question,
        questionNumber: absoluteIndex,
        boxHeight: Math.max(
          question.format === "vertical"
            ? Math.max(metrics.verticalQuestionMinHeight, hint.pdfMinHeight || 0)
            : Math.max(metrics.questionMinHeight, hint.pdfMinHeight || 0),
          baseHeight
        )
      };
    });
    const firstQuestion = currentRowQuestions[0];
    const sectionHeaderHeight = firstQuestion?.sectionStart
      ? (metrics.sectionHeaderHeight || QUESTION_SECTION_HEADER_HEIGHT)
      : 0;

    rows.push({
      items: rowQuestions,
      rowHeight: Math.max(...rowQuestions.map((item) => item.boxHeight)) + sectionHeaderHeight,
      baseRowHeight: Math.max(...rowQuestions.map((item) => item.boxHeight)) + sectionHeaderHeight,
      contentHeight: Math.max(...rowQuestions.map((item) => item.boxHeight)),
      sectionKey: firstQuestion?.sectionKey || null,
      sectionLabel: firstQuestion?.sectionLabel || "",
      sectionInstruction: firstQuestion?.sectionInstruction || "",
      showSectionHeader: Boolean(firstQuestion?.sectionStart),
      sectionHeaderHeight
    });
    currentRowQuestions = [];
  }

  questions.forEach((question) => {
    if (currentRowQuestions.length > 0 && question.sectionStart) {
      flushRow();
    }

    if (currentRowQuestions.length >= columnsCount) {
      flushRow();
    }

    currentRowQuestions.push(question);
  });

  flushRow();

  return rows;
}

function buildEstimatedAnswerRows(questions, answerColumns, answerColumnWidth, metrics) {
  const rows = [];
  let currentRowQuestions = [];

  function flushRow() {
    if (!currentRowQuestions.length) {
      return;
    }

    const rowQuestions = currentRowQuestions.map((question) => {
      const absoluteIndex = question.sequenceIndex || (questions.indexOf(question) + 1);
      const answerText = String(question.answer || "");
      const answerLines = estimateWrappedLineCount(
        answerText,
        answerColumnWidth - (metrics.answerCardPadding * 2),
        8.2
      );
      const hintUnits = question.layoutHints?.answerUnits || 1;
      const boxHeight = Math.max(
        metrics.answerCardMinHeight + ((hintUnits - 1) * 2.35),
        (answerLines * metrics.answerCardLineHeight) + 6.6
      );

      return {
        absoluteIndex,
        boxHeight
      };
    });
    const firstQuestion = currentRowQuestions[0];
    const sectionHeaderHeight = firstQuestion?.sectionStart
      ? (metrics.answerSectionHeaderHeight || ANSWER_SECTION_HEADER_HEIGHT)
      : 0;

    rows.push({
      items: rowQuestions,
      rowHeight: Math.max(...rowQuestions.map((item) => item.boxHeight)) + sectionHeaderHeight,
      baseRowHeight: Math.max(...rowQuestions.map((item) => item.boxHeight)) + sectionHeaderHeight,
      contentHeight: Math.max(...rowQuestions.map((item) => item.boxHeight)),
      sectionKey: firstQuestion?.sectionKey || null,
      sectionLabel: firstQuestion?.sectionLabel || "",
      sectionInstruction: firstQuestion?.sectionInstruction || "",
      showSectionHeader: Boolean(firstQuestion?.sectionStart),
      sectionHeaderHeight
    });
    currentRowQuestions = [];
  }

  questions.forEach((question) => {
    if (currentRowQuestions.length > 0 && question.sectionStart) {
      flushRow();
    }

    if (currentRowQuestions.length >= answerColumns) {
      flushRow();
    }

    currentRowQuestions.push(question);
  });

  flushRow();

  return rows;
}

function getPageMargins() {
  return {
    top: PDF_PAGE_LAYOUT.paddingTop,
    right: PDF_PAGE_LAYOUT.paddingX,
    bottom: PDF_PAGE_LAYOUT.paddingBottom,
    left: PDF_PAGE_LAYOUT.paddingX
  };
}

function getResolvedIdentity(layoutContext = {}, requestType = "math") {
  const identity = layoutContext.identity || {};

  return {
    worksheetTitle: identity.worksheetTitle || layoutContext.worksheetTitle || "Worksheet",
    schoolName: identity.schoolName || "",
    teacherName: identity.teacherName || "",
    studentName: identity.studentName || "",
    worksheetDate: identity.worksheetDate || "",
    instructions: identity.instructions || "",
    scorePoints: identity.scorePoints || "",
    teacherNotes: requestType === "math" ? (identity.teacherNotes || "") : ""
  };
}

function buildEstimatedBreakdown({
  questions,
  template,
  showAnswerKey,
  layoutContext = {}
}) {
  const safeQuestions = Array.isArray(questions) ? questions.filter(Boolean) : [];
  const presentation = getTemplatePresentation(template);
  const pageWidth = PDF_PAGE_LAYOUT.width;
  const pageHeight = PDF_PAGE_LAYOUT.height;
  const margins = getPageMargins();
  const baseMetrics = getPdfLayoutMetrics(presentation);
  const resolvedIdentity = getResolvedIdentity(layoutContext, layoutContext.requestType);
  const footer = getFooterMetrics(pageHeight);
  const questionContentBottom = footer.top - PDF_PAGE_LAYOUT.footerGap;
  const initialColumnGap = baseMetrics.columnGap;
  const initialColumnWidth = presentation.columnsCount === 1
    ? pageWidth - margins.left - margins.right
    : ((pageWidth - margins.left - margins.right - initialColumnGap) / 2);
  const baseQuestionHeaderHeight = measureEstimatedHeaderHeight({
    identity: resolvedIdentity,
    metrics: baseMetrics,
    grade: layoutContext.grade || "",
    subjectLabel: layoutContext.subjectLabel || "Math",
    focusLabel: layoutContext.focusLabel || "",
    worksheetModeLabel: layoutContext.worksheetModeLabel || "",
    margins,
    pageWidth,
    pageKind: "questions",
    currentPage: 1
  });
  const baseQuestionUsableHeight = Math.max(0, questionContentBottom - (margins.top + baseQuestionHeaderHeight));
  const initialQuestionRows = buildEstimatedQuestionRows(safeQuestions, presentation, baseMetrics, initialColumnWidth);
  const initialQuestionPages = paginateRows(
    initialQuestionRows,
    baseQuestionUsableHeight,
    baseMetrics.rowGap,
    QUESTION_SECTION_HEADER_HEIGHT
  );
  const densityProfile = buildDensityProfile({
    questionPages: initialQuestionPages,
    questionUsableHeight: baseQuestionUsableHeight,
    rowGap: baseMetrics.rowGap,
    questions: safeQuestions
  });
  const metrics = getAdaptivePdfMetrics(baseMetrics, densityProfile);
  const questionHeaderHeight = measureEstimatedHeaderHeight({
    identity: resolvedIdentity,
    metrics,
    grade: layoutContext.grade || "",
    subjectLabel: layoutContext.subjectLabel || "Math",
    focusLabel: layoutContext.focusLabel || "",
    worksheetModeLabel: layoutContext.worksheetModeLabel || "",
    margins,
    pageWidth,
    pageKind: "questions",
    currentPage: 1
  });
  const answerHeaderHeight = measureEstimatedHeaderHeight({
    identity: resolvedIdentity,
    metrics,
    grade: layoutContext.grade || "",
    subjectLabel: layoutContext.subjectLabel || "Math",
    focusLabel: layoutContext.focusLabel || "",
    worksheetModeLabel: layoutContext.worksheetModeLabel || "",
    margins,
    pageWidth,
    pageKind: "answer-key",
    currentPage: 1
  });
  const questionUsableHeight = Math.max(0, questionContentBottom - (margins.top + questionHeaderHeight));
  const answerUsableHeight = Math.max(0, questionContentBottom - (margins.top + answerHeaderHeight));
  const columnGap = metrics.columnGap;
  const columnWidth = presentation.columnsCount === 1
    ? pageWidth - margins.left - margins.right
    : ((pageWidth - margins.left - margins.right - columnGap) / 2);
  const questionRows = buildEstimatedQuestionRows(safeQuestions, presentation, metrics, columnWidth);
  const questionPagesMap = safeQuestions.length > 0
    ? paginateRows(questionRows, questionUsableHeight, metrics.rowGap, QUESTION_SECTION_HEADER_HEIGHT)
    : [[]];
  const answerColumns = resolveAnswerColumnCount(safeQuestions);
  const answerColumnWidth = (
    pageWidth - margins.left - margins.right - ((answerColumns - 1) * 3.4)
  ) / answerColumns;
  const answerRows = showAnswerKey
    ? buildEstimatedAnswerRows(safeQuestions, answerColumns, answerColumnWidth, metrics)
    : [];
  const answerPagesMap = showAnswerKey && safeQuestions.length > 0
    ? paginateRows(answerRows, answerUsableHeight, 3.6, ANSWER_SECTION_HEADER_HEIGHT)
    : [];
  const questionPages = questionPagesMap.length || 1;
  const answerPages = showAnswerKey ? answerPagesMap.length : 0;

  return {
    answerColumns,
    answerPages,
    answerPagesMap,
    metrics,
    questionPages,
    questionPagesMap,
    totalPages: questionPages + answerPages
  };
}

function getQuestionPageCount(totalQuestions, questionsPerPage) {
  if (totalQuestions <= 0) {
    return 1;
  }

  return Math.max(1, Math.ceil(totalQuestions / Math.max(questionsPerPage, 1)));
}

export function getAnswerCardsPerPage(templateLike) {
  const presentation = getTemplatePresentation(templateLike);
  const metrics = getPdfLayoutMetrics(presentation);
  const margins = getPageMargins();
  const pageWidth = PDF_PAGE_LAYOUT.width;
  const pageHeight = PDF_PAGE_LAYOUT.height;
  const footer = getFooterMetrics(pageHeight);
  const answerColumns = presentation.columnsCount === 1 ? 3 : 4;
  const headerHeight = 46;
  const usableHeight = Math.max(0, (footer.top - PDF_PAGE_LAYOUT.footerGap) - (margins.top + headerHeight));
  const rowHeight = metrics.answerCardMinHeight + 3.6;
  const rowsPerPage = Math.max(1, Math.floor((usableHeight + 3.6) / rowHeight));
  const answerColumnWidth = (
    pageWidth - margins.left - margins.right - ((answerColumns - 1) * 3.4)
  ) / answerColumns;

  if (!answerColumnWidth) {
    return answerColumns * rowsPerPage;
  }

  return answerColumns * rowsPerPage;
}

export function getAnswerPageCount(totalQuestions, templateLike, showAnswerKey = true) {
  if (!showAnswerKey || totalQuestions <= 0) {
    return 0;
  }

  const placeholderQuestions = Array.from({ length: totalQuestions }, (_, index) => ({
    text: `Question ${index + 1}`,
    answer: `${index + 1}`,
    layoutHints: {
      answerUnits: 1
    }
  }));
  const breakdown = buildEstimatedBreakdown({
    questions: placeholderQuestions,
    template: templateLike,
    showAnswerKey: true
  });

  return Math.max(1, breakdown.answerPages);
}

export function getWorksheetPageBreakdown({
  questions = [],
  totalQuestions = 0,
  questionsPerPage = 1,
  template,
  showAnswerKey = true,
  layoutContext = {}
}) {
  const safeQuestions = Array.isArray(questions) ? questions.filter(Boolean) : [];

  if (safeQuestions.length === 0) {
    const questionPages = getQuestionPageCount(totalQuestions, questionsPerPage);
    const answerPages = getAnswerPageCount(totalQuestions, template, showAnswerKey);

    return {
      questionPages,
      answerPages,
      totalPages: questionPages + answerPages,
      answerCardsPerPage: getAnswerCardsPerPage(template),
      questionPagesMap: [[]],
      answerPagesMap: []
    };
  }

  const breakdown = buildEstimatedBreakdown({
    questions: safeQuestions,
    template,
    showAnswerKey,
    layoutContext
  });

  return {
    questionPages: breakdown.questionPages,
    answerPages: breakdown.answerPages,
    totalPages: breakdown.totalPages,
    answerCardsPerPage: getAnswerCardsPerPage(template),
    questionPagesMap: breakdown.questionPagesMap,
    answerPagesMap: breakdown.answerPagesMap
  };
}
