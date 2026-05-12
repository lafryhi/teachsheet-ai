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

function buildQuestionRows(pdf, questions, presentation, questionFontSize, columnWidth) {
  const rows = [];
  const columnsCount = presentation.columnsCount;
  const lineHeight = Math.max(5.6, questionFontSize * 0.44);

  for (let index = 0; index < questions.length; index += columnsCount) {
    const rowQuestions = questions.slice(index, index + columnsCount).map((question, offset) => {
      const absoluteIndex = index + offset + 1;
      const label = `${absoluteIndex}.\n${question.text}`;
      const textLines = buildQuestionLines(pdf, label, columnWidth - 8);
      const baseHeight = (textLines.length * lineHeight) + (question.answerLine === false ? 12 : 20);

      return {
        question,
        textLines,
        boxHeight: Math.max(question.format === "vertical" ? 34 : 24, baseHeight)
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

function drawMetaRow(pdf, pairs, y, margins, pageWidth) {
  if (pairs.length === 0) {
    return y;
  }

  if (pairs.length === 1) {
    pdf.text(`${pairs[0][0]}: ${pairs[0][1]}`, margins.left, y);
    return y;
  }

  pdf.text(`${pairs[0][0]}: ${pairs[0][1]}`, margins.left, y);
  pdf.text(`${pairs[1][0]}: ${pairs[1][1]}`, pageWidth - margins.right, y, { align: "right" });
  return y;
}

function drawNotesBlock(pdf, label, value, y, margins, pageWidth) {
  if (!value) {
    return y;
  }

  const lines = pdf.splitTextToSize(`${label}: ${value}`, pageWidth - margins.left - margins.right - 6);
  const boxHeight = getNotesBlockHeight(lines.length);
  pdf.setFillColor(247, 251, 255);
  pdf.setDrawColor(220, 232, 245);
  pdf.roundedRect(margins.left, y - 3.6, pageWidth - margins.left - margins.right, boxHeight, 2, 2, "FD");
  pdf.text(lines, margins.left + 3, y);
  return y + boxHeight + 2;
}

function getNotesBlockHeight(linesCount) {
  return Math.max(11, (linesCount * 4.7) + 5);
}

function getFooterMetrics(pageHeight) {
  const top = pageHeight - PDF_PAGE_LAYOUT.footerBottom - PDF_PAGE_LAYOUT.footerHeight;

  return {
    top,
    lineY: top - 1.8,
    textY: top + 5.4
  };
}

function measurePageHeaderHeight(pdf, {
  identity,
  grade,
  subjectLabel,
  focusLabel,
  worksheetModeLabel,
  margins,
  pageWidth,
  pageKind
}) {
  let y = margins.top;

  if (identity.schoolName) {
    y += 7;
  }

  y += 8;

  if (pageKind === "answer-key" || worksheetModeLabel) {
    y += 6.5;
  }

  const optionalPairs = [
    identity.teacherName ? ["Teacher", identity.teacherName] : null,
    identity.studentName ? ["Name", identity.studentName] : null,
    identity.worksheetDate ? ["Date", identity.worksheetDate] : null,
    identity.scorePoints ? ["Score", identity.scorePoints] : null
  ].filter(Boolean);

  while (optionalPairs.length > 0) {
    optionalPairs.splice(0, 2);
    y += 6.2;
  }

  y += 6.2;
  y += 5.8;

  if (identity.instructions) {
    const lines = pdf.splitTextToSize(
      `Instructions: ${identity.instructions}`,
      pageWidth - margins.left - margins.right - 6
    );
    y += getNotesBlockHeight(lines.length) + 2;
  }

  if (identity.teacherNotes) {
    const lines = pdf.splitTextToSize(
      `Teacher Notes: ${identity.teacherNotes}`,
      pageWidth - margins.left - margins.right - 6
    );
    y += getNotesBlockHeight(lines.length) + 2;
  }

  return (y + 7) - margins.top;
}

function drawPageHeader(pdf, {
  fontFamily,
  accentColor,
  identity,
  grade,
  subjectLabel,
  focusLabel,
  worksheetModeLabel,
  pageNumber,
  totalPages,
  margins,
  pageWidth,
  pageHeight,
  pageKind
}) {
  let y = margins.top;

  pdf.setTextColor(accentColor.r, accentColor.g, accentColor.b);
  pdf.setFont(fontFamily, "bold");

  if (identity.schoolName) {
    pdf.setFontSize(12);
    pdf.text(identity.schoolName, pageWidth / 2, y, { align: "center" });
    y += 7;
  }

  pdf.setFontSize(18);
  pdf.text(identity.worksheetTitle || "Worksheet", pageWidth / 2, y, { align: "center" });
  y += 8;

  if (pageKind === "answer-key" || worksheetModeLabel) {
    pdf.setFontSize(11);
    pdf.text(pageKind === "answer-key" ? "Answer Sheet" : worksheetModeLabel, pageWidth / 2, y, { align: "center" });
    y += 6.5;
  }

  pdf.setTextColor(20, 24, 39);
  pdf.setFont(fontFamily, "normal");
  pdf.setFontSize(10.2);

  const optionalPairs = [
    identity.teacherName ? ["Teacher", identity.teacherName] : null,
    identity.studentName ? ["Name", identity.studentName] : null,
    identity.worksheetDate ? ["Date", identity.worksheetDate] : null,
    identity.scorePoints ? ["Score", identity.scorePoints] : null
  ].filter(Boolean);

  while (optionalPairs.length > 0) {
    const pairChunk = optionalPairs.splice(0, 2);
    y = drawMetaRow(pdf, pairChunk, y, margins, pageWidth) + 6.2;
  }

  y = drawMetaRow(pdf, [["Level", grade || "--"], ["Subject", subjectLabel || "--"]], y, margins, pageWidth) + 6.2;
  pdf.text(`Focus: ${focusLabel || "--"}`, margins.left, y);
  y += 5.8;

  y = drawNotesBlock(pdf, "Instructions", identity.instructions, y, margins, pageWidth);
  y = drawNotesBlock(pdf, "Teacher Notes", identity.teacherNotes, y, margins, pageWidth);

  pdf.setDrawColor(accentColor.r, accentColor.g, accentColor.b);
  pdf.setLineWidth(0.45);
  pdf.line(margins.left, y, pageWidth - margins.right, y);

  return y + 7;
}

function drawPageFooter(pdf, {
  fontFamily,
  accentColor,
  pageNumber,
  totalPages,
  margins,
  pageWidth,
  pageHeight
}) {
  const footer = getFooterMetrics(pageHeight);

  pdf.setFont(fontFamily, "normal");
  pdf.setFontSize(9.4);
  pdf.setTextColor(90, 100, 114);
  pdf.setDrawColor(accentColor.r, accentColor.g, accentColor.b);
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
    accentColor,
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
      accentColor,
      identity,
      grade,
      subjectLabel,
      focusLabel,
      worksheetModeLabel,
      pageNumber: pageIndex + 1,
      totalPages,
      margins,
      pageWidth,
      pageHeight,
      pageKind: "questions"
    });

    pdf.setFont(fontFamily, "normal");
    pdf.setFontSize(questionFontSize);
    pdf.setTextColor(20, 24, 39);

    pageRows.forEach((row) => {
      row.items.forEach((item, itemIndex) => {
        const x = margins.left + (itemIndex * (columnWidth + columnGap));
        const boxHeight = row.rowHeight;

        pdf.setDrawColor(183, 217, 245);
        pdf.setFillColor(255, 255, 255);
        pdf.roundedRect(x, y, columnWidth, boxHeight, 3, 3, "FD");
        pdf.text(item.textLines, x + 4, y + 6);

        if (item.question.answerLine !== false) {
          pdf.line(x + 4, y + boxHeight - 5, x + columnWidth - 4, y + boxHeight - 5);
        }
      });

      y += row.rowHeight + rowGap;
    });

    drawPageFooter(pdf, {
      fontFamily,
      accentColor,
      pageNumber: pageIndex + 1,
      totalPages,
      margins,
      pageWidth,
      pageHeight
    });
  });
}

function buildAnswerRows(pdf, questions, answerColumns, answerColumnWidth) {
  const rows = [];

  for (let index = 0; index < questions.length; index += answerColumns) {
    const rowQuestions = questions.slice(index, index + answerColumns).map((question, offset) => {
      const absoluteIndex = index + offset + 1;
      const answerLines = pdf.splitTextToSize(String(question.answer), answerColumnWidth - 14);
      const boxHeight = Math.max(14, (answerLines.length * 4.5) + 7);

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
    accentColor,
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
      accentColor,
      identity,
      grade,
      subjectLabel,
      focusLabel,
      worksheetModeLabel,
      pageNumber: questionPageCount + pageIndex + 1,
      totalPages,
      margins,
      pageWidth,
      pageHeight,
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

        pdf.setDrawColor(220, 232, 245);
        pdf.setFillColor(247, 251, 255);
        pdf.roundedRect(x, y, answerColumnWidth, row.rowHeight, 2, 2, "FD");
        pdf.setFont(fontFamily, "bold");
        pdf.text(`${item.absoluteIndex}.`, x + 3, y + 5.6);
        pdf.setFont(fontFamily, "normal");
        pdf.text(item.answerLines, x + 10, y + 5.6);
      });

      y += row.rowHeight + 5;
    });

    drawPageFooter(pdf, {
      fontFamily,
      accentColor,
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
  const rowGap = Math.max(7, Math.round(presentation.spacing * 0.34));
  const questionFontSize = Math.max(11.5, presentation.fontSize - 7);
  const columnGap = 8;
  const columnWidth = presentation.columnsCount === 1
    ? pageWidth - margins.left - margins.right
    : ((pageWidth - margins.left - margins.right - columnGap) / 2);
  const questionRows = buildQuestionRows(pdf, safeQuestions, presentation, questionFontSize, columnWidth);
  const questionPages = paginateRows(questionRows, questionUsableHeight, rowGap);
  const answerColumns = Math.min(4, presentation.columnsCount === 1 ? 3 : 4);
  const answerColumnWidth = (
    pageWidth - margins.left - margins.right - ((answerColumns - 1) * 6)
  ) / answerColumns;
  const answerRows = showAnswerKey ? buildAnswerRows(pdf, safeQuestions, answerColumns, answerColumnWidth) : [];
  const answerPages = showAnswerKey ? paginateRows(answerRows, answerUsableHeight, 5) : [];
  const answerPageCount = answerPages.length;
  const totalPages = questionPages.length + answerPageCount;

  drawQuestionPages(pdf, questionPages, {
    fontFamily,
    accentColor,
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
      accentColor,
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
