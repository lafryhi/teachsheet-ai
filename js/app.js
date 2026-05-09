import {
  createPaginationState,
  nextPage,
  previousPage,
  resetPagination
} from "./core/pagination.js";
import {
  deleteProject,
  getGuestScope,
  loadProjects,
  loadSettings,
  loadWorksheet,
  saveProject,
  saveSettings,
  saveWorksheet,
  clearWorksheetStorage
} from "./core/storage.js?v=auth-dashboard";
import {
  hasRecognizedWorksheetPrompt,
  parseWorksheetPrompt
} from "./core/parser.js";
import { createAuthController } from "./auth/auth.js";
import { renderDashboard } from "./auth/dashboard.js";
import { downloadWorksheetPDF } from "./export/pdf.js";
import { generateColoringWorksheet } from "./generators/coloringGenerator.js";
import { generateGrammarWorksheet } from "./generators/grammarGenerator.js";
import { generateMathWorksheet } from "./generators/mathGenerator.js";
import { generateReadingWorksheet } from "./generators/readingGenerator.js";
import { generateTracingWorksheet } from "./generators/tracingGenerator.js";
import {
  getDefaultTemplate,
  getTemplateById,
  getTemplateOptions
} from "./templates/templates.js";
import { renderSavedProjects } from "./ui/projects.js";
import { renderEmptyWorksheet, renderWorksheetPreview } from "./ui/preview.js";
import { applyTheme, getTheme } from "./ui/themes.js";
import { applyZoom, normalizeZoomValue } from "./ui/zoom.js";

const GENERATORS = {
  math: generateMathWorksheet,
  grammar: generateGrammarWorksheet,
  reading: generateReadingWorksheet,
  tracing: generateTracingWorksheet,
  coloring: generateColoringWorksheet
};

const state = {
  currentQuestions: [],
  currentProject: null,
  currentRequest: null,
  currentUser: null,
  currentWorksheetMeta: null,
  isGenerating: false,
  pagination: createPaginationState(0),
  savedProjects: [],
  storageScope: getGuestScope(),
  template: getDefaultTemplate(),
  theme: getDefaultTemplate().theme,
  zoom: 100
};

let statusTimerId = null;

const authController = createAuthController({
  onUserChanged(user) {
    state.currentUser = user;
    state.storageScope = getStorageScopeForUser(user);
    hydrateScopedWorkspace();
  }
});

function getElement(id) {
  return document.getElementById(id);
}

function getWorksheetElement() {
  return getElement("worksheet");
}

function getGenerateButton() {
  return getElement("generateButton");
}

function getPromptGenerateButton() {
  return getElement("promptGenerateButton");
}

function getSaveProjectButton() {
  return getElement("saveProjectButton");
}

function getStatusElement() {
  return getElement("generationStatus");
}

function getPreviewPageIndicator() {
  return getElement("previewPageIndicator");
}

function getPreviewPreviousButton() {
  return getElement("previewPrevButton");
}

function getPreviewNextButton() {
  return getElement("previewNextButton");
}

function getSavedProjectsListElement() {
  return getElement("savedProjectsList");
}

function getDashboardContainer() {
  return getElement("dashboardContainer");
}

function getSmartPromptDefaults() {
  return {
    type: "math",
    subject: "math",
    topic: "addition",
    difficulty: "medium",
    count: 15,
    grade: "Grade 2",
    template: "classic-math"
  };
}

function getStorageScopeForUser(user) {
  return user?.uid || getGuestScope();
}

function capitalizeWords(text = "") {
  return String(text)
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getWorksheetTitle(type) {
  const titles = {
    math: "Math Worksheet",
    grammar: "Grammar Worksheet",
    reading: "Reading Worksheet",
    tracing: "Tracing Practice",
    coloring: "Coloring Activity"
  };

  return titles[type] || "Worksheet";
}

function getSubjectLabel(request) {
  return request.type === "math" ? "Math" : capitalizeWords(request.subject);
}

function getFocusLabel(request) {
  const topicLabel = capitalizeWords(request.topic);

  if (request.type === "tracing" || request.type === "coloring") {
    return topicLabel;
  }

  return request.difficulty ? `${topicLabel} - ${capitalizeWords(request.difficulty)}` : topicLabel;
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
    grade: getElement("grade").value,
    operation: getElement("operation").value,
    difficulty: getElement("difficulty").value,
    questionCount: Number.parseInt(getElement("questionCount").value, 10),
    templateId: getElement("template").value,
    studentName: getElement("studentName").value.trim()
  };
}

