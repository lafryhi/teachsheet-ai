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
import { getWorksheetPageBreakdown } from "./core/worksheetLayout.js";
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

const PERSISTED_FIELD_IDS = [
  "grade",
  "operation",
  "difficulty",
  "questionCount",
  "worksheetTitle",
  "schoolName",
  "teacherName",
  "studentName",
  "worksheetDate",
  "instructions",
  "scorePoints"
];

const state = {
  currentQuestions: [],
  currentProject: null,
  currentRequest: null,
  currentUser: null,
  currentWorksheetMeta: null,
  isGenerating: false,
  lastGeneratedAt: null,
  pagination: createPaginationState(0),
  savedProjects: [],
  storageScope: getGuestScope(),
  template: getDefaultTemplate(),
  templateManuallySelected: false,
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

function getActiveTemplateIndicator() {
  return getElement("activeTemplateIndicator");
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
    worksheetTitle: getElement("worksheetTitle").value.trim(),
    schoolName: getElement("schoolName").value.trim(),
    teacherName: getElement("teacherName").value.trim(),
    studentName: getElement("studentName").value.trim(),
    worksheetDate: getElement("worksheetDate").value,
    instructions: getElement("instructions").value.trim(),
    scorePoints: getElement("scorePoints").value.trim()
  };
}

