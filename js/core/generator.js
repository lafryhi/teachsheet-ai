import { buildDifficultyPlan } from "./math/difficultyEngine.js";
import { createMathQuestionCandidate } from "./math/questionFactory.js";
import {
  getAllowedMixedOperations,
  getGradeNumber,
  normalizeLayoutMode,
  normalizeMode,
  normalizeOperation
} from "./math/curriculumRules.js";
import {
  buildOperationPlan,
  buildPatternPlan,
  getAvailablePatternsForOperation
} from "./math/patternSelector.js";
import { createWorksheetBalancer } from "./math/worksheetBalancer.js";

function choose(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function buildFallbackPattern(operation, layoutMode = "horizontal") {
  if (normalizeLayoutMode(layoutMode) === "vertical" && ["addition", "subtraction", "multiplication", "division"].includes(operation)) {
    return {
      id: "vertical",
      family: "direct"
    };
  }

  return {
    id: "horizontal",
    family: "direct"
  };
}

function createFallbackQuestion(operation, difficulty, grade, mode, layoutMode) {
  return createMathQuestionCandidate({
    operation,
    pattern: buildFallbackPattern(operation, layoutMode),
    slot: {
      stage: "core",
      difficulty
    },
    grade,
    mode,
    layoutMode
  });
}

function decorateWithSequence(question, sequenceIndex, slot) {
  return {
    ...question,
    difficulty: slot.difficulty,
    stage: slot.stage,
    sequenceIndex
  };
}

function buildMixedOperationFallback(grade = "Grade 2", slotIndex = 0) {
  const allowed = getAllowedMixedOperations(getGradeNumber(grade));
  return allowed[slotIndex % allowed.length] || "addition";
}

export function createQuestion(
  operation,
  difficulty,
  grade = "Grade 2",
  mode = "practice",
  layoutMode = "horizontal"
) {
  const resolvedOperation = normalizeOperation(operation);
  const effectiveOperation = resolvedOperation === "mixed"
    ? buildMixedOperationFallback(grade, 0)
    : resolvedOperation;

  return createFallbackQuestion(
    effectiveOperation,
    difficulty,
    grade,
    normalizeMode(mode),
    normalizeLayoutMode(layoutMode)
  );
}

export function generateQuestions({
  operation,
  difficulty,
  questionCount,
  grade,
  mode = "practice",
  layoutMode = "horizontal"
}) {
  const normalizedMode = normalizeMode(mode);
  const normalizedLayout = normalizeLayoutMode(layoutMode);
  const resolvedOperation = normalizeOperation(operation);
  const difficultyPlan = buildDifficultyPlan({
    difficulty,
    count: questionCount,
    mode: normalizedMode
  });
  const operations = buildOperationPlan({
    operation: resolvedOperation,
    count: questionCount,
    grade
  });
  const patternPlan = buildPatternPlan({
    operations,
    difficultyPlan,
    grade,
    mode: normalizedMode,
    layoutMode: normalizedLayout
  });
  const balancer = createWorksheetBalancer({
    count: questionCount
  });
  const gradeNumber = getGradeNumber(grade);
  const questions = [];

  for (let index = 0; index < questionCount; index += 1) {
    const slot = difficultyPlan[index] || {
      stage: "core",
      difficulty
    };
    const targetOperation = operations[index] || buildMixedOperationFallback(grade, index);
    const basePattern = patternPlan[index] || buildFallbackPattern(targetOperation, normalizedLayout);
    const safePatternPool = getAvailablePatternsForOperation({
      operation: targetOperation,
      gradeNumber,
      layoutMode: normalizedLayout
    });
    let acceptedQuestion = null;

    for (let attempt = 0; attempt < 28; attempt += 1) {
      const candidatePattern = attempt === 0
        ? basePattern
        : {
          ...choose(safePatternPool),
          weight: undefined
        };
      const candidate = createMathQuestionCandidate({
        operation: targetOperation,
        pattern: candidatePattern,
        slot,
        grade,
        mode: normalizedMode,
        layoutMode: normalizedLayout
      });

      if (!balancer.canUse(candidate)) {
        continue;
      }

      acceptedQuestion = decorateWithSequence(candidate, index + 1, slot);
      balancer.record(acceptedQuestion);
      break;
    }

    if (!acceptedQuestion) {
      const fallbackQuestion = decorateWithSequence(
        createFallbackQuestion(targetOperation, slot.difficulty, grade, normalizedMode, normalizedLayout),
        index + 1,
        slot
      );
      acceptedQuestion = fallbackQuestion;
      balancer.record(fallbackQuestion);
    }

    questions.push(acceptedQuestion);
  }

  return questions;
}

export function formatOperation(operation) {
  const names = {
    addition: "Addition",
    subtraction: "Subtraction",
    multiplication: "Multiplication",
    division: "Division",
    mixed: "Mixed Operations"
  };

  return names[operation] || operation;
}

export function capitalize(text = "") {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
