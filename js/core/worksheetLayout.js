import {
  ANSWER_SECTION_HEADER_HEIGHT,
  PDF_PAGE_LAYOUT,
  QUESTION_SECTION_HEADER_HEIGHT,
  buildCompactDescriptorLine,
  buildDensityProfile,
  getAdaptivePdfMetrics,
  getAnswerSheetHeaderMetrics,
  getFooterMetrics,
  getIdentityFieldHeight,
  getLocalizedHeaderMetrics,
  getNotesBlockHeight,
  getPdfLayoutMetrics,
  normalizePrintWorksheetTitle,
  paginateRows,
  resolveAnswerColumnCount
} from "./printLayoutShared.js";
import {
  getLocalizedAnswerText,
  getLocalizedQuestionDisplayText,
  getQuestionDisplayText,
  isCompareQuestion,
  parseCompareQuestionText,
  shouldShowTeacherNotes
} from "./worksheetPresentation.js";
import { getTemplatePresentation } from "../templates/templates.js";
import {
  getLocalizedWorksheetIntroCopy,
  getNaturalFrenchWorksheetInstruction,
  localizeTeacherNotesText,
  localizeStoredInstructionText,
  normalizeFrenchInstructionText,
  normalizeLanguage,
  t
} from "../ui/language.js";

function questionHasInlineAnswerSpace(question) {
  return /_{3,}/.test(getQuestionDisplayText(question)) || isCompareQuestion(question);
}

function buildWorksheetIntroText({ identity, pageKind, worksheetModeLabel, focusLabel, language = "en" }) {
  if (pageKind === "answer-key") {
    return getLocalizedWorksheetIntroCopy(language, "answer-key");
  }

  if (identity.instructions) {
    const localizedInstruction = localizeStoredInstructionText(identity.instructions, language);
    return normalizeLanguage(language) === "fr"
      ? normalizeFrenchInstructionText(localizedInstruction)
      : localizedInstruction;
  }

  if (worksheetModeLabel && normalizeLanguage(language) === "fr") {
    return `${worksheetModeLabel}. ${getNaturalFrenchWorksheetInstruction({ type: "math" })}`;
  }

  if (worksheetModeLabel && focusLabel && normalizeLanguage(language) === "fr") {
    return `${worksheetModeLabel} centré sur ${focusLabel}. Résous les exercices suivants avec soin. Montre ton raisonnement si nécessaire.`;
  }

  return worksheetModeLabel && focusLabel
    ? (normalizeLanguage(language) === "fr"
      ? `${worksheetModeLabel} centré sur ${focusLabel}. Lis chaque question avec attention et montre clairement ton travail si besoin.`
      : `${worksheetModeLabel} focused on ${focusLabel}. Read each question carefully and show clear working when needed.`)
    : getLocalizedWorksheetIntroCopy(language, "questions");
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
  currentPage = 1,
  language = "en"
}) {
  const headerMetrics = getLocalizedHeaderMetrics(
    pageKind === "answer-key"
      ? getAnswerSheetHeaderMetrics(metrics)
      : metrics,
    language
  );
  const descriptorLine = buildCompactDescriptorLine({
    pageKind,
    grade,
    subjectLabel,
    focusLabel,
    worksheetModeLabel,
    language
  });
  const descriptorLines = descriptorLine
    ? estimateWrappedLineCount(
      descriptorLine,
      pageWidth - margins.left - margins.right,
      headerMetrics.titleSubtitleFontSize
    )
    : 0;
  const introText = buildWorksheetIntroText({ identity, pageKind, worksheetModeLabel, focusLabel, language });
  const introLines = identity.instructions || pageKind === "answer-key"
    ? estimateWrappedLineCount(
      introText,
      pageWidth - margins.left - margins.right,
      headerMetrics.introFontSize
    )
    : 0;
  const titleText = normalizePrintWorksheetTitle(identity.worksheetTitle || "Worksheet", subjectLabel, focusLabel, language);
  const titleLines = estimateWrappedLineCount(
    titleText,
    pageWidth - margins.left - margins.right - 12,
    headerMetrics.titleFontSize,
    { title: true }
  );
  let y = margins.top;

  if (identity.schoolName) {
    y += headerMetrics.schoolGap;
  }

  y += Math.max(headerMetrics.titleGap, titleLines * headerMetrics.titleLineUnit);

  if (descriptorLines > 0) {
    y += Math.max(headerMetrics.descriptorMinHeight, descriptorLines * headerMetrics.descriptorLineUnit);
  }

  y += getIdentityFieldHeight(headerMetrics);

  if (introLines > 0) {
    y += headerMetrics.introTopGap;
    y += Math.max(3.4, introLines * headerMetrics.introLineHeight);
  }

  if (shouldShowTeacherNotes(identity.teacherNotes, { currentPage, pageKind })) {
    const notesLines = estimateWrappedLineCount(
      localizeTeacherNotesText(identity.teacherNotes, language),
      pageWidth - margins.left - margins.right - (headerMetrics.notesPadding * 2),
      headerMetrics.introFontSize
    );
    y += headerMetrics.notesTopGap;
    y += getNotesBlockHeight(notesLines, headerMetrics) + 1.2;
  }

  return (y + headerMetrics.headerBottomGap) - margins.top;
}

