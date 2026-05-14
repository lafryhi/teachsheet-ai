import { buildDifficultyPlan } from "./math/difficultyEngine.js";
import { buildWorksheetInstruction } from "./math/instructionsEngine.js";
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
import { buildSectionPlan, listWorksheetSections } from "./math/sectionPlanner.js";
import { normalizeTeacherMode, resolvePedagogicalMode } from "./math/teacherModes.js";
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

function decorateWithSequence(question, sequenceIndex, slot, sectionMeta) {
  return {
    ...question,
    difficulty: slot.difficulty,
    stage: slot.stage,
    sequenceIndex,
    sectionKey: sectionMeta?.sectionKey || "practice",
    sectionLabel: sectionMeta?.sectionLabel || "Practice",
    sectionInstruction: sectionMeta?.sectionInstruction || "",
    sectionStart: Boolean(sectionMeta?.sectionStart),
    layoutHints: {
      ...question.layoutHints,
      sectionHeaderUnits: sectionMeta?.sectionStart ? 0.48 : 0,
      sectionHeaderHeight: sectionMeta?.sectionStart ? 13 : 0,
      answerSectionUnits: sectionMeta?.sectionStart ? 0.72 : 0
    }
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
  layoutMode = "horizontal",
  teacherMode = "practice",
  focusPattern = null
}) {
  const normalizedTeacherMode = normalizeTeacherMode(teacherMode);
  const normalizedMode = resolvePedagogicalMode({
    mode,
    teacherMode: normalizedTeacherMode
  });
  const normalizedLayout = normalizeLayoutMode(layoutMode);
  const resolvedOperation = normalizeOperation(operation);
  const difficultyPlan = buildDifficultyPlan({
    difficulty,
    count: questionCount,
    mode: normalizedMode
  });
  const sectionPlan = buildSectionPlan({
    count: questionCount,
    operation: resolvedOperation,
    layoutMode: normalizedLayout,
    teacherMode: normalizedTeacherMode,
    focusPattern
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
    layoutMode: normalizedLayout,
    teacherMode: normalizedTeacherMode,
    focusPattern
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
    const sectionMeta = sectionPlan[index] || null;
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

      acceptedQuestion = decorateWithSequence(candidate, index + 1, slot, sectionMeta);
      balancer.record(acceptedQuestion);
      break;
    }

    if (!acceptedQuestion) {
      const fallbackQuestion = decorateWithSequence(
        createFallbackQuestion(targetOperation, slot.difficulty, grade, normalizedMode, normalizedLayout),
        index + 1,
        slot,
        sectionMeta
      );
      acceptedQuestion = fallbackQuestion;
      balancer.record(fallbackQuestion);
    }

    questions.push(acceptedQuestion);
  }

  return questions;
}

export function buildMathWorksheetIntelligence(request, questions) {
  return {
    instructions: buildWorksheetInstruction(request),
    sections: listWorksheetSections(questions)
  };
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
