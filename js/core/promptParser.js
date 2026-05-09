import { templates } from "../templates/templates.js";

const DEFAULT_PROMPT_SETTINGS = {
  grade: "Grade 2",
  operation: "addition",
  difficulty: "medium",
  questionCount: 15,
  template: "classic-math"
};

const OPERATION_PATTERNS = [
  { value: "addition", patterns: [/\baddition\b/, /\badd\b/] },
  { value: "subtraction", patterns: [/\bsubtraction\b/, /\bsubtract\b/] },
  { value: "multiplication", patterns: [/\bmultiplication\b/, /\bmultiply\b/, /\btimes\b/] },
  { value: "division", patterns: [/\bdivision\b/, /\bdivide\b/] },
  { value: "mixed", patterns: [/\bmixed\b/, /\bmixed operations\b/] }
];

const DIFFICULTY_PATTERNS = ["easy", "medium", "hard"];

function normalizePrompt(prompt = "") {
  return String(prompt)
    .toLowerCase()
    .replaceAll("_", "-")
    .replaceAll(/\s+/g, " ")
    .trim();
}

function normalizeTemplateAliases(template) {
  return [
    template.id,
    template.id.replaceAll("-", " "),
    template.name.toLowerCase(),
    template.name.toLowerCase().replaceAll("-", " ")
  ];
}

function findOperation(prompt) {
  for (const operation of OPERATION_PATTERNS) {
    if (operation.patterns.some((pattern) => pattern.test(prompt))) {
      return operation.value;
    }
  }

  return null;
}

function findDifficulty(prompt) {
  return DIFFICULTY_PATTERNS.find((difficulty) => new RegExp(`\\b${difficulty}\\b`).test(prompt)) || null;
}

function findGrade(prompt) {
  const match = prompt.match(/\bgrade\s*([1-5])\b/);
  return match ? `Grade ${match[1]}` : null;
}

function findQuestionCount(prompt) {
  const directMatch = prompt.match(/\b(\d+)\s*questions?\b/);
  if (directMatch) {
    return Number.parseInt(directMatch[1], 10);
  }

  const reverseMatch = prompt.match(/\bquestions?\s*(\d+)\b/);
  if (reverseMatch) {
    return Number.parseInt(reverseMatch[1], 10);
  }

  return null;
}

function findTemplate(prompt) {
  for (const template of templates) {
    const aliases = normalizeTemplateAliases(template);
    if (aliases.some((alias) => prompt.includes(alias))) {
      return template.id;
    }
  }

  return null;
}

function extractPromptMatches(prompt) {
  const normalizedPrompt = normalizePrompt(prompt);

  return {
    grade: findGrade(normalizedPrompt),
    operation: findOperation(normalizedPrompt),
    difficulty: findDifficulty(normalizedPrompt),
    questionCount: findQuestionCount(normalizedPrompt),
    template: findTemplate(normalizedPrompt)
  };
}

export function hasRecognizedPromptFields(prompt) {
  const matches = extractPromptMatches(prompt);
  return Object.values(matches).some((value) => value !== null);
}

export function parsePrompt(prompt, defaults = {}) {
  const matches = extractPromptMatches(prompt);
  const baseDefaults = {
    ...DEFAULT_PROMPT_SETTINGS,
    ...defaults
  };

  return {
    grade: matches.grade || baseDefaults.grade,
    operation: matches.operation || baseDefaults.operation,
    difficulty: matches.difficulty || baseDefaults.difficulty,
    questionCount: matches.questionCount || baseDefaults.questionCount,
    template: matches.template || baseDefaults.template
  };
}
