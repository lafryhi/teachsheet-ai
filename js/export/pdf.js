export function downloadWorksheetPDF({
  questions,
  grade,
  operation,
  difficulty,
  studentName,
  formatOperation,
  capitalize
}) {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF("p", "mm", "a4");

  let y = 20;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(22);
  pdf.text("TeachSheet AI", 105, y, { align: "center" });

  y += 10;
  pdf.setFontSize(16);
  pdf.text("Math Worksheet", 105, y, { align: "center" });

  y += 14;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);

  pdf.text(`Name: ${studentName || "________________________"}`, 20, y);
  pdf.text(`Grade: ${grade}`, 130, y);

  y += 8;
  pdf.text(`Operation: ${formatOperation(operation)}`, 20, y);
  pdf.text(`Difficulty: ${capitalize(difficulty)}`, 130, y);

  y += 12;
  pdf.line(20, y, 190, y);
  y += 12;

  pdf.setFontSize(14);

  questions.forEach((question, index) => {
    if (y > 260) {
      pdf.addPage();
      y = 20;
    }

    const questionText = `${index + 1}. ${question.text} __________________`;

    if (index % 2 === 0) {
      pdf.text(questionText, 20, y);
    } else {
      pdf.text(questionText, 110, y);
      y += 14;
    }
  });

  pdf.addPage();
  y = 20;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.text("Answer Key", 105, y, { align: "center" });

  y += 15;
  pdf.setFont("helvetica", "normal");
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

  pdf.save("teachsheet-ai-worksheet.pdf");
}
