let currentQuestions = [];
let currentWorksheetData = null;
let previewPages = [];
let currentPreviewPage = 0;

function getRandomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getElementValue(id) {
  const element = document.getElementById(id);
  return element ? element.value : "";
}

function getCleanValue(id, fallback = "") {
  const value = getElementValue(id).trim();
  return value || fallback;
}

function getGradeNumber(gradeText) {
  const number = parseInt(String(gradeText).replace(/\D/g, ""), 10);
  return Number.isNaN(number) ? 2 : number;
}

function getDifficultyLevel(difficultyText) {
  return String(difficultyText || "medium").toLowerCase();
}

function getNumberRange(grade, difficulty) {
  const gradeNumber = getGradeNumber(grade);
  const level = getDifficultyLevel(difficulty);

  if (gradeNumber <= 1) {
    if (level === "easy") return { min: 1, max: 10 };
    if (level === "medium") return { min: 1, max: 20 };
    return { min: 10, max: 50 };
  }

  if (gradeNumber === 2) {
    if (level === "easy") return { min: 1, max: 20 };
    if (level === "medium") return { min: 10, max: 100 };
    return { min: 50, max: 200 };
  }

  if (gradeNumber === 3) {
    if (level === "easy") return { min: 10, max: 100 };
    if (level === "medium") return { min: 50, max: 500 };
    return { min: 100, max: 999 };
  }

  if (gradeNumber === 4) {
    if (level === "easy") return { min: 50, max: 500 };
    if (level === "medium") return { min: 100, max: 999 };
    return { min: 500, max: 3000 };
  }

  if (level === "easy") return { min: 100, max: 999 };
  if (level === "medium") return { min: 500, max: 5000 };
  return { min: 1000, max: 9999 };
}

function formatOperation(operation) {
  const operations = {
    addition: "Addition",
    subtraction: "Subtraction",
    multiplication: "Multiplication",
    division: "Division",
    mixed: "Mixed Operations"
  };

  return operations[operation] || "Addition";
}

function createAdditionQuestion(grade, difficulty) {
  const range = getNumberRange(grade, difficulty);
  const a = getRandomNumber(range.min, range.max);
  const b = getRandomNumber(range.min, range.max);

  return {
    text: `${a} + ${b} =`,
    answer: a + b,
    operation: "Addition"
  };
}

function createSubtractionQuestion(grade, difficulty) {
  const range = getNumberRange(grade, difficulty);
  let a = getRandomNumber(range.min, range.max);
  let b = getRandomNumber(range.min, range.max);

  if (b > a) {
    [a, b] = [b, a];
  }

  return {
    text: `${a} - ${b} =`,
    answer: a - b,
    operation: "Subtraction"
  };
}

function createMultiplicationQuestion(grade, difficulty) {
  const gradeNumber = getGradeNumber(grade);
  const level = getDifficultyLevel(difficulty);

  let a;
  let b;

  if (gradeNumber <= 2 || level === "easy") {
    a = getRandomNumber(1, 10);
    b = getRandomNumber(1, 10);
  } else if (gradeNumber <= 4 || level === "medium") {
    a = getRandomNumber(2, 12);
    b = getRandomNumber(2, 12);
  } else {
    a = getRandomNumber(10, 99);
    b = getRandomNumber(2, 12);
  }

  return {
    text: `${a} × ${b} =`,
    answer: a * b,
    operation: "Multiplication"
  };
}

function createDivisionQuestion(grade, difficulty) {
  const gradeNumber = getGradeNumber(grade);
  const level = getDifficultyLevel(difficulty);

  let divisor;
  let quotient;

  if (gradeNumber <= 2 || level === "easy") {
    divisor = getRandomNumber(2, 10);
    quotient = getRandomNumber(2, 10);
  } else if (gradeNumber <= 4 || level === "medium") {
    divisor = getRandomNumber(2, 12);
    quotient = getRandomNumber(5, 20);
  } else {
    divisor = getRandomNumber(2, 20);
    quotient = getRandomNumber(10, 50);
  }

  const dividend = divisor * quotient;

  return {
    text: `${dividend} ÷ ${divisor} =`,
    answer: quotient,
    operation: "Division"
  };
}

