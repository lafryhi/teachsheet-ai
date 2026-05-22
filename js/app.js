import {
  createPaginationState,
  nextPage,
  previousPage,
  resetPagination
} from "./core/pagination.js";
import {
  deleteProject,
  getGuestScope,
  loadGlobalSchoolSettings,
  loadProjects,
  loadSettings,
  loadWorksheet,
  saveProject,
  saveGlobalSchoolSettings,
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
  getLocalizedQuestionDisplayText,
  normalizeStudentName,
  sanitizeTeacherNotes
} from "./core/worksheetPresentation.js";
import { getWorksheetPageBreakdown } from "./core/worksheetLayout.js";
import { sanitizeWorksheetQuestions } from "./core/questionValidation.js";
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
import {
  DEFAULT_LANGUAGE,
  getLocalizedDemoPreset,
  getLocalizedDifficultyLabel,
  getLocalizedFocusLabel,
  getLocalizedGradeLabel,
  getLocalizedOnboardingExamplePrompt,
  getLocalizedOperationLabel,
  getLocalizedPresetContent,
  getLocalizedPromptExamples,
  getLocalizedSubjectLabel,
  getNaturalFrenchWorksheetInstruction,
  getLocalizedTeacherModeLabel,
  getLocalizedWorksheetModeLabel,
  getLocalizedWorksheetTitle,
  loadLanguagePreference,
  localizeQuestionCountLabel,
  localizeDefaultWorksheetInstruction,
  localizeGeneratedAtLabel,
  localizeSectionInstruction,
  localizeSectionLabel,
  localizeTrustSignals,
  normalizeLanguage,
  normalizeLocalizedPrompt,
  persistLanguagePreference,
  t
} from "./ui/language.js";
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
  "subject",
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

const SMART_DEFAULT_TRIGGER_FIELDS = new Set(["subject", "grade", "operation", "teacherMode"]);
const MANUAL_OVERRIDE_FIELDS = new Set(["difficulty", "questionCount", "teacherMode"]);
const GLOBAL_SCHOOL_LOGO_MAX_BYTES = 800 * 1024;

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

const CLASSROOM_EXAMPLES = [
  {
    id: "english-addition",
    previewLanguage: "en",
    prompts: {
      en: "grade 2 addition practice 20 questions",
      fr: "addition CE2"
    },
    templateId: "kids-colorful",
    teacherMode: "practice"
  },
  {
    id: "french-mental-math",
    previewLanguage: "fr",
    prompts: {
      en: "mental math fast review grade 2",
      fr: "calcul mental CE1"
    },
    templateId: "classic-math",
    teacherMode: "fast-review"
  },
  {
    id: "french-multiplication",
    previewLanguage: "fr",
    prompts: {
      en: "grade 4 multiplication practice",
      fr: "multiplication CM1"
    },
    templateId: "classic-math",
    teacherMode: "practice"
  },
  {
    id: "remediation-support",
    previewLanguage: "en",
    prompts: {
      en: "grade 3 remediation subtraction worksheet",
      fr: "fiche de remediation soustraction CE2"
    },
    templateId: "homework-sheet",
    teacherMode: "remediation"
  },
  {
    id: "french-assessment",
    previewLanguage: "fr",
    prompts: {
      en: "grade 5 assessment division",
      fr: "evaluation division CM2"
    },
    templateId: "exam-style",
    teacherMode: "assessment"
  },
  {
    id: "mixed-review",
    previewLanguage: "en",
    prompts: {
      en: "grade 5 mixed review worksheet",
      fr: "revision rapide CM1"
    },
    templateId: "classic-math",
    teacherMode: "homework"
  }
];

const CLASSROOM_EXAMPLE_COPY = {
  en: {
    "english-addition": {
      title: "English Addition Practice",
      body: "A classroom-friendly addition worksheet with clear pacing, answer space, and printable structure."
    },
    "french-mental-math": {
      title: "French Mental Math",
      body: "A quick oral and written fluency activity that works well for warm-up rounds and short revision."
    },
    "french-multiplication": {
      title: "French Multiplication Practice",
      body: "A structured multiplication page for primary classrooms, with clean line spacing and real A4 pacing."
    },
    "remediation-support": {
      title: "Remediation Support",
      body: "A slower subtraction worksheet with clearer steps and gentler progression for targeted support."
    },
    "french-assessment": {
      title: "French Assessment Example",
      body: "A sharper division assessment layout that looks ready for checking, printing, and classroom correction."
    },
    "mixed-review": {
      title: "Mixed Review Worksheet",
      body: "A mixed operations worksheet that feels like real revision material instead of a generic generator output."
    }
  },
  fr: {
    "english-addition": {
      title: "Exemple d'addition",
      body: "Une fiche d'addition claire, progressive et imprimable pour une utilisation immediate en classe."
    },
    "french-mental-math": {
      title: "Calcul mental",
      body: "Une activite courte pour l'echauffement, la revision rapide et la fluidite mentale en primaire."
    },
    "french-multiplication": {
      title: "Multiplication en classe",
      body: "Une fiche de multiplication propre et lisible, avec une mise en page adaptee a l'impression A4."
    },
    "remediation-support": {
      title: "Exemple de remediation",
      body: "Une fiche de soustraction plus douce, avec une progression plus simple pour l'accompagnement cible."
    },
    "french-assessment": {
      title: "Exemple d'evaluation",
      body: "Une fiche d'evaluation en division qui semble deja prete pour la correction et l'impression."
    },
    "mixed-review": {
      title: "Revision des operations",
      body: "Une fiche melangee qui ressemble a un vrai support de revision pour la classe."
    }
  }
};

