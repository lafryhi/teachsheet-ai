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
import { listWorksheetSections } from "./core/math/sectionPlanner.js";
import {
  getScoreTarget,
  normalizeStudentName,
  sanitizeTeacherNotes
} from "./core/worksheetPresentation.js";
import { getWorksheetPageBreakdown } from "./core/worksheetLayout.js";
import { buildWorksheetInstruction, buildWorksheetModeLabel } from "./core/math/instructionsEngine.js";
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
  "teacherMode",
  "worksheetTitle",
  "schoolName",
  "teacherName",
  "studentName",
  "worksheetDate",
  "instructions",
  "scorePoints",
  "teacherNotes"
];

const SMART_DEFAULT_TRIGGER_FIELDS = new Set(["grade", "operation", "teacherMode"]);
const MANUAL_OVERRIDE_FIELDS = new Set(["difficulty", "questionCount", "teacherMode"]);

const GRADE_DEFAULTS = {
  "Grade 1": { difficulty: "easy", questionCount: 10, templateId: "kids-colorful" },
  "Grade 2": { difficulty: "medium", questionCount: 15, templateId: "classic-math" },
  "Grade 3": { difficulty: "medium", questionCount: 15, templateId: "classic-math" },
  "Grade 4": { difficulty: "medium", questionCount: 20, templateId: "classic-math" },
  "Grade 5": { difficulty: "medium", questionCount: 20, templateId: "classic-math" }
};

const TEACHER_MODE_DEFAULTS = {
  practice: { templateId: "classic-math", questionCount: null, difficulty: null },
  homework: { templateId: "homework-sheet", questionCount: 15, difficulty: "medium" },
  assessment: { templateId: "exam-style", questionCount: 20, difficulty: "medium" },
  remediation: { templateId: "classic-math", questionCount: 12, difficulty: "easy" },
  "fast-review": { templateId: "homework-sheet", questionCount: 12, difficulty: "medium" }
};

const WORKFLOW_PRESETS = {
  "daily-practice": {
    label: "Daily Practice",
    description: "Balanced classwork with steady progression.",
    teacherMode: "practice",
    defaultOperation: "addition"
  },
  homework: {
    label: "Homework",
    description: "Independent follow-up that stays clear on the page.",
    teacherMode: "homework",
    defaultOperation: "subtraction"
  },
  "quick-review": {
    label: "Quick Review",
    description: "Short mixed recall for warm-up or closing review.",
    teacherMode: "fast-review",
    forceOperation: "mixed"
  },
  assessment: {
    label: "Assessment",
    description: "Exam-style setup for clearer mastery checks.",
    teacherMode: "assessment",
    defaultOperation: "multiplication",
    preferVertical: true
  },
  remediation: {
    label: "Remediation",
    description: "Slower pacing with easier defaults and extra support.",
    teacherMode: "remediation",
    defaultOperation: "subtraction"
  },
  "mental-math-drill": {
    label: "Mental Math Drill",
    description: "Fast horizontal fluency for short review rounds.",
    teacherMode: "fast-review",
    defaultOperation: "mixed",
    focusPattern: "mental-math"
  }
};

const state = {
  activePresetId: null,
  currentLayoutBreakdown: null,
  currentQuestions: [],
  currentProject: null,
  currentRequest: null,
  currentUser: null,
  currentWorksheetMeta: null,
  isApplyingWorkflowUpdate: false,
  isGenerating: false,
  lastGeneratedAt: null,
  manualOverrides: {
    difficulty: false,
    questionCount: false,
    teacherMode: false,
    template: false
  },
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
    mode: "practice",
    layoutMode: "horizontal",
    teacherMode: "practice",
    focusPattern: null,
    template: "classic-math"
  };
}

function getActivePresetElement() {
  return getElement("workflowPresetGrid");
}