function getPromptValue() {
  return getElement("promptInput").value.trim();
}

function getProjectAnswers(questions) {
  return questions.map((question) => question.answer);
}

function waitForPaint() {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      window.setTimeout(resolve, 120);
    });
  });
}

function clearStatusMessageTimer() {
  if (!statusTimerId) {
    return;
  }

  window.clearTimeout(statusTimerId);
  statusTimerId = null;
}

function setStatusMessage(message = "", tone = "") {
  const statusElement = getStatusElement();
  clearStatusMessageTimer();

  statusElement.textContent = message;
  statusElement.className = "status-message";

  if (tone) {
    statusElement.classList.add(`is-${tone}`);
  }

  if (tone === "success" && message) {
    statusTimerId = window.setTimeout(() => {
      statusElement.textContent = "";
      statusElement.className = "status-message";
      statusTimerId = null;
    }, 2600);
  }
}

function setGeneratingState(isGenerating) {
  state.isGenerating = isGenerating;
  getGenerateButton().disabled = isGenerating;
  getPromptGenerateButton().disabled = isGenerating;
  getSaveProjectButton().disabled = isGenerating;
  getGenerateButton().textContent = isGenerating ? "Generating..." : "Generate Worksheet";
}

function updatePreviewControls() {
  const totalPages = Math.max(1, state.pagination.totalPages || 1);
  const currentPage = Math.min(Math.max(1, state.pagination.currentPage || 1), totalPages);

  getPreviewPageIndicator().textContent = `Page ${currentPage} of ${totalPages}`;
  getPreviewPreviousButton().disabled = state.currentQuestions.length === 0 || currentPage <= 1;
  getPreviewNextButton().disabled = state.currentQuestions.length === 0 || currentPage >= totalPages;
}

