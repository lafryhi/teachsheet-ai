import {
  ANSWER_SECTION_HEADER_HEIGHT as SHARED_ANSWER_SECTION_HEADER_HEIGHT,
  PDF_PAGE_LAYOUT as SHARED_PDF_PAGE_LAYOUT,
  QUESTION_SECTION_HEADER_HEIGHT as SHARED_QUESTION_SECTION_HEADER_HEIGHT,
  buildCompactDescriptorLine as buildSharedCompactDescriptorLine,
  buildDensityProfile as buildSharedDensityProfile,
  getAdaptivePdfMetrics as getSharedAdaptivePdfMetrics,
  getAnswerSheetHeaderMetrics as getSharedAnswerSheetHeaderMetrics,
  getFooterMetrics as getSharedFooterMetrics,
  getIdentityFieldHeight as getSharedIdentityFieldHeight,
  getNotesBlockHeight as getSharedNotesBlockHeight,
  getPageRowsHeight as getSharedPageRowsHeight,
  getPdfLayoutMetrics as getSharedPdfLayoutMetrics,
  normalizePrintFocusLabel as normalizeSharedPrintFocusLabel,
  normalizePrintWorksheetTitle as normalizeSharedPrintWorksheetTitle,
  paginateRows as paginateSharedRows,
  resolveAnswerColumnCount as resolveSharedAnswerColumnCount
} from "../core/printLayoutShared.js";
import {
  getScoreTarget,
  getStudentDisplayValue,
  isCompareQuestion,
  normalizeStudentName,
  parseCompareQuestionText,
  sanitizeTeacherNotes,
  shouldShowTeacherNotes
} from "../core/worksheetPresentation.js";
import { getTemplatePresentation } from "../templates/templates.js";

const PDF_PAGE_LAYOUT = SHARED_PDF_PAGE_LAYOUT;
const QUESTION_SECTION_HEADER_HEIGHT = SHARED_QUESTION_SECTION_HEADER_HEIGHT;
const ANSWER_SECTION_HEADER_HEIGHT = SHARED_ANSWER_SECTION_HEADER_HEIGHT;
const buildCompactDescriptorLine = buildSharedCompactDescriptorLine;
const buildDensityProfile = buildSharedDensityProfile;
const getAdaptivePdfMetrics = getSharedAdaptivePdfMetrics;
const getAnswerSheetHeaderMetrics = getSharedAnswerSheetHeaderMetrics;
const getFooterMetrics = getSharedFooterMetrics;
const getIdentityFieldHeight = getSharedIdentityFieldHeight;
const getNotesBlockHeight = getSharedNotesBlockHeight;
const getPageRowsHeight = getSharedPageRowsHeight;
const getPdfLayoutMetrics = getSharedPdfLayoutMetrics;
const normalizePrintFocusLabel = normalizeSharedPrintFocusLabel;
const normalizePrintWorksheetTitle = normalizeSharedPrintWorksheetTitle;
const paginateRows = paginateSharedRows;
const resolveAnswerColumnCount = resolveSharedAnswerColumnCount;

function getPdfFontFamily(template) {
  return template.layout === "single-column" ? "times" : "helvetica";
}

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

  return "Read each question carefully and keep your work neat.";
}

function getWorksheetTheme() {
  return {
    accent: { r: 0, g: 0, b: 0 },
    accentPale: { r: 255, g: 255, b: 255 },
    accentBorder: { r: 112, g: 112, b: 112 },
    titleColor: { r: 0, g: 0, b: 0 },
    textColor: { r: 0, g: 0, b: 0 },
    mutedText: { r: 55, g: 55, b: 55 },
    subtleText: { r: 95, g: 95, b: 95 },
    dividerColor: { r: 135, g: 135, b: 135 },
    fieldBackground: { r: 255, g: 255, b: 255 },
    fieldBorder: { r: 128, g: 128, b: 128 },
    metaBackground: { r: 255, g: 255, b: 255 },
    metaBorder: { r: 145, g: 145, b: 145 },
    notesBackground: { r: 255, g: 255, b: 255 },
    notesBorder: { r: 145, g: 145, b: 145 },
    questionBorder: { r: 92, g: 92, b: 92 },
    answerBackground: { r: 255, g: 255, b: 255 },
    answerBorder: { r: 102, g: 102, b: 102 },
    footerLine: { r: 135, g: 135, b: 135 }
  };
}