function getWorkflowSmartSummaryElement() {
  return getElement("workflowSmartSummary");
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

function formatGeneratedAtLabel(dateValue) {
  const date = new Date(dateValue || Date.now());

  if (Number.isNaN(date.getTime())) {
    return "Generated today";
  }

  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
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
  const topicLabel = request.focusPattern === "mental-math"
    ? "Mental Math"
    : capitalizeWords(request.topic);
  const mathLayoutLabel = request.type === "math" && request.layoutMode
    ? `${capitalizeWords(request.layoutMode)} ${topicLabel}`
    : topicLabel;

  if (request.type === "tracing" || request.type === "coloring") {
    return topicLabel;
  }

  return request.difficulty
    ? `${mathLayoutLabel} - ${capitalizeWords(request.difficulty)}`
    : mathLayoutLabel;
}

function getWorksheetModeLabel(request) {
  return buildWorksheetModeLabel(request);
}

function getWorksheetSubtitle(request) {
  if (!request) {
    return "";
  }

  return `${getSubjectLabel(request)} - ${getFocusLabel(request)}`;
}

function getWorksheetTrustSignals(request) {
  const signals = [
    "Ready for printing",
    "Optimized for A4",
    "Smart pagination enabled"
  ];

  if (request?.type === "math") {
    signals.push("Teacher mode active");
  }

  return signals;
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
    teacherMode: getElement("teacherMode").value,
    templateId: getElement("template").value,
    worksheetTitle: getElement("worksheetTitle").value.trim(),
    schoolName: getElement("schoolName").value.trim(),
    teacherName: getElement("teacherName").value.trim(),
    studentName: getElement("studentName").value.trim(),
    worksheetDate: getElement("worksheetDate").value,
    instructions: getElement("instructions").value.trim(),
    scorePoints: getElement("scorePoints").value.trim(),
    teacherNotes: getElement("teacherNotes").value.trim()
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

function getGradeNumber(gradeValue) {
  const match = String(gradeValue || "").match(/(\d+)/);
  return match ? Number.parseInt(match[1], 10) : 2;
}

function withWorkflowUpdate(callback) {
  state.isApplyingWorkflowUpdate = true;

  try {
    return callback();
  } finally {
    state.isApplyingWorkflowUpdate = false;
  }
}

function resetManualOverrides(fields = ["difficulty", "questionCount", "teacherMode", "template"]) {
  for (const field of fields) {
    if (field in state.manualOverrides) {
      state.manualOverrides[field] = false;
    }
  }
}

function getPromptExplicitness(promptText = "") {
  const normalizedPrompt = String(promptText).toLowerCase();

  return {
    grade: /\bgrade\s*[1-5]\b/.test(normalizedPrompt),
    operation: /\b(addition|subtraction|multiplication|division|mixed)\b/.test(normalizedPrompt),
    difficulty: /\b(easy|medium|hard)\b/.test(normalizedPrompt),
    questionCount: /\b\d+\s+questions?\b/.test(normalizedPrompt),
    teacherMode: /\b(practice|homework|assessment|remediation|fast review|review)\b/.test(normalizedPrompt),
    layoutMode: /\b(vertical|horizontal)\b/.test(normalizedPrompt),
    mentalMath: /\bmental math\b/.test(normalizedPrompt)
  };
}

function getTeacherModeDescription(teacherMode = "practice") {
  const descriptions = {
    practice: "steady skill building with balanced pacing",
    homework: "independent follow-up with clean printable structure",
    assessment: "clearer mastery checking with a more formal worksheet style",
    remediation: "simpler numbers, lighter pacing, and extra support",
    "fast-review": "short recall rounds and quick fluency practice"
  };

  return descriptions[teacherMode] || descriptions.practice;
}

function getSmartDefaultProfile({
  grade,
  operation,
  teacherMode,
  focusPattern = null,
  promptText = ""
}) {
  const normalizedTeacherMode = teacherMode || "practice";
  const gradeDefaults = GRADE_DEFAULTS[grade] || GRADE_DEFAULTS["Grade 2"];
  const teacherModeDefaults = TEACHER_MODE_DEFAULTS[normalizedTeacherMode] || TEACHER_MODE_DEFAULTS.practice;
  const gradeNumber = getGradeNumber(grade);
  const isMentalMath = focusPattern === "mental-math" || /\bmental math\b/i.test(promptText);
  let difficulty = teacherModeDefaults.difficulty || gradeDefaults.difficulty;
  let questionCount = teacherModeDefaults.questionCount || gradeDefaults.questionCount;
  let templateId = teacherModeDefaults.templateId || gradeDefaults.templateId;
  let layoutMode = "horizontal";

  if (gradeNumber === 1 && normalizedTeacherMode === "practice") {
    templateId = "kids-colorful";
    difficulty = "easy";
  }

  if (normalizedTeacherMode === "assessment") {
    difficulty = gradeNumber >= 5 ? "hard" : "medium";
    questionCount = gradeNumber >= 4 ? 20 : 15;
    templateId = "exam-style";
  }

  if (normalizedTeacherMode === "remediation") {
    difficulty = "easy";
    questionCount = gradeNumber <= 2 ? 10 : 12;
    templateId = gradeNumber === 1 ? "kids-colorful" : "classic-math";
  }

  if (normalizedTeacherMode === "homework") {
    questionCount = gradeNumber >= 4 ? 20 : 15;
    templateId = "homework-sheet";
  }

  if (normalizedTeacherMode === "fast-review") {
    difficulty = gradeNumber === 1 ? "easy" : "medium";
    questionCount = gradeNumber <= 2 ? 10 : 12;
    templateId = "homework-sheet";
  }

  if (operation === "mixed" && normalizedTeacherMode === "practice") {
    questionCount = Math.max(questionCount, gradeNumber >= 4 ? 20 : 15);
  }

  if (isMentalMath) {
    difficulty = gradeNumber === 1 ? "easy" : "medium";
    questionCount = gradeNumber <= 2 ? 10 : 12;
    templateId = "homework-sheet";
    layoutMode = "horizontal";
  }

  return {
    difficulty,
    questionCount,
    templateId,
    layoutMode,
    summary: `${capitalizeWords(normalizedTeacherMode.replace("-", " "))} mode with ${questionCount} questions, ${difficulty} difficulty, and the ${getTemplateById(templateId).name} template.`,
    hint: isMentalMath
      ? "Mental Math keeps the worksheet short and horizontal for faster fluency practice."
      : `${grade} defaults keep the setup practical for ${getTeacherModeDescription(normalizedTeacherMode)}.`
  };
}

function buildPresetPrompt(presetId, context = {}) {
  const preset = WORKFLOW_PRESETS[presetId];

  if (!preset) {
    return "";
  }

  const grade = context.grade || getElement("grade").value || "Grade 2";
  const gradeNumber = getGradeNumber(grade);
  const currentOperation = context.operation || getElement("operation").value || "addition";
  const operation = preset.forceOperation
    || (currentOperation === "mixed" && preset.defaultOperation ? preset.defaultOperation : currentOperation)
    || preset.defaultOperation
    || "addition";
  const teacherMode = preset.teacherMode || context.teacherMode || "practice";
  const smartProfile = getSmartDefaultProfile({
    grade,
    operation,
    teacherMode,
    focusPattern: preset.focusPattern || null
  });

  if (preset.focusPattern === "mental-math") {
    return `mental math fast review grade ${gradeNumber}`;
  }

  if (presetId === "assessment") {
    const layoutPrefix = preset.preferVertical ? "vertical " : "";
    return `grade ${gradeNumber} assessment ${layoutPrefix}${operation} ${smartProfile.questionCount} questions`;
  }

  if (presetId === "quick-review") {
    return `grade ${gradeNumber} mixed review worksheet`;
  }

  if (presetId === "remediation") {
    return `grade ${gradeNumber} remediation ${operation} worksheet`;
  }

  if (presetId === "homework") {
    return `grade ${gradeNumber} ${operation} homework ${smartProfile.questionCount} questions`;
  }

  return `grade ${gradeNumber} ${operation} practice ${smartProfile.questionCount} questions`;
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

function refreshWorksheetPreviewState() {
  if (state.currentQuestions.length === 0) {
    syncPreview();
    return;
  }

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

function getPromptInputGuidance() {
  return "Try a prompt like: grade 2 addition practice 20 questions";
}

function updateWorkflowPresetUI() {
  const presetGrid = getActivePresetElement();

  if (!presetGrid) {
    return;
  }

  presetGrid.querySelectorAll("[data-workflow-preset]").forEach((buttonElement) => {
    buttonElement.classList.toggle("is-active", buttonElement.dataset.workflowPreset === state.activePresetId);
  });
}

function updateWorkflowSmartSummary() {
  const summaryElement = getWorkflowSmartSummaryElement();

  if (!summaryElement) {
    return;
  }

  const formValues = getFormValues();
  const promptText = getPromptValue();
  const hasPrompt = promptText && hasRecognizedWorksheetPrompt(promptText);
  const parsedPrompt = hasPrompt
    ? { ...getSmartPromptDefaults(), ...parseWorksheetPrompt(promptText) }
    : null;
  const activeTeacherMode = parsedPrompt?.teacherMode || formValues.teacherMode || "practice";
  const activeOperation = parsedPrompt?.type === "math"
    ? parsedPrompt.topic
    : formValues.operation;
  const smartProfile = getSmartDefaultProfile({
    grade: parsedPrompt?.grade || formValues.grade,
    operation: activeOperation,
    teacherMode: activeTeacherMode,
    focusPattern: parsedPrompt?.focusPattern || null,
    promptText
  });
  const activePreset = state.activePresetId ? WORKFLOW_PRESETS[state.activePresetId] : null;
  const teacherModeLabel = capitalizeWords(activeTeacherMode.replace("-", " "));

  summaryElement.innerHTML = `
    <div class="workflow-smart-topline">
      <span class="workflow-smart-badge">${activePreset ? "Active Preset" : "Smart Defaults"}</span>
      <strong>${activePreset ? activePreset.label : `${teacherModeLabel} workflow`}</strong>
    </div>
    <p>${activePreset ? activePreset.description : smartProfile.summary}</p>
    <div class="workflow-smart-chips">
      <span>${formValues.grade}</span>
      <span>${teacherModeLabel}</span>
      <span>${capitalizeWords(formValues.difficulty)}</span>
      <span>${formValues.questionCount} questions</span>
      <span>${state.template.name}</span>
    </div>
    <small>${smartProfile.hint}</small>
  `;
  updateWorkflowPresetUI();
}

function applyTemplateSelection(templateId, options = {}) {
  const {
    manual = false,
    refreshExisting = true,
    persist = true
  } = options;

  state.template = getTemplateById(templateId);
  getElement("template").value = state.template.id;
  state.theme = state.template.theme;

  if (manual) {
    state.templateManuallySelected = true;
    state.manualOverrides.template = true;
  }

  if (state.currentRequest) {
    state.currentRequest.template = state.template.id;
  }

  if (refreshExisting && state.currentQuestions.length > 0) {
    refreshPagination(state.currentWorksheetMeta?.showAnswerKey !== false);
    state.currentWorksheetMeta = state.currentWorksheetMeta
      ? {
        ...state.currentWorksheetMeta,
        templateDescription: state.template.description
      }
      : state.currentWorksheetMeta;
    refreshWorksheetPreviewState();
  } else {
    syncPreview();
  }

  if (persist) {
    persistSettings();
  }

  updateActiveTemplateIndicator();
  updateWorkflowSmartSummary();
}

function applySmartTeacherDefaults(options = {}) {
  const {
    force = false,
    teacherMode = getElement("teacherMode").value,
    promptText = getPromptValue(),
    focusPattern = null
  } = options;
  const formValues = getFormValues();
  const smartProfile = getSmartDefaultProfile({
    grade: formValues.grade,
    operation: formValues.operation,
    teacherMode,
    focusPattern,
    promptText
  });
  let changed = false;

  withWorkflowUpdate(() => {
    if (force || !state.manualOverrides.difficulty) {
      if (getElement("difficulty").value !== smartProfile.difficulty) {
        getElement("difficulty").value = smartProfile.difficulty;
        changed = true;
      }
    }

    if (force || !state.manualOverrides.questionCount) {
      ensureSelectOption(
        getElement("questionCount"),
        smartProfile.questionCount,
        `${smartProfile.questionCount} Questions`
      );

      if (getElement("questionCount").value !== String(smartProfile.questionCount)) {
        getElement("questionCount").value = String(smartProfile.questionCount);
        changed = true;
      }
    }
  });

  if ((force || !state.manualOverrides.template) && state.template.id !== smartProfile.templateId) {
    state.templateManuallySelected = false;
    applyTemplateSelection(smartProfile.templateId, {
      manual: false,
      refreshExisting: true,
      persist: false
    });
    changed = true;
  } else {
    updateWorkflowSmartSummary();
  }

  return changed;
}

async function applyWorkflowPreset(presetId, options = {}) {
  if (state.isGenerating) {
    return;
  }

  const preset = WORKFLOW_PRESETS[presetId];

  if (!preset) {
    return;
  }

  const currentGrade = getElement("grade").value || "Grade 2";
  const currentOperation = getElement("operation").value || preset.defaultOperation || "addition";
  const resolvedOperation = preset.forceOperation
    || (currentOperation === "mixed" && preset.defaultOperation ? preset.defaultOperation : currentOperation)
    || "addition";
  const promptText = buildPresetPrompt(presetId, {
    grade: currentGrade,
    operation: resolvedOperation,
    teacherMode: preset.teacherMode
  });

  withWorkflowUpdate(() => {
    state.activePresetId = presetId;
    resetManualOverrides();
    getElement("teacherMode").value = preset.teacherMode;
    getElement("operation").value = resolvedOperation;
    getElement("promptInput").value = promptText;
  });

  state.templateManuallySelected = false;
  applySmartTeacherDefaults({
    force: true,
    teacherMode: preset.teacherMode,
    promptText,
    focusPattern: preset.focusPattern || null
  });
  persistSettings({ activePresetId: presetId });
  updateWorkflowSmartSummary();
  setStatusMessage(`${preset.label} preset applied. Generate now or adjust the details first.`, "success");

  if (options.generate) {
    await generateWorksheet();
  }
}

function getDemoPresetFromTrigger(triggerElement) {
  const demoButton = triggerElement?.closest?.("[data-demo-prompt]");

  if (!demoButton) {
    return null;
  }

  return {
    prompt: demoButton.dataset.demoPrompt || "",
    templateId: demoButton.dataset.demoTemplate || getDefaultTemplate().id,
    teacherMode: demoButton.dataset.demoMode || "practice"
  };
}

function applyDemoPresetToInterface(demoPreset) {
  if (!demoPreset) {
    return;
  }

  withWorkflowUpdate(() => {
    state.activePresetId = null;
    resetManualOverrides();
    getElement("promptInput").value = demoPreset.prompt;
    getElement("teacherMode").value = demoPreset.teacherMode;
  });
  state.templateManuallySelected = false;
  applyTemplateSelection(demoPreset.templateId, {
    manual: false,
    refreshExisting: true,
    persist: false
  });
  applySmartTeacherDefaults({
    force: true,
    teacherMode: demoPreset.teacherMode,
    promptText: demoPreset.prompt
  });
  persistSettings();
}

async function runDemoPreset(demoPreset) {
  if (!demoPreset || state.isGenerating) {
    return;
  }

  applyDemoPresetToInterface(demoPreset);
  getElement("app").scrollIntoView({ behavior: "smooth", block: "start" });
  setStatusMessage("Loading a demo worksheet preset for preview...", "loading");
  await waitForPaint();
  await generateWorksheet();
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
    mode: "practice",
    layoutMode: "horizontal",
    teacherMode: formValues.teacherMode || "practice",
    focusPattern: null,
    template: formValues.templateId
  };
}

function getResolvedWorksheetIdentity(formValues, request, worksheetTitleFallback = null, smartInstructions = "") {
  return {
    worksheetTitle: formValues.worksheetTitle || worksheetTitleFallback || getWorksheetTitle(request.type),
    schoolName: formValues.schoolName,
    teacherName: formValues.teacherName,
    studentName: normalizeStudentName(formValues.studentName),
    worksheetDate: formValues.worksheetDate,
    instructions: formValues.instructions || smartInstructions,
    scorePoints: getScoreTarget(formValues.scorePoints),
    teacherNotes: sanitizeTeacherNotes(formValues.teacherNotes)
  };
}

function getCurrentWorksheetBreakdown(showAnswerKey = state.currentWorksheetMeta?.showAnswerKey !== false) {
  const formValues = getFormValues();
  const fallbackRequest = state.currentRequest || buildMathRequestFromFormValues(formValues);
  const identity = state.currentWorksheetMeta?.identity || getResolvedWorksheetIdentity(
    formValues,
    fallbackRequest,
    state.currentWorksheetMeta?.worksheetTitle || null,
    buildWorksheetInstruction(fallbackRequest)
  );

  return getWorksheetPageBreakdown({
    questions: state.currentQuestions,
    totalQuestions: state.currentQuestions.length,
    questionsPerPage: state.template.questionsPerPage,
    template: state.template,
    showAnswerKey,
    layoutContext: {
      grade: fallbackRequest.grade || formValues.grade,
      subjectLabel: state.currentWorksheetMeta?.subjectLabel || getSubjectLabel(fallbackRequest),
      focusLabel: state.currentWorksheetMeta?.focusLabel || getFocusLabel(fallbackRequest),
      worksheetModeLabel: state.currentWorksheetMeta?.worksheetModeLabel || getWorksheetModeLabel(fallbackRequest),
      worksheetTitle: state.currentWorksheetMeta?.worksheetTitle || identity.worksheetTitle,
      identity,
      requestType: fallbackRequest.type || "math"
    }
  });
}

function refreshPagination(showAnswerKey = state.currentWorksheetMeta?.showAnswerKey !== false) {
  state.currentLayoutBreakdown = getCurrentWorksheetBreakdown(showAnswerKey);
  state.pagination = resetPagination(
    state.pagination,
    state.currentQuestions.length,
    state.template.questionsPerPage,
    0,
    state.currentLayoutBreakdown.totalPages
  );
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

  withWorkflowUpdate(() => {
    if (parsedPrompt.grade) {
      getElement("grade").value = parsedPrompt.grade;
    }

    if (parsedPrompt.type === "math") {
      getElement("operation").value = parsedPrompt.topic;
    }

    getElement("difficulty").value = parsedPrompt.difficulty;
    ensureSelectOption(getElement("questionCount"), parsedPrompt.count, `${parsedPrompt.count} Questions`);
    getElement("questionCount").value = String(parsedPrompt.count);
    getElement("teacherMode").value = parsedPrompt.teacherMode || "practice";
  });

  if (applyTemplate && parsedPrompt.template) {
    state.templateManuallySelected = false;
    applyTemplateSelection(parsedPrompt.template, {
      manual: false,
      refreshExisting: true,
      persist: false
    });
  }

  updateWorkflowSmartSummary();
}

function getWorksheetRequest() {
  const promptValue = getPromptValue();
  const selectedTemplateId = getSelectedTemplateId();
  const formValues = getFormValues();

  if (promptValue && hasRecognizedWorksheetPrompt(promptValue)) {
    const promptExplicitness = getPromptExplicitness(promptValue);
    const parsedPrompt = {
      ...getSmartPromptDefaults(),
      ...parseWorksheetPrompt(promptValue)
    };
    const smartProfile = getSmartDefaultProfile({
      grade: promptExplicitness.grade ? parsedPrompt.grade : formValues.grade,
      operation: parsedPrompt.type === "math"
        ? (promptExplicitness.operation ? parsedPrompt.topic : formValues.operation)
        : parsedPrompt.topic,
      teacherMode: promptExplicitness.teacherMode ? parsedPrompt.teacherMode : formValues.teacherMode,
      focusPattern: parsedPrompt.focusPattern,
      promptText: promptValue
    });
    const resolvedRequest = {
      ...parsedPrompt,
      grade: promptExplicitness.grade ? parsedPrompt.grade : formValues.grade,
      topic: parsedPrompt.type === "math"
        ? (promptExplicitness.operation ? parsedPrompt.topic : formValues.operation)
        : parsedPrompt.topic,
      difficulty: promptExplicitness.difficulty
        ? parsedPrompt.difficulty
        : (state.manualOverrides.difficulty ? formValues.difficulty : smartProfile.difficulty),
      count: promptExplicitness.questionCount
        ? parsedPrompt.count
        : (state.manualOverrides.questionCount ? formValues.questionCount : smartProfile.questionCount),
      teacherMode: promptExplicitness.teacherMode
        ? parsedPrompt.teacherMode
        : formValues.teacherMode,
      layoutMode: promptExplicitness.layoutMode
        ? parsedPrompt.layoutMode
        : smartProfile.layoutMode,
      template: state.templateManuallySelected
        ? selectedTemplateId
        : (parsedPrompt.templateExplicit
          ? parsedPrompt.template
          : (state.manualOverrides.template ? selectedTemplateId : smartProfile.templateId))
    };

    state.activePresetId = null;
    applyParsedPromptSettings(resolvedRequest, {
      applyTemplate: !state.templateManuallySelected
    });
    return resolvedRequest;
  }

  return buildMathRequestFromFormValues(formValues);
}

function getWorksheetMeta(request, generatorResult) {
  const formValues = getFormValues();
  const defaultTitle = getWorksheetTitle(request.type);
  const smartInstructions = generatorResult.instructions || buildWorksheetInstruction(request);
  const worksheetModeLabel = getWorksheetModeLabel(request);

  return {
    worksheetTitle: formValues.worksheetTitle || defaultTitle,
    subjectLabel: getSubjectLabel(request),
    focusLabel: getFocusLabel(request),
    worksheetSubtitle: getWorksheetSubtitle(request),
    worksheetModeLabel,
    difficultyLabel: request?.difficulty ? capitalizeWords(request.difficulty) : "",
    generatedAtLabel: formatGeneratedAtLabel(state.lastGeneratedAt),
    trustSignals: getWorksheetTrustSignals(request),
    showAnswerKey: generatorResult.showAnswerKey !== false,
    templateDescription: state.template.description,
    sections: generatorResult.sections || listWorksheetSections(state.currentQuestions),
    identity: getResolvedWorksheetIdentity(formValues, request, defaultTitle, smartInstructions)
  };
}

function persistSettings(partialSettings = {}) {
  const formValues = getFormValues();

  saveSettings({
    grade: formValues.grade,
    operation: formValues.operation,
    difficulty: formValues.difficulty,
    questionCount: formValues.questionCount,
    teacherMode: formValues.teacherMode,
    worksheetTitle: formValues.worksheetTitle,
    schoolName: formValues.schoolName,
    teacherName: formValues.teacherName,
    templateId: state.template.id,
    studentName: formValues.studentName,
    worksheetDate: formValues.worksheetDate,
    instructions: formValues.instructions,
    scorePoints: formValues.scorePoints,
    teacherNotes: formValues.teacherNotes,
    activePresetId: state.activePresetId,
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
  state.currentLayoutBreakdown = null;
  state.currentQuestions = [];
  state.currentProject = null;
  state.currentRequest = null;
  state.currentWorksheetMeta = null;
  state.lastGeneratedAt = null;
  state.pagination = resetPagination(state.pagination, 0);
}

function loadProjectIntoInterface(project) {
  withWorkflowUpdate(() => {
    state.activePresetId = null;
    resetManualOverrides();
    getElement("promptInput").value = project.prompt || "";
    getElement("grade").value = project.settings.grade;
    getElement("operation").value = project.settings.operation;
    getElement("difficulty").value = project.settings.difficulty;
    getElement("teacherMode").value = project.settings.teacherMode || "practice";
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
    getElement("teacherNotes").value = project.settings.teacherNotes || "";
  });
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
    teacherMode: project.settings.teacherMode || "practice",
    templateId: project.template,
    worksheetTitle: project.settings.worksheetTitle || "",
    schoolName: project.settings.schoolName || "",
    teacherName: project.settings.teacherName || "",
    studentName: project.settings.studentName || "",
    worksheetDate: project.settings.worksheetDate || "",
    instructions: project.settings.instructions || "",
    scorePoints: project.settings.scorePoints || "",
    teacherNotes: project.settings.teacherNotes || ""
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
    updateWorkflowSmartSummary();
    return;
  }

  const formValues = getFormValues();
  const showAnswerKey = state.currentWorksheetMeta?.showAnswerKey !== false;
  const breakdown = state.currentLayoutBreakdown || getCurrentWorksheetBreakdown(showAnswerKey);
  const isAnswerPage = showAnswerKey && state.pagination.currentPage > breakdown.questionPages;
  const pageQuestions = isAnswerPage
    ? []
    : (breakdown.questionPagesMap[state.pagination.currentPage - 1] || []);
  const answerPageIndex = isAnswerPage ? state.pagination.currentPage - breakdown.questionPages - 1 : 0;
  const answerPageQuestions = isAnswerPage
    ? (breakdown.answerPagesMap?.[answerPageIndex] || [])
    : [];
  const answerQuestions = isAnswerPage
    ? answerPageQuestions.map((question) => ({
      ...question,
      answerIndex: question.sequenceIndex || (state.currentQuestions.indexOf(question) + 1)
    }))
    : [];

  renderWorksheetPreview({
    worksheetElement: getWorksheetElement(),
    grade: state.currentRequest?.grade || formValues.grade,
    subjectLabel: state.currentWorksheetMeta?.subjectLabel || "Math",
    focusLabel: state.currentWorksheetMeta?.focusLabel || "Addition - Medium",
    worksheetSubtitle: state.currentWorksheetMeta?.worksheetSubtitle || getWorksheetSubtitle(state.currentRequest),
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
    worksheetModeLabel: state.currentWorksheetMeta?.worksheetModeLabel || "",
    difficultyLabel: state.currentWorksheetMeta?.difficultyLabel || capitalizeWords(state.currentRequest?.difficulty || ""),
    generatedAtLabel: state.currentWorksheetMeta?.generatedAtLabel || formatGeneratedAtLabel(state.lastGeneratedAt),
    trustSignals: state.currentWorksheetMeta?.trustSignals || getWorksheetTrustSignals(state.currentRequest),
    worksheetSections: state.currentWorksheetMeta?.sections || [],
    identity: state.currentWorksheetMeta?.identity || getResolvedWorksheetIdentity(
      formValues,
      state.currentRequest,
      null,
      buildWorksheetInstruction(state.currentRequest || {})
    ),
    requestType: state.currentRequest?.type || "math",
    templateDescription: state.currentWorksheetMeta?.templateDescription || state.template.description
  });

  applyPreviewState();
  updateActiveTemplateIndicator();
  updatePreviewControls();
  renderDashboardSection();
  updateWorkflowSmartSummary();
}

function applyStoredWorksheet(savedWorksheet) {
  if (!savedWorksheet?.questions?.length) {
    resetWorksheetState();
    return;
  }

  state.activePresetId = null;
  state.template = getTemplateById(savedWorksheet.templateId || state.template.id);
  state.templateManuallySelected = true;
  state.manualOverrides.template = true;
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
  state.lastGeneratedAt = worksheetProject?.generatedAt || worksheetProject?.createdAt || null;
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
  refreshPagination(state.currentWorksheetMeta.showAnswerKey);
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
  refreshPagination(state.currentWorksheetMeta.showAnswerKey);
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
    setStatusMessage("Analyzing your prompt and worksheet settings...", "loading");
    await waitForPaint();
    const worksheetRequest = getWorksheetRequest();
    setStatusMessage("Building sections, answer key, and printable pages...", "loading");
    await waitForPaint();
    buildWorksheetFromRequest(worksheetRequest);
    setStatusMessage("Worksheet ready for preview and printing.", "success");
  } catch (error) {
    console.error(error);
    setStatusMessage("We couldn't generate the worksheet. Please simplify your prompt or try another example.", "error");
  } finally {
    setGeneratingState(false);
  }
}

function clearWorksheet() {
  clearStatusMessageTimer();
  resetWorksheetState();
  state.activePresetId = null;
  resetManualOverrides();
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

  if (!promptText) {
    setStatusMessage("Start with a short prompt or choose a preset first.", "error");
    getElement("promptInput").focus();
    return;
  }

  if (!hasRecognizedWorksheetPrompt(promptText)) {
    setStatusMessage(`We couldn't read that prompt yet. ${getPromptInputGuidance()}`, "error");
    getElement("promptInput").focus();
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
  state.activePresetId = null;
  state.theme = state.template.theme;
  state.currentQuestions = Array.isArray(project.questions) ? project.questions : [];
  state.currentRequest = getRequestFromProject(project);
  state.lastGeneratedAt = project.generatedAt || project.createdAt || null;
  state.currentWorksheetMeta = getWorksheetMeta(state.currentRequest, {
    showAnswerKey: !["tracing", "coloring"].includes(state.currentRequest.type)
  });
  refreshPagination(state.currentWorksheetMeta.showAnswerKey);
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
    setStatusMessage("Generate a worksheet first, then save it as a project.", "error");
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
    setStatusMessage("Generate a worksheet first, then download the printable PDF.", "error");
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
    worksheetSubtitle: state.currentWorksheetMeta?.worksheetSubtitle || getWorksheetSubtitle(state.currentRequest),
    worksheetModeLabel: state.currentWorksheetMeta?.worksheetModeLabel || "",
    difficultyLabel: state.currentWorksheetMeta?.difficultyLabel || capitalizeWords(state.currentRequest?.difficulty || ""),
    generatedAtLabel: state.currentWorksheetMeta?.generatedAtLabel || formatGeneratedAtLabel(state.lastGeneratedAt),
    trustSignals: state.currentWorksheetMeta?.trustSignals || getWorksheetTrustSignals(state.currentRequest),
    showAnswerKey: state.currentWorksheetMeta?.showAnswerKey !== false,
    identity: state.currentWorksheetMeta?.identity || getResolvedWorksheetIdentity(
      getFormValues(),
      state.currentRequest,
      null,
      buildWorksheetInstruction(state.currentRequest || {})
    )
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
    updateWorkflowSmartSummary();
    return;
  }

  withWorkflowUpdate(() => {
    for (const fieldId of PERSISTED_FIELD_IDS) {
      if (savedSettings[fieldId] !== undefined && savedSettings[fieldId] !== null) {
        getElement(fieldId).value = String(savedSettings[fieldId]);
      }
    }
  });

  state.template = getTemplateById(savedSettings.templateId);
  state.templateManuallySelected = true;
  state.manualOverrides.template = true;
  state.activePresetId = savedSettings.activePresetId || null;
  getElement("template").value = state.template.id;
  state.theme = getTheme(savedSettings.theme).id;
  state.zoom = normalizeZoomValue(savedSettings.zoom ?? 100);
  updateActiveTemplateIndicator();
  updateWorkflowSmartSummary();
}

function bindFormPersistence() {
  for (const fieldId of PERSISTED_FIELD_IDS) {
    getElement(fieldId).addEventListener("change", () => {
      if (!state.isApplyingWorkflowUpdate && MANUAL_OVERRIDE_FIELDS.has(fieldId)) {
        state.manualOverrides[fieldId] = true;
        state.activePresetId = null;
      }

      if (!state.isApplyingWorkflowUpdate && SMART_DEFAULT_TRIGGER_FIELDS.has(fieldId)) {
        applySmartTeacherDefaults({ teacherMode: getElement("teacherMode").value });
      }

      persistSettings();
      refreshWorksheetPreviewState();
      updateWorkflowSmartSummary();
    });
  }

  getElement("template").addEventListener("change", (event) => {
    if (!state.isApplyingWorkflowUpdate) {
      state.activePresetId = null;
    }

    applyTemplateSelection(event.target.value, {
      manual: !state.isApplyingWorkflowUpdate,
      refreshExisting: true,
      persist: true
    });
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

    if (!state.isApplyingWorkflowUpdate) {
      state.activePresetId = null;
      updateWorkflowSmartSummary();
    }
  });

  document.querySelector(".example-prompts-list").addEventListener("click", (event) => {
    const examplePrompt = event.target.dataset.examplePrompt;

    if (!examplePrompt) {
      return;
    }

    getElement("promptInput").value = examplePrompt;
    state.activePresetId = null;
    updateWorkflowSmartSummary();
    setStatusMessage("Example prompt loaded. Generate it now or adjust the teacher mode first.", "success");
  });

  const workflowPresetGrid = getActivePresetElement();
  if (workflowPresetGrid) {
    workflowPresetGrid.addEventListener("click", async (event) => {
      const presetId = event.target.closest("[data-workflow-preset]")?.dataset.workflowPreset;

      if (!presetId) {
        return;
      }

      await applyWorkflowPreset(presetId);
      getElement("generateButton").focus();
    });
  }

  const demoGallery = document.querySelector(".demo-gallery-grid");
  if (demoGallery) {
    demoGallery.addEventListener("click", async (event) => {
      const demoPreset = getDemoPresetFromTrigger(event.target);

      if (!demoPreset) {
        return;
      }

      await runDemoPreset(demoPreset);
    });
  }

  const generateDemoButton = getElement("generateDemoButton");
  if (generateDemoButton) {
    generateDemoButton.addEventListener("click", async (event) => {
      const demoPreset = getDemoPresetFromTrigger(event.target);
      await runDemoPreset(demoPreset);
    });
  }

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
  updateActiveTemplateIndicator();
  updateWorkflowSmartSummary();
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
