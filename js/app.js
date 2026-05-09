import { generateQuestions, formatOperation, capitalize } from "./core/generator.js";
import {
  createPaginationState,
  nextPage,
  previousPage,
  resetPagination
} from "./core/pagination.js";
import {
  loadSettings,
  loadProjects,
  saveProject,
  saveSettings,
  saveWorksheet,
  clearWorksheetStorage,
  deleteProject
} from "./core/storage.js?v=projects";
import { hasRecognizedPromptFields, parsePrompt } from "./core/promptParser.js";
import { renderEmptyWorksheet, renderWorksheetPreview } from "./ui/preview.js";
import { renderSavedProjects } from "./ui/projects.js";
import { applyTheme, getTheme } from "./ui/themes.js";
import { applyZoom, normalizeZoomValue } from "./ui/zoom.js";
import { downloadWorksheetPDF } from "./export/pdf.js";
import {
  getDefaultTemplate,
  getTemplateById,
  getTemplateOptions
} from "./templates/templates.js";

const state = {
  currentQuestions: [],
  currentProject: null,
  pagination: createPaginationState(0),
  savedProjects: [],
  template: getDefaultTemplate(),
  theme: getDefaultTemplate().theme,
  zoom: 100
};

function getWorksheetElement() {
  return document.getElementById("worksheet");
}

function getSmartPromptDefaults() {
  return {
    grade: "Grade 2",
    operation: "addition",
    difficulty: "medium",
    questionCount: 15,
    template: "classic-math"
  };
}

function ensureSelectOption(selectElement, value, label) {
  if ([...selectElement.options].some((option) => option.value === String(value))) {
    return;
  }

  const optionElement = document.createElement("option");
  optionElement.value = String(value);
  optionElement.textContent = label;
  selectElement.appendChild(optionElement);
}

function getFormValues() {
  return {
    grade: document.getElementById("grade").value,
    operation: document.getElementById("operation").value,
    difficulty: document.getElementById("difficulty").value,
    questionCount: Number.parseInt(document.getElementById("questionCount").value, 10),
    templateId: document.getElementById("template").value,
    studentName: document.getElementById("studentName").value.trim()
  };
}

function getPromptValue() {
  return document.getElementById("promptInput").value.trim();
}

function getProjectAnswers(questions) {
  return questions.map((question) => question.answer);
}