function buildQuestionLines(pdf, questionLabel, columnWidth) {
  const rawLines = String(questionLabel).split("\n");
  const lines = [];

  rawLines.forEach((line) => {
    const splitLines = pdf.splitTextToSize(line, columnWidth);

    if (splitLines.length === 0) {
      lines.push("");
      return;
    }

    splitLines.forEach((splitLine) => lines.push(splitLine));
  });

  return lines;
}

function buildCompareQuestionParts(pdf, question, availableWidth, lineHeight) {
  const compareParts = parseCompareQuestionText(question?.text);

  if (!compareParts) {
    return null;
  }

  const headingLines = pdf.splitTextToSize(compareParts.heading, availableWidth);
  const blankWidth = Math.max(14, Math.min(20, availableWidth * 0.18));
  const compareGap = 5;
  const expressionWidth = Math.max(18, (availableWidth - blankWidth - (compareGap * 2)) / 2);
  const leftLines = pdf.splitTextToSize(compareParts.leftExpression, expressionWidth);
  const rightLines = pdf.splitTextToSize(compareParts.rightExpression, expressionWidth);
  const expressionLines = Math.max(leftLines.length, rightLines.length);

  return {
    ...compareParts,
    headingLines,
    leftLines,
    rightLines,
    blankWidth,
    compareGap,
    expressionWidth,
    compareBlockHeight: (headingLines.length * lineHeight) + (expressionLines * lineHeight) + 4.4
  };
}