function createQuestion(operation, grade, difficulty) {
  let selectedOperation = operation;

  if (selectedOperation === "mixed") {
    const operations = ["addition", "subtraction", "multiplication", "division"];
    selectedOperation = operations[getRandomNumber(0, operations.length - 1)];
  }

  if (selectedOperation === "addition") return createAdditionQuestion(grade, difficulty);
  if (selectedOperation === "subtraction") return createSubtractionQuestion(grade, difficulty);
  if (selectedOperation === "multiplication") return createMultiplicationQuestion(grade, difficulty);
  if (selectedOperation === "division") return createDivisionQuestion(grade, difficulty);

  return createAdditionQuestion(grade, difficulty);
}

function getWorksheetData() {
  return {
    teacherName: getCleanValue("teacherName", "Teacher"),
    schoolName: getCleanValue("schoolName", "School"),
    subjectName: getCleanValue("subjectName", "Mathematics"),
    className: getCleanValue("className", "Class"),
    grade: getElementValue("grade"),
    operation: getElementValue("operation"),
    difficulty: getElementValue("difficulty"),
    questionCount: parseInt(getElementValue("questionCount"), 10) || 15,
    studentName: getCleanValue("studentName", "________________"),
    date: new Date().toLocaleDateString()
  };
}

function generateWorksheet() {
  currentWorksheetData = getWorksheetData();
  currentQuestions = [];

  for (let i = 0; i < currentWorksheetData.questionCount; i++) {
    currentQuestions.push(
      createQuestion(
        currentWorksheetData.operation,
        currentWorksheetData.grade,
        currentWorksheetData.difficulty
      )
    );
  }

  buildPreviewPages();
  currentPreviewPage = 0;
  renderCurrentPreviewPage();
}

function buildPreviewPages() {
  const questionsPerPage = 20;
  previewPages = [];

  for (let i = 0; i < currentQuestions.length; i += questionsPerPage) {
    previewPages.push({
      type: "worksheet",
      questions: currentQuestions.slice(i, i + questionsPerPage),
      startIndex: i
    });
  }

  previewPages.push({
    type: "answer-key",
    questions: currentQuestions,
    startIndex: 0
  });
}

function renderCurrentPreviewPage() {
  const worksheet = document.getElementById("worksheet");
  const pageInfo = document.getElementById("pageInfo");

  if (!worksheet) return;

  if (!currentWorksheetData || !previewPages.length) {
    worksheet.innerHTML = getEmptyPreviewHTML();

    if (pageInfo) {
      pageInfo.textContent = "Page 1 of 1";
    }

    return;
  }

  const page = previewPages[currentPreviewPage];

  if (pageInfo) {
    pageInfo.textContent = `Page ${currentPreviewPage + 1} of ${previewPages.length}`;
  }

  if (page.type === "answer-key") {
    worksheet.innerHTML = getAnswerKeyPageHTML(page);
  } else {
    worksheet.innerHTML = getWorksheetPageHTML(page);
  }
}

function getA4HeaderHTML(title, subtitle) {
  return `
    <div class="a4-header">
      <div class="logo-mark">TS</div>

      <div class="a4-title-block">
        <h2>${title}</h2>
        <p>${subtitle}</p>
      </div>

      <div class="a4-brand">
        TeachSheet AI
      </div>
    </div>
  `;
}

function getInfoGridHTML() {
  return `
    <div class="a4-info-grid">
      <div><strong>Teacher:</strong> ${currentWorksheetData.teacherName}</div>
      <div><strong>School:</strong> ${currentWorksheetData.schoolName}</div>
      <div><strong>Class:</strong> ${currentWorksheetData.className}</div>
      <div><strong>Student:</strong> ${currentWorksheetData.studentName}</div>
      <div><strong>Date:</strong> ${currentWorksheetData.date}</div>
      <div><strong>Grade:</strong> ${currentWorksheetData.grade}</div>
    </div>
  `;
}

