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

function getPdfFontFamily(template) {
  return template.layout === "single-column" ? "times" : "helvetica";
}

function hexToRgb(hexColor) {
  const normalized = String(hexColor || "").replace("#", "");

  if (normalized.length !== 6) {
    return { r: 0, g: 140, b: 255 };
  }

  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16)
  };
}

function mixWithWhite(color, ratio) {
  return {
    r: Math.round(color.r + ((255 - color.r) * ratio)),
    g: Math.round(color.g + ((255 - color.g) * ratio)),
    b: Math.round(color.b + ((255 - color.b) * ratio))
  };
}

function questionHasInlineAnswerSpace(question) {
  return /_{3,}/.test(String(question?.text || ""));
}

function buildWorksheetIntroText({ identity, pageKind, worksheetModeLabel, focusLabel }) {
  if (pageKind === "answer-key") {
    return "Use this page as the reference key for quick checking and classroom correction.";
  }

  if (identity.instructions) {
    return identity.instructions;
  }

  if (worksheetModeLabel && focusLabel) {
    return `${worksheetModeLabel} focused on ${focusLabel}. Read each question carefully and show clear working when needed.`;
  }

  return "Read each question carefully, keep your work neat, and complete every answer in the space provided.";
}

function getWorksheetTheme(presentation, accentColor) {
  const visualTheme = presentation.visualTheme || {};

  return {
    accent: accentColor,
    accentPale: mixWithWhite(accentColor, 0.94),
    accentBorder: mixWithWhite(accentColor, 0.74),
    titleColor: hexToRgb(visualTheme.titleColor || "#183153"),
    textColor: hexToRgb(visualTheme.textColor || "#1f2937"),
    mutedText: hexToRgb(visualTheme.mutedText || "#5f6b7a"),
    subtleText: hexToRgb(visualTheme.subtleText || "#7a8794"),
    dividerColor: hexToRgb(visualTheme.dividerColor || "#dbe5ef"),
    fieldBackground: hexToRgb(visualTheme.fieldBackground || "#ffffff"),
    fieldBorder: hexToRgb(visualTheme.fieldBorder || "#cfdeeb"),
    metaBackground: hexToRgb(visualTheme.metaBackground || "#f8fbff"),
    metaBorder: hexToRgb(visualTheme.metaBorder || "#dbe7f3"),
    notesBackground: hexToRgb(visualTheme.notesBackground || "#f8fbff"),
    notesBorder: hexToRgb(visualTheme.notesBorder || "#dbe7f3"),
    questionBorder: hexToRgb(visualTheme.questionBorder || "#c8d8e8"),
    answerBackground: hexToRgb(visualTheme.answerBackground || "#f8fbff"),
    answerBorder: hexToRgb(visualTheme.answerBorder || "#d9e6f2"),
    footerLine: hexToRgb(visualTheme.footerLine || "#dbe5ef")
  };
}

