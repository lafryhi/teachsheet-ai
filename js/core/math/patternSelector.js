import {
  getAllowedMixedOperations,
  getGradeNumber,
  normalizeLayoutMode,
  normalizeMode,
  normalizeOperation
} from "./curriculumRules.js";
import { getTeacherModeProfile, normalizeTeacherMode } from "./teacherModes.js";

const PATTERN_POOLS = {
  addition: [
    { id: "horizontal", family: "direct", minGrade: 1, stages: ["warmup", "foundation", "launch", "guided", "core", "build"], weight: 5 },
    { id: "vertical", family: "direct", minGrade: 2, stages: ["core", "build", "stretch", "check-understanding"], weight: 4, requiresVerticalFriendly: true },
    { id: "missing-addend", family: "reasoning", minGrade: 1, stages: ["guided", "core", "stretch"], weight: 4 },
    { id: "compare-total", family: "reasoning", minGrade: 2, stages: ["core", "stretch", "check-understanding"], weight: 3 },
    { id: "mental-math", family: "fluency", minGrade: 1, stages: ["warmup", "foundation", "review"], weight: 3 },
    { id: "true-false", family: "checking", minGrade: 2, stages: ["build", "stretch", "check-understanding"], weight: 2 },
    { id: "word-problem", family: "application", minGrade: 1, stages: ["core", "build", "stretch"], weight: 3 }
  ],
  subtraction: [
    { id: "horizontal", family: "direct", minGrade: 1, stages: ["warmup", "foundation", "guided", "core"], weight: 5 },
    { id: "vertical", family: "direct", minGrade: 2, stages: ["core", "build", "stretch", "check-understanding"], weight: 4, requiresVerticalFriendly: true },
    { id: "missing-subtrahend", family: "reasoning", minGrade: 1, stages: ["guided", "core", "stretch"], weight: 4 },
    { id: "compare-difference", family: "reasoning", minGrade: 2, stages: ["core", "stretch", "check-understanding"], weight: 3 },
    { id: "mental-math", family: "fluency", minGrade: 1, stages: ["warmup", "foundation", "review"], weight: 3 },
    { id: "true-false", family: "checking", minGrade: 2, stages: ["build", "stretch", "check-understanding"], weight: 2 },
    { id: "word-problem", family: "application", minGrade: 1, stages: ["core", "build", "stretch"], weight: 3 }
  ],
  multiplication: [
    { id: "horizontal", family: "direct", minGrade: 1, stages: ["warmup", "foundation", "core"], weight: 5 },
    { id: "vertical", family: "direct", minGrade: 3, stages: ["build", "stretch", "check-understanding"], weight: 4, requiresVerticalFriendly: true },
    { id: "missing-factor", family: "reasoning", minGrade: 2, stages: ["guided", "core", "stretch"], weight: 4 },
    { id: "groups", family: "application", minGrade: 1, stages: ["core", "build", "stretch"], weight: 4 },
    { id: "mental-math", family: "fluency", minGrade: 1, stages: ["warmup", "foundation", "review"], weight: 3 },
    { id: "true-false", family: "checking", minGrade: 2, stages: ["build", "stretch", "check-understanding"], weight: 2 },
    { id: "word-problem", family: "application", minGrade: 2, stages: ["core", "build", "stretch"], weight: 3 }
  ],
  division: [
    { id: "horizontal", family: "direct", minGrade: 2, stages: ["warmup", "foundation", "core"], weight: 5 },
    { id: "vertical", family: "direct", minGrade: 4, stages: ["build", "stretch", "check-understanding"], weight: 3, requiresVerticalFriendly: true },
    { id: "missing-divisor", family: "reasoning", minGrade: 2, stages: ["guided", "core", "stretch"], weight: 4 },
    { id: "equal-groups", family: "application", minGrade: 2, stages: ["core", "build", "stretch"], weight: 4 },
    { id: "mental-math", family: "fluency", minGrade: 2, stages: ["warmup", "foundation", "review"], weight: 3 },
    { id: "true-false", family: "checking", minGrade: 3, stages: ["build", "stretch", "check-understanding"], weight: 2 },
    { id: "word-problem", family: "application", minGrade: 2, stages: ["core", "build", "stretch"], weight: 3 }
  ]
};

