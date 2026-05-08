let currentQuestions = [];
let currentWorksheetData = null;

function getRandomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getElementValue(id) {
  const element = document.getElementById(id);
  return element ? element.value : "";
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

  if (selectedOperation === "addition") {
    return createAdditionQuestion(grade, difficulty);
  }

  if (selectedOperation === "subtraction") {
    return createSubtractionQuestion(grade, difficulty);
  }

  if (selectedOperation === "multiplication") {
    return createMultiplicationQuestion(grade, difficulty);
  }

  if (selectedOperation === "division") {
    return createDivisionQuestion(grade, difficulty);
  }

  return createAdditionQuestion(grade, difficulty);
}

function getWorksheetData() {
  return {
    grade: getElementValue("grade"),
    operation: getElementValue("operation"),
    difficulty: getElementValue("difficulty"),
    questionCount: parseInt(getElementValue("questionCount"), 10) || 15,
    studentName: getElementValue("studentName").trim(),
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

  renderWorksheet();
}

function renderWorksheet() {
  const worksheet = document.getElementById("worksheet");
  const questionsContainer = document.getElementById("questions");

  if (!worksheet || !questionsContainer || !currentWorksheetData) return;

  const studentName = currentWorksheetData.studentName || "________________";

  worksheet.querySelector(".worksheet-header").innerHTML = `
    <h2>Math Worksheet</h2>
    <p>Generated by TeachSheet AI</p>

    <div class="meta">
      <div><strong>Name:</strong> ${studentName}</div>
      <div><strong>Date:</strong> ${currentWorksheetData.date}</div>
      <div><strong>Grade:</strong> ${currentWorksheetData.grade}</div>
      <div><strong>Operation:</strong> ${formatOperation(currentWorksheetData.operation)}</div>
      <div><strong>Difficulty:</strong> ${currentWorksheetData.difficulty}</div>
      <div><strong>Questions:</strong> ${currentWorksheetData.questionCount}</div>
    </div>
  `;

  questionsContainer.className = "questions";
  questionsContainer.innerHTML = "";

  currentQuestions.forEach((question, index) => {
    const questionBox = document.createElement("div");
    questionBox.className = "question";
    questionBox.innerHTML = `
      <strong>${index + 1}.</strong>
      ${question.text}
      <span class="answer-line"></span>
    `;
    questionsContainer.appendChild(questionBox);
  });

  const oldAnswerKey = worksheet.querySelector(".answer-key");
  if (oldAnswerKey) {
    oldAnswerKey.remove();
  }

  const answerKey = document.createElement("div");
  answerKey.className = "answer-key";
  answerKey.innerHTML = `
    <h3>Answer Key</h3>
    <div class="answer-grid">
      ${currentQuestions
        .map((question, index) => `<div>${index + 1}) ${question.answer}</div>`)
        .join("")}
    </div>
  `;

  worksheet.appendChild(answerKey);
}

function clearWorksheet() {
  currentQuestions = [];
  currentWorksheetData = null;

  const worksheet = document.getElementById("worksheet");

  if (!worksheet) return;

  worksheet.innerHTML = `
    <div class="worksheet-header">
      <h2>Math Worksheet</h2>
      <p>Choose settings and generate your worksheet.</p>
    </div>

    <div id="questions" class="questions empty">
      No worksheet generated yet.
    </div>
  `;
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

  drawWorksheetPDF(pdf);
  drawAnswerKeyPDF(pdf);

  pdf.save("teachsheet-ai-worksheet.pdf");
}

function drawWorksheetPDF(pdf) {
  const data = currentWorksheetData;

  let y = 20;

  pdf.setDrawColor(30, 144, 255);
  pdf.setLineWidth(1.2);
  pdf.roundedRect(10, 10, 190, 277, 4, 4);

  pdf.setFillColor(24, 119, 242);
  pdf.roundedRect(10, 10, 190, 22, 4, 4, "F");

  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(22);

  pdf.text("TeachSheet AI", 105, 24, {
    align: "center"
  });

  y = 45;

  pdf.setTextColor(0, 0, 0);

  pdf.setFontSize(18);
  pdf.text("Math Worksheet", 105, y, {
    align: "center"
  });

  y += 12;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);

  pdf.text(`Student: ${data.studentName || "________________"}`, 18, y);
  pdf.text(`Date: ${data.date}`, 140, y);

  y += 8;

  pdf.text(`Grade: ${data.grade}`, 18, y);
  pdf.text(`Operation: ${formatOperation(data.operation)}`, 70, y);
  pdf.text(`Difficulty: ${data.difficulty}`, 145, y);

  y += 14;

  pdf.setDrawColor(220, 220, 220);
  pdf.line(18, y, 192, y);

  y += 12;

  pdf.setFontSize(14);

  currentQuestions.forEach((question, index) => {
    if (y > 255) {
      addPdfFooter(pdf);
      pdf.addPage();

      pdf.setDrawColor(30, 144, 255);
      pdf.setLineWidth(1.2);
      pdf.roundedRect(10, 10, 190, 277, 4, 4);

      y = 25;
    }

    const leftColumn = index % 2 === 0;
    const x = leftColumn ? 20 : 110;

    pdf.setDrawColor(220, 220, 220);
    pdf.roundedRect(x - 5, y - 8, 75, 16, 3, 3);

    pdf.setFont("helvetica", "bold");
    pdf.text(`${index + 1}.`, x, y);

    pdf.setFont("helvetica", "normal");
    pdf.text(question.text, x + 10, y);

    pdf.line(x + 40, y + 1, x + 62, y + 1);

    if (!leftColumn) {
      y += 22;
    }
  });

  addPdfFooter(pdf);
}

function drawAnswerKeyPDF(pdf) {
  pdf.addPage();

  pdf.setDrawColor(30, 144, 255);
  pdf.setLineWidth(1.2);
  pdf.roundedRect(10, 10, 190, 277, 4, 4);

  pdf.setFillColor(34, 197, 94);
  pdf.roundedRect(10, 10, 190, 22, 4, 4, "F");

  pdf.setTextColor(255, 255, 255);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(20);

  pdf.text("Answer Key", 105, 24, {
    align: "center"
  });

  let y = 45;

  pdf.setTextColor(0, 0, 0);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(12);

  currentQuestions.forEach((question, index) => {
    if (y > 260) {
      addPdfFooter(pdf);

      pdf.addPage();

      pdf.setDrawColor(30, 144, 255);
      pdf.setLineWidth(1.2);
      pdf.roundedRect(10, 10, 190, 277, 4, 4);

      y = 25;
    }

    const column = index % 4;
    const x = 20 + column * 42;

    pdf.setFillColor(245, 245, 245);
    pdf.roundedRect(x, y - 6, 35, 12, 2, 2, "F");

    pdf.text(`${index + 1}) ${question.answer}`, x + 4, y + 1);

    if (column === 3) {
      y += 16;
    }
  });

  addPdfFooter(pdf);
}

function addPdfFooter(pdf) {
  const pageHeight = pdf.internal.pageSize.height;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(120, 120, 120);

  pdf.text("Generated by TeachSheet AI", 105, pageHeight - 10, {
    align: "center"
  });

  pdf.setTextColor(0, 0, 0);
}
