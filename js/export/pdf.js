import { getAnswerCardsPerPage } from "../core/worksheetLayout.js";
import { getTemplatePresentation } from "../templates/templates.js";

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

function rebalanceQuestionPages(pages, usableHeight, rowGap) {
  const balancedPages = pages
    .filter((pageRows) => pageRows.length > 0)
    .map((pageRows) => [...pageRows]);

  if (balancedPages.length < 2) {
    return balancedPages;
  }

  let changed = true;

  while (changed) {
    changed = false;

    for (let pageIndex = balancedPages.length - 1; pageIndex > 0; pageIndex -= 1) {
      const currentPage = balancedPages[pageIndex];
      const previousPage = balancedPages[pageIndex - 1];

      if (currentPage.length === 0 || previousPage.length <= 1) {
        continue;
      }

      const currentHeight = getPageRowsHeight(currentPage, rowGap);
      const previousHeight = getPageRowsHeight(previousPage, rowGap);
      const lastRow = previousPage[previousPage.length - 1];
      const movedCurrentHeight = currentHeight + rowGap + lastRow.rowHeight;
      const movedPreviousHeight = previousHeight - lastRow.rowHeight - rowGap;
      const currentFillRatio = currentHeight / usableHeight;

      if (
        currentFillRatio < 0.42 &&
        movedCurrentHeight <= usableHeight &&
        movedPreviousHeight >= usableHeight * 0.35
      ) {
        currentPage.unshift(previousPage.pop());
        changed = true;
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
  const boxHeight = Math.max(11, (lines.length * 4.7) + 5);
  pdf.setFillColor(247, 251, 255);
  pdf.setDrawColor(220, 232, 245);
  pdf.roundedRect(margins.left, y - 3.6, pageWidth - margins.left - margins.right, boxHeight, 2, 2, "FD");
  pdf.text(lines, margins.left + 3, y);
  return y + boxHeight + 2;
}

function drawPageChrome(pdf, {
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

  pdf.setFont(fontFamily, "normal");
  pdf.setFontSize(9.4);
  pdf.setTextColor(90, 100, 114);
  pdf.line(margins.left, pageHeight - margins.bottom + 1.5, pageWidth - margins.right, pageHeight - margins.bottom + 1.5);
  pdf.text("Generated by TeachSheet AI", margins.left, pageHeight - margins.bottom + 6);
  pdf.text(`Page ${pageNumber} of ${totalPages}`, pageWidth - margins.right, pageHeight - margins.bottom + 6, {
    align: "right"
  });

  return y + 7;
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

    let y = drawPageChrome(pdf, {
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
  });
}

function drawAnswerKeyPages(pdf, questions, options) {
  if (!questions.length) {
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
    template,
    startOnCurrentPage = false
  } = options;

  const cardsPerPage = getAnswerCardsPerPage(template);
  const presentation = getTemplatePresentation(template);
  const answerColumns = Math.min(4, presentation.columnsCount === 1 ? 3 : 4);
  const answerGap = 6;
  const cardHeight = 14;
  const answerColumnWidth = (
    pageWidth - margins.left - margins.right - ((answerColumns - 1) * answerGap)
  ) / answerColumns;
  const totalAnswerPages = Math.ceil(questions.length / cardsPerPage);

  for (let pageIndex = 0; pageIndex < totalAnswerPages; pageIndex += 1) {
    const pageQuestions = questions.slice(pageIndex * cardsPerPage, (pageIndex + 1) * cardsPerPage);

    if (!(startOnCurrentPage && pageIndex === 0)) {
      pdf.addPage();
    }

    const startY = drawPageChrome(pdf, {
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

    pdf.setFont(fontFamily, "normal");
    pdf.setFontSize(9.6);
    pdf.setTextColor(20, 24, 39);

    pageQuestions.forEach((question, localIndex) => {
      const columnIndex = localIndex % answerColumns;
      const rowIndex = Math.floor(localIndex / answerColumns);
      const x = margins.left + (columnIndex * (answerColumnWidth + answerGap));
      const y = startY + (rowIndex * (cardHeight + 5));
      const absoluteIndex = (pageIndex * cardsPerPage) + localIndex + 1;
      const answerLines = pdf.splitTextToSize(String(question.answer), answerColumnWidth - 14);

      pdf.setDrawColor(220, 232, 245);
      pdf.setFillColor(247, 251, 255);
      pdf.roundedRect(x, y, answerColumnWidth, cardHeight, 2, 2, "FD");
      pdf.setFont(fontFamily, "bold");
      pdf.text(`${absoluteIndex}.`, x + 3, y + 5.6);
      pdf.setFont(fontFamily, "normal");
      pdf.text(answerLines, x + 10, y + 5.6);
    });
  }
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
  const pageWidth = 210;
  const pageHeight = 297;
  const margins = {
    top: 14,
    right: 14,
    bottom: 12,
    left: 14
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
  const notesLinesCount = [resolvedIdentity.instructions, resolvedIdentity.teacherNotes]
    .filter(Boolean)
    .reduce((count, text) => count + Math.ceil(String(text).length / 70), 0);
  const estimatedHeaderHeight = 42 + (notesLinesCount * 4.8);
  const usableHeight = pageHeight - estimatedHeaderHeight - margins.bottom - 10;
  const rowGap = Math.max(7, Math.round(presentation.spacing * 0.34));
  const questionFontSize = Math.max(11.5, presentation.fontSize - 7);
  const columnGap = 8;
  const columnWidth = presentation.columnsCount === 1
    ? pageWidth - margins.left - margins.right
    : ((pageWidth - margins.left - margins.right - columnGap) / 2);
  const questionRows = buildQuestionRows(pdf, safeQuestions, presentation, questionFontSize, columnWidth);
  const questionPages = paginateRows(questionRows, usableHeight, rowGap);
  const answerPageCount = showAnswerKey ? Math.ceil(safeQuestions.length / getAnswerCardsPerPage(template)) : 0;
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
    drawAnswerKeyPages(pdf, safeQuestions, {
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
      template,
      startOnCurrentPage: questionPages.length === 0
    });
  }

  pdf.save("teachsheet-ai-worksheet.pdf");
}