function createProjectId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `project-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function buildProjectObject(existingProjectId = null, existingCreatedAt = null) {
  const settings = getFormValues();

  return {
    id: existingProjectId || createProjectId(),
    createdAt: existingCreatedAt || new Date().toISOString(),
    prompt: getPromptValue(),
    template: state.template.id,
    settings,
    questions: state.currentQuestions,
    answers: getProjectAnswers(state.currentQuestions)
  };
}

function applyPreviewState() {
  const worksheetElement = getWorksheetElement();
  applyTheme(worksheetElement, state.theme);
  applyZoom(worksheetElement, state.zoom);
}

function applyParsedPromptSettings(parsedPrompt) {
  document.getElementById("grade").value = parsedPrompt.grade;
  document.getElementById("operation").value = parsedPrompt.operation;
  document.getElementById("difficulty").value = parsedPrompt.difficulty;
  ensureSelectOption(
    document.getElementById("questionCount"),
    parsedPrompt.questionCount,
    `${parsedPrompt.questionCount} Questions`
  );
  document.getElementById("questionCount").value = String(parsedPrompt.questionCount);
  document.getElementById("template").value = parsedPrompt.template;
}

function persistSettings(partialSettings = {}) {
  const formValues = getFormValues();

  saveSettings({
    grade: formValues.grade,
    operation: formValues.operation,
    difficulty: formValues.difficulty,
    questionCount: formValues.questionCount,
    templateId: state.template.id,
    studentName: formValues.studentName,
    theme: state.theme,
    zoom: state.zoom,
    ...partialSettings
  });
}

function syncPreview() {
  if (state.currentQuestions.length === 0) {
    renderEmptyWorksheet(getWorksheetElement(), state.template);
    applyPreviewState();
    return;
  }

  const formValues = getFormValues();
  const questionStartIndex = (state.pagination.currentPage - 1) * state.pagination.pageSize;
  const pageQuestions = state.currentQuestions.slice(
    questionStartIndex,
    questionStartIndex + state.pagination.pageSize
  );

  renderWorksheetPreview({
    worksheetElement: getWorksheetElement(),
    grade: formValues.grade,
    operation: formValues.operation,
    difficulty: formValues.difficulty,
    studentName: formValues.studentName,
    questions: pageQuestions,
    allQuestions: state.currentQuestions,
    currentPage: state.pagination.currentPage,
    totalPages: state.pagination.totalPages,
    template: state.template,
    pageSize: state.pagination.pageSize,
    formatOperation,
    capitalize
  });

  applyPreviewState();
}

function renderSavedProjectsList() {
  document.getElementById("savedProjectsList").innerHTML = renderSavedProjects(
    state.savedProjects,
    state.currentProject?.id || null
  );
}

function generateWorksheet() {
  const formValues = getFormValues();
  state.template = getTemplateById(formValues.templateId);
  state.theme = state.template.theme;

  state.currentQuestions = generateQuestions({
    operation: formValues.operation,
    difficulty: formValues.difficulty,
    questionCount: formValues.questionCount
  });

  state.pagination = resetPagination(
    state.pagination,
    state.currentQuestions.length,
    state.template.questionsPerPage
  );
  state.currentProject = buildProjectObject();

  syncPreview();
  renderSavedProjectsList();

  persistSettings();
  saveWorksheet({
    project: state.currentProject,
    questions: state.currentQuestions,
    settings: formValues,
    templateId: state.template.id,
    prompt: getPromptValue(),
    answers: state.currentProject.answers,
    theme: state.theme,
    zoom: state.zoom
  });
}

function clearWorksheet() {
  state.currentQuestions = [];
  state.currentProject = null;
  state.pagination = resetPagination(state.pagination, 0);

  syncPreview();
  renderSavedProjectsList();
  clearWorksheetStorage();
  persistSettings();
}

function applyPrompt() {
  const promptInput = document.getElementById("promptInput");
  const promptText = promptInput.value.trim();

  if (!hasRecognizedPromptFields(promptText)) {
    window.alert("Please enter a structured prompt like: grade 2 + addition + 20 questions");
    return;
  }

  const parsedPrompt = parsePrompt(promptText, getSmartPromptDefaults());
  applyParsedPromptSettings(parsedPrompt);
  generateWorksheet();
}

function loadProjectIntoInterface(project) {
  document.getElementById("promptInput").value = project.prompt || "";
  document.getElementById("grade").value = project.settings.grade;
  document.getElementById("operation").value = project.settings.operation;
  document.getElementById("difficulty").value = project.settings.difficulty;
  ensureSelectOption(
    document.getElementById("questionCount"),
    project.settings.questionCount,
    `${project.settings.questionCount} Questions`
  );
  document.getElementById("questionCount").value = String(project.settings.questionCount);
  document.getElementById("template").value = project.template;
  document.getElementById("studentName").value = project.settings.studentName || "";
}

function loadProject(projectId) {
  const project = state.savedProjects.find((entry) => entry.id === projectId);

  if (!project) {
    return;
  }

  state.template = getTemplateById(project.template);
  state.theme = state.template.theme;
  state.currentQuestions = Array.isArray(project.questions) ? project.questions : [];
  state.pagination = resetPagination(
    state.pagination,
    state.currentQuestions.length,
    state.template.questionsPerPage
  );
  state.currentProject = {
    ...project,
    answers: Array.isArray(project.answers) ? project.answers : getProjectAnswers(project.questions || [])
  };

  loadProjectIntoInterface(project);
  syncPreview();
  renderSavedProjectsList();
  persistSettings();
  saveWorksheet({
    project: state.currentProject,
    questions: state.currentQuestions,
    settings: project.settings,
    templateId: state.template.id,
    prompt: project.prompt || "",
    answers: state.currentProject.answers,
    theme: state.theme,
    zoom: state.zoom
  });
}

function saveCurrentProject() {
  if (state.currentQuestions.length === 0) {
    window.alert("Please generate a worksheet first.");
    return;
  }

  const existingProjectId = state.currentProject?.id || null;
  const existingCreatedAt = state.currentProject?.createdAt || null;
  state.currentProject = buildProjectObject(existingProjectId, existingCreatedAt);
  state.savedProjects = saveProject(state.currentProject);
  renderSavedProjectsList();
}

function removeProject(projectId) {
  state.savedProjects = deleteProject(projectId);

  if (state.currentProject?.id === projectId) {
    state.currentProject = null;
  }

  renderSavedProjectsList();
}

function downloadPDF() {
  if (state.currentQuestions.length === 0) {
    window.alert("Please generate a worksheet first.");
    return;
  }

  downloadWorksheetPDF({
    questions: state.currentQuestions,
    ...getFormValues(),
    template: state.template,
    theme: getTheme(state.theme),
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

  if (state.currentProject) {
    state.currentProject.template = state.template.id;
  }
}

function hydrateSettings() {
  const savedSettings = loadSettings();

  if (!savedSettings) {
    document.getElementById("template").value = state.template.id;
    return;
  }

  const fieldIds = ["grade", "operation", "difficulty", "questionCount", "studentName"];

  for (const fieldId of fieldIds) {
    if (savedSettings[fieldId] !== undefined && savedSettings[fieldId] !== null) {
      document.getElementById(fieldId).value = String(savedSettings[fieldId]);
    }
  }

  state.template = getTemplateById(savedSettings.templateId);
  document.getElementById("template").value = state.template.id;
  state.theme = getTheme(savedSettings.theme).id;
  state.zoom = normalizeZoomValue(savedSettings.zoom ?? 100);
}

function hydrateSavedProjects() {
  state.savedProjects = loadProjects();
  renderSavedProjectsList();
}

function bindFormPersistence() {
  const fieldIds = ["grade", "operation", "difficulty", "questionCount", "studentName"];

  for (const fieldId of fieldIds) {
    document.getElementById(fieldId).addEventListener("change", () => {
      persistSettings();
    });
  }

  document.getElementById("template").addEventListener("change", (event) => {
    state.template = getTemplateById(event.target.value);
    state.theme = state.template.theme;
    state.pagination = resetPagination(
      state.pagination,
      state.currentQuestions.length,
      state.template.questionsPerPage
    );
    syncPreview();
    persistSettings();

    if (state.currentQuestions.length > 0) {
      state.currentProject = buildProjectObject(
        state.currentProject?.id || null,
        state.currentProject?.createdAt || null
      );
      saveWorksheet({
        project: state.currentProject,
        questions: state.currentQuestions,
        settings: getFormValues(),
        templateId: state.template.id,
        prompt: getPromptValue(),
        answers: state.currentProject.answers,
        theme: state.theme,
        zoom: state.zoom
      });
    }
  });

  document.getElementById("promptGenerateButton").addEventListener("click", () => {
    applyPrompt();
  });

  document.getElementById("promptInput").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      applyPrompt();
    }
  });

  document.getElementById("saveProjectButton").addEventListener("click", () => {
    saveCurrentProject();
  });

  document.getElementById("savedProjectsList").addEventListener("click", (event) => {
    const loadProjectId = event.target.dataset.loadProject;
    const deleteProjectId = event.target.dataset.deleteProject;

    if (loadProjectId) {
      loadProject(loadProjectId);
      return;
    }

    if (deleteProjectId) {
      removeProject(deleteProjectId);
    }
  });
}

function populateTemplateOptions() {
  const templateSelect = document.getElementById("template");
  templateSelect.innerHTML = getTemplateOptions()
    .map((templateOption) => `<option value="${templateOption.value}">${templateOption.label}</option>`)
    .join("");
}

function init() {
  populateTemplateOptions();
  hydrateSettings();
  hydrateSavedProjects();
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
window.applyPrompt = applyPrompt;
window.saveCurrentProject = saveCurrentProject;

init();