function getPdfLayoutMetrics(presentation) {
  const isSingleColumn = presentation.layout === "single-column";
  const isKids = presentation.id === "kids-colorful";

  return {
    questionFontSize: isKids ? 13.2 : isSingleColumn ? 12.3 : 12,
    questionLineHeight: isKids ? 5.2 : isSingleColumn ? 4.9 : 4.6,
    answerLineHeight: 4.3,
    questionPadding: isKids ? 5.4 : isSingleColumn ? 5 : 4.6,
    questionMinHeight: isKids ? 29 : isSingleColumn ? 25 : 23,
    verticalQuestionMinHeight: isKids ? 40 : 34,
    answerAreaHeight: isKids ? 10 : 8.2,
    answerLineWidth: isKids ? 46 : isSingleColumn ? 84 : 30,
    answerCardMinHeight: isSingleColumn ? 14 : 13,
    answerCardPadding: 4,
    answerCardLineHeight: 4.1,
    rowGap: isSingleColumn ? 6.5 : 5.8,
    columnGap: isSingleColumn ? 0 : 7,
    titleFontSize: 20.5,
    subtitleFontSize: 10,
    schoolFontSize: 10.2,
    introFontSize: 9.7,
    introLineHeight: 4.4,
    schoolGap: 5,
    titleGap: 7.2,
    subtitleGap: 5,
    dividerGap: 4.4,
    fieldHeight: 11.2,
    metaHeight: 10.2,
    notesLabelGap: 4.8,
    notesPadding: 3.4,
    notesLineHeight: 4.4,
    notesMinHeight: 12,
    footerFontSize: 8.7,
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

function buildQuestionRows(pdf, questions, presentation, metrics, columnWidth) {
  const rows = [];
  const columnsCount = presentation.columnsCount;
  const lineHeight = metrics.questionLineHeight;
  const horizontalPadding = metrics.questionPadding;
  const answerAreaHeight = metrics.answerAreaHeight;

  for (let index = 0; index < questions.length; index += columnsCount) {
    const rowQuestions = questions.slice(index, index + columnsCount).map((question, offset) => {
      const absoluteIndex = index + offset + 1;
      const hasInlineAnswerSpace = questionHasInlineAnswerSpace(question);
      const textLines = buildQuestionLines(pdf, question.text, columnWidth - (horizontalPadding * 2));
      const answerReserve = question.answerLine !== false && !hasInlineAnswerSpace ? answerAreaHeight : 0;
      const baseHeight = (textLines.length * lineHeight) + answerReserve + 12.5;

      return {
        question,
        questionNumber: absoluteIndex,
        hasInlineAnswerSpace,
        textLines,
        boxHeight: Math.max(
          question.format === "vertical" ? metrics.verticalQuestionMinHeight : metrics.questionMinHeight,
          baseHeight
        )
      };
    });

    rows.push({
      items: rowQuestions,
      rowHeight: Math.max(...rowQuestions.map((item) => item.boxHeight))
    });
  }

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

function isMoveImprovement(currentLeftHeight, currentRightHeight, nextLeftHeight, nextRightHeight, targetHeight) {
  const currentDistance = Math.abs(currentLeftHeight - targetHeight) + Math.abs(currentRightHeight - targetHeight);
  const nextDistance = Math.abs(nextLeftHeight - targetHeight) + Math.abs(nextRightHeight - targetHeight);

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

      if (leftHeight + 1 < targetHeight && rightPage.length > 1) {
        const movedRow = rightPage[0];
        const nextLeftHeight = getHeightAfterAddingRow(leftHeight, leftPage.length, movedRow.rowHeight, rowGap);
        const nextRightHeight = getHeightAfterRemovingRow(rightHeight, rightPage.length, movedRow.rowHeight, rowGap);

        if (
          nextLeftHeight <= usableHeight &&
          nextRightHeight >= usableHeight * 0.25 &&
          isMoveImprovement(leftHeight, rightHeight, nextLeftHeight, nextRightHeight, targetHeight)
        ) {
          leftPage.push(rightPage.shift());
          leftHeight = nextLeftHeight;
          rightHeight = nextRightHeight;
          changed = true;
        }
      }

      if (rightHeight + 1 < targetHeight && leftPage.length > 1) {
        const movedRow = leftPage[leftPage.length - 1];
        const nextLeftHeight = getHeightAfterRemovingRow(leftHeight, leftPage.length, movedRow.rowHeight, rowGap);
        const nextRightHeight = getHeightAfterAddingRow(rightHeight, rightPage.length, movedRow.rowHeight, rowGap);

        if (
          nextRightHeight <= usableHeight &&
          nextLeftHeight >= usableHeight * 0.25 &&
          isMoveImprovement(leftHeight, rightHeight, nextLeftHeight, nextRightHeight, targetHeight)
        ) {
          rightPage.unshift(leftPage.pop());
          changed = true;
        }
      }
    }
  }

  return balancedPages.filter((pageRows) => pageRows.length > 0);
}

function paginateRows(rows, usableHeight, rowGap) {
  const pages = [];
  let currentPageRows = [];
  let usedHeight = 0;

  rows.forEach((row) => {
    const totalRowHeight = row.rowHeight + (currentPageRows.length > 0 ? rowGap : 0);

    if (currentPageRows.length > 0 && usedHeight + totalRowHeight > usableHeight) {
      pages.push(currentPageRows);
      currentPageRows = [row];
      usedHeight = row.rowHeight;
      return;
    }

    currentPageRows.push(row);
    usedHeight += totalRowHeight;
  });

  if (currentPageRows.length > 0) {
    pages.push(currentPageRows);
  }

  return rebalanceQuestionPages(pages, usableHeight, rowGap);
}

function drawNotesBlock(pdf, label, value, y, margins, pageWidth, worksheetTheme, metrics) {
  if (!value) {
    return y;
  }

  const lines = pdf.splitTextToSize(value, pageWidth - margins.left - margins.right - (metrics.notesPadding * 2));
  const boxHeight = getNotesBlockHeight(lines.length, metrics);
  pdf.setFillColor(worksheetTheme.notesBackground.r, worksheetTheme.notesBackground.g, worksheetTheme.notesBackground.b);
  pdf.setDrawColor(worksheetTheme.notesBorder.r, worksheetTheme.notesBorder.g, worksheetTheme.notesBorder.b);
  pdf.roundedRect(margins.left, y, pageWidth - margins.left - margins.right, boxHeight, 2, 2, "FD");
  pdf.setTextColor(worksheetTheme.accent.r, worksheetTheme.accent.g, worksheetTheme.accent.b);
  pdf.setFontSize(8.8);
  pdf.setFont("helvetica", "bold");
  pdf.text(label.toUpperCase(), margins.left + metrics.notesPadding, y + 4.6);
  pdf.setTextColor(worksheetTheme.mutedText.r, worksheetTheme.mutedText.g, worksheetTheme.mutedText.b);
  pdf.setFontSize(9.8);
  pdf.setFont("helvetica", "normal");
  pdf.text(lines, margins.left + metrics.notesPadding, y + metrics.notesLabelGap + 4.2);
  return y + boxHeight + 2.8;
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

function getMetaGridHeight(metrics) {
  return metrics.metaHeight;
}

function drawIdentityFieldRow(pdf, fields, y, margins, pageWidth, worksheetTheme, metrics) {
  const gap = 4.6;
  const fieldHeight = getIdentityFieldHeight(metrics);
  const fieldWidth = (pageWidth - margins.left - margins.right - (gap * (fields.length - 1))) / fields.length;

  fields.forEach((field, index) => {
    const x = margins.left + (index * (fieldWidth + gap));

    pdf.setFillColor(worksheetTheme.fieldBackground.r, worksheetTheme.fieldBackground.g, worksheetTheme.fieldBackground.b);
    pdf.setDrawColor(worksheetTheme.fieldBorder.r, worksheetTheme.fieldBorder.g, worksheetTheme.fieldBorder.b);
    pdf.roundedRect(x, y, fieldWidth, fieldHeight, 2.4, 2.4, "FD");
    pdf.setTextColor(worksheetTheme.subtleText.r, worksheetTheme.subtleText.g, worksheetTheme.subtleText.b);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.8);
    pdf.text(field.label.toUpperCase(), x + 3.2, y + 3.8);

    if (field.value) {
      pdf.setTextColor(worksheetTheme.titleColor.r, worksheetTheme.titleColor.g, worksheetTheme.titleColor.b);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9.8);
      pdf.text(field.value, x + 3.2, y + 8.6);
    } else {
      pdf.setDrawColor(worksheetTheme.accentBorder.r, worksheetTheme.accentBorder.g, worksheetTheme.accentBorder.b);
      pdf.setLineWidth(0.3);
      pdf.line(x + 3.2, y + 8.8, x + fieldWidth - 3.2, y + 8.8);
    }
  });

  return y + fieldHeight;
}