function getWorksheetPageHTML(page) {
  const questionsHTML = page.questions
    .map((question, index) => {
      const number = page.startIndex + index + 1;

      return `
        <div class="question">
          <strong>${number}.</strong>
          ${question.text}
          <span class="answer-line"></span>
        </div>
      `;
    })
    .join("");

  return `
    ${getA4HeaderHTML(
      `${currentWorksheetData.subjectName} Worksheet`,
      `${formatOperation(currentWorksheetData.operation)} · ${currentWorksheetData.difficulty} · ${currentWorksheetData.questionCount} questions`
    )}

    ${getInfoGridHTML()}

    <div class="a4-divider"></div>

    <div id="questions" class="questions">
      ${questionsHTML}
    </div>

    <div class="a4-footer">
      Generated by TeachSheet AI · Page ${currentPreviewPage + 1}
    </div>
  `;
}

function getAnswerKeyPageHTML() {
  const answersHTML = currentQuestions
    .map((question, index) => {
      return `<div>${index + 1}) ${question.answer}</div>`;
    })
    .join("");

  return `
    ${getA4HeaderHTML(
      "Answer Key",
      `${currentWorksheetData.subjectName} · ${currentWorksheetData.grade} · ${currentWorksheetData.date}`
    )}

    ${getInfoGridHTML()}

    <div class="a4-divider"></div>

    <div class="answer-key">
      <h3>Answer Key</h3>

      <div class="answer-grid">
        ${answersHTML}
      </div>
    </div>

    <div class="a4-footer">
      Generated by TeachSheet AI · Answer Key
    </div>
  `;
}

function getEmptyPreviewHTML() {
  return `
    <div class="a4-header">
      <div class="logo-mark">TS</div>

      <div class="a4-title-block">
        <h2>Math Worksheet</h2>
        <p>Choose settings and generate your worksheet.</p>
      </div>

      <div class="a4-brand">
        TeachSheet AI
      </div>
    </div>

    <div class="a4-info-grid">
      <div><strong>Teacher:</strong> —</div>
      <div><strong>School:</strong> —</div>
      <div><strong>Class:</strong> —</div>
      <div><strong>Student:</strong> —</div>
      <div><strong>Date:</strong> —</div>
      <div><strong>Grade:</strong> —</div>
    </div>

    <div class="a4-divider"></div>

    <div id="questions" class="questions empty a4-empty">
      No worksheet generated yet.
    </div>

    <div class="a4-footer">
      Generated by TeachSheet AI · Page 1
    </div>
  `;
}

function previousPreviewPage() {
  if (!previewPages.length) return;

  currentPreviewPage--;

  if (currentPreviewPage < 0) {
    currentPreviewPage = previewPages.length - 1;
  }

  renderCurrentPreviewPage();
}

function nextPreviewPage() {
  if (!previewPages.length) return;

  currentPreviewPage++;

  if (currentPreviewPage >= previewPages.length) {
    currentPreviewPage = 0;
  }

  renderCurrentPreviewPage();
}

function clearWorksheet() {
  currentQuestions = [];
  currentWorksheetData = null;
  previewPages = [];
  currentPreviewPage = 0;

  renderCurrentPreviewPage();
}