function pickByWeight(items) {
  const totalWeight = items.reduce((total, item) => total + item.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) {
      return item;
    }
  }

  return items[items.length - 1];
}

function buildWeightedCandidates({ operation, slot, gradeNumber, layoutMode, history, teacherMode, focusPattern }) {
  const normalizedLayout = normalizeLayoutMode(layoutMode);
  const teacherModeProfile = getTeacherModeProfile(teacherMode);

  return getAvailablePatternsForOperation({
    operation,
    gradeNumber,
    layoutMode: normalizedLayout
  })
    .map((pattern) => {
      let weight = pattern.weight;

      if (pattern.stages.includes(slot.stage)) {
        weight += 2.2;
      }

      if (focusPattern === "mental-math" && pattern.id === "mental-math") {
        weight += 8;
      }

      if (normalizedLayout === "vertical" && pattern.id === "vertical") {
        weight += 5;
      }

      if (normalizedLayout === "vertical" && pattern.requiresVerticalFriendly) {
        weight += 1.5;
      }

      if (history.lastPatternId === pattern.id) {
        weight *= 0.3;
      }

      if (history.lastFamily === pattern.family) {
        weight *= 0.72;
      }

      const patternUsage = history.patternCounts.get(pattern.id) || 0;
      const familyUsage = history.familyCounts.get(pattern.family) || 0;
      weight *= Math.max(0.28, 1 - (patternUsage * 0.12));
      weight *= Math.max(0.4, 1 - (familyUsage * 0.06));
      weight *= teacherModeProfile.patternBias[pattern.family] || 1;

      return {
        ...pattern,
        weight
      };
    })
    .filter((pattern) => pattern.weight > 0);
}

export function getAvailablePatternsForOperation({
  operation,
  gradeNumber,
  layoutMode = "horizontal"
}) {
  const pool = PATTERN_POOLS[operation] || PATTERN_POOLS.addition;
  const normalizedLayout = normalizeLayoutMode(layoutMode);

  return pool
    .filter((pattern) => gradeNumber >= pattern.minGrade)
    .filter((pattern) => normalizedLayout === "vertical" || pattern.id !== "vertical");
}

export function buildOperationPlan({
  operation = "addition",
  count = 15,
  grade = "Grade 2"
}) {
  const gradeNumber = getGradeNumber(grade);
  const resolvedOperation = normalizeOperation(operation);

  if (resolvedOperation !== "mixed") {
    return Array.from({ length: count }, () => resolvedOperation);
  }

  const allowedOperations = getAllowedMixedOperations(gradeNumber);
  const sequence = [];

  for (let index = 0; index < count; index += 1) {
    const preferredOffset = index % allowedOperations.length;
    sequence.push(allowedOperations[preferredOffset]);
  }

  return sequence;
}

export function buildPatternPlan({
  operations,
  difficultyPlan,
  grade = "Grade 2",
  mode = "practice",
  layoutMode = "horizontal",
  teacherMode = "practice",
  focusPattern = null
}) {
  const gradeNumber = getGradeNumber(grade);
  const resolvedMode = normalizeMode(mode);
  const resolvedTeacherMode = normalizeTeacherMode(teacherMode);
  const history = {
    lastPatternId: null,
    lastFamily: null,
    patternCounts: new Map(),
    familyCounts: new Map()
  };

  return difficultyPlan.map((slot, index) => {
    const operation = operations[index] || operations[0] || "addition";
    const weightedCandidates = buildWeightedCandidates({
      operation,
      slot: resolvedMode === "review" && slot.stage === "mixed-practice"
        ? { ...slot, stage: "review" }
        : slot,
      gradeNumber,
      layoutMode,
      history,
      teacherMode: resolvedTeacherMode,
      focusPattern
    });
    const selectedPattern = pickByWeight(weightedCandidates.length > 0 ? weightedCandidates : [{
      id: "horizontal",
      family: "direct",
      weight: 1
    }]);

    history.lastPatternId = selectedPattern.id;
    history.lastFamily = selectedPattern.family;
    history.patternCounts.set(selectedPattern.id, (history.patternCounts.get(selectedPattern.id) || 0) + 1);
    history.familyCounts.set(selectedPattern.family, (history.familyCounts.get(selectedPattern.family) || 0) + 1);

    return selectedPattern;
  });
}