function drawMetaGrid(pdf, items, y, margins, pageWidth, worksheetTheme, metrics) {
  const columns = items.length;
  const gap = 3.6;
  const cellHeight = metrics.metaHeight;
  const cellWidth = (pageWidth - margins.left - margins.right - (gap * (columns - 1))) / columns;

  items.forEach((item, index) => {
    const x = margins.left + (index * (cellWidth + gap));
    const cellY = y;

    pdf.setFillColor(worksheetTheme.metaBackground.r, worksheetTheme.metaBackground.g, worksheetTheme.metaBackground.b);
    pdf.setDrawColor(worksheetTheme.metaBorder.r, worksheetTheme.metaBorder.g, worksheetTheme.metaBorder.b);
    pdf.roundedRect(x, cellY, cellWidth, cellHeight, 2, 2, "FD");
    pdf.setTextColor(worksheetTheme.subtleText.r, worksheetTheme.subtleText.g, worksheetTheme.subtleText.b);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.6);
    pdf.text(item.label.toUpperCase(), x + 2.6, cellY + 3.4);
    pdf.setTextColor(worksheetTheme.titleColor.r, worksheetTheme.titleColor.g, worksheetTheme.titleColor.b);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.4);
    pdf.text(String(item.value || "--"), x + 2.6, cellY + 7.4);
  });

  return y + getMetaGridHeight(metrics);
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
  const introText = buildWorksheetIntroText({ identity, pageKind, worksheetModeLabel, focusLabel });
  const introLines = pdf.splitTextToSize(introText, pageWidth - margins.left - margins.right);
  let y = margins.top;

  if (identity.schoolName) {
    y += metrics.schoolGap;
  }

  y += metrics.titleGap;

  if (pageKind === "answer-key" || worksheetModeLabel) {
    y += metrics.subtitleGap;
  }

  y += Math.max(6.2, introLines.length * metrics.introLineHeight);
  y += metrics.dividerGap;
  y += getIdentityFieldHeight(metrics);
  y += 4;
  y += getMetaGridHeight(metrics);

  if (identity.teacherNotes) {
    const lines = pdf.splitTextToSize(
      identity.teacherNotes,
      pageWidth - margins.left - margins.right - (metrics.notesPadding * 2)
    );
    y += 4;
    y += getNotesBlockHeight(lines.length, metrics) + 2.8;
  }

  return (y + 5.2) - margins.top;
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
  const introText = buildWorksheetIntroText({ identity, pageKind, worksheetModeLabel, focusLabel });
  const introLines = pdf.splitTextToSize(introText, pageWidth - margins.left - margins.right);
  const identityFields = [
    { label: "Name", value: identity.studentName || "" },
    { label: "Date", value: identity.worksheetDate || "" },
    { label: "Score", value: identity.scorePoints || "" }
  ];
  const metaItems = [
    { label: "Teacher", value: identity.teacherName || "--" },
    { label: "Level", value: grade || "--" },
    { label: "Subject", value: subjectLabel || "--" },
    { label: "Focus", value: focusLabel || "--" }
  ];
  let y = margins.top;

  pdf.setTextColor(worksheetTheme.accent.r, worksheetTheme.accent.g, worksheetTheme.accent.b);
  pdf.setFont("helvetica", "bold");

  if (identity.schoolName) {
    pdf.setFontSize(metrics.schoolFontSize);
    pdf.text(identity.schoolName, pageWidth / 2, y, { align: "center" });
    y += metrics.schoolGap;
  }

  pdf.setTextColor(worksheetTheme.titleColor.r, worksheetTheme.titleColor.g, worksheetTheme.titleColor.b);
  pdf.setFont(fontFamily, "bold");
  pdf.setFontSize(metrics.titleFontSize);
  pdf.text(identity.worksheetTitle || "Worksheet", pageWidth / 2, y, { align: "center" });
  y += metrics.titleGap;

  if (pageKind === "answer-key" || worksheetModeLabel) {
    pdf.setTextColor(worksheetTheme.accent.r, worksheetTheme.accent.g, worksheetTheme.accent.b);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(metrics.subtitleFontSize);
    pdf.text(pageKind === "answer-key" ? "Answer Sheet" : worksheetModeLabel, pageWidth / 2, y, { align: "center" });
    y += metrics.subtitleGap;
  }

  pdf.setTextColor(worksheetTheme.mutedText.r, worksheetTheme.mutedText.g, worksheetTheme.mutedText.b);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(metrics.introFontSize);
  pdf.text(introLines, margins.left, y);
  y += Math.max(6.2, introLines.length * metrics.introLineHeight);

  pdf.setDrawColor(worksheetTheme.dividerColor.r, worksheetTheme.dividerColor.g, worksheetTheme.dividerColor.b);
  pdf.setLineWidth(0.3);
  pdf.line(margins.left, y, pageWidth - margins.right, y);
  y += metrics.dividerGap;

  y = drawIdentityFieldRow(pdf, identityFields, y, margins, pageWidth, worksheetTheme, metrics);
  y += 4;
  y = drawMetaGrid(pdf, metaItems, y, margins, pageWidth, worksheetTheme, metrics);

  if (identity.teacherNotes) {
    y += 4;
    y = drawNotesBlock(pdf, "Teacher Notes", identity.teacherNotes, y, margins, pageWidth, worksheetTheme, metrics);
  }

  pdf.setDrawColor(worksheetTheme.dividerColor.r, worksheetTheme.dividerColor.g, worksheetTheme.dividerColor.b);
  pdf.setLineWidth(0.45);
  pdf.line(margins.left, y, pageWidth - margins.right, y);

  return y + 5.2;
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
    worksheetModeLabel,
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
      worksheetModeLabel,
      margins,
      pageWidth,
      pageKind: "questions"
    });

    pdf.setFont(fontFamily, "normal");
    pdf.setFontSize(questionFontSize);
    pdf.setTextColor(worksheetTheme.textColor.r, worksheetTheme.textColor.g, worksheetTheme.textColor.b);

    pageRows.forEach((row) => {
      row.items.forEach((item, itemIndex) => {
        const x = margins.left + (itemIndex * (columnWidth + columnGap));
        const boxHeight = row.rowHeight;
        const boxPadding = metrics.questionPadding;
        const badgeWidth = item.questionNumber >= 10 ? 11.8 : 9.4;
        const badgeHeight = 6.4;
        const textY = y + boxPadding + 9.8;

        pdf.setDrawColor(worksheetTheme.questionBorder.r, worksheetTheme.questionBorder.g, worksheetTheme.questionBorder.b);
        pdf.setFillColor(255, 255, 255);
        pdf.roundedRect(x, y, columnWidth, boxHeight, 3, 3, "FD");
        pdf.setDrawColor(worksheetTheme.accentBorder.r, worksheetTheme.accentBorder.g, worksheetTheme.accentBorder.b);
        pdf.setFillColor(worksheetTheme.accentPale.r, worksheetTheme.accentPale.g, worksheetTheme.accentPale.b);
        pdf.roundedRect(x + boxPadding, y + boxPadding, badgeWidth, badgeHeight, 3.2, 3.2, "FD");
        pdf.setTextColor(worksheetTheme.accent.r, worksheetTheme.accent.g, worksheetTheme.accent.b);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8.7);
        pdf.text(String(item.questionNumber), x + boxPadding + (badgeWidth / 2), y + boxPadding + 4.4, { align: "center" });

        if (item.question.format === "vertical") {
          pdf.setTextColor(worksheetTheme.textColor.r, worksheetTheme.textColor.g, worksheetTheme.textColor.b);
          pdf.setFont("courier", "bold");
          pdf.setFontSize(Math.max(11.1, questionFontSize - 0.8));
          pdf.text(item.textLines, x + columnWidth - boxPadding - 1.2, textY, { align: "right" });
        } else {
          pdf.setTextColor(worksheetTheme.textColor.r, worksheetTheme.textColor.g, worksheetTheme.textColor.b);
          pdf.setFont(fontFamily, "normal");
          pdf.setFontSize(questionFontSize);
          pdf.text(item.textLines, x + boxPadding, textY);
        }

        if (item.question.answerLine !== false && !item.hasInlineAnswerSpace) {
          const answerY = y + boxHeight - Math.max(4.8, metrics.answerAreaHeight * 0.52);
          const answerWidth = Math.min(columnWidth - (boxPadding * 2), metrics.answerLineWidth);

          pdf.setDrawColor(worksheetTheme.accent.r, worksheetTheme.accent.g, worksheetTheme.accent.b);
          pdf.setLineWidth(0.4);
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

  for (let index = 0; index < questions.length; index += answerColumns) {
    const rowQuestions = questions.slice(index, index + answerColumns).map((question, offset) => {
      const absoluteIndex = index + offset + 1;
      const answerLines = pdf.splitTextToSize(String(question.answer), answerColumnWidth - (metrics.answerCardPadding * 2));
      const boxHeight = Math.max(metrics.answerCardMinHeight, (answerLines.length * metrics.answerCardLineHeight) + 9.5);

      return {
        absoluteIndex,
        answerLines,
        boxHeight
      };
    });

    rows.push({
      items: rowQuestions,
      rowHeight: Math.max(...rowQuestions.map((item) => item.boxHeight))
    });
  }

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
    worksheetModeLabel,
    margins,
    pageWidth,
    pageHeight,
    totalPages,
    questionPageCount,
    startOnCurrentPage = false
  } = options;

  const answerGap = 6;

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
      worksheetModeLabel,
      margins,
      pageWidth,
      pageKind: "answer-key"
    });

    const widestRow = pageRows.reduce((maxColumns, row) => Math.max(maxColumns, row.items.length), 1);
    const answerColumnWidth = (
      pageWidth - margins.left - margins.right - ((widestRow - 1) * answerGap)
    ) / widestRow;

    pdf.setFont(fontFamily, "normal");
    pdf.setFontSize(9.6);
    pdf.setTextColor(20, 24, 39);

    let y = startY;

    pageRows.forEach((row) => {
      row.items.forEach((item, columnIndex) => {
        const x = margins.left + (columnIndex * (answerColumnWidth + answerGap));

        pdf.setDrawColor(worksheetTheme.answerBorder.r, worksheetTheme.answerBorder.g, worksheetTheme.answerBorder.b);
        pdf.setFillColor(worksheetTheme.answerBackground.r, worksheetTheme.answerBackground.g, worksheetTheme.answerBackground.b);
        pdf.roundedRect(x, y, answerColumnWidth, row.rowHeight, 2, 2, "FD");
        pdf.setFillColor(worksheetTheme.accentPale.r, worksheetTheme.accentPale.g, worksheetTheme.accentPale.b);
        pdf.setDrawColor(worksheetTheme.accentBorder.r, worksheetTheme.accentBorder.g, worksheetTheme.accentBorder.b);
        pdf.roundedRect(x + 3, y + 3, item.absoluteIndex >= 10 ? 13 : 11, 5.8, 3, 3, "FD");
        pdf.setTextColor(worksheetTheme.accent.r, worksheetTheme.accent.g, worksheetTheme.accent.b);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8.5);
        pdf.text(`${item.absoluteIndex}.`, x + (item.absoluteIndex >= 10 ? 9.5 : 8.5), y + 7.1, { align: "center" });
        pdf.setFont(fontFamily, "normal");
        pdf.setTextColor(worksheetTheme.textColor.r, worksheetTheme.textColor.g, worksheetTheme.textColor.b);
        pdf.setFontSize(9.2);
        pdf.text(item.answerLines, x + metrics.answerCardPadding, y + 12.6);
      });

      y += row.rowHeight + 5;
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
  worksheetModeLabel,
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
  const accentColor = hexToRgb(theme?.accent);
  const worksheetTheme = getWorksheetTheme(presentation, accentColor);
  const metrics = getPdfLayoutMetrics(presentation);
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
  const questionHeaderHeight = measurePageHeaderHeight(pdf, {
    identity: resolvedIdentity,
    metrics,
    grade,
    subjectLabel,
    focusLabel,
    worksheetModeLabel,
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
    worksheetModeLabel,
    margins,
    pageWidth,
    pageKind: "answer-key"
  });
  const footer = getFooterMetrics(pageHeight);
  const questionContentBottom = footer.top - PDF_PAGE_LAYOUT.footerGap;
  const questionUsableHeight = Math.max(0, questionContentBottom - (margins.top + questionHeaderHeight));
  const answerUsableHeight = Math.max(0, questionContentBottom - (margins.top + answerHeaderHeight));
  const rowGap = metrics.rowGap;
  const questionFontSize = metrics.questionFontSize;
  const columnGap = metrics.columnGap;
  const columnWidth = presentation.columnsCount === 1
    ? pageWidth - margins.left - margins.right
    : ((pageWidth - margins.left - margins.right - columnGap) / 2);
  const questionRows = buildQuestionRows(pdf, safeQuestions, presentation, metrics, columnWidth);
  const questionPages = paginateRows(questionRows, questionUsableHeight, rowGap);
  const answerColumns = Math.min(4, presentation.columnsCount === 1 ? 3 : 4);
  const answerColumnWidth = (
    pageWidth - margins.left - margins.right - ((answerColumns - 1) * 6)
  ) / answerColumns;
  const answerRows = showAnswerKey ? buildAnswerRows(pdf, safeQuestions, answerColumns, answerColumnWidth, metrics) : [];
  const answerPages = showAnswerKey ? paginateRows(answerRows, answerUsableHeight, 6) : [];
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
    worksheetModeLabel,
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
      worksheetModeLabel,
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
