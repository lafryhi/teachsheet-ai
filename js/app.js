import { generateQuestions, formatOperation, capitalize } from "./core/generator.js";
import {
  createPaginationState,
  nextPage,
  previousPage,
  resetPagination
} from "./core/pagination.js";
import {
  loadSettings,
  saveSettings,
  saveWorksheet,
  clearWorksheetStorage
} from "./core/storage.js";
import { renderEmptyWorksheet, renderWorksheetPreview } from "./ui/preview.js";
import { applyTheme, getTheme } from "./ui/themes.js";
import { applyZoom, normalizeZoomValue } from "./ui/zoom.js";
import { downloadWorksheetPDF } from "./export/pdf.js";
import { getDefaultTemplate } from "./templates/templates.js";

const state = {
  currentQuestions: [],
  pagination: createPaginationState(0),
  template: getDefaultTemplate(),
  theme: getDefaultTemplate().theme,
  zoom: 100
};

function getWorksheetElement() {
  return document.getElementById("worksheet");
}

function getFormValues() {
  return {
    grade: document.getElementById("grade").value,
    operation: document.getElementById("operation").value,
    difficulty: document.getElementById("difficulty").value,
    questionCount: Number.parseInt(document.getElementById("questionCount").value, 10),
    studentName: document.getElementById("studentName").value.trim()
  };
}

function applyPreviewState() {
  const worksheetElement = getWorksheetElement();
  applyTheme(worksheetElement, state.theme);
  applyZoom(worksheetElement, state.zoom);
}

function persistSettings(partialSettings = {}) {
  const formValues = getFormValues();

  saveSettings({
    grade: formValues.grade,
    operation: formValues.operation,
    difficulty: formValues.difficulty,
    questionCount: formValues.questionCount,
    studentName: formValues.studentName,
    theme: state.theme,
    zoom: state.zoom,
    templateId: state.template.id,
    ...partialSettings
  });
}

function syncPreview() {
  if (state.currentQuestions.length === 0) {
    renderEmptyWorksheet(getWorksheetElement());
    applyPreviewState();
    return;
  }

  const formValues = getFormValues();

  renderWorksheetPreview({
    worksheetElement: getWorksheetElement(),
    grade: formValues.grade,
    operation: formValues.operation,
    difficulty: formValues.difficulty,
    studentName: formValues.studentName,
    questions: state.currentQuestions,
    currentPage: state.pagination.currentPage,
    totalPages: state.pagination.totalPages,
    formatOperation,
    capitalize
  });

  applyPreviewState();
}

function generateWorksheet() {
  const formValues = getFormValues();

  state.currentQuestions = generateQuestions({
    operation: formValues.operation,
    difficulty: formValues.difficulty,
    questionCount: formValues.questionCount
  });

  state.pagination = resetPagination(
    state.pagination,
    state.currentQuestions.length,
    state.currentQuestions.length || 1
  );

  syncPreview();

  persistSettings();
  saveWorksheet({
    questions: state.currentQuestions,
    settings: formValues,
    theme: state.theme,
    zoom: state.zoom
  });
}

function clearWorksheet() {
  state.currentQuestions = [];
  state.pagination = resetPagination(state.pagination, 0);

  syncPreview();
  clearWorksheetStorage();
  persistSettings();
}

function downloadPDF() {
  if (state.currentQuestions.length === 0) {
    window.alert("Please generate a worksheet first.");
    return;
  }

  downloadWorksheetPDF({
    questions: state.currentQuestions,
    ...getFormValues(),
    formatOperation,
    capitalize
  });
}

function previousPreviewPage() {
  if (state.currentQuestions.length === 0) {
    return;
  }

  state.pagination = previousPage(state.pagination);
  syncPreview();
}

function nextPreviewPage() {
  if (state.currentQuestions.length === 0) {
    return;
  }

  state.pagination = nextPage(state.pagination);
  syncPreview();
}

function updateZoom(value) {
  state.zoom = normalizeZoomValue(value);
  applyZoom(getWorksheetElement(), state.zoom);
  persistSettings();
}

function setTheme(theme) {
  state.theme = getTheme(theme).id;
  applyTheme(getWorksheetElement(), state.theme);
  persistSettings();
}

function hydrateSettings() {
  const savedSettings = loadSettings();

  if (!savedSettings) {
    return;
  }

  const fieldIds = ["grade", "operation", "difficulty", "questionCount", "studentName"];

  for (const fieldId of fieldIds) {
    if (savedSettings[fieldId] !== undefined && savedSettings[fieldId] !== null) {
      document.getElementById(fieldId).value = String(savedSettings[fieldId]);
    }
  }

  state.theme = getTheme(savedSettings.theme).id;
  state.zoom = normalizeZoomValue(savedSettings.zoom ?? 100);
}

function bindFormPersistence() {
  const fieldIds = ["grade", "operation", "difficulty", "questionCount", "studentName"];

  for (const fieldId of fieldIds) {
    document.getElementById(fieldId).addEventListener("change", () => {
      persistSettings();
    });
  }
}

function init() {
  hydrateSettings();
  bindFormPersistence();
  syncPreview();
}

window.generateWorksheet = generateWorksheet;
window.downloadPDF = downloadPDF;
window.clearWorksheet = clearWorksheet;
window.previousPreviewPage = previousPreviewPage;
window.nextPreviewPage = nextPreviewPage;
window.updateZoom = updateZoom;
window.setTheme = setTheme;

init();
