import { getTemplatePresentation } from "../templates/templates.js";

function chunkQuestions(questions, pageSize) {
  const pages = [];

  for (let index = 0; index < questions.length; index += pageSize) {
    pages.push(questions.slice(index, index + pageSize));
  }

  return pages;
}

function getPdfFontFamily(template) {
  if (template.layout === "single-column") {
    return "times";
  }

  return "helvetica";
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

export function downloadWorksheetPDF({
  questions,
  grade,
  studentName,
  template,
  theme,
  worksheetTitle,
  subjectLabel,
  focusLabel,
  showAnswerKey
}) {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF("p", "mm", "a4");
  const presentation = getTemplatePresentation(template);
  const questionPages = chunkQuestions(questions, presentation.questionsPerPage);
  const fontFamily = getPdfFontFamily(presentation);
  const questionFontSize = Math.max(12, presentation.fontSize - 6);
  const questionLineHeight = Math.max(10, Math.round(presentation.spacing * 0.7));
  const questionColumns = presentation.columnsCount;
  const xPositions = questionColumns === 1 ? [20] : [20, 110];
  const accentColor = hexToRgb(theme?.accent);

  function renderWorksheetPage(pageQuestions, pageNumber, totalPages) {
    let y = 20;

    if (pageNumber > 1) {
      pdf.addPage();
    }

    pdf.setTextColor(accentColor.r, accentColor.g, accentColor.b);
    pdf.setFont(fontFamily, "bold");
    pdf.setFontSize(22);
    pdf.text("TeachSheet AI", 105, y, { align: "center" });

    y += 10;
    pdf.setFontSize(16);
    pdf.text(worksheetTitle, 105, y, { align: "center" });

    y += 14;
    pdf.setTextColor(0, 0, 0);
    pdf.setFont(fontFamily, "normal");
    pdf.setFontSize(11);

    pdf.text(`Name: ${studentName || "________________________"}`, 20, y);
    pdf.text(`Grade: ${grade || "—"}`, 130, y);

    y += 8;
    pdf.text(`Subject: ${subjectLabel}`, 20, y);
    pdf.text(`Focus: ${focusLabel}`, 130, y);

    y += 8;
    pdf.text(`Page: ${pageNumber} / ${totalPages}`, 20, y);

    y += 12;
    pdf.setDrawColor(accentColor.r, accentColor.g, accentColor.b);
    pdf.line(20, y, 190, y);
    y += 12;

    pdf.setFontSize(questionFontSize);

    pageQuestions.forEach((question, index) => {
      const absoluteIndex = ((pageNumber - 1) * presentation.questionsPerPage) + index;
      const columnIndex = index % questionColumns;
      const x = xPositions[columnIndex];
      const answerLine = question.answerLine === false ? "" : " __________________";
      const questionText = `${absoluteIndex + 1}. ${question.text}${answerLine}`;

      pdf.text(questionText, x, y);

      if (columnIndex === questionColumns - 1 || questionColumns === 1) {
        y += questionLineHeight;
      }
    });
  }

  questionPages.forEach((pageQuestions, index) => {
    renderWorksheetPage(pageQuestions, index + 1, questionPages.length);
  });

  if (showAnswerKey) {
    let y = 20;
    pdf.addPage();
    pdf.setTextColor(accentColor.r, accentColor.g, accentColor.b);
    pdf.setFont(fontFamily, "bold");
    pdf.setFontSize(18);
    pdf.text("Answer Key", 105, y, { align: "center" });

    y += 15;
    pdf.setTextColor(0, 0, 0);
    pdf.setFont(fontFamily, "normal");
    pdf.setFontSize(12);

    questions.forEach((question, index) => {
      if (y > 270) {
        pdf.addPage();
        y = 20;
      }

      pdf.text(`${index + 1}) ${question.answer}`, 25 + ((index % 4) * 45), y);

      if (index % 4 === 3) {
        y += 10;
      }
    });
  }

  pdf.save("teachsheet-ai-worksheet.pdf");
}
