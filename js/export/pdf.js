import { getTemplatePresentation } from "../templates/templates.js";

const PDF_PAGE_LAYOUT = {
  width: 210,
  height: 297,
  paddingX: 20,
  paddingTop: 20,
  paddingBottom: 20,
  footerBottom: 8,
  footerHeight: 8,
  footerGap: 12
};

const QUESTION_SECTION_HEADER_HEIGHT = 8.4;
const ANSWER_SECTION_HEADER_HEIGHT = 7.8;

function getPdfFontFamily(template) {
  return template.layout === "single-column" ? "times" : "helvetica";
}

function questionHasInlineAnswerSpace(question) {
  return /_{3,}/.test(String(question?.text || ""));
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

function getPdfLayoutMetrics(presentation) {
  const isSingleColumn = presentation.layout === "single-column";
  const isKids = presentation.id === "kids-colorful";

  return {
    questionFontSize: isKids ? 12.4 : isSingleColumn ? 11.7 : 11.5,
    questionLineHeight: isKids ? 4.8 : isSingleColumn ? 4.45 : 4.2,
    answerLineHeight: 3.9,
    questionPadding: isKids ? 4.2 : isSingleColumn ? 4 : 3.8,
    questionMinHeight: isKids ? 24 : isSingleColumn ? 21.5 : 20.5,
    verticalQuestionMinHeight: isKids ? 31 : 28.5,
    answerAreaHeight: isKids ? 8.2 : 6.8,
    answerLineWidth: isKids ? 40 : isSingleColumn ? 82 : 28,
    answerCardMinHeight: isSingleColumn ? 10 : 9.6,
    answerCardPadding: 2.6,
    answerCardLineHeight: 3.55,
    rowGap: isSingleColumn ? 4.8 : 4.3,
    columnGap: isSingleColumn ? 0 : 6,
    titleFontSize: 18.4,
    titleSubtitleFontSize: 8.1,
    subtitleFontSize: 8.8,
    schoolFontSize: 7.9,
    introFontSize: 8.5,
    introLineHeight: 3.8,
    schoolGap: 3.4,
    titleGap: 5,
    subtitleGap: 3.8,
    dividerGap: 3.2,
    fieldHeight: 9.2,
    notesLabelGap: 3.8,
    notesPadding: 2.8,
    notesLineHeight: 3.8,
    notesMinHeight: 9.6,
    footerFontSize: 8.2,
    footerLineInset: 1.8
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

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function scaleMetric(value, factor, minimum) {
  return Math.max(minimum, Number((value * factor).toFixed(2)));
}

function getPageFillRatio(pageRows, usableHeight, rowGap) {
  if (!usableHeight || usableHeight <= 0 || !pageRows.length) {
    return 0;
  }

  return getPageRowsHeight(pageRows, rowGap) / usableHeight;
}

function buildDensityProfile({ questionPages, questionUsableHeight, rowGap, questions }) {
  if (!questionPages.length) {
    return {
      compactness: 0,
      earlyFill: 1,
      averageFill: 1
    };
  }

  const fills = questionPages.map((pageRows) => getPageFillRatio(pageRows, questionUsableHeight, rowGap));
  const earlyPages = fills.slice(0, Math.min(2, fills.length));
  const earlyFill = earlyPages.reduce((total, fill) => total + fill, 0) / earlyPages.length;
  const averageFill = fills.reduce((total, fill) => total + fill, 0) / fills.length;
  const verticalShare = questions.length
    ? questions.filter((question) => question.format === "vertical").length / questions.length
    : 0;
  let compactness = 0;

  if (questionPages.length > 1) {
    compactness = (
      Math.max(0, 0.86 - earlyFill) * 0.55 +
      Math.max(0, 0.82 - averageFill) * 0.45
    );
  } else {
    compactness = Math.max(0, 0.76 - averageFill) * 0.35;
  }

  compactness += verticalShare * 0.03;
  return {
    compactness: clamp(compactness, 0, 0.18),
    earlyFill,
    averageFill
  };
}

function getAdaptivePdfMetrics(baseMetrics, densityProfile) {
  const compactness = densityProfile?.compactness || 0;

  if (compactness <= 0.015) {
    return {
      ...baseMetrics,
      sectionHeaderHeight: QUESTION_SECTION_HEADER_HEIGHT,
      answerSectionHeaderHeight: ANSWER_SECTION_HEADER_HEIGHT
    };
  }

  const factor = 1 - compactness;

  return {
    ...baseMetrics,
    questionPadding: scaleMetric(baseMetrics.questionPadding, 1 - (compactness * 0.7), 3),
    questionMinHeight: scaleMetric(baseMetrics.questionMinHeight, factor, 18.5),
    verticalQuestionMinHeight: scaleMetric(baseMetrics.verticalQuestionMinHeight, 1 - (compactness * 0.85), 24.5),
    answerAreaHeight: scaleMetric(baseMetrics.answerAreaHeight, 1 - (compactness * 0.75), 5.8),
    answerCardMinHeight: scaleMetric(baseMetrics.answerCardMinHeight, factor, 8.8),
    rowGap: scaleMetric(baseMetrics.rowGap, 1 - (compactness * 0.9), 2.8),
    introLineHeight: scaleMetric(baseMetrics.introLineHeight, 1 - (compactness * 0.35), 3.4),
    notesLineHeight: scaleMetric(baseMetrics.notesLineHeight, 1 - (compactness * 0.35), 3.4),
    notesMinHeight: scaleMetric(baseMetrics.notesMinHeight, 1 - (compactness * 0.5), 8.2),
    sectionHeaderHeight: scaleMetric(QUESTION_SECTION_HEADER_HEIGHT, 1 - (compactness * 0.75), 6.4),
    answerSectionHeaderHeight: scaleMetric(ANSWER_SECTION_HEADER_HEIGHT, 1 - (compactness * 0.75), 6)
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
      const textLines = buildQuestionLines(pdf, question.text, columnWidth - (horizontalPadding * 2));
      const answerReserve = question.answerLine !== false && !hasInlineAnswerSpace
        ? (hint.answerAreaHeight || answerAreaHeight)
        : 0;
      const baseHeight = (textLines.length * lineHeight) + answerReserve + 9.4;

      return {
        question,
        questionNumber: absoluteIndex,
        hasInlineAnswerSpace,
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

function getPageRowsHeight(rows, rowGap) {
  if (!rows.length) {
    return 0;
  }

  return rows.reduce((total, row, index) => (
    total + row.rowHeight + (index > 0 ? rowGap : 0)
  ), 0);
}

function getHeightAfterRemovingRow(pageHeight, pageLength, rowHeight, rowGap) {
  if (pageLength <= 0) {
    return 0;
  }

  if (pageLength === 1) {
    return 0;
  }

  return pageHeight - rowHeight - rowGap;
}

function getHeightAfterAddingRow(pageHeight, pageLength, rowHeight, rowGap) {
  return pageHeight + rowHeight + (pageLength > 0 ? rowGap : 0);
}

function isMoveImprovement(
  currentLeftHeight,
  currentRightHeight,
  nextLeftHeight,
  nextRightHeight,
  leftTargetHeight,
  rightTargetHeight
) {
  const currentDistance = Math.abs(currentLeftHeight - leftTargetHeight) + Math.abs(currentRightHeight - rightTargetHeight);
  const nextDistance = Math.abs(nextLeftHeight - leftTargetHeight) + Math.abs(nextRightHeight - rightTargetHeight);

  return nextDistance + 1 < currentDistance;
}

function rebalanceQuestionPages(pages, usableHeight, rowGap) {
  const balancedPages = pages
    .filter((pageRows) => pageRows.length > 0)
    .map((pageRows) => [...pageRows]);

  if (balancedPages.length < 2) {
    return balancedPages;
  }

  const totalContentHeight = balancedPages.reduce((total, pageRows) => (
    total + getPageRowsHeight(pageRows, rowGap)
  ), 0);
  const targetHeight = Math.min(usableHeight, totalContentHeight / balancedPages.length);
  const earlyTargetHeight = Math.min(
    usableHeight * 0.88,
    Math.max(targetHeight, usableHeight * 0.8)
  );
  let changed = true;
  let iterations = 0;

  while (changed && iterations < 20) {
    changed = false;
    iterations += 1;

    for (let pageIndex = 0; pageIndex < balancedPages.length - 1; pageIndex += 1) {
      const leftPage = balancedPages[pageIndex];
      const rightPage = balancedPages[pageIndex + 1];

      if (!leftPage.length || !rightPage.length) {
        continue;
      }

      let leftHeight = getPageRowsHeight(leftPage, rowGap);
      let rightHeight = getPageRowsHeight(rightPage, rowGap);
      const leftTargetHeight = pageIndex < 2 ? earlyTargetHeight : targetHeight;
      const rightTargetHeight = pageIndex + 1 < 2 ? earlyTargetHeight : targetHeight;

      if (leftHeight + 1 < leftTargetHeight && rightPage.length > 1) {
        const movedRow = rightPage[0];
        const nextLeftHeight = getHeightAfterAddingRow(leftHeight, leftPage.length, movedRow.rowHeight, rowGap);
        const nextRightHeight = getHeightAfterRemovingRow(rightHeight, rightPage.length, movedRow.rowHeight, rowGap);

        if (
          nextLeftHeight <= usableHeight &&
          nextRightHeight >= usableHeight * 0.22 &&
          isMoveImprovement(
            leftHeight,
            rightHeight,
            nextLeftHeight,
            nextRightHeight,
            leftTargetHeight,
            rightTargetHeight
          )
        ) {
          leftPage.push(rightPage.shift());
          leftHeight = nextLeftHeight;
          rightHeight = nextRightHeight;
          changed = true;
        }
      }

      if (rightHeight + 1 < rightTargetHeight && leftPage.length > 1) {
        const movedRow = leftPage[leftPage.length - 1];
        const nextLeftHeight = getHeightAfterRemovingRow(leftHeight, leftPage.length, movedRow.rowHeight, rowGap);
        const nextRightHeight = getHeightAfterAddingRow(rightHeight, rightPage.length, movedRow.rowHeight, rowGap);

        if (
          nextRightHeight <= usableHeight &&
          nextLeftHeight >= usableHeight * 0.22 &&
          isMoveImprovement(
            leftHeight,
            rightHeight,
            nextLeftHeight,
            nextRightHeight,
            leftTargetHeight,
            rightTargetHeight
          )
        ) {
          rightPage.unshift(leftPage.pop());
          changed = true;
        }
      }
    }
  }

  return balancedPages.filter((pageRows) => pageRows.length > 0);
}

function paginateRows(rows, usableHeight, rowGap, continuationHeaderHeight = 0) {
  const pages = [];
  let currentPageRows = [];
  let usedHeight = 0;

  rows.forEach((row) => {
    let effectiveRow = row;
    let totalRowHeight = effectiveRow.rowHeight + (currentPageRows.length > 0 ? rowGap : 0);

    if (currentPageRows.length > 0 && usedHeight + totalRowHeight > usableHeight) {
      pages.push(currentPageRows);
      if (!row.showSectionHeader && row.sectionLabel && continuationHeaderHeight > 0) {
        effectiveRow = {
          ...row,
          continuedSectionHeader: true,
          rowHeight: row.rowHeight + continuationHeaderHeight,
          sectionHeaderHeight: (row.sectionHeaderHeight || 0) + continuationHeaderHeight
        };
      }

      currentPageRows = [effectiveRow];
      usedHeight = effectiveRow.rowHeight;
      return;
    }

    currentPageRows.push(effectiveRow);
    usedHeight += totalRowHeight;
  });

  if (currentPageRows.length > 0) {
    pages.push(currentPageRows);
  }

  const balancedPages = rebalanceQuestionPages(pages, usableHeight, rowGap);

  if (continuationHeaderHeight <= 0) {
    return balancedPages;
  }

  return balancedPages.map((pageRows, pageIndex) => pageRows.map((row, rowIndex) => {
    const shouldRepeatHeader = pageIndex > 0 && rowIndex === 0 && row.sectionLabel && !row.showSectionHeader;

    return {
      ...row,
      continuedSectionHeader: shouldRepeatHeader,
      sectionHeaderHeight: shouldRepeatHeader
        ? Math.max(row.sectionHeaderHeight || 0, continuationHeaderHeight)
        : (row.showSectionHeader ? row.sectionHeaderHeight : 0),
      rowHeight: shouldRepeatHeader
        ? (row.baseRowHeight || row.rowHeight) + continuationHeaderHeight
        : (row.baseRowHeight || row.rowHeight)
    };
  }));
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
  pdf.text(label.toUpperCase(), margins.left + metrics.notesPadding, y + 3.8);
  pdf.setTextColor(worksheetTheme.mutedText.r, worksheetTheme.mutedText.g, worksheetTheme.mutedText.b);
  pdf.setFontSize(8.6);
  pdf.setFont("helvetica", "normal");
  pdf.text(lines, margins.left + metrics.notesPadding, y + metrics.notesLabelGap + 3.2);
  return y + boxHeight + 1.8;
}

function getNotesBlockHeight(linesCount, metrics) {
  return Math.max(metrics.notesMinHeight, (linesCount * metrics.notesLineHeight) + metrics.notesLabelGap + 5.2);
}

function getFooterMetrics(pageHeight) {
  const top = pageHeight - PDF_PAGE_LAYOUT.footerBottom - PDF_PAGE_LAYOUT.footerHeight;

  return {
    top,
    lineY: top - 1.8,
    textY: top + 5.4
  };
}

function getIdentityFieldHeight(metrics) {
  return metrics.fieldHeight;
}

function normalizePrintFocusLabel(subjectLabel, focusLabel) {
  if (!focusLabel) {
    return "";
  }

  if (subjectLabel === "Math") {
    return String(focusLabel).replace(/^Horizontal\s+/i, "");
  }

  return String(focusLabel);
}

function normalizePrintWorksheetTitle(title, subjectLabel, focusLabel) {
  const rawTitle = String(title || "").trim();

  if (!rawTitle) {
    return "Worksheet";
  }

  const normalized = rawTitle.toLowerCase();
  const genericTitles = new Set(["exercices", "exercises", "exercise", "worksheet"]);

  if (genericTitles.has(normalized)) {
    const focusPart = normalizePrintFocusLabel(subjectLabel, focusLabel);
    return focusPart ? `${focusPart} Worksheet` : "Worksheet";
  }

  return rawTitle;
}

function buildCompactDescriptorLine({
  pageKind,
  grade,
  subjectLabel,
  focusLabel,
  worksheetModeLabel
}) {
  const parts = [grade];

  if (subjectLabel && subjectLabel !== "Math") {
    parts.push(subjectLabel);
  }

  parts.push(normalizePrintFocusLabel(subjectLabel, focusLabel));

  if (pageKind === "answer-key") {
    parts.push("Answer Sheet");
  } else if (worksheetModeLabel) {
    parts.push(worksheetModeLabel);
  }

  return parts.filter(Boolean).join(" | ");
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
    pdf.text(field.label.toUpperCase(), x + 2.4, y + 2.9);

    if (field.value) {
      pdf.setTextColor(worksheetTheme.titleColor.r, worksheetTheme.titleColor.g, worksheetTheme.titleColor.b);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8.4);
      pdf.text(field.value, x + 2.4, y + 6.8);
    } else {
      pdf.setDrawColor(worksheetTheme.accentBorder.r, worksheetTheme.accentBorder.g, worksheetTheme.accentBorder.b);
      pdf.setLineWidth(0.3);
      pdf.line(x + 2.4, y + 6.8, x + fieldWidth - 2.4, y + 6.8);
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
  pageKind
}) {
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
  let y = margins.top;

  if (identity.schoolName) {
    y += metrics.schoolGap;
  }

  y += metrics.titleGap;

  if (descriptorLines.length > 0) {
    y += Math.max(3.4, descriptorLines.length * 3.3);
  }

  y += getIdentityFieldHeight(metrics);

  if (introLines.length > 0) {
    y += 3.2;
    y += Math.max(3.8, introLines.length * metrics.introLineHeight);
  }

  if (identity.teacherNotes) {
    const lines = pdf.splitTextToSize(
      identity.teacherNotes,
      pageWidth - margins.left - margins.right - (metrics.notesPadding * 2)
    );
    y += 3;
    y += getNotesBlockHeight(lines.length, metrics) + 1.8;
  }

  return (y + 4.2) - margins.top;
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
  pageKind
}) {
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
  const identityFields = [
    { label: "Name", value: identity.studentName || "" },
    { label: "Date", value: identity.worksheetDate || "" },
    { label: "Score", value: identity.scorePoints || "" }
  ];
  let y = margins.top;

  if (identity.schoolName) {
    pdf.setTextColor(worksheetTheme.mutedText.r, worksheetTheme.mutedText.g, worksheetTheme.mutedText.b);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(metrics.schoolFontSize);
    pdf.text(identity.schoolName, pageWidth / 2, y + 2.7, { align: "center" });
    y += metrics.schoolGap;
  }

  pdf.setTextColor(worksheetTheme.titleColor.r, worksheetTheme.titleColor.g, worksheetTheme.titleColor.b);
  pdf.setFont(fontFamily, "bold");
  pdf.setFontSize(metrics.titleFontSize);
  pdf.text(titleText, pageWidth / 2, y + 4.6, { align: "center" });

  y += metrics.titleGap;

  if (descriptorLines.length > 0) {
    pdf.setTextColor(worksheetTheme.mutedText.r, worksheetTheme.mutedText.g, worksheetTheme.mutedText.b);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(metrics.titleSubtitleFontSize);
    pdf.text(descriptorLines, pageWidth / 2, y + 2.8, { align: "center" });
    y += Math.max(3.4, descriptorLines.length * 3.3);
  }

  y = drawIdentityFieldRow(pdf, identityFields, y + 1.6, margins, pageWidth, worksheetTheme, metrics);

  if (introLines.length > 0) {
    y += 3.2;
    pdf.setTextColor(worksheetTheme.mutedText.r, worksheetTheme.mutedText.g, worksheetTheme.mutedText.b);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(metrics.introFontSize);
    pdf.text(introLines, margins.left, y + 3.2);
    y += Math.max(3.8, introLines.length * metrics.introLineHeight);
  }

  if (identity.teacherNotes) {
    y += 3;
    y = drawNotesBlock(pdf, "Teacher Notes", identity.teacherNotes, y, margins, pageWidth, worksheetTheme, metrics);
  }

  pdf.setDrawColor(worksheetTheme.dividerColor.r, worksheetTheme.dividerColor.g, worksheetTheme.dividerColor.b);
  pdf.setLineWidth(0.35);
  pdf.line(margins.left, y + 1.6, pageWidth - margins.right, y + 1.6);

  return y + 4.2;
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
      pageKind: "questions"
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
      pageKind: "answer-key"
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
    studentName: identity?.studentName || "",
    worksheetDate: identity?.worksheetDate || "",
    instructions: identity?.instructions || "",
    scorePoints: identity?.scorePoints || "",
    teacherNotes: identity?.teacherNotes || ""
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
    pageKind: "questions"
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
    pageKind: "questions"
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
    pageKind: "answer-key"
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
  const hasWideAnswers = safeQuestions.some((question) => (
    (question.layoutHints?.answerUnits || 1) > 1.2 || String(question.answer || "").length > 24
  ));
  const allAnswersCompact = safeQuestions.every((question) => (
    (question.layoutHints?.answerUnits || 1) <= 1.05 && String(question.answer || "").length <= 16
  ));
  const answerColumns = hasWideAnswers
    ? 2
    : (allAnswersCompact ? 4 : 3);
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