function buildEstimatedQuestionRows(questions, presentation, metrics, columnWidth, language = "en") {
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
      const questionText = getLocalizedQuestionDisplayText(question, language);
      const textWidth = Math.max(
        18,
        columnWidth - (horizontalPadding * 2) - (question.format === "vertical" ? 2 : (index === 0 ? 8 : 0))
      );
      const compareParts = parseCompareQuestionText(question, language);
      const textLines = question.format === "vertical"
        ? String(questionText || "").split("\n").length
        : compareParts
          ? (
            estimateWrappedLineCount(compareParts.heading, textWidth, metrics.questionFontSize)
            + Math.max(
              estimateWrappedLineCount(compareParts.leftExpression, Math.max(18, (textWidth - 26) / 2), metrics.questionFontSize),
              estimateWrappedLineCount(compareParts.rightExpression, Math.max(18, (textWidth - 26) / 2), metrics.questionFontSize)
            )
          )
          : estimateWrappedLineCount(questionText, textWidth, metrics.questionFontSize);
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

function buildEstimatedAnswerRows(questions, answerColumns, answerColumnWidth, metrics, language = "en") {
  const rows = [];
  let currentRowQuestions = [];

  function flushRow() {
    if (!currentRowQuestions.length) {
      return;
    }

    const rowQuestions = currentRowQuestions.map((question) => {
      const absoluteIndex = question.sequenceIndex || (questions.indexOf(question) + 1);
      const answerText = getLocalizedAnswerText(question, language);
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
        question,
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
  const resolvedLanguage = normalizeLanguage(layoutContext.language || "en");
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
    currentPage: 1,
    language: resolvedLanguage
  });
  const baseQuestionUsableHeight = Math.max(0, questionContentBottom - (margins.top + baseQuestionHeaderHeight));
  const initialQuestionRows = buildEstimatedQuestionRows(safeQuestions, presentation, baseMetrics, initialColumnWidth, resolvedLanguage);
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
    currentPage: 1,
    language: resolvedLanguage
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
    currentPage: 1,
    language: resolvedLanguage
  });
  const questionUsableHeight = Math.max(0, questionContentBottom - (margins.top + questionHeaderHeight));
  const answerUsableHeight = Math.max(0, questionContentBottom - (margins.top + answerHeaderHeight));
  const columnGap = metrics.columnGap;
  const columnWidth = presentation.columnsCount === 1
    ? pageWidth - margins.left - margins.right
    : ((pageWidth - margins.left - margins.right - columnGap) / 2);
  const questionRows = buildEstimatedQuestionRows(safeQuestions, presentation, metrics, columnWidth, resolvedLanguage);
  const questionRowPages = safeQuestions.length > 0
    ? paginateRows(questionRows, questionUsableHeight, metrics.rowGap, QUESTION_SECTION_HEADER_HEIGHT)
    : [[]];
  const answerColumns = resolveAnswerColumnCount(safeQuestions);
  const answerColumnWidth = (
    pageWidth - margins.left - margins.right - ((answerColumns - 1) * 3.4)
  ) / answerColumns;
  const answerRows = showAnswerKey
    ? buildEstimatedAnswerRows(safeQuestions, answerColumns, answerColumnWidth, metrics, resolvedLanguage)
    : [];
  const answerRowPages = showAnswerKey && safeQuestions.length > 0
    ? paginateRows(answerRows, answerUsableHeight, 3.6, ANSWER_SECTION_HEADER_HEIGHT)
    : [];
  const questionPagesMap = questionRowPages.map((pageRows) => (
    pageRows.flatMap((row) => row.items.map((item) => item.question || item))
  ));
  const answerPagesMap = answerRowPages.map((pageRows) => (
    pageRows.flatMap((row) => row.items.map((item) => item.question || item))
  ));
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