const ONBOARDING_STORAGE_KEY = "teachsheet-ai-onboarding-v1";
const state = {
  activePresetId: null,
  currentLayoutBreakdown: null,
  currentQuestions: [],
  currentProject: null,
  currentRequest: null,
  currentUser: null,
  currentWorksheetMeta: null,
  globalSchoolSettings: {
    schoolName: "",
    teacherName: "",
    schoolLogoDataUrl: "",
    schoolLogoName: "",
    defaultGrade: "",
    defaultSubject: ""
  },
  isApplyingWorkflowUpdate: false,
  isGenerating: false,
  lastGeneratedAt: null,
  language: DEFAULT_LANGUAGE,
  onboarding: {
    completed: false,
    dismissed: false
  },
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

function getLanguageSelect() {
  return getElement("languageSelect");
}

function getDashboardContainer() {
  return getElement("dashboardContainer");
}

function getGlobalSchoolNameInput() {
  return getElement("globalSchoolName");
}

function getGlobalTeacherNameInput() {
  return getElement("globalTeacherName");
}

function getGlobalSchoolLogoInput() {
  return getElement("globalSchoolLogo");
}

function getGlobalDefaultGradeSelect() {
  return getElement("globalDefaultGrade");
}

function getGlobalDefaultSubjectSelect() {
  return getElement("globalDefaultSubject");
}

function getGlobalSchoolLogoCard() {
  return getElement("globalSchoolLogoCard");
}

function getGlobalSchoolLogoPreview() {
  return getElement("globalSchoolLogoPreview");
}

function getGlobalSchoolLogoName() {
  return getElement("globalSchoolLogoName");
}

function getClearGlobalSchoolLogoButton() {
  return getElement("clearGlobalSchoolLogoButton");
}

function getResetGlobalSchoolSettingsButton() {
  return getElement("resetGlobalSchoolSettingsButton");
}

function getGlobalSchoolSettingsStatus() {
  return getElement("globalSchoolSettingsStatus");
}

function getActiveTemplateIndicator() {
  return getElement("activeTemplateIndicator");
}

function getOnboardingCard() {
  return getElement("teacherOnboardingCard");
}

function getClassroomExamplesContainer() {
  return getElement("classroomExamplesGrid");
}

function getDismissOnboardingButton() {
  return getElement("dismissOnboardingButton");
}

function getShowOnboardingButton() {
  return getElement("showOnboardingButton");
}

function getOnboardingDemoButton() {
  return getElement("onboardingDemoButton");
}

function getHeroDemoButton() {
  return getElement("heroDemoButton");
}

function getInstantDemoButton() {
  return getElement("instantDemoButton");
}

function getUseExamplePromptButton() {
  return getElement("useExamplePromptButton");
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

function getEmptyGlobalSchoolSettings() {
  return {
    schoolName: "",
    teacherName: "",
    schoolLogoDataUrl: "",
    schoolLogoName: "",
    defaultGrade: "",
    defaultSubject: ""
  };
}

function normalizeGlobalSchoolSettings(settings = {}) {
  const base = getEmptyGlobalSchoolSettings();
  const source = settings && typeof settings === "object" ? settings : {};

  return {
    ...base,
    schoolName: String(source.schoolName || "").trim(),
    teacherName: String(source.teacherName || "").trim(),
    schoolLogoDataUrl: /^data:image\//.test(String(source.schoolLogoDataUrl || ""))
      ? String(source.schoolLogoDataUrl)
      : "",
    schoolLogoName: String(source.schoolLogoName || "").trim(),
    defaultGrade: String(source.defaultGrade || ""),
    defaultSubject: String(source.defaultSubject || "")
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

function readOnboardingState() {
  try {
    const rawState = window.localStorage.getItem(ONBOARDING_STORAGE_KEY);

    if (!rawState) {
      return { completed: false, dismissed: false };
    }

    const parsedState = JSON.parse(rawState);
    return {
      completed: Boolean(parsedState?.completed),
      dismissed: Boolean(parsedState?.dismissed)
    };
  } catch (error) {
    return { completed: false, dismissed: false };
  }
}

function persistOnboardingState() {
  try {
    window.localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(state.onboarding));
  } catch (error) {
    return;
  }
}

function applyStaticTranslations() {
  document.documentElement.lang = state.language === "fr" ? "fr" : "en";

  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.dataset.i18n;
    element.textContent = t(state.language, key);
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    const key = element.dataset.i18nPlaceholder;
    element.setAttribute("placeholder", t(state.language, key));
  });
}

function updateSelectOptionLabels() {
  const gradeSelect = getElement("grade");
  [...gradeSelect.options].forEach((option) => {
    option.textContent = getLocalizedGradeLabel(state.language, option.value);
  });

  const operationLabels = {
    addition: "operationAddition",
    subtraction: "operationSubtraction",
    multiplication: "operationMultiplication",
    division: "operationDivision",
    mixed: "operationMixed"
  };
  [...getElement("operation").options].forEach((option) => {
    option.textContent = t(state.language, operationLabels[option.value] || option.value);
  });

  const difficultyLabels = {
    easy: "difficultyEasy",
    medium: "difficultyMedium",
    hard: "difficultyHard"
  };
  [...getElement("difficulty").options].forEach((option) => {
    option.textContent = t(state.language, difficultyLabels[option.value] || option.value);
  });

  [...getElement("teacherMode").options].forEach((option) => {
    option.textContent = getLocalizedTeacherModeLabel(state.language, option.value);
  });

  [...getElement("questionCount").options].forEach((option) => {
    const count = Number.parseInt(option.value, 10);
    option.textContent = localizeQuestionCountLabel(state.language, count);
  });
}

function renderWorkflowPresetCards() {
  const workflowPresetGrid = getActivePresetElement();

  if (!workflowPresetGrid) {
    return;
  }

  workflowPresetGrid.innerHTML = Object.entries(WORKFLOW_PRESETS).map(([presetId, preset]) => {
    const localizedPreset = getLocalizedPresetContent(state.language, presetId, preset);

    return `
      <button type="button" class="workflow-preset-card" data-workflow-preset="${presetId}">
        <strong>${localizedPreset.label}</strong>
        <span>${localizedPreset.description}</span>
      </button>
    `;
  }).join("");

  updateWorkflowPresetUI();
}

function renderExamplePromptChips() {
  const promptList = document.querySelector(".example-prompts-list");

  if (!promptList) {
    return;
  }

  const prompts = getLocalizedPromptExamples(state.language);
  promptList.innerHTML = prompts
    .map((prompt) => `<button type="button" class="example-prompt-chip" data-example-prompt="${prompt}">${prompt}</button>`)
    .join("");

  const promptTipExample = getElement("promptTipExampleValue");
  if (promptTipExample) {
    promptTipExample.textContent = prompts[2] || prompts[0] || "";
  }
}

function updateLocalizedDemoTriggers() {
  const demoPreset = getLocalizedDemoPreset(state.language);
  const demoButtons = document.querySelectorAll("[data-demo-localized=\"true\"]");

  demoButtons.forEach((buttonElement) => {
    buttonElement.dataset.demoPrompt = demoPreset.prompt;
    buttonElement.dataset.demoTemplate = demoPreset.templateId;
    buttonElement.dataset.demoMode = demoPreset.teacherMode;
  });
}

function updateLanguageSelector() {
  const languageSelect = getLanguageSelect();

  if (languageSelect) {
    languageSelect.value = state.language;
  }
}

function getClassroomExampleText(exampleId) {
  return CLASSROOM_EXAMPLE_COPY[state.language]?.[exampleId]
    || CLASSROOM_EXAMPLE_COPY.en[exampleId]
    || { title: "Worksheet Example", body: "Classroom-ready worksheet example." };
}

function getClassroomExampleLanguageLabel(exampleLanguage) {
  const isFrench = normalizeLanguage(exampleLanguage) === "fr";

  if (state.language === "fr") {
    return isFrench ? "Exemple francais" : "Exemple anglais";
  }

  return isFrench ? "French Example" : "English Example";
}

function createExampleIdentity(request, worksheetTitle, instructions = "") {
  return {
    worksheetTitle,
    schoolName: "",
    teacherName: "",
    studentName: "",
    worksheetDate: "",
    instructions,
    scorePoints: "",
    teacherNotes: ""
  };
}

function buildClassroomExampleRequest(example) {
  const exampleLanguage = normalizeLanguage(example.previewLanguage || "en");
  const promptText = normalizeLocalizedPrompt(
    example.prompts?.[exampleLanguage] || example.prompts?.en || "",
    exampleLanguage
  );
  const parsedPrompt = {
    ...getSmartPromptDefaults(),
    ...parseWorksheetPrompt(promptText)
  };
  const teacherMode = example.teacherMode || parsedPrompt.teacherMode || "practice";
  const smartProfile = getSmartDefaultProfile({
    grade: parsedPrompt.grade,
    operation: parsedPrompt.topic,
    teacherMode,
    focusPattern: parsedPrompt.focusPattern,
    promptText
  });

  return {
    ...parsedPrompt,
    language: exampleLanguage,
    difficulty: parsedPrompt.difficulty || smartProfile.difficulty,
    count: parsedPrompt.count || smartProfile.questionCount,
    teacherMode,
    layoutMode: parsedPrompt.layoutMode || smartProfile.layoutMode,
    template: example.templateId || parsedPrompt.template || smartProfile.templateId,
    templateId: example.templateId || parsedPrompt.template || smartProfile.templateId
  };
}

function renderClassroomExamples() {
  const container = getClassroomExamplesContainer();

  if (!container) {
    return;
  }

  container.innerHTML = CLASSROOM_EXAMPLES.map((example) => {
    const exampleLanguage = normalizeLanguage(example.previewLanguage || "en");
    const worksheetRequest = buildClassroomExampleRequest(example);
    const generator = GENERATORS[worksheetRequest.type] || generateMathWorksheet;
    const generatorResult = generator(worksheetRequest);
    const questions = sanitizeQuestionsForRequest(generatorResult.questions, worksheetRequest);
    const template = getTemplateById(worksheetRequest.templateId);
    const worksheetTitle = getLocalizedWorksheetTitle(exampleLanguage, worksheetRequest);
    const subjectLabel = getLocalizedSubjectLabel(exampleLanguage, worksheetRequest);
    const focusLabel = getLocalizedFocusLabel(exampleLanguage, worksheetRequest);
    const gradeLabel = getLocalizedGradeLabel(exampleLanguage, worksheetRequest.grade || "");
    const worksheetModeLabel = getLocalizedWorksheetModeLabel(exampleLanguage, worksheetRequest, buildWorksheetModeLabel(worksheetRequest));
    const difficultyLabel = getLocalizedDifficultyLabel(exampleLanguage, worksheetRequest.difficulty || "medium");
    const worksheetSubtitle = focusLabel && gradeLabel ? `${focusLabel}${exampleLanguage === "fr" ? " — " : " - "}${gradeLabel}` : gradeLabel;
    const identity = createExampleIdentity(
      worksheetRequest,
      worksheetTitle,
      exampleLanguage === "fr"
        ? getNaturalFrenchWorksheetInstruction(worksheetRequest)
        : localizeDefaultWorksheetInstruction(exampleLanguage, worksheetRequest)
    );
    const layoutBreakdown = getWorksheetPageBreakdown({
      questions,
      totalQuestions: questions.length,
      questionsPerPage: template.questionsPerPage,
      template,
      showAnswerKey: false,
      layoutContext: {
        grade: gradeLabel,
        subjectLabel,
        focusLabel,
        worksheetModeLabel,
        worksheetTitle,
        identity,
        requestType: worksheetRequest.type || "math",
        language: exampleLanguage
      }
    });
    const previewElement = document.createElement("div");
    previewElement.className = "worksheet classroom-example-worksheet";
    renderWorksheetPreview({
      worksheetElement: previewElement,
      grade: gradeLabel,
      subjectLabel,
      focusLabel,
      worksheetSubtitle,
      questions: layoutBreakdown.questionPagesMap[0] || questions.slice(0, 4),
      answerQuestions: [],
      currentPage: 1,
      totalPages: layoutBreakdown.totalPages,
      template,
      pageSize: template.questionsPerPage,
      showAnswerKey: false,
      pageKind: "questions",
      worksheetModeLabel,
      difficultyLabel,
      generatedAtLabel: "",
      trustSignals: [],
      identity,
      requestType: worksheetRequest.type,
      templateDescription: template.description,
      language: exampleLanguage
    });

    const localizedPrompt = example.prompts?.[state.language] || example.prompts?.en || example.prompts?.fr || "";
    const localizedCopy = getClassroomExampleText(example.id);
    const pageLabel = state.language === "fr"
      ? `${layoutBreakdown.totalPages} pages`
      : `${layoutBreakdown.totalPages} pages`;
    const questionLabel = localizeQuestionCountLabel(state.language, questions.length);
    const exampleLanguageLabel = getClassroomExampleLanguageLabel(exampleLanguage);
    const sampleQuestion = questions[0] ? getLocalizedQuestionDisplayText(questions[0], exampleLanguage).replace(/\s+/g, " ").trim() : "";

    return `
      <article class="classroom-example-card">
        <div class="classroom-example-topline">
          <span class="classroom-example-language">${exampleLanguageLabel}</span>
          <span class="classroom-example-template">${template.name}</span>
        </div>
        <div class="classroom-example-paper">${previewElement.outerHTML}</div>
        <div class="classroom-example-copy">
          <h3>${localizedCopy.title}</h3>
          <p>${localizedCopy.body}</p>
          <div class="classroom-example-meta">
            <span>${worksheetModeLabel}</span>
            <span>${questionLabel}</span>
            <span>${pageLabel}</span>
          </div>
          ${sampleQuestion ? `<p>${sampleQuestion}</p>` : ""}
          <div class="classroom-example-actions">
            <button
              type="button"
              class="demo-gallery-button classroom-example-button"
              data-demo-prompt="${localizedPrompt}"
              data-demo-template="${template.id}"
              data-demo-mode="${example.teacherMode || worksheetRequest.teacherMode || "practice"}"
            >${t(state.language, "classroomExampleGenerate")}</button>
            <button
              type="button"
              class="classroom-example-link"
              data-demo-prompt="${localizedPrompt}"
              data-demo-template="${template.id}"
              data-demo-mode="${example.teacherMode || worksheetRequest.teacherMode || "practice"}"
            >${t(state.language, "classroomExamplePreview")}</button>
          </div>
        </div>
      </article>
    `;
  }).join("");
}

function getNormalizedPromptText(promptText = getPromptValue()) {
  return normalizeLocalizedPrompt(promptText, state.language);
}

function applyLanguageUI() {
  applyStaticTranslations();
  updateSelectOptionLabels();
  updateLanguageSelector();
  renderWorkflowPresetCards();
  renderExamplePromptChips();
  updateLocalizedDemoTriggers();
  renderClassroomExamples();
  syncGlobalSchoolLogoCard();
}

function setLanguage(language, options = {}) {
  const {
    persist = true,
    refresh = true
  } = options;
  const nextLanguage = normalizeLanguage(language);

  if (state.language === nextLanguage && persist) {
    applyLanguageUI();
    return;
  }

  state.language = nextLanguage;

  if (persist) {
    persistLanguagePreference(nextLanguage);
  }

  applyLanguageUI();

  if (refresh) {
    updateActiveTemplateIndicator();
    updateWorkflowSmartSummary();
    renderSavedProjectsList();
    renderDashboardSection();
    syncPreview();
  }
}

function capitalizeWords(text = "") {
  return String(text)
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatGeneratedAtLabel(dateValue) {
  return localizeGeneratedAtLabel(state.language, dateValue);
}

function getWorksheetTitle(request) {
  return getLocalizedWorksheetTitle(state.language, request || "math");
}

function getSubjectLabel(request) {
  return getLocalizedSubjectLabel(state.language, request);
}

function getFocusLabel(request) {
  return getLocalizedFocusLabel(state.language, request);
}

function getWorksheetModeLabel(request) {
  return getLocalizedWorksheetModeLabel(state.language, request, buildWorksheetModeLabel(request));
}

function getWorksheetSubtitle(request) {
  if (!request) {
    return "";
  }

  if (request.type === "math") {
    const separator = normalizeLanguage(state.language) === "fr" ? " \u2014 " : " - ";
    return `${getFocusLabel(request)}${separator}${getLocalizedGradeLabel(state.language, request.grade || "")}`;
  }

  const separator = normalizeLanguage(state.language) === "fr" ? " \u2014 " : " - ";
  return `${getSubjectLabel(request)}${separator}${getFocusLabel(request)}`;
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

  return localizeTrustSignals(state.language, signals);
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
    subject: getElement("subject").value,
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

function getGlobalSchoolSettingsFormValues() {
  return normalizeGlobalSchoolSettings({
    schoolName: getGlobalSchoolNameInput()?.value || "",
    teacherName: getGlobalTeacherNameInput()?.value || "",
    schoolLogoDataUrl: state.globalSchoolSettings.schoolLogoDataUrl || "",
    schoolLogoName: state.globalSchoolSettings.schoolLogoName || "",
    defaultGrade: getGlobalDefaultGradeSelect()?.value || "",
    defaultSubject: getGlobalDefaultSubjectSelect()?.value || ""
  });
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

function sanitizeQuestionsForRequest(questions, request) {
  return sanitizeWorksheetQuestions(questions, request).questions;
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

function syncGlobalSchoolLogoCard() {
  const logoCard = getGlobalSchoolLogoCard();
  const logoPreview = getGlobalSchoolLogoPreview();
  const logoName = getGlobalSchoolLogoName();
  const logoDataUrl = state.globalSchoolSettings.schoolLogoDataUrl;

  if (!logoCard || !logoPreview || !logoName) {
    return;
  }

  const hasLogo = Boolean(logoDataUrl);
  logoCard.hidden = !hasLogo;

  if (!hasLogo) {
    logoPreview.removeAttribute("src");
    logoName.textContent = t(state.language, "schoolLogoStored");
    return;
  }

  logoPreview.src = logoDataUrl;
  logoName.textContent = state.globalSchoolSettings.schoolLogoName || t(state.language, "schoolLogoStored");
}

function applyGlobalSchoolSettingsToForm({
  forceIdentity = true,
  forceGrade = true,
  forceSubject = true,
  persist = false,
  refresh = false
} = {}) {
  const globalSettings = state.globalSchoolSettings;

  withWorkflowUpdate(() => {
    if (globalSettings.schoolName && (forceIdentity || !getElement("schoolName").value.trim())) {
      getElement("schoolName").value = globalSettings.schoolName;
    }

    if (globalSettings.teacherName && (forceIdentity || !getElement("teacherName").value.trim())) {
      getElement("teacherName").value = globalSettings.teacherName;
    }

    if (globalSettings.defaultGrade && (forceGrade || !getElement("grade").value)) {
      getElement("grade").value = globalSettings.defaultGrade;
    }

    if (globalSettings.defaultSubject && (forceSubject || !getElement("subject").value)) {
      getElement("subject").value = globalSettings.defaultSubject;
    }
  });

  updateSubjectWorkflowUI();

  if (persist) {
    persistSettings();
  }

  if (refresh) {
    refreshWorksheetPreviewState();
    updateWorkflowSmartSummary();
  }
}

function hydrateGlobalSchoolSettings() {
  state.globalSchoolSettings = normalizeGlobalSchoolSettings(loadGlobalSchoolSettings());

  withWorkflowUpdate(() => {
    getGlobalSchoolNameInput().value = state.globalSchoolSettings.schoolName;
    getGlobalTeacherNameInput().value = state.globalSchoolSettings.teacherName;
    getGlobalDefaultGradeSelect().value = state.globalSchoolSettings.defaultGrade;
    getGlobalDefaultSubjectSelect().value = state.globalSchoolSettings.defaultSubject;
  });

  syncGlobalSchoolLogoCard();
  applyGlobalSchoolSettingsToForm({
    forceIdentity: true,
    forceGrade: true,
    forceSubject: true,
    persist: true,
    refresh: false
  });
  updateWorkflowSmartSummary();
}

function persistGlobalSchoolSettings(options = {}) {
  state.globalSchoolSettings = getGlobalSchoolSettingsFormValues();
  saveGlobalSchoolSettings(state.globalSchoolSettings);
  syncGlobalSchoolLogoCard();
  applyGlobalSchoolSettingsToForm({
    forceIdentity: true,
    forceGrade: state.currentQuestions.length === 0,
    forceSubject: state.currentQuestions.length === 0,
    persist: options.persistForm !== false,
    refresh: options.refreshPreview !== false
  });

  if (getGlobalSchoolSettingsStatus()) {
    getGlobalSchoolSettingsStatus().textContent = t(state.language, "schoolSettingsSaved");
  }
}

function resetGlobalSchoolSettings() {
  state.globalSchoolSettings = getEmptyGlobalSchoolSettings();
  saveGlobalSchoolSettings(state.globalSchoolSettings);

  withWorkflowUpdate(() => {
    getGlobalSchoolNameInput().value = "";
    getGlobalTeacherNameInput().value = "";
    getGlobalDefaultGradeSelect().value = "";
    getGlobalDefaultSubjectSelect().value = "";
    if (getGlobalSchoolLogoInput()) {
      getGlobalSchoolLogoInput().value = "";
    }
  });

  syncGlobalSchoolLogoCard();

  if (getGlobalSchoolSettingsStatus()) {
    getGlobalSchoolSettingsStatus().textContent = t(state.language, "schoolSettingsReset");
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("File read failed"));
    reader.readAsDataURL(file);
  });
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
    return state.language === "fr"
      ? `calcul mental CE${Math.max(1, gradeNumber - 1)}`
      : `mental math fast review grade ${gradeNumber}`;
  }

  if (presetId === "assessment") {
    const layoutPrefix = preset.preferVertical ? "vertical " : "";
    return state.language === "fr"
      ? `évaluation ${operation} ${preset.preferVertical ? "verticale " : ""}${getLocalizedGradeLabel("fr", `Grade ${gradeNumber}`)}`
      : `grade ${gradeNumber} assessment ${layoutPrefix}${operation} ${smartProfile.questionCount} questions`;
  }

  if (presetId === "quick-review") {
    return state.language === "fr"
      ? `fiche de révision ${getLocalizedGradeLabel("fr", `Grade ${gradeNumber}`)}`
      : `grade ${gradeNumber} mixed review worksheet`;
  }

  if (presetId === "remediation") {
    return state.language === "fr"
      ? `remédiation ${operation} ${getLocalizedGradeLabel("fr", `Grade ${gradeNumber}`)}`
      : `grade ${gradeNumber} remediation ${operation} worksheet`;
  }

  if (presetId === "homework") {
    return state.language === "fr"
      ? `${operation} devoir ${getLocalizedGradeLabel("fr", `Grade ${gradeNumber}`)}`
      : `grade ${gradeNumber} ${operation} homework ${smartProfile.questionCount} questions`;
  }

  return state.language === "fr"
    ? `${operation} ${getLocalizedGradeLabel("fr", `Grade ${gradeNumber}`)}`
    : `grade ${gradeNumber} ${operation} practice ${smartProfile.questionCount} questions`;
}

function waitForPaint() {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      window.setTimeout(resolve, 120);
    });
  });
}

