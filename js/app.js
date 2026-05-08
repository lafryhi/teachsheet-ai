/* TeachSheet AI - js/app.js */
/* Preview + Pagination + Answer Sheet + Zoom + Themes */

document.addEventListener("DOMContentLoaded", () => {
  const app = {
    exercises: [],
    answers: [],
    pages: [],
    currentPage: 0,
    zoom: 1,
    theme: "blue",
    showAnswers: false,

    settings: {
      title: "TeachSheet AI Worksheet",
      subtitle: "Generated educational worksheet",
      studentName: true,
      date: true,
      level: "Primary",
      questionsCount: 20,
      operations: ["addition"],
      min: 1,
      max: 20,
      perPage: 10
    }
  };
  
const exportBtn = document.getElementById("exportPdfBtn");

if (exportBtn) {
  exportBtn.addEventListener("click", exportPDF);
}

function exportPDF() {

  const element =
    document.querySelector(".a4-sheet") ||
    document.querySelector(".a4-page");

  if (!element) return;

  const options = {
    margin: 0,
    filename: "TeachSheet-Worksheet.pdf",
    image: {
      type: "jpeg",
      quality: 1
    },
    html2canvas: {
      scale: 2,
      useCORS: true
    },
    jsPDF: {
      unit: "mm",
      format: "a4",
      orientation: "portrait"
    }
  };

  html2pdf().set(options).from(element).save();
}
  const $ = (id) => document.getElementById(id);

  const preview = $("worksheetPreview") || $("preview") || createPreviewArea();
  const pageCounter = $("pageCounter") || createSmallText("pageCounter");
  const zoomValue = $("zoomValue") || createSmallText("zoomValue");

  bindButtons();
  generateWorksheet();

  function bindButtons() {
    bind("generateBtn", generateWorksheet);
    bind("prevPageBtn", prevPage);
    bind("nextPageBtn", nextPage);
    bind("zoomInBtn", zoomIn);
    bind("zoomOutBtn", zoomOut);
    bind("resetZoomBtn", resetZoom);
    bind("answerSheetBtn", toggleAnswerSheet);

    document.querySelectorAll("[data-theme]").forEach(btn => {
      btn.addEventListener("click", () => {
        app.theme = btn.dataset.theme;
        renderPage();
      });
    });
  }

  function bind(id, fn) {
    const el = $(id);
    if (el) el.addEventListener("click", fn);
  }

  function generateWorksheet() {
    readSettings();

    app.exercises = [];
    app.answers = [];
    app.pages = [];
    app.currentPage = 0;
    app.showAnswers = false;

    for (let i = 1; i <= app.settings.questionsCount; i++) {
      const ex = createExercise(i);
      app.exercises.push(ex);
      app.answers.push({
        number: i,
        question: ex.question,
        answer: ex.answer
      });
    }

    app.pages = paginate(app.exercises, app.settings.perPage);
    renderPage();
  }

  function readSettings() {
    app.settings.title = getValue("worksheetTitle", app.settings.title);
    app.settings.subtitle = getValue("worksheetSubtitle", app.settings.subtitle);
    app.settings.level = getValue("worksheetLevel", app.settings.level);

    app.settings.questionsCount = getNumber("questionsCount", 20);
    app.settings.min = getNumber("minNumber", 1);
    app.settings.max = getNumber("maxNumber", 20);
    app.settings.perPage = getNumber("questionsPerPage", 10);

    const operation = getValue("operationType", "addition");
    app.settings.operations = [operation];

    if (app.settings.max <= app.settings.min) {
      app.settings.max = app.settings.min + 10;
    }
  }

  function createExercise(index) {
    const op = app.settings.operations[0];
    let a = rand(app.settings.min, app.settings.max);
    let b = rand(app.settings.min, app.settings.max);
    let question = "";
    let answer = 0;

    if (op === "subtraction") {
      if (b > a) [a, b] = [b, a];
      question = `${a} − ${b} =`;
      answer = a - b;
    } else if (op === "multiplication") {
      question = `${a} × ${b} =`;
      answer = a * b;
    } else if (op === "division") {
      answer = rand(app.settings.min, Math.max(app.settings.min + 1, app.settings.max));
      b = rand(1, 10);
      a = answer * b;
      question = `${a} ÷ ${b} =`;
    } else {
      question = `${a} + ${b} =`;
      answer = a + b;
    }

    return {
      number: index,
      question,
      answer
    };
  }

  function paginate(items, perPage) {
    const result = [];
    for (let i = 0; i < items.length; i += perPage) {
      result.push(items.slice(i, i + perPage));
    }
    return result;
  }

  function renderPage() {
    preview.innerHTML = "";

    const sheet = document.createElement("div");
    sheet.className = `a4-sheet theme-${app.theme}`;
    sheet.style.transform = `scale(${app.zoom})`;
    sheet.style.transformOrigin = "top center";

    sheet.innerHTML = `
      <div class="sheet-header">
        <div>
          <h1>${escapeHtml(app.settings.title)}</h1>
          <p>${escapeHtml(app.settings.subtitle)}</p>
        </div>
        <div class="sheet-logo">TeachSheet AI</div>
      </div>

      <div class="sheet-info">
        <span>Name: ____________________</span>
        <span>Date: ____ / ____ / ______</span>
        <span>Level: ${escapeHtml(app.settings.level)}</span>
      </div>

      ${app.showAnswers ? renderAnswerSheet() : renderExercises()}

      <div class="sheet-footer">
        <span>Page ${app.currentPage + 1} / ${app.pages.length}</span>
        <span>Generated by TeachSheet AI</span>
      </div>
    `;

    preview.appendChild(sheet);
    updateControls();
  }

  function renderExercises() {
    const page = app.pages[app.currentPage] || [];

    return `
      <div class="exercise-grid">
        ${page.map(ex => `
          <div class="exercise-card">
            <div class="exercise-number">${ex.number}</div>
            <div class="exercise-question">${ex.question}</div>
            <div class="answer-line"></div>
          </div>
        `).join("")}
      </div>
    `;
  }

  function renderAnswerSheet() {
    return `
      <div class="answer-sheet">
        <h2>Answer Sheet</h2>
        <div class="answer-grid">
          ${app.answers.map(item => `
            <div class="answer-item">
              <strong>${item.number}.</strong>
              <span>${item.question}</span>
              <b>${item.answer}</b>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  function updateControls() {
    pageCounter.textContent = `Page ${app.currentPage + 1} / ${app.pages.length}`;
    zoomValue.textContent = `${Math.round(app.zoom * 100)}%`;

    const prev = $("prevPageBtn");
    const next = $("nextPageBtn");

    if (prev) prev.disabled = app.currentPage === 0 || app.showAnswers;
    if (next) next.disabled = app.currentPage >= app.pages.length - 1 || app.showAnswers;
  }

  function prevPage() {
    if (app.currentPage > 0) {
      app.currentPage--;
      renderPage();
    }
  }

  function nextPage() {
    if (app.currentPage < app.pages.length - 1) {
      app.currentPage++;
      renderPage();
    }
  }

  function zoomIn() {
    app.zoom = Math.min(app.zoom + 0.1, 1.5);
    renderPage();
  }

  function zoomOut() {
    app.zoom = Math.max(app.zoom - 0.1, 0.5);
    renderPage();
  }

  function resetZoom() {
    app.zoom = 1;
    renderPage();
  }

  function toggleAnswerSheet() {
    app.showAnswers = !app.showAnswers;
    app.currentPage = 0;
    renderPage();

    const btn = $("answerSheetBtn");
    if (btn) {
      btn.textContent = app.showAnswers ? "Show Worksheet" : "Answer Sheet";
    }
  }

  function getValue(id, fallback) {
    const el = $(id);
    return el && el.value.trim() ? el.value.trim() : fallback;
  }

  function getNumber(id, fallback) {
    const el = $(id);
    const value = el ? parseInt(el.value, 10) : fallback;
    return Number.isFinite(value) ? value : fallback;
  }

  function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function createPreviewArea() {
    const div = document.createElement("div");
    div.id = "worksheetPreview";
    div.style.width = "100%";
    div.style.minHeight = "900px";
    div.style.display = "flex";
    div.style.justifyContent = "center";
    div.style.alignItems = "flex-start";
    document.body.appendChild(div);
    return div;
  }

  function createSmallText(id) {
    const span = document.createElement("span");
    span.id = id;
    span.style.display = "none";
    document.body.appendChild(span);
    return span;
  }
});
