import {
  createPaginationState,
  nextPage,
  previousPage,
  resetPagination
} from "./core/pagination.js";
import {
  loadSettings,
  loadProjects,
  loadWorksheet,
  saveProject,
  saveSettings,
  saveWorksheet,
  clearWorksheetStorage,
  deleteProject
} from "./core/storage.js?v=refine-ux";
import {
  hasRecognizedWorksheetPrompt,
  parseWorksheetPrompt
} from "./core/parser.js";
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
import { generateMathWorksheet } from "./generators/mathGenerator.js";
import { generateGrammarWorksheet } from "./generators/grammarGenerator.js";
import { generateReadingWorksheet } from "./generators/readingGenerator.js";
import { generateTracingWorksheet } from "./generators/tracingGenerator.js";
import { generateColoringWorksheet } from "./generators/coloringGenerator.js";

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
  currentWorksheetMeta: null,
  isGenerating: false,
  pagination: createPaginationState(0),
  savedProjects: [],
  template: getDefaultTemplate(),
  theme: getDefaultTemplate().theme,
  zoom: 100
};

let statusTimerId = null;

function getWorksheetElement() {
  return document.getElementById("worksheet");
}

function getGenerateButton() {
  return document.getElementById("generateButton");
}

function getPromptGenerateButton() {
  return document.getElementById("promptGenerateButton");
}

function getSaveProjectButton() {
  return document.getElementById("saveProjectButton");
}

function getStatusElement() {
  return document.getElementById("generationStatus");
}

function getPreviewPageIndicator() {
  return document.getElementById("previewPageIndicator");
}

function getPreviewPreviousButton() {
  return document.getElementById("previewPrevButton");
}

function getPreviewNextButton() {
  return document.getElementById("previewNextButton");
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
    document.getElementById("grade").value = parsedPrompt.grade;
  }

  if (parsedPrompt.type === "math") {
    document.getElementById("operation").value = parsedPrompt.topic;
  }

  document.getElementById("difficulty").value = parsedPrompt.difficulty;
  ensureSelectOption(
    document.getElementById("questionCount"),
    parsedPrompt.count,
    `${parsedPrompt.count} Questions`
  );
  document.getElementById("questionCount").value = String(parsedPrompt.count);

  if (parsedPrompt.template) {
    document.getElementById("template").value = parsedPrompt.template;
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

function syncPreview() {
  if (state.currentQuestions.length === 0) {
    renderEmptyWorksheet(getWorksheetElement(), state.template);
    applyPreviewState();
    updatePreviewControls();
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
}

function renderSavedProjectsList() {
  document.getElementById("savedProjectsList").innerHTML = renderSavedProjects(
    state.savedProjects,
    state.currentProject?.id || null
  );
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
  state.currentQuestions = [];
  state.currentProject = null;
  state.currentRequest = null;
  state.currentWorksheetMeta = null;
  state.pagination = resetPagination(state.pagination, 0);

  syncPreview();
  renderSavedProjectsList();
  clearWorksheetStorage();
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
  state.savedProjects = saveProject(state.currentProject);
  renderSavedProjectsList();
  setStatusMessage("Project saved locally.", "success");
}

function removeProject(projectId) {
  state.savedProjects = deleteProject(projectId);

  if (state.currentProject?.id === projectId) {
    state.currentProject = null;
  }

  renderSavedProjectsList();
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

function hydrateLastWorksheet() {
  const savedWorksheet = loadWorksheet();

  if (!savedWorksheet?.questions?.length) {
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
    document.getElementById("promptInput").value = savedWorksheet.prompt;
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

  getPromptGenerateButton().addEventListener("click", () => {
    applyPrompt();
  });

  document.getElementById("promptInput").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      applyPrompt();
    }
  });

  document.querySelector(".example-prompts-list").addEventListener("click", (event) => {
    const examplePrompt = event.target.dataset.examplePrompt;

    if (!examplePrompt) {
      return;
    }

    document.getElementById("promptInput").value = examplePrompt;
    setStatusMessage("");
  });

  getSaveProjectButton().addEventListener("click", () => {
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
  hydrateLastWorksheet();
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