function shouldShowOnboarding() {
  return !state.onboarding.dismissed && !state.onboarding.completed;
}

function refreshOnboardingUI() {
  const onboardingCard = getOnboardingCard();
  const showOnboardingButton = getShowOnboardingButton();

  if (onboardingCard) {
    onboardingCard.hidden = !shouldShowOnboarding();
  }

  if (showOnboardingButton) {
    showOnboardingButton.hidden = shouldShowOnboarding();
  }
}

function completeOnboarding() {
  if (state.onboarding.completed) {
    return;
  }

  state.onboarding.completed = true;
  persistOnboardingState();
  refreshOnboardingUI();
}

function dismissOnboarding() {
  state.onboarding.dismissed = true;
  persistOnboardingState();
  refreshOnboardingUI();
}

function reopenOnboarding() {
  state.onboarding.dismissed = false;
  state.onboarding.completed = false;
  persistOnboardingState();
  refreshOnboardingUI();
}

function loadOnboardingExamplePrompt() {
  getElement("promptInput").value = getLocalizedOnboardingExamplePrompt(state.language);
  state.activePresetId = null;
  updateWorkflowSmartSummary();
  setStatusMessage(t(state.language, "onboardingExampleLoaded"), "success");
  getElement("promptInput").focus();
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
  return t(state.language, "promptGuidance");
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
  const normalizedPromptText = getNormalizedPromptText(promptText);
  const hasPrompt = normalizedPromptText && hasRecognizedWorksheetPrompt(normalizedPromptText);
  const parsedPrompt = hasPrompt
    ? { ...getSmartPromptDefaults(), ...parseWorksheetPrompt(normalizedPromptText) }
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
  const teacherModeLabel = getLocalizedTeacherModeLabel(state.language, activeTeacherMode);
  const activePresetContent = activePreset
    ? getLocalizedPresetContent(state.language, state.activePresetId, activePreset)
    : null;
  const summaryBody = activePresetContent
    ? activePresetContent.description
    : `${teacherModeLabel} · ${getLocalizedDifficultyLabel(state.language, formValues.difficulty)} · ${localizeQuestionCountLabel(state.language, formValues.questionCount)}`;
  const summaryHint = state.language === "fr"
    ? "Les réglages intelligents s’adaptent au niveau, au mode et au type d’activité."
    : "Smart defaults adapt the worksheet to the selected grade, mode, and activity type.";

  summaryElement.innerHTML = `
    <div class="workflow-smart-topline">
      <span class="workflow-smart-badge">${activePreset ? t(state.language, "activePreset") : t(state.language, "smartDefaults")}</span>
      <strong>${activePresetContent ? activePresetContent.label : t(state.language, "workflow", { label: teacherModeLabel })}</strong>
    </div>
    <p>${summaryBody}</p>
    <div class="workflow-smart-chips">
      <span>${getLocalizedGradeLabel(state.language, formValues.grade)}</span>
      <span>${teacherModeLabel}</span>
      <span>${getLocalizedDifficultyLabel(state.language, formValues.difficulty)}</span>
      <span>${localizeQuestionCountLabel(state.language, formValues.questionCount)}</span>
      <span>${state.template.name}</span>
    </div>
    <small>${summaryHint}</small>
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
      localizeQuestionCountLabel(state.language, smartProfile.questionCount)
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
  const localizedPreset = getLocalizedPresetContent(state.language, presetId, preset);
  setStatusMessage(t(state.language, "presetApplied", { label: localizedPreset.label }), "success");

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
  setStatusMessage(t(state.language, "loadingDemo"), "loading");
  await waitForPaint();
  await generateWorksheet();
}

function setGeneratingState(isGenerating) {
  state.isGenerating = isGenerating;
  getGenerateButton().disabled = isGenerating;
  getPromptGenerateButton().disabled = isGenerating;
  getSaveProjectButton().disabled = isGenerating;
  getGenerateButton().textContent = isGenerating ? t(state.language, "generating") : t(state.language, "generateWorksheet");
}

function updatePreviewControls() {
  const totalPages = Math.max(1, state.pagination.totalPages || 1);
  const currentPage = Math.min(Math.max(1, state.pagination.currentPage || 1), totalPages);

  getPreviewPageIndicator().textContent = t(state.language, "pageLabel", { current: currentPage, total: totalPages });
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
  const subjectType = formValues.subject || "math";
  const subjectDefaults = {
    math: { topic: formValues.operation, layoutMode: "horizontal", focusPattern: null },
    grammar: { topic: "verbs", layoutMode: "horizontal", focusPattern: null },
    reading: { topic: "short passage", layoutMode: "horizontal", focusPattern: null },
    tracing: { topic: "letter A", layoutMode: "horizontal", focusPattern: null },
    coloring: { topic: "animals", layoutMode: "horizontal", focusPattern: null }
  };
  const resolvedSubject = subjectDefaults[subjectType] ? subjectType : "math";
  const subjectConfig = subjectDefaults[resolvedSubject];

  return {
    type: resolvedSubject,
    subject: resolvedSubject,
    topic: subjectConfig.topic,
    difficulty: formValues.difficulty,
    count: formValues.questionCount,
    grade: formValues.grade,
    mode: "practice",
    layoutMode: subjectConfig.layoutMode,
    teacherMode: formValues.teacherMode || "practice",
    focusPattern: subjectConfig.focusPattern,
    template: formValues.templateId
  };
}

function updateSubjectWorkflowUI() {
  const subject = getElement("subject").value || "math";
  const mathOnlyFields = document.querySelectorAll("[data-subject-math-only]");

  mathOnlyFields.forEach((field) => {
    const isMath = subject === "math";
    field.hidden = !isMath;
    field.setAttribute("aria-hidden", String(!isMath));

    field.querySelectorAll("select, input, textarea, button").forEach((control) => {
      control.disabled = !isMath;
    });
  });
}

function getResolvedWorksheetIdentity(formValues, request, worksheetTitleFallback = null, smartInstructions = "") {
  const globalSettings = state.globalSchoolSettings;

  return {
    worksheetTitle: formValues.worksheetTitle || worksheetTitleFallback || getWorksheetTitle(request),
    schoolName: formValues.schoolName || globalSettings.schoolName,
    teacherName: formValues.teacherName || globalSettings.teacherName,
    schoolLogoDataUrl: globalSettings.schoolLogoDataUrl || "",
    schoolLogoName: globalSettings.schoolLogoName || "",
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
    (normalizeLanguage(state.language) === "fr"
      ? getNaturalFrenchWorksheetInstruction(fallbackRequest)
      : localizeDefaultWorksheetInstruction(state.language, fallbackRequest)) || buildWorksheetInstruction(fallbackRequest)
  );

  return getWorksheetPageBreakdown({
    questions: state.currentQuestions,
    totalQuestions: state.currentQuestions.length,
    questionsPerPage: state.template.questionsPerPage,
    template: state.template,
    showAnswerKey,
    layoutContext: {
      grade: getLocalizedGradeLabel(state.language, fallbackRequest.grade || formValues.grade),
      subjectLabel: state.currentWorksheetMeta?.subjectLabel || getSubjectLabel(fallbackRequest),
      focusLabel: state.currentWorksheetMeta?.focusLabel || getFocusLabel(fallbackRequest),
      worksheetModeLabel: state.currentWorksheetMeta?.worksheetModeLabel || getWorksheetModeLabel(fallbackRequest),
      worksheetTitle: state.currentWorksheetMeta?.worksheetTitle || identity.worksheetTitle,
      identity,
      requestType: fallbackRequest.type || "math",
      language: state.language
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
    <span class="active-template-badge">${t(state.language, "activeTemplate")}</span>
    <strong>${state.template.name}</strong>
    <span>${state.template.description}</span>
  `;
  indicator.dataset.templateId = state.template.id;
}