function createProjectId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `project-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function buildMathRequestFromFormValues(formValues) {
  return {
    type: "math",
    subject: "math",
    topic: formValues.operation,
    difficulty: formValues.difficulty,
    count: formValues.questionCount,
    grade: formValues.grade,
    template: formValues.templateId
  };
}

function buildProjectObject(existingProjectId = null, existingCreatedAt = null) {
  const settings = getFormValues();

  return {
    id: existingProjectId || createProjectId(),
    createdAt: existingCreatedAt || new Date().toISOString(),
    ownerId: state.currentUser?.uid || getGuestScope(),
    ownerEmail: state.currentUser?.email || "guest@local",
    prompt: getPromptValue(),
    template: state.template.id,
    settings,
    request: state.currentRequest,
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
  if (parsedPrompt.grade) {
    getElement("grade").value = parsedPrompt.grade;
  }

  if (parsedPrompt.type === "math") {
    getElement("operation").value = parsedPrompt.topic;
  }

  getElement("difficulty").value = parsedPrompt.difficulty;
  ensureSelectOption(getElement("questionCount"), parsedPrompt.count, `${parsedPrompt.count} Questions`);
  getElement("questionCount").value = String(parsedPrompt.count);

  if (parsedPrompt.template) {
    getElement("template").value = parsedPrompt.template;
  }
}

function getWorksheetRequest() {
  const promptValue = getPromptValue();

  if (promptValue && hasRecognizedWorksheetPrompt(promptValue)) {
    const parsedPrompt = {
      ...getSmartPromptDefaults(),
      ...parseWorksheetPrompt(promptValue)
    };

    applyParsedPromptSettings(parsedPrompt);
    return parsedPrompt;
  }

  return buildMathRequestFromFormValues(getFormValues());
}

function getWorksheetMeta(request, generatorResult) {
  return {
    worksheetTitle: getWorksheetTitle(request.type),
    subjectLabel: getSubjectLabel(request),
    focusLabel: getFocusLabel(request),
    showAnswerKey: generatorResult.showAnswerKey !== false,
    templateDescription: state.template.description
  };
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

function renderDashboardSection() {
  const dashboardContainer = getDashboardContainer();
  dashboardContainer.innerHTML = renderDashboard({
    user: state.currentUser,
    projects: state.savedProjects,
    currentProject: state.currentProject
  });

  const createButton = getElement("dashboardCreateButton");

  if (createButton) {
    createButton.addEventListener("click", () => {
      getElement("app").scrollIntoView({ behavior: "smooth", block: "start" });
      getElement("promptInput").focus();
    });
  }
}

function resetWorksheetState() {
  state.currentQuestions = [];
  state.currentProject = null;
  state.currentRequest = null;
  state.currentWorksheetMeta = null;
  state.pagination = resetPagination(state.pagination, 0);
}

function loadProjectIntoInterface(project) {
  getElement("promptInput").value = project.prompt || "";
  getElement("grade").value = project.settings.grade;
  getElement("operation").value = project.settings.operation;
  getElement("difficulty").value = project.settings.difficulty;
  ensureSelectOption(
    getElement("questionCount"),
    project.settings.questionCount,
    `${project.settings.questionCount} Questions`
  );
  getElement("questionCount").value = String(project.settings.questionCount);
  getElement("template").value = project.template;
  getElement("studentName").value = project.settings.studentName || "";
}

function getRequestFromProject(project) {
  if (project.request) {
    return {
      ...getSmartPromptDefaults(),
      ...project.request,
      template: project.template || project.request.template || getDefaultTemplate().id
    };
  }

  if (project.prompt && hasRecognizedWorksheetPrompt(project.prompt)) {
    return {
      ...getSmartPromptDefaults(),
      ...parseWorksheetPrompt(project.prompt),
      template: project.template || getDefaultTemplate().id
    };
  }

  return buildMathRequestFromFormValues({
    grade: project.settings.grade,
    operation: project.settings.operation,
    difficulty: project.settings.difficulty,
    questionCount: project.settings.questionCount,
    templateId: project.template,
    studentName: project.settings.studentName || ""
  });
}

function buildStoredWorksheetPayload() {
  return {
    project: state.currentProject,
    questions: state.currentQuestions,
    settings: getFormValues(),
    templateId: state.template.id,
    prompt: getPromptValue(),
    answers: state.currentProject?.answers || getProjectAnswers(state.currentQuestions),
    theme: state.theme,
    zoom: state.zoom
  };
}

function persistCurrentWorksheet() {
  saveWorksheet(buildStoredWorksheetPayload(), state.storageScope);
}

function renderSavedProjectsList() {
  getSavedProjectsListElement().innerHTML = renderSavedProjects(
    state.savedProjects,
    state.currentProject?.id || null
  );
}

function syncPreview() {
  if (state.currentQuestions.length === 0) {
    renderEmptyWorksheet(getWorksheetElement(), state.template);
    applyPreviewState();
    updatePreviewControls();
    renderDashboardSection();
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
    grade: state.currentRequest?.grade || formValues.grade,
    subjectLabel: state.currentWorksheetMeta?.subjectLabel || "Math",
    focusLabel: state.currentWorksheetMeta?.focusLabel || "Addition - Medium",
    studentName: formValues.studentName,
    questions: pageQuestions,
    allQuestions: state.currentQuestions,
    currentPage: state.pagination.currentPage,
    totalPages: state.pagination.totalPages,
    template: state.template,
    pageSize: state.pagination.pageSize,
    worksheetTitle: state.currentWorksheetMeta?.worksheetTitle || "Worksheet",
    showAnswerKey: state.currentWorksheetMeta?.showAnswerKey !== false,
    templateDescription: state.currentWorksheetMeta?.templateDescription || state.template.description
  });

  applyPreviewState();
  updatePreviewControls();
  renderDashboardSection();
}

function applyStoredWorksheet(savedWorksheet) {
  if (!savedWorksheet?.questions?.length) {
    resetWorksheetState();
    return;
  }

  state.template = getTemplateById(savedWorksheet.templateId || state.template.id);
  state.theme = getTheme(savedWorksheet.theme || state.template.theme).id;
  state.zoom = normalizeZoomValue(savedWorksheet.zoom ?? state.zoom);
  state.currentQuestions = Array.isArray(savedWorksheet.questions) ? savedWorksheet.questions : [];

  if (savedWorksheet.settings) {
    loadProjectIntoInterface({
      prompt: savedWorksheet.prompt || "",
      template: savedWorksheet.templateId || state.template.id,
      settings: savedWorksheet.settings
    });
  } else if (savedWorksheet.prompt) {
    getElement("promptInput").value = savedWorksheet.prompt;
  }

  const worksheetProject = savedWorksheet.project || null;
  state.currentRequest = worksheetProject
    ? getRequestFromProject(worksheetProject)
    : (savedWorksheet.prompt && hasRecognizedWorksheetPrompt(savedWorksheet.prompt)
      ? {
        ...getSmartPromptDefaults(),
        ...parseWorksheetPrompt(savedWorksheet.prompt),
        template: savedWorksheet.templateId || state.template.id
      }
      : buildMathRequestFromFormValues(getFormValues()));

  state.currentWorksheetMeta = getWorksheetMeta(state.currentRequest, {
    showAnswerKey: !["tracing", "coloring"].includes(state.currentRequest.type)
  });
  state.currentProject = worksheetProject;
  state.pagination = resetPagination(
    state.pagination,
    state.currentQuestions.length,
    state.template.questionsPerPage
  );
}

function hydrateScopedWorkspace() {
  state.savedProjects = loadProjects(state.storageScope);
  const savedWorksheet = loadWorksheet(state.storageScope);

  if (savedWorksheet?.questions?.length) {
    applyStoredWorksheet(savedWorksheet);
  } else {
    resetWorksheetState();
  }

  renderSavedProjectsList();
  syncPreview();
}

function buildWorksheetFromRequest(worksheetRequest) {
  const generator = GENERATORS[worksheetRequest.type] || generateMathWorksheet;
  const generatorResult = generator(worksheetRequest);

  state.currentRequest = worksheetRequest;
  state.template = getTemplateById(worksheetRequest.template || getFormValues().templateId);
  state.theme = state.template.theme;
  state.currentQuestions = generatorResult.questions;
  state.currentWorksheetMeta = getWorksheetMeta(worksheetRequest, generatorResult);
  state.pagination = resetPagination(
    state.pagination,
    state.currentQuestions.length,
    state.template.questionsPerPage
  );
  state.currentProject = buildProjectObject();

  syncPreview();
  renderSavedProjectsList();
  persistSettings();
  persistCurrentWorksheet();
}

async function generateWorksheet() {
  if (state.isGenerating) {
    return;
  }

  try {
    setGeneratingState(true);
    setStatusMessage("Generating worksheet...", "loading");
    await waitForPaint();
    buildWorksheetFromRequest(getWorksheetRequest());
    setStatusMessage("Worksheet generated successfully.", "success");
  } catch (error) {
    console.error(error);
    setStatusMessage("Unable to generate the worksheet.", "error");
  } finally {
    setGeneratingState(false);
  }
}

function clearWorksheet() {
  clearStatusMessageTimer();
  resetWorksheetState();
  renderSavedProjectsList();
  syncPreview();
  clearWorksheetStorage(state.storageScope);
  persistSettings();
  setStatusMessage("");
}

async function applyPrompt() {
  if (state.isGenerating) {
    return;
  }

  const promptText = getPromptValue();

  if (!hasRecognizedWorksheetPrompt(promptText)) {
    window.alert("Please enter a structured prompt like: grade 2 + addition + 20 questions");
    return;
  }

  const parsedPrompt = {
    ...getSmartPromptDefaults(),
    ...parseWorksheetPrompt(promptText)
  };

  applyParsedPromptSettings(parsedPrompt);
  await generateWorksheet();
}

function loadProject(projectId) {
  const project = state.savedProjects.find((entry) => entry.id === projectId);

  if (!project) {
    return;
  }

  state.template = getTemplateById(project.template);
  state.theme = state.template.theme;
  state.currentQuestions = Array.isArray(project.questions) ? project.questions : [];
  state.currentRequest = getRequestFromProject(project);
  state.currentWorksheetMeta = getWorksheetMeta(state.currentRequest, {
    showAnswerKey: !["tracing", "coloring"].includes(state.currentRequest.type)
  });
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
  persistCurrentWorksheet();
  setStatusMessage("Saved project loaded.", "success");
}

function saveCurrentProject() {
  if (state.isGenerating) {
    return;
  }

  if (state.currentQuestions.length === 0) {
    window.alert("Please generate a worksheet first.");
    return;
  }

  const existingProjectId = state.currentProject?.id || null;
  const existingCreatedAt = state.currentProject?.createdAt || null;
  state.currentProject = buildProjectObject(existingProjectId, existingCreatedAt);
  state.savedProjects = saveProject(state.currentProject, state.storageScope);
  renderSavedProjectsList();
  renderDashboardSection();
  persistCurrentWorksheet();
  setStatusMessage("Project saved locally.", "success");
}

function removeProject(projectId) {
  state.savedProjects = deleteProject(projectId, state.storageScope);

  if (state.currentProject?.id === projectId) {
    state.currentProject = null;

    if (state.currentQuestions.length > 0) {
      persistCurrentWorksheet();
    }
  }

  renderSavedProjectsList();
  renderDashboardSection();
  setStatusMessage("Project deleted.", "success");
}

function downloadPDF() {
  if (state.currentQuestions.length === 0) {
    window.alert("Please generate a worksheet first.");
    return;
  }

  downloadWorksheetPDF({
    questions: state.currentQuestions,
    template: state.template,
    theme: getTheme(state.theme),
    studentName: getFormValues().studentName,
    grade: state.currentRequest?.grade || getFormValues().grade,
    worksheetTitle: state.currentWorksheetMeta?.worksheetTitle || "Worksheet",
    subjectLabel: state.currentWorksheetMeta?.subjectLabel || "Math",
    focusLabel: state.currentWorksheetMeta?.focusLabel || "Addition - Medium",
    showAnswerKey: state.currentWorksheetMeta?.showAnswerKey !== false
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

  if (state.currentQuestions.length > 0) {
    persistCurrentWorksheet();
  }
}

function setTheme(theme) {
  state.theme = getTheme(theme).id;
  applyTheme(getWorksheetElement(), state.theme);
  persistSettings();

  if (state.currentQuestions.length > 0) {
    if (state.currentProject) {
      state.currentProject.template = state.template.id;
    }

    persistCurrentWorksheet();
  }
}

function hydrateSettings() {
  const savedSettings = loadSettings();

  if (!savedSettings) {
    getElement("template").value = state.template.id;
    return;
  }

  const fieldIds = ["grade", "operation", "difficulty", "questionCount", "studentName"];

  for (const fieldId of fieldIds) {
    if (savedSettings[fieldId] !== undefined && savedSettings[fieldId] !== null) {
      getElement(fieldId).value = String(savedSettings[fieldId]);
    }
  }

  state.template = getTemplateById(savedSettings.templateId);
  getElement("template").value = state.template.id;
  state.theme = getTheme(savedSettings.theme).id;
  state.zoom = normalizeZoomValue(savedSettings.zoom ?? 100);
}

function bindFormPersistence() {
  const fieldIds = ["grade", "operation", "difficulty", "questionCount", "studentName"];

  for (const fieldId of fieldIds) {
    getElement(fieldId).addEventListener("change", () => {
      persistSettings();
    });
  }

  getElement("template").addEventListener("change", (event) => {
    state.template = getTemplateById(event.target.value);
    state.theme = state.template.theme;
    state.pagination = resetPagination(
      state.pagination,
      state.currentQuestions.length,
      state.template.questionsPerPage
    );
    state.currentWorksheetMeta = state.currentWorksheetMeta
      ? {
        ...state.currentWorksheetMeta,
        templateDescription: state.template.description
      }
      : state.currentWorksheetMeta;
    syncPreview();
    persistSettings();

    if (state.currentQuestions.length > 0) {
      state.currentProject = buildProjectObject(
        state.currentProject?.id || null,
        state.currentProject?.createdAt || null
      );
      persistCurrentWorksheet();
    }
  });

  getPromptGenerateButton().addEventListener("click", () => {
    applyPrompt();
  });

  getElement("promptInput").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      applyPrompt();
    }
  });

  getElement("promptInput").addEventListener("input", () => {
    if (state.currentProject) {
      state.currentProject.prompt = getPromptValue();
    }
  });

  document.querySelector(".example-prompts-list").addEventListener("click", (event) => {
    const examplePrompt = event.target.dataset.examplePrompt;

    if (!examplePrompt) {
      return;
    }

    getElement("promptInput").value = examplePrompt;
    setStatusMessage("");
  });

  getSaveProjectButton().addEventListener("click", () => {
    saveCurrentProject();
  });

  getSavedProjectsListElement().addEventListener("click", (event) => {
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
  const templateSelect = getElement("template");
  templateSelect.innerHTML = getTemplateOptions()
    .map((templateOption) => `<option value="${templateOption.value}">${templateOption.label}</option>`)
    .join("");
}

async function init() {
  populateTemplateOptions();
  hydrateSettings();
  bindFormPersistence();
  await authController.init();
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

init().catch((error) => {
  console.error(error);
  setStatusMessage("App initialization failed.", "error");
});