function getSelectedTemplateId() {
  return getFormValues().templateId;
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

function getResolvedWorksheetIdentity(formValues, request, worksheetTitleFallback = null) {
  return {
    worksheetTitle: formValues.worksheetTitle || worksheetTitleFallback || getWorksheetTitle(request.type),
    schoolName: formValues.schoolName,
    teacherName: formValues.teacherName,
    studentName: formValues.studentName,
    worksheetDate: formValues.worksheetDate,
    instructions: formValues.instructions,
    scorePoints: formValues.scorePoints
  };
}

function getPaginationExtraPages(showAnswerKey) {
  if (!state.currentRequest) {
    return 0;
  }

  const breakdown = getWorksheetPageBreakdown({
    totalQuestions: state.currentQuestions.length,
    questionsPerPage: state.template.questionsPerPage,
    template: state.template,
    showAnswerKey
  });

  return breakdown.answerPages;
}

function buildProjectObject(existingProjectId = null, existingCreatedAt = null) {
  const settings = getFormValues();

  return {
    id: existingProjectId || createProjectId(),
    createdAt: existingCreatedAt || new Date().toISOString(),
    generatedAt: state.lastGeneratedAt || new Date().toISOString(),
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

function updateActiveTemplateIndicator() {
  const indicator = getActiveTemplateIndicator();

  indicator.innerHTML = `
    <span class="active-template-badge">Active Template</span>
    <strong>${state.template.name}</strong>
    <span>${state.template.description}</span>
  `;
  indicator.dataset.templateId = state.template.id;
}

function applyParsedPromptSettings(parsedPrompt, options = {}) {
  const { applyTemplate = false } = options;

  if (parsedPrompt.grade) {
    getElement("grade").value = parsedPrompt.grade;
  }

  if (parsedPrompt.type === "math") {
    getElement("operation").value = parsedPrompt.topic;
  }

  getElement("difficulty").value = parsedPrompt.difficulty;
  ensureSelectOption(getElement("questionCount"), parsedPrompt.count, `${parsedPrompt.count} Questions`);
  getElement("questionCount").value = String(parsedPrompt.count);

  if (applyTemplate && parsedPrompt.template) {
    getElement("template").value = parsedPrompt.template;
  }
}

function getWorksheetRequest() {
  const promptValue = getPromptValue();
  const selectedTemplateId = getSelectedTemplateId();

  if (promptValue && hasRecognizedWorksheetPrompt(promptValue)) {
    const parsedPrompt = {
      ...getSmartPromptDefaults(),
      ...parseWorksheetPrompt(promptValue)
    };
    const resolvedRequest = {
      ...parsedPrompt,
      template: state.templateManuallySelected
        ? selectedTemplateId
        : (parsedPrompt.templateExplicit ? parsedPrompt.template : selectedTemplateId)
    };

    applyParsedPromptSettings(parsedPrompt, {
      applyTemplate: parsedPrompt.templateExplicit && !state.templateManuallySelected
    });
    return resolvedRequest;
  }

  return buildMathRequestFromFormValues(getFormValues());
}

function getWorksheetMeta(request, generatorResult) {
  const formValues = getFormValues();
  const defaultTitle = getWorksheetTitle(request.type);

  return {
    worksheetTitle: formValues.worksheetTitle || defaultTitle,
    subjectLabel: getSubjectLabel(request),
    focusLabel: getFocusLabel(request),
    showAnswerKey: generatorResult.showAnswerKey !== false,
    templateDescription: state.template.description,
    identity: getResolvedWorksheetIdentity(formValues, request, defaultTitle)
  };
}

function persistSettings(partialSettings = {}) {
  const formValues = getFormValues();

  saveSettings({
    grade: formValues.grade,
    operation: formValues.operation,
    difficulty: formValues.difficulty,
    questionCount: formValues.questionCount,
    worksheetTitle: formValues.worksheetTitle,
    schoolName: formValues.schoolName,
    teacherName: formValues.teacherName,
    templateId: state.template.id,
    studentName: formValues.studentName,
    worksheetDate: formValues.worksheetDate,
    instructions: formValues.instructions,
    scorePoints: formValues.scorePoints,
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
    currentWorksheetSummary: state.currentQuestions.length > 0
      ? {
        title: state.currentProject?.prompt || state.currentWorksheetMeta?.worksheetTitle || "Worksheet",
        timestamp: state.lastGeneratedAt
      }
      : null
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
  state.lastGeneratedAt = null;
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
  getElement("worksheetTitle").value = project.settings.worksheetTitle || "";
  getElement("schoolName").value = project.settings.schoolName || "";
  getElement("teacherName").value = project.settings.teacherName || "";
  getElement("studentName").value = project.settings.studentName || "";
  getElement("worksheetDate").value = project.settings.worksheetDate || "";
  getElement("instructions").value = project.settings.instructions || "";
  getElement("scorePoints").value = project.settings.scorePoints || "";
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
    worksheetTitle: project.settings.worksheetTitle || "",
    schoolName: project.settings.schoolName || "",
    teacherName: project.settings.teacherName || "",
    studentName: project.settings.studentName || "",
    worksheetDate: project.settings.worksheetDate || "",
    instructions: project.settings.instructions || "",
    scorePoints: project.settings.scorePoints || ""
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
    updateActiveTemplateIndicator();
    updatePreviewControls();
    renderDashboardSection();
    return;
  }

  const formValues = getFormValues();
  const showAnswerKey = state.currentWorksheetMeta?.showAnswerKey !== false;
  const breakdown = getWorksheetPageBreakdown({
    totalQuestions: state.currentQuestions.length,
    questionsPerPage: state.pagination.pageSize,
    template: state.template,
    showAnswerKey
  });
  const isAnswerPage = showAnswerKey && state.pagination.currentPage > breakdown.questionPages;
  const questionStartIndex = isAnswerPage
    ? 0
    : (state.pagination.currentPage - 1) * state.pagination.pageSize;
  const pageQuestions = isAnswerPage
    ? []
    : state.currentQuestions.slice(questionStartIndex, questionStartIndex + state.pagination.pageSize);
  const answerPageIndex = isAnswerPage ? state.pagination.currentPage - breakdown.questionPages - 1 : 0;
  const answerStartIndex = answerPageIndex * breakdown.answerCardsPerPage;
  const answerQuestions = isAnswerPage
    ? state.currentQuestions.slice(
      answerStartIndex,
      answerStartIndex + breakdown.answerCardsPerPage
    ).map((question, index) => ({
      ...question,
      answerIndex: answerStartIndex + index + 1
    }))
    : [];

  renderWorksheetPreview({
    worksheetElement: getWorksheetElement(),
    grade: state.currentRequest?.grade || formValues.grade,
    subjectLabel: state.currentWorksheetMeta?.subjectLabel || "Math",
    focusLabel: state.currentWorksheetMeta?.focusLabel || "Addition - Medium",
    questions: pageQuestions,
    answerQuestions,
    allQuestions: state.currentQuestions,
    currentPage: state.pagination.currentPage,
    totalPages: breakdown.totalPages,
    template: state.template,
    pageSize: state.pagination.pageSize,
    worksheetTitle: state.currentWorksheetMeta?.worksheetTitle || "Worksheet",
    showAnswerKey,
    pageKind: isAnswerPage ? "answer-key" : "questions",
    identity: state.currentWorksheetMeta?.identity || getResolvedWorksheetIdentity(formValues, state.currentRequest),
    templateDescription: state.currentWorksheetMeta?.templateDescription || state.template.description
  });

  applyPreviewState();
  updateActiveTemplateIndicator();
  updatePreviewControls();
  renderDashboardSection();
}

function applyStoredWorksheet(savedWorksheet) {
  if (!savedWorksheet?.questions?.length) {
    resetWorksheetState();
    return;
  }

  state.template = getTemplateById(savedWorksheet.templateId || state.template.id);
  state.templateManuallySelected = true;
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
  state.lastGeneratedAt = worksheetProject?.generatedAt || worksheetProject?.createdAt || null;
  state.pagination = resetPagination(
    state.pagination,
    state.currentQuestions.length,
    state.template.questionsPerPage,
    getPaginationExtraPages(state.currentWorksheetMeta.showAnswerKey)
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
  state.lastGeneratedAt = new Date().toISOString();
  state.currentWorksheetMeta = getWorksheetMeta(worksheetRequest, generatorResult);
  state.pagination = resetPagination(
    state.pagination,
    state.currentQuestions.length,
    state.template.questionsPerPage,
    getPaginationExtraPages(state.currentWorksheetMeta.showAnswerKey)
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
  state.templateManuallySelected = true;
  state.theme = state.template.theme;
  state.currentQuestions = Array.isArray(project.questions) ? project.questions : [];
  state.currentRequest = getRequestFromProject(project);
  state.currentWorksheetMeta = getWorksheetMeta(state.currentRequest, {
    showAnswerKey: !["tracing", "coloring"].includes(state.currentRequest.type)
  });
  state.pagination = resetPagination(
    state.pagination,
    state.currentQuestions.length,
    state.template.questionsPerPage,
    getPaginationExtraPages(state.currentWorksheetMeta.showAnswerKey)
  );
  state.currentProject = {
    ...project,
    answers: Array.isArray(project.answers) ? project.answers : getProjectAnswers(project.questions || [])
  };
  state.lastGeneratedAt = project.generatedAt || project.createdAt || null;

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
    grade: state.currentRequest?.grade || getFormValues().grade,
    worksheetTitle: state.currentWorksheetMeta?.worksheetTitle || "Worksheet",
    subjectLabel: state.currentWorksheetMeta?.subjectLabel || "Math",
    focusLabel: state.currentWorksheetMeta?.focusLabel || "Addition - Medium",
    showAnswerKey: state.currentWorksheetMeta?.showAnswerKey !== false,
    identity: state.currentWorksheetMeta?.identity || getResolvedWorksheetIdentity(getFormValues(), state.currentRequest)
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
  for (const fieldId of PERSISTED_FIELD_IDS) {
    if (savedSettings[fieldId] !== undefined && savedSettings[fieldId] !== null) {
      getElement(fieldId).value = String(savedSettings[fieldId]);
    }
  }

  state.template = getTemplateById(savedSettings.templateId);
  state.templateManuallySelected = true;
  getElement("template").value = state.template.id;
  state.theme = getTheme(savedSettings.theme).id;
  state.zoom = normalizeZoomValue(savedSettings.zoom ?? 100);
  updateActiveTemplateIndicator();
}

function bindFormPersistence() {
  for (const fieldId of PERSISTED_FIELD_IDS) {
    getElement(fieldId).addEventListener("change", () => {
      persistSettings();
      if (state.currentQuestions.length > 0) {
        state.currentWorksheetMeta = getWorksheetMeta(
          state.currentRequest,
          { showAnswerKey: state.currentWorksheetMeta?.showAnswerKey !== false }
        );
        if (state.currentProject) {
          state.currentProject = buildProjectObject(
            state.currentProject?.id || null,
            state.currentProject?.createdAt || null
          );
        }
        syncPreview();
        persistCurrentWorksheet();
      }
    });
  }

  getElement("template").addEventListener("change", (event) => {
    state.templateManuallySelected = true;
    state.template = getTemplateById(event.target.value);
    state.theme = state.template.theme;
    if (state.currentRequest) {
      state.currentRequest.template = state.template.id;
    }
    state.pagination = resetPagination(
      state.pagination,
      state.currentQuestions.length,
      state.template.questionsPerPage,
      getPaginationExtraPages(state.currentWorksheetMeta?.showAnswerKey !== false)
    );
    state.currentWorksheetMeta = state.currentWorksheetMeta
      ? {
        ...state.currentWorksheetMeta,
        templateDescription: state.template.description
      }
      : state.currentWorksheetMeta;
    updateActiveTemplateIndicator();
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