function applyParsedPromptSettings(parsedPrompt, options = {}) {
  const { applyTemplate = false } = options;

  withWorkflowUpdate(() => {
    if (parsedPrompt.type) {
      getElement("subject").value = parsedPrompt.type;
    }

    if (parsedPrompt.grade) {
      getElement("grade").value = parsedPrompt.grade;
    }

    if (parsedPrompt.type === "math") {
      getElement("operation").value = parsedPrompt.topic;
    }

    getElement("difficulty").value = parsedPrompt.difficulty;
    ensureSelectOption(getElement("questionCount"), parsedPrompt.count, localizeQuestionCountLabel(state.language, parsedPrompt.count));
    getElement("questionCount").value = String(parsedPrompt.count);
    getElement("teacherMode").value = parsedPrompt.teacherMode || "practice";
  });

  updateSubjectWorkflowUI();

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
  const normalizedPromptValue = getNormalizedPromptText(promptValue);
  const selectedTemplateId = getSelectedTemplateId();
  const formValues = getFormValues();

  if (normalizedPromptValue && hasRecognizedWorksheetPrompt(normalizedPromptValue)) {
    const promptExplicitness = getPromptExplicitness(normalizedPromptValue);
    const parsedPrompt = {
      ...getSmartPromptDefaults(),
      ...parseWorksheetPrompt(normalizedPromptValue)
    };
    const smartProfile = getSmartDefaultProfile({
      grade: promptExplicitness.grade ? parsedPrompt.grade : formValues.grade,
      operation: parsedPrompt.type === "math"
        ? (promptExplicitness.operation ? parsedPrompt.topic : formValues.operation)
        : parsedPrompt.topic,
      teacherMode: promptExplicitness.teacherMode ? parsedPrompt.teacherMode : formValues.teacherMode,
      focusPattern: parsedPrompt.focusPattern,
      promptText: normalizedPromptValue
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
  const defaultTitle = getWorksheetTitle(request);
  const smartInstructions = formValues.instructions
    || (normalizeLanguage(state.language) === "fr"
      ? getNaturalFrenchWorksheetInstruction(request)
      : localizeDefaultWorksheetInstruction(state.language, request))
    || generatorResult.instructions
    || buildWorksheetInstruction(request);
  const worksheetModeLabel = getWorksheetModeLabel(request);

  return {
    worksheetTitle: formValues.worksheetTitle || defaultTitle,
    subjectLabel: getSubjectLabel(request),
    focusLabel: getFocusLabel(request),
    worksheetSubtitle: getWorksheetSubtitle(request),
    worksheetModeLabel,
    difficultyLabel: request?.difficulty ? getLocalizedDifficultyLabel(state.language, request.difficulty) : "",
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
    language: state.language,
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
    getElement("subject").value = project.settings.subject || "math";
    getElement("grade").value = project.settings.grade;
    getElement("operation").value = project.settings.operation;
    getElement("difficulty").value = project.settings.difficulty;
    getElement("teacherMode").value = project.settings.teacherMode || "practice";
    ensureSelectOption(
      getElement("questionCount"),
      project.settings.questionCount,
      localizeQuestionCountLabel(state.language, project.settings.questionCount)
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
  updateSubjectWorkflowUI();
  applyGlobalSchoolSettingsToForm({
    forceIdentity: false,
    forceGrade: false,
    forceSubject: false,
    persist: false,
    refresh: false
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

  if (project.prompt && hasRecognizedWorksheetPrompt(getNormalizedPromptText(project.prompt))) {
    return {
      ...getSmartPromptDefaults(),
      ...parseWorksheetPrompt(getNormalizedPromptText(project.prompt)),
      template: project.template || getDefaultTemplate().id
    };
  }

  return buildMathRequestFromFormValues({
    subject: project.settings.subject || "math",
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
    state.currentProject?.id || null,
    state.language
  );
}

function syncPreview() {
  if (state.currentQuestions.length === 0) {
    renderEmptyWorksheet(getWorksheetElement(), state.template, state.language);
    applyPreviewState();
    refreshOnboardingUI();
    updateActiveTemplateIndicator();
    updatePreviewControls();
    renderDashboardSection();
    updateWorkflowSmartSummary();
    return;
  }

  completeOnboarding();

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
    grade: getLocalizedGradeLabel(state.language, state.currentRequest?.grade || formValues.grade),
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
    difficultyLabel: state.currentWorksheetMeta?.difficultyLabel || getLocalizedDifficultyLabel(state.language, state.currentRequest?.difficulty || "medium"),
    generatedAtLabel: state.currentWorksheetMeta?.generatedAtLabel || formatGeneratedAtLabel(state.lastGeneratedAt),
    trustSignals: state.currentWorksheetMeta?.trustSignals || getWorksheetTrustSignals(state.currentRequest),
    worksheetSections: state.currentWorksheetMeta?.sections || [],
    identity: state.currentWorksheetMeta?.identity || getResolvedWorksheetIdentity(
      formValues,
      state.currentRequest,
      null,
      (normalizeLanguage(state.language) === "fr"
        ? getNaturalFrenchWorksheetInstruction(state.currentRequest || {})
        : localizeDefaultWorksheetInstruction(state.language, state.currentRequest || {})) || buildWorksheetInstruction(state.currentRequest || {})
    ),
    requestType: state.currentRequest?.type || "math",
    templateDescription: state.currentWorksheetMeta?.templateDescription || state.template.description,
    language: state.language
  });

  applyPreviewState();
  refreshOnboardingUI();
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
    : (savedWorksheet.prompt && hasRecognizedWorksheetPrompt(getNormalizedPromptText(savedWorksheet.prompt))
      ? {
        ...getSmartPromptDefaults(),
        ...parseWorksheetPrompt(getNormalizedPromptText(savedWorksheet.prompt)),
        template: savedWorksheet.templateId || state.template.id
      }
      : buildMathRequestFromFormValues(getFormValues()));

  state.currentQuestions = sanitizeQuestionsForRequest(
    Array.isArray(savedWorksheet.questions) ? savedWorksheet.questions : [],
    state.currentRequest
  );

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
  const sanitizedQuestions = sanitizeQuestionsForRequest(generatorResult.questions, worksheetRequest);

  state.currentRequest = worksheetRequest;
  state.template = getTemplateById(worksheetRequest.template || getFormValues().templateId);
  state.theme = state.template.theme;
  state.currentQuestions = sanitizedQuestions;
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
    setStatusMessage(t(state.language, "loadingAnalyze"), "loading");
    await waitForPaint();
    const worksheetRequest = getWorksheetRequest();
    setStatusMessage(t(state.language, "loadingBuild"), "loading");
    await waitForPaint();
    buildWorksheetFromRequest(worksheetRequest);
    setStatusMessage(t(state.language, "worksheetReady"), "success");
  } catch (error) {
    console.error(error);
    setStatusMessage(t(state.language, "generateFailed"), "error");
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
  const normalizedPromptText = getNormalizedPromptText(promptText);

  if (!promptText) {
    setStatusMessage(t(state.language, "promptRequired"), "error");
    getElement("promptInput").focus();
    return;
  }

  if (!hasRecognizedWorksheetPrompt(normalizedPromptText)) {
    setStatusMessage(t(state.language, "promptUnreadable", { guidance: getPromptInputGuidance() }), "error");
    getElement("promptInput").focus();
    return;
  }

  const parsedPrompt = {
    ...getSmartPromptDefaults(),
    ...parseWorksheetPrompt(normalizedPromptText)
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
  state.currentRequest = getRequestFromProject(project);
  state.currentQuestions = sanitizeQuestionsForRequest(
    Array.isArray(project.questions) ? project.questions : [],
    state.currentRequest
  );
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
  setStatusMessage(t(state.language, "savedProjectLoaded"), "success");
}

function saveCurrentProject() {
  if (state.isGenerating) {
    return;
  }

  if (state.currentQuestions.length === 0) {
    setStatusMessage(t(state.language, "generateBeforeSave"), "error");
    return;
  }

  const existingProjectId = state.currentProject?.id || null;
  const existingCreatedAt = state.currentProject?.createdAt || null;
  state.currentProject = buildProjectObject(existingProjectId, existingCreatedAt);
  state.savedProjects = saveProject(state.currentProject, state.storageScope);
  renderSavedProjectsList();
  renderDashboardSection();
  persistCurrentWorksheet();
  setStatusMessage(t(state.language, "projectSaved"), "success");
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
  setStatusMessage(t(state.language, "projectDeleted"), "success");
}

function downloadPDF() {
  if (state.currentQuestions.length === 0) {
    setStatusMessage(t(state.language, "generateBeforePdf"), "error");
    return;
  }

  downloadWorksheetPDF({
    questions: state.currentQuestions,
    template: state.template,
    theme: getTheme(state.theme),
    grade: getLocalizedGradeLabel(state.language, state.currentRequest?.grade || getFormValues().grade),
    worksheetTitle: state.currentWorksheetMeta?.worksheetTitle || "Worksheet",
    subjectLabel: state.currentWorksheetMeta?.subjectLabel || "Math",
    focusLabel: state.currentWorksheetMeta?.focusLabel || "Addition - Medium",
    worksheetSubtitle: state.currentWorksheetMeta?.worksheetSubtitle || getWorksheetSubtitle(state.currentRequest),
    worksheetModeLabel: state.currentWorksheetMeta?.worksheetModeLabel || "",
    difficultyLabel: state.currentWorksheetMeta?.difficultyLabel || getLocalizedDifficultyLabel(state.language, state.currentRequest?.difficulty || "medium"),
    generatedAtLabel: state.currentWorksheetMeta?.generatedAtLabel || formatGeneratedAtLabel(state.lastGeneratedAt),
    trustSignals: state.currentWorksheetMeta?.trustSignals || getWorksheetTrustSignals(state.currentRequest),
    showAnswerKey: state.currentWorksheetMeta?.showAnswerKey !== false,
    language: state.language,
    identity: state.currentWorksheetMeta?.identity || getResolvedWorksheetIdentity(
      getFormValues(),
      state.currentRequest,
      null,
      (normalizeLanguage(state.language) === "fr"
        ? getNaturalFrenchWorksheetInstruction(state.currentRequest || {})
        : localizeDefaultWorksheetInstruction(state.language, state.currentRequest || {})) || buildWorksheetInstruction(state.currentRequest || {})
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
    updateSubjectWorkflowUI();
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
  updateSubjectWorkflowUI();
  updateActiveTemplateIndicator();
  updateWorkflowSmartSummary();
}

function bindFormPersistence() {
  getGlobalSchoolNameInput().addEventListener("change", () => {
    persistGlobalSchoolSettings();
  });

  getGlobalTeacherNameInput().addEventListener("change", () => {
    persistGlobalSchoolSettings();
  });

  getGlobalDefaultGradeSelect().addEventListener("change", () => {
    persistGlobalSchoolSettings();
  });

  getGlobalDefaultSubjectSelect().addEventListener("change", () => {
    persistGlobalSchoolSettings();
  });

  getGlobalSchoolLogoInput().addEventListener("change", async (event) => {
    const [file] = event.target.files || [];

    if (!file) {
      return;
    }

    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setStatusMessage(t(state.language, "schoolLogoInvalid"), "error");
      event.target.value = "";
      return;
    }

    if (file.size > GLOBAL_SCHOOL_LOGO_MAX_BYTES) {
      setStatusMessage(t(state.language, "schoolLogoTooLarge"), "error");
      event.target.value = "";
      return;
    }

    try {
      state.globalSchoolSettings = normalizeGlobalSchoolSettings({
        ...state.globalSchoolSettings,
        schoolLogoDataUrl: await readFileAsDataUrl(file),
        schoolLogoName: file.name
      });
      saveGlobalSchoolSettings(state.globalSchoolSettings);
      syncGlobalSchoolLogoCard();
      applyGlobalSchoolSettingsToForm({
        forceIdentity: true,
        forceGrade: false,
        forceSubject: false,
        persist: true,
        refresh: true
      });
      setStatusMessage(t(state.language, "schoolLogoUpdated"), "success");
    } catch (error) {
      console.error(error);
      setStatusMessage(t(state.language, "schoolLogoInvalid"), "error");
    } finally {
      event.target.value = "";
    }
  });

  getClearGlobalSchoolLogoButton().addEventListener("click", () => {
    state.globalSchoolSettings = normalizeGlobalSchoolSettings({
      ...state.globalSchoolSettings,
      schoolLogoDataUrl: "",
      schoolLogoName: ""
    });
    saveGlobalSchoolSettings(state.globalSchoolSettings);
    syncGlobalSchoolLogoCard();
    refreshWorksheetPreviewState();
    setStatusMessage(t(state.language, "schoolLogoRemoved"), "success");
  });

  getResetGlobalSchoolSettingsButton().addEventListener("click", () => {
    resetGlobalSchoolSettings();
    refreshWorksheetPreviewState();
  });

  for (const fieldId of PERSISTED_FIELD_IDS) {
    getElement(fieldId).addEventListener("change", () => {
      if (fieldId === "subject") {
        updateSubjectWorkflowUI();
      }

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
    setStatusMessage(t(state.language, "promptLoadedAdjustMode"), "success");
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

  const classroomExamplesGrid = getClassroomExamplesContainer();
  if (classroomExamplesGrid) {
    classroomExamplesGrid.addEventListener("click", async (event) => {
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

  const onboardingDemoButton = getOnboardingDemoButton();
  if (onboardingDemoButton) {
    onboardingDemoButton.addEventListener("click", async (event) => {
      const demoPreset = getDemoPresetFromTrigger(event.target) || getLocalizedDemoPreset(state.language);
      await runDemoPreset(demoPreset);
    });
  }

  const heroDemoButton = getHeroDemoButton();
  if (heroDemoButton) {
    heroDemoButton.addEventListener("click", async (event) => {
      const demoPreset = getDemoPresetFromTrigger(event.target) || getLocalizedDemoPreset(state.language);
      await runDemoPreset(demoPreset);
    });
  }

  const instantDemoButton = getInstantDemoButton();
  if (instantDemoButton) {
    instantDemoButton.addEventListener("click", async (event) => {
      const demoPreset = getDemoPresetFromTrigger(event.target) || getLocalizedDemoPreset(state.language);
      await runDemoPreset(demoPreset);
    });
  }

  const useExamplePromptButton = getUseExamplePromptButton();
  if (useExamplePromptButton) {
    useExamplePromptButton.addEventListener("click", () => {
      loadOnboardingExamplePrompt();
    });
  }

  const dismissOnboardingButton = getDismissOnboardingButton();
  if (dismissOnboardingButton) {
    dismissOnboardingButton.addEventListener("click", () => {
      dismissOnboarding();
      setStatusMessage(t(state.language, "quickGuideDismissed"), "success");
    });
  }

  const showOnboardingButton = getShowOnboardingButton();
  if (showOnboardingButton) {
    showOnboardingButton.addEventListener("click", () => {
      reopenOnboarding();
      getOnboardingCard()?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  getWorksheetElement().addEventListener("click", async (event) => {
    const trigger = event.target.closest("[data-empty-action]");

    if (!trigger) {
      return;
    }

    const action = trigger.dataset.emptyAction;

    if (action === "demo") {
      const demoPreset = getDemoPresetFromTrigger(trigger) || getLocalizedDemoPreset(state.language);
      await runDemoPreset(demoPreset);
      return;
    }

    if (action === "example-prompt") {
      loadOnboardingExamplePrompt();
      getElement("app").scrollIntoView({ behavior: "smooth", block: "start" });
    }
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

  const languageSelect = getLanguageSelect();
  if (languageSelect) {
    languageSelect.addEventListener("change", (event) => {
      setLanguage(event.target.value);
    });
  }
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
  state.language = loadLanguagePreference();
  state.onboarding = readOnboardingState();
  populateTemplateOptions();
  applyLanguageUI();
  hydrateSettings();
  hydrateGlobalSchoolSettings();
  bindFormPersistence();
  await authController.init();
  refreshOnboardingUI();
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
  setStatusMessage(t(state.language, "initFailed"), "error");
});