function downloadPDF() {
  if (!currentQuestions.length || !currentWorksheetData) {
    alert("Please generate a worksheet first.");
    return;
  }

  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert("PDF library is not loaded. Please check your internet connection.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF("p", "mm", "a4");

  drawWorksheetPDFPages(pdf);
  drawAnswerKeyPDF(pdf);

  const fileName = `${currentWorksheetData.subjectName.toLowerCase().replace(/\s+/g, "-")}-worksheet.pdf`;
  pdf.save(fileName);
}

function drawPDFFrame(pdf, colorType = "blue") {
  const fillColor = colorType === "green" ? [34, 197, 94] : [24, 119, 242];

  pdf.setDrawColor(30, 144, 255);
  pdf.setLineWidth(1.2);
  pdf.roundedRect(10, 10, 190, 277, 4, 4);

  pdf.setFillColor(fillColor[0], fillColor[1], fillColor[2]);
  pdf.roundedRect(10, 10, 190, 24, 4, 4, "F");

  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.text(currentWorksheetData.schoolName, 18, 22);

  pdf.setFontSize(13);
  pdf.text(currentWorksheetData.teacherName, 192, 22, { align: "right" });

  pdf.setTextColor(0, 0, 0);
}

function drawPDFInfo(pdf, y) {
  const data = currentWorksheetData;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(0, 0, 0);

  pdf.text(`Student: ${data.studentName}`, 18, y);
  pdf.text(`Class: ${data.className}`, 78, y);
  pdf.text(`Date: ${data.date}`, 145, y);

  y += 8;

  pdf.text(`Grade: ${data.grade}`, 18, y);
  pdf.text(`Operation: ${formatOperation(data.operation)}`, 78, y);
  pdf.text(`Difficulty: ${data.difficulty}`, 145, y);

  y += 10;

  pdf.setDrawColor(220, 220, 220);
  pdf.line(18, y, 192, y);

  return y + 12;
}

function drawWorksheetPDFPages(pdf) {
  const questionsPerPage = 20;
  let pageNumber = 1;

  for (let start = 0; start < currentQuestions.length; start += questionsPerPage) {
    if (start > 0) {
      pdf.addPage();
    }

    drawPDFFrame(pdf, "blue");

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(18);
    pdf.setTextColor(0, 0, 0);
    pdf.text(`${currentWorksheetData.subjectName} Worksheet`, 105, 48, {
      align: "center"
    });

    let y = drawPDFInfo(pdf, 62);

    pdf.setFontSize(14);

    const pageQuestions = currentQuestions.slice(start, start + questionsPerPage);

    pageQuestions.forEach((question, index) => {
      const number = start + index + 1;
      const leftColumn = index % 2 === 0;
      const x = leftColumn ? 20 : 110;

      pdf.setDrawColor(220, 220, 220);
      pdf.roundedRect(x - 5, y - 8, 75, 16, 3, 3);

      pdf.setFont("helvetica", "bold");
      pdf.text(`${number}.`, x, y);

      pdf.setFont("helvetica", "normal");
      pdf.text(question.text, x + 10, y);

      pdf.line(x + 40, y + 1, x + 62, y + 1);

      if (!leftColumn) {
        y += 22;
      }
    });

    addPdfFooter(pdf, `Generated by TeachSheet AI · Page ${pageNumber}`);
    pageNumber++;
  }
}

function drawAnswerKeyPDF(pdf) {
  pdf.addPage();

  drawPDFFrame(pdf, "green");

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.setTextColor(0, 0, 0);
  pdf.text("Answer Key", 105, 48, { align: "center" });

  let y = 66;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);

  pdf.text(`Subject: ${currentWorksheetData.subjectName}`, 18, y);
  pdf.text(`Grade: ${currentWorksheetData.grade}`, 78, y);
  pdf.text(`Date: ${currentWorksheetData.date}`, 145, y);

  y += 16;

  pdf.setFontSize(12);

  currentQuestions.forEach((question, index) => {
    if (y > 260) {
      addPdfFooter(pdf, "Generated by TeachSheet AI · Answer Key");
      pdf.addPage();
      drawPDFFrame(pdf, "green");

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(18);
      pdf.setTextColor(0, 0, 0);
      pdf.text("Answer Key", 105, 48, { align: "center" });

      y = 66;
    }

    const column = index % 4;
    const x = 20 + column * 42;

    pdf.setFillColor(245, 245, 245);
    pdf.roundedRect(x, y - 6, 35, 12, 2, 2, "F");

    pdf.setFont("helvetica", "normal");
    pdf.text(`${index + 1}) ${question.answer}`, x + 4, y + 1);

    if (column === 3) {
      y += 16;
    }
  });

  addPdfFooter(pdf, "Generated by TeachSheet AI · Answer Key");
}

function addPdfFooter(pdf, text = "Generated by TeachSheet AI") {
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(120, 120, 120);

  pdf.text(text, 105, 281, {
    align: "center"
  });

  pdf.setTextColor(0, 0, 0);
}

window.generateWorksheet = generateWorksheet;
window.downloadPDF = downloadPDF;
window.clearWorksheet = clearWorksheet;
window.previousPreviewPage = previousPreviewPage;
window.nextPreviewPage = nextPreviewPage;

document.addEventListener("DOMContentLoaded", function () {
  clearWorksheet();
});