function buildQuestionRows(pdf, questions, presentation, metrics, columnWidth) {
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

    const rowQuestions = currentRowQuestions.map((question) => {
      const absoluteIndex = question.sequenceIndex || (questions.indexOf(question) + 1);
      const hasInlineAnswerSpace = questionHasInlineAnswerSpace(question);
      const hint = question.layoutHints || {};
      const availableTextWidth = columnWidth - (horizontalPadding * 2);
      const compareParts = buildCompareQuestionParts(pdf, question, availableTextWidth, lineHeight);
      const textLines = compareParts
        ? compareParts.headingLines
        : buildQuestionLines(pdf, question.text, availableTextWidth);
      const answerReserve = question.answerLine !== false && !hasInlineAnswerSpace
        ? (hint.answerAreaHeight || answerAreaHeight)
        : 0;
      const baseHeight = compareParts
        ? compareParts.compareBlockHeight + 9.4
        : (textLines.length * lineHeight) + answerReserve + 9.4;

      return {
        question,
        questionNumber: absoluteIndex,
        hasInlineAnswerSpace,
        compareParts,
        textLines,
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
      ? (firstQuestion.layoutHints?.sectionHeaderHeight || metrics.sectionHeaderHeight || QUESTION_SECTION_HEADER_HEIGHT)
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


function drawSectionHeader(pdf, {
  x,
  y,
  width,
  sectionLabel,
  worksheetTheme,
  headerHeight = QUESTION_SECTION_HEADER_HEIGHT
}) {
  pdf.setDrawColor(worksheetTheme.dividerColor.r, worksheetTheme.dividerColor.g, worksheetTheme.dividerColor.b);
  pdf.setLineWidth(0.35);
  pdf.line(x, y + 1.1, width + x, y + 1.1);
  pdf.setTextColor(worksheetTheme.titleColor.r, worksheetTheme.titleColor.g, worksheetTheme.titleColor.b);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9.1);
  pdf.text(String(sectionLabel || "Section").toUpperCase(), x, y + Math.max(4.9, headerHeight - 1.8));
}

function drawNotesBlock(pdf, label, value, y, margins, pageWidth, worksheetTheme, metrics) {
  if (!value) {
    return y;
  }

  const lines = pdf.splitTextToSize(value, pageWidth - margins.left - margins.right - (metrics.notesPadding * 2));
  const boxHeight = getNotesBlockHeight(lines.length, metrics);
  pdf.setDrawColor(worksheetTheme.notesBorder.r, worksheetTheme.notesBorder.g, worksheetTheme.notesBorder.b);
  pdf.roundedRect(margins.left, y, pageWidth - margins.left - margins.right, boxHeight, 1.6, 1.6, "S");
  pdf.setTextColor(worksheetTheme.titleColor.r, worksheetTheme.titleColor.g, worksheetTheme.titleColor.b);
  pdf.setFontSize(7.8);
  pdf.setFont("helvetica", "bold");
  pdf.text(label.toUpperCase(), margins.left + metrics.notesPadding, y + metrics.notesLabelBaseline);
  pdf.setTextColor(worksheetTheme.mutedText.r, worksheetTheme.mutedText.g, worksheetTheme.mutedText.b);
  pdf.setFontSize(8.6);
  pdf.setFont("helvetica", "normal");
  pdf.text(lines, margins.left + metrics.notesPadding, y + metrics.notesTextTopOffset);
  return y + boxHeight + 1.8;
}

function drawIdentityFieldRow(pdf, fields, y, margins, pageWidth, worksheetTheme, metrics) {
  const gap = 3.8;
  const fieldHeight = getIdentityFieldHeight(metrics);
  const fieldWidth = (pageWidth - margins.left - margins.right - (gap * (fields.length - 1))) / fields.length;

  fields.forEach((field, index) => {
    const x = margins.left + (index * (fieldWidth + gap));

    pdf.setFillColor(worksheetTheme.fieldBackground.r, worksheetTheme.fieldBackground.g, worksheetTheme.fieldBackground.b);
    pdf.setDrawColor(worksheetTheme.fieldBorder.r, worksheetTheme.fieldBorder.g, worksheetTheme.fieldBorder.b);
    pdf.roundedRect(x, y, fieldWidth, fieldHeight, 1.6, 1.6, "S");
    pdf.setTextColor(worksheetTheme.subtleText.r, worksheetTheme.subtleText.g, worksheetTheme.subtleText.b);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(6.5);
    pdf.text(field.label.toUpperCase(), x + 2.4, y + metrics.fieldLabelBaseline);

    if (field.value) {
      pdf.setTextColor(worksheetTheme.titleColor.r, worksheetTheme.titleColor.g, worksheetTheme.titleColor.b);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8.4);
      pdf.text(field.value, x + 2.4, y + metrics.fieldValueBaseline);
    } else {
      pdf.setDrawColor(worksheetTheme.accentBorder.r, worksheetTheme.accentBorder.g, worksheetTheme.accentBorder.b);
      pdf.setLineWidth(0.3);
      pdf.line(x + 2.4, y + metrics.fieldValueBaseline, x + fieldWidth - 2.4, y + metrics.fieldValueBaseline);
    }
  });

  return y + fieldHeight;
}

function measurePageHeaderHeight(pdf, {
  metrics,
  identity,
  grade,
  subjectLabel,
  focusLabel,
  worksheetModeLabel,
  margins,
  pageWidth,
  pageKind,
  currentPage = 1
}) {
  const headerMetrics = pageKind === "answer-key"
    ? getAnswerSheetHeaderMetrics(metrics)
    : metrics;
  const descriptorLine = buildCompactDescriptorLine({
    pageKind,
    grade,
    subjectLabel,
    focusLabel,
    worksheetModeLabel
  });
  const descriptorLines = descriptorLine
    ? pdf.splitTextToSize(descriptorLine, pageWidth - margins.left - margins.right)
    : [];
  const introText = buildWorksheetIntroText({ identity, pageKind, worksheetModeLabel, focusLabel });
  const introLines = identity.instructions || pageKind === "answer-key"
    ? pdf.splitTextToSize(introText, pageWidth - margins.left - margins.right)
    : [];
  const titleText = normalizePrintWorksheetTitle(identity.worksheetTitle || "Worksheet", subjectLabel, focusLabel);
  const titleLines = pdf.splitTextToSize(titleText, pageWidth - margins.left - margins.right - 12);
  let y = margins.top;

  if (identity.schoolName) {
    y += headerMetrics.schoolGap;
  }

  y += Math.max(headerMetrics.titleGap, titleLines.length * headerMetrics.titleLineUnit);

  if (descriptorLines.length > 0) {
    y += Math.max(headerMetrics.descriptorMinHeight, descriptorLines.length * headerMetrics.descriptorLineUnit);
  }

  y += getIdentityFieldHeight(headerMetrics);

  if (introLines.length > 0) {
    y += headerMetrics.introTopGap;
    y += Math.max(3.4, introLines.length * headerMetrics.introLineHeight);
  }

  if (shouldShowTeacherNotes(identity.teacherNotes, { currentPage, pageKind })) {
    const notesLines = pdf.splitTextToSize(
      identity.teacherNotes,
      pageWidth - margins.left - margins.right - (headerMetrics.notesPadding * 2)
    );
    y += headerMetrics.notesTopGap;
    y += getNotesBlockHeight(notesLines.length, headerMetrics) + 1.2;
  }

  return (y + headerMetrics.headerBottomGap) - margins.top;
}

function drawPageHeader(pdf, {
  fontFamily,
  worksheetTheme,
  metrics,
  identity,
  grade,
  subjectLabel,
  focusLabel,
  worksheetModeLabel,
  margins,
  pageWidth,
  pageKind,
  currentPage = 1
}) {
  const headerMetrics = pageKind === "answer-key"
    ? getAnswerSheetHeaderMetrics(metrics)
    : metrics;
  const descriptorLine = buildCompactDescriptorLine({
    pageKind,
    grade,
    subjectLabel,
    focusLabel,
    worksheetModeLabel
  });
  const descriptorLines = descriptorLine
    ? pdf.splitTextToSize(descriptorLine, pageWidth - margins.left - margins.right)
    : [];
  const introText = buildWorksheetIntroText({ identity, pageKind, worksheetModeLabel, focusLabel });
  const introLines = identity.instructions || pageKind === "answer-key"
    ? pdf.splitTextToSize(introText, pageWidth - margins.left - margins.right)
    : [];
  const titleText = normalizePrintWorksheetTitle(identity.worksheetTitle || "Worksheet", subjectLabel, focusLabel);
  const titleLines = pdf.splitTextToSize(titleText, pageWidth - margins.left - margins.right - 12);
  const identityFields = [
    { label: "Name", value: getStudentDisplayValue(identity.studentName, "---") },
    { label: "Date", value: identity.worksheetDate || "" },
    { label: "Score", value: `____ / ${getScoreTarget(identity.scorePoints)}` }
  ];
  let y = margins.top;

  if (identity.schoolName) {
    pdf.setTextColor(worksheetTheme.mutedText.r, worksheetTheme.mutedText.g, worksheetTheme.mutedText.b);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(headerMetrics.schoolFontSize);
    pdf.text(identity.schoolName, pageWidth / 2, y + headerMetrics.schoolBaselineOffset, { align: "center" });
    y += headerMetrics.schoolGap;
  }

  pdf.setTextColor(worksheetTheme.titleColor.r, worksheetTheme.titleColor.g, worksheetTheme.titleColor.b);
  pdf.setFont(fontFamily, "bold");
  pdf.setFontSize(headerMetrics.titleFontSize);
  pdf.text(titleText, pageWidth / 2, y + headerMetrics.titleBaselineOffset, { align: "center" });

  y += Math.max(headerMetrics.titleGap, Math.max(1, titleLines.length) * headerMetrics.titleLineUnit);

  if (descriptorLines.length > 0) {
    pdf.setTextColor(worksheetTheme.mutedText.r, worksheetTheme.mutedText.g, worksheetTheme.mutedText.b);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(headerMetrics.titleSubtitleFontSize);
    pdf.text(descriptorLines, pageWidth / 2, y + headerMetrics.descriptorBaselineOffset, { align: "center" });
    y += Math.max(headerMetrics.descriptorMinHeight, descriptorLines.length * headerMetrics.descriptorLineUnit);
  }

  y = drawIdentityFieldRow(pdf, identityFields, y + headerMetrics.identityTopGap, margins, pageWidth, worksheetTheme, headerMetrics);

  if (introLines.length > 0) {
    y += headerMetrics.introTopGap;
    pdf.setTextColor(worksheetTheme.mutedText.r, worksheetTheme.mutedText.g, worksheetTheme.mutedText.b);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(headerMetrics.introFontSize);
    pdf.text(introLines, margins.left, y + headerMetrics.introBaselineOffset);
    y += Math.max(3.4, introLines.length * headerMetrics.introLineHeight);
  }

  if (shouldShowTeacherNotes(identity.teacherNotes, { currentPage, pageKind })) {
    y += headerMetrics.notesTopGap;
    y = drawNotesBlock(pdf, "Teacher Notes", identity.teacherNotes, y, margins, pageWidth, worksheetTheme, headerMetrics);
  }

  pdf.setDrawColor(worksheetTheme.dividerColor.r, worksheetTheme.dividerColor.g, worksheetTheme.dividerColor.b);
  pdf.setLineWidth(0.35);
  pdf.line(margins.left, y + headerMetrics.dividerTopGap, pageWidth - margins.right, y + headerMetrics.dividerTopGap);

  return y + headerMetrics.headerBottomGap;
}

function drawPageFooter(pdf, {
  fontFamily,
  worksheetTheme,
  metrics,
  pageNumber,
  totalPages,
  margins,
  pageWidth,
  pageHeight
}) {
  const footer = getFooterMetrics(pageHeight);

  pdf.setFont(fontFamily, "normal");
  pdf.setFontSize(metrics.footerFontSize);
  pdf.setTextColor(worksheetTheme.subtleText.r, worksheetTheme.subtleText.g, worksheetTheme.subtleText.b);
  pdf.setDrawColor(worksheetTheme.footerLine.r, worksheetTheme.footerLine.g, worksheetTheme.footerLine.b);
  pdf.line(margins.left, footer.lineY, pageWidth - margins.right, footer.lineY);
  pdf.text("Generated by TeachSheet AI", margins.left, footer.textY);
  pdf.text(`Page ${pageNumber} of ${totalPages}`, pageWidth - margins.right, footer.textY, {
    align: "right"
  });
}

function drawQuestionPages(pdf, questionPages, options) {
  if (!questionPages.length) {
    return;
  }

  const {
    fontFamily,
    worksheetTheme,
    presentation,
    metrics,
    identity,
    grade,
    subjectLabel,
    focusLabel,
    worksheetSubtitle,
    worksheetModeLabel,
    difficultyLabel,
    generatedAtLabel,
    trustSignals,
    margins,
    pageWidth,
    pageHeight,
    questionFontSize,
    columnWidth,
    columnGap,
    rowGap,
    totalPages
  } = options;

  questionPages.forEach((pageRows, pageIndex) => {
    if (pageIndex > 0) {
      pdf.addPage();
    }

    let y = drawPageHeader(pdf, {
      fontFamily,
      worksheetTheme,
      metrics,
      identity,
      grade,
      subjectLabel,
      focusLabel,
      worksheetSubtitle,
      worksheetModeLabel,
      difficultyLabel,
      generatedAtLabel,
      trustSignals,
      margins,
      pageWidth,
      pageKind: "questions",
      currentPage: pageIndex + 1
    });

    pdf.setFont(fontFamily, "normal");
    pdf.setFontSize(questionFontSize);
    pdf.setTextColor(worksheetTheme.textColor.r, worksheetTheme.textColor.g, worksheetTheme.textColor.b);

    pageRows.forEach((row) => {
      const sectionHeaderHeight = row.sectionHeaderHeight || 0;
      if (row.showSectionHeader || row.continuedSectionHeader) {
        drawSectionHeader(pdf, {
          x: margins.left,
          y,
          width: pageWidth - margins.left - margins.right,
          sectionLabel: row.sectionLabel,
          worksheetTheme,
          headerHeight: sectionHeaderHeight || metrics.sectionHeaderHeight || QUESTION_SECTION_HEADER_HEIGHT
        });
      }

      const questionBoxY = y + sectionHeaderHeight;

      row.items.forEach((item, itemIndex) => {
        const x = margins.left + (itemIndex * (columnWidth + columnGap));
        const boxHeight = row.contentHeight || (row.rowHeight - sectionHeaderHeight);
        const boxPadding = metrics.questionPadding;
        const numberLabel = `${item.questionNumber}.`;
        const numberWidth = pdf.getTextWidth(numberLabel);
        const textY = questionBoxY + boxPadding + 7.6;

        pdf.setDrawColor(worksheetTheme.questionBorder.r, worksheetTheme.questionBorder.g, worksheetTheme.questionBorder.b);
        pdf.roundedRect(x, questionBoxY, columnWidth, boxHeight, 1.8, 1.8, "S");
        pdf.setTextColor(worksheetTheme.titleColor.r, worksheetTheme.titleColor.g, worksheetTheme.titleColor.b);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8.2);
        pdf.text(numberLabel, x + boxPadding, questionBoxY + boxPadding + 3.8);

        if (item.question.format === "vertical") {
          pdf.setTextColor(worksheetTheme.textColor.r, worksheetTheme.textColor.g, worksheetTheme.textColor.b);
          pdf.setFont("courier", "bold");
          pdf.setFontSize(Math.max(10.5, questionFontSize - 0.5));
          pdf.text(item.textLines, x + columnWidth - boxPadding - 0.8, textY, { align: "right" });
        } else if (item.compareParts) {
          const compareStartX = x + boxPadding + numberWidth + 1.8;
          const compareTopY = textY;
          const compareRowY = compareTopY + (item.compareParts.headingLines.length * metrics.questionLineHeight) + 1.8;
          const leftX = compareStartX;
          const rightX = x + columnWidth - boxPadding;
          const blankStartX = leftX + item.compareParts.expressionWidth + item.compareParts.compareGap;
          const blankEndX = blankStartX + item.compareParts.blankWidth;

          pdf.setTextColor(worksheetTheme.textColor.r, worksheetTheme.textColor.g, worksheetTheme.textColor.b);
          pdf.setFont(fontFamily, "normal");
          pdf.setFontSize(questionFontSize);
          pdf.text(item.compareParts.headingLines, compareStartX, compareTopY);
          pdf.text(item.compareParts.leftLines, leftX, compareRowY);
          pdf.text(item.compareParts.rightLines, rightX, compareRowY, { align: "right" });
          pdf.setDrawColor(worksheetTheme.questionBorder.r, worksheetTheme.questionBorder.g, worksheetTheme.questionBorder.b);
          pdf.setLineWidth(0.35);
          pdf.line(blankStartX, compareRowY - 0.5, blankEndX, compareRowY - 0.5);
        } else {
          pdf.setTextColor(worksheetTheme.textColor.r, worksheetTheme.textColor.g, worksheetTheme.textColor.b);
          pdf.setFont(fontFamily, "normal");
          pdf.setFontSize(questionFontSize);
          pdf.text(item.textLines, x + boxPadding + numberWidth + 1.8, textY);
        }

        if (item.question.answerLine !== false && !item.hasInlineAnswerSpace) {
          const answerY = questionBoxY + boxHeight - Math.max(4.2, metrics.answerAreaHeight * 0.5);
          const answerWidth = Math.min(columnWidth - (boxPadding * 2), metrics.answerLineWidth);

          pdf.setDrawColor(worksheetTheme.questionBorder.r, worksheetTheme.questionBorder.g, worksheetTheme.questionBorder.b);
          pdf.setLineWidth(0.35);
          pdf.line(x + boxPadding, answerY, x + boxPadding + answerWidth, answerY);
        }
      });

      y += row.rowHeight + rowGap;
    });

    drawPageFooter(pdf, {
      fontFamily,
      worksheetTheme,
      metrics,
      pageNumber: pageIndex + 1,
      totalPages,
      margins,
      pageWidth,
      pageHeight
    });
  });
}

function buildAnswerRows(pdf, questions, answerColumns, answerColumnWidth, metrics) {
  const rows = [];
  let currentRowQuestions = [];

  function flushRow() {
    if (!currentRowQuestions.length) {
      return;
    }

    const rowQuestions = currentRowQuestions.map((question) => {
      const absoluteIndex = question.sequenceIndex || (questions.indexOf(question) + 1);
      const answerLines = pdf.splitTextToSize(String(question.answer), answerColumnWidth - (metrics.answerCardPadding * 2));
      const hintUnits = question.layoutHints?.answerUnits || 1;
      const boxHeight = Math.max(
        metrics.answerCardMinHeight + ((hintUnits - 1) * 2.35),
        (answerLines.length * metrics.answerCardLineHeight) + 6.6
      );

      return {
        absoluteIndex,
        answerLines,
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

function drawAnswerKeyPages(pdf, answerPages, options) {
  if (!answerPages.length) {
    return;
  }

  const {
    fontFamily,
    worksheetTheme,
    metrics,
    identity,
    grade,
    subjectLabel,
    focusLabel,
    worksheetSubtitle,
    worksheetModeLabel,
    difficultyLabel,
    generatedAtLabel,
    trustSignals,
    margins,
    pageWidth,
    pageHeight,
    totalPages,
    questionPageCount,
    startOnCurrentPage = false
  } = options;

  const answerGap = 3.4;

  answerPages.forEach((pageRows, pageIndex) => {
    if (!(startOnCurrentPage && pageIndex === 0)) {
      pdf.addPage();
    }

    const startY = drawPageHeader(pdf, {
      fontFamily,
      worksheetTheme,
      metrics,
      identity,
      grade,
      subjectLabel,
      focusLabel,
      worksheetSubtitle,
      worksheetModeLabel,
      difficultyLabel,
      generatedAtLabel,
      trustSignals,
      margins,
      pageWidth,
      pageKind: "answer-key",
      currentPage: questionPageCount + pageIndex + 1
    });

    const widestRow = pageRows.reduce((maxColumns, row) => Math.max(maxColumns, row.items.length), 1);
    const answerColumnWidth = (
      pageWidth - margins.left - margins.right - ((widestRow - 1) * answerGap)
    ) / widestRow;

    pdf.setFont(fontFamily, "normal");
    pdf.setFontSize(8.5);
    pdf.setTextColor(0, 0, 0);

    let y = startY;

    pageRows.forEach((row) => {
      const sectionHeaderHeight = row.sectionHeaderHeight || 0;
      if (row.showSectionHeader || row.continuedSectionHeader) {
        drawSectionHeader(pdf, {
          x: margins.left,
          y,
          width: pageWidth - margins.left - margins.right,
          sectionLabel: row.sectionLabel,
          worksheetTheme,
          headerHeight: sectionHeaderHeight || metrics.answerSectionHeaderHeight || ANSWER_SECTION_HEADER_HEIGHT
        });
      }

      const answerRowY = y + sectionHeaderHeight;

      row.items.forEach((item, columnIndex) => {
        const x = margins.left + (columnIndex * (answerColumnWidth + answerGap));
        const answerBoxHeight = row.contentHeight || (row.rowHeight - sectionHeaderHeight);

        pdf.setDrawColor(worksheetTheme.answerBorder.r, worksheetTheme.answerBorder.g, worksheetTheme.answerBorder.b);
        pdf.roundedRect(x, answerRowY, answerColumnWidth, answerBoxHeight, 1.4, 1.4, "S");
        pdf.setTextColor(worksheetTheme.titleColor.r, worksheetTheme.titleColor.g, worksheetTheme.titleColor.b);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(7.6);
        pdf.text(`${item.absoluteIndex}.`, x + metrics.answerCardPadding, answerRowY + 4.4);
        pdf.setFont(fontFamily, "normal");
        pdf.setTextColor(worksheetTheme.textColor.r, worksheetTheme.textColor.g, worksheetTheme.textColor.b);
        pdf.setFontSize(8.2);
        pdf.text(item.answerLines, x + metrics.answerCardPadding, answerRowY + 8.4);
      });

      y += row.rowHeight + 2.8;
    });

    drawPageFooter(pdf, {
      fontFamily,
      worksheetTheme,
      metrics,
      pageNumber: questionPageCount + pageIndex + 1,
      totalPages,
      margins,
      pageWidth,
      pageHeight
    });
  });
}

export function downloadWorksheetPDF({
  questions,
  grade,
  template,
  theme,
  worksheetTitle,
  subjectLabel,
  focusLabel,
  worksheetSubtitle,
  worksheetModeLabel,
  difficultyLabel,
  generatedAtLabel,
  trustSignals,
  showAnswerKey,
  identity
}) {
  const safeQuestions = Array.isArray(questions) ? questions.filter(Boolean) : [];

  if (safeQuestions.length === 0) {
    return;
  }

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({
    orientation: "p",
    unit: "mm",
    format: "a4",
    compress: true
  });
  const presentation = getTemplatePresentation(template);
  const fontFamily = getPdfFontFamily(presentation);
  const worksheetTheme = getWorksheetTheme(presentation, theme);
  const pageWidth = PDF_PAGE_LAYOUT.width;
  const pageHeight = PDF_PAGE_LAYOUT.height;
  const margins = {
    top: PDF_PAGE_LAYOUT.paddingTop,
    right: PDF_PAGE_LAYOUT.paddingX,
    bottom: PDF_PAGE_LAYOUT.paddingBottom,
    left: PDF_PAGE_LAYOUT.paddingX
  };
  const resolvedIdentity = {
    worksheetTitle: identity?.worksheetTitle || worksheetTitle || "Worksheet",
    schoolName: identity?.schoolName || "",
    teacherName: identity?.teacherName || "",
    studentName: normalizeStudentName(identity?.studentName || ""),
    worksheetDate: identity?.worksheetDate || "",
    instructions: identity?.instructions || "",
    scorePoints: getScoreTarget(identity?.scorePoints || ""),
    teacherNotes: sanitizeTeacherNotes(identity?.teacherNotes || "")
  };
  const baseMetrics = getPdfLayoutMetrics(presentation);
  const baseQuestionHeaderHeight = measurePageHeaderHeight(pdf, {
    identity: resolvedIdentity,
    metrics: baseMetrics,
    grade,
    subjectLabel,
    focusLabel,
    worksheetSubtitle,
    worksheetModeLabel,
    trustSignals,
    margins,
    pageWidth,
    pageKind: "questions",
    currentPage: 1
  });
  const footer = getFooterMetrics(pageHeight);
  const questionContentBottom = footer.top - PDF_PAGE_LAYOUT.footerGap;
  const baseQuestionUsableHeight = Math.max(0, questionContentBottom - (margins.top + baseQuestionHeaderHeight));
  const initialColumnGap = baseMetrics.columnGap;
  const initialColumnWidth = presentation.columnsCount === 1
    ? pageWidth - margins.left - margins.right
    : ((pageWidth - margins.left - margins.right - initialColumnGap) / 2);
  const initialQuestionRows = buildQuestionRows(pdf, safeQuestions, presentation, baseMetrics, initialColumnWidth);
  const initialQuestionPages = paginateRows(
    initialQuestionRows,
    baseQuestionUsableHeight,
    baseMetrics.rowGap,
    baseMetrics.sectionHeaderHeight || QUESTION_SECTION_HEADER_HEIGHT
  );
  const densityProfile = buildDensityProfile({
    questionPages: initialQuestionPages,
    questionUsableHeight: baseQuestionUsableHeight,
    rowGap: baseMetrics.rowGap,
    questions: safeQuestions
  });
  const metrics = getAdaptivePdfMetrics(baseMetrics, densityProfile);
  const questionHeaderHeight = measurePageHeaderHeight(pdf, {
    identity: resolvedIdentity,
    metrics,
    grade,
    subjectLabel,
    focusLabel,
    worksheetSubtitle,
    worksheetModeLabel,
    trustSignals,
    margins,
    pageWidth,
    pageKind: "questions",
    currentPage: 1
  });
  const answerHeaderHeight = measurePageHeaderHeight(pdf, {
    identity: resolvedIdentity,
    metrics,
    grade,
    subjectLabel,
    focusLabel,
    worksheetSubtitle,
    worksheetModeLabel,
    trustSignals,
    margins,
    pageWidth,
    pageKind: "answer-key",
    currentPage: 1
  });
  const questionUsableHeight = Math.max(0, questionContentBottom - (margins.top + questionHeaderHeight));
  const answerUsableHeight = Math.max(0, questionContentBottom - (margins.top + answerHeaderHeight));
  const rowGap = metrics.rowGap;
  const questionFontSize = metrics.questionFontSize;
  const columnGap = metrics.columnGap;
  const columnWidth = presentation.columnsCount === 1
    ? pageWidth - margins.left - margins.right
    : ((pageWidth - margins.left - margins.right - columnGap) / 2);
  const questionRows = buildQuestionRows(pdf, safeQuestions, presentation, metrics, columnWidth);
  const questionPages = paginateRows(questionRows, questionUsableHeight, rowGap, QUESTION_SECTION_HEADER_HEIGHT);
  const answerColumns = resolveAnswerColumnCount(safeQuestions);
  const answerColumnWidth = (
    pageWidth - margins.left - margins.right - ((answerColumns - 1) * 3.4)
  ) / answerColumns;
  const answerRows = showAnswerKey ? buildAnswerRows(pdf, safeQuestions, answerColumns, answerColumnWidth, metrics) : [];
  const answerPages = showAnswerKey ? paginateRows(answerRows, answerUsableHeight, 3.6, ANSWER_SECTION_HEADER_HEIGHT) : [];
  const answerPageCount = answerPages.length;
  const totalPages = questionPages.length + answerPageCount;

  drawQuestionPages(pdf, questionPages, {
    fontFamily,
    worksheetTheme,
    presentation,
    metrics,
    identity: resolvedIdentity,
    grade,
    subjectLabel,
    focusLabel,
    worksheetSubtitle,
    worksheetModeLabel,
    difficultyLabel,
    generatedAtLabel,
    trustSignals,
    margins,
    pageWidth,
    pageHeight,
    questionFontSize,
    columnWidth,
    columnGap,
    rowGap,
    totalPages
  });

  if (showAnswerKey) {
    drawAnswerKeyPages(pdf, answerPages, {
      fontFamily,
      worksheetTheme,
      metrics,
      identity: resolvedIdentity,
      grade,
      subjectLabel,
      focusLabel,
      worksheetSubtitle,
      worksheetModeLabel,
      difficultyLabel,
      generatedAtLabel,
      trustSignals,
      margins,
      pageWidth,
      pageHeight,
      totalPages,
      questionPageCount: questionPages.length,
      startOnCurrentPage: questionPages.length === 0
    });
  }

  pdf.save("teachsheet-ai-worksheet.pdf");
}
