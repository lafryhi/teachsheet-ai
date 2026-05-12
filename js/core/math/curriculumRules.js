const DIFFICULTY_INDEX = {
  easy: 0,
  medium: 1,
  hard: 2
};

const VALID_MODES = ["practice", "review", "remediation", "challenge"];
const VALID_OPERATIONS = ["addition", "subtraction", "multiplication", "division", "mixed"];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function getGradeNumber(grade = "Grade 2") {
  const match = String(grade).match(/(\d+)/);
  return clamp(match ? Number.parseInt(match[1], 10) : 2, 1, 5);
}

export function normalizeDifficulty(difficulty = "medium") {
  return ["easy", "medium", "hard"].includes(difficulty) ? difficulty : "medium";
}

export function getDifficultyIndex(difficulty = "medium") {
  return DIFFICULTY_INDEX[normalizeDifficulty(difficulty)] ?? 1;
}

export function difficultyLabelFromIndex(index = 1) {
  return ["easy", "medium", "hard"][clamp(index, 0, 2)];
}

export function normalizeMode(mode = "practice") {
  return VALID_MODES.includes(mode) ? mode : "practice";
}

export function normalizeLayoutMode(layoutMode = "horizontal") {
  return layoutMode === "vertical" ? "vertical" : "horizontal";
}

export function normalizeOperation(operation = "addition") {
  return VALID_OPERATIONS.includes(operation) ? operation : "addition";
}

export function getAllowedMixedOperations(gradeNumber = 2) {
  if (gradeNumber <= 1) {
    return ["addition", "subtraction"];
  }

  if (gradeNumber === 2) {
    return ["addition", "subtraction", "multiplication"];
  }

  return ["addition", "subtraction", "multiplication", "division"];
}

function getModeAdjustments(mode = "practice") {
  const resolvedMode = normalizeMode(mode);

  if (resolvedMode === "remediation") {
    return {
      numberScale: 0.72,
      factScale: 0.75,
      preferNoRegrouping: true,
      wordProblemComplexity: 0,
      trueFalseBias: 0.25
    };
  }

  if (resolvedMode === "challenge") {
    return {
      numberScale: 1.18,
      factScale: 1.15,
      preferNoRegrouping: false,
      wordProblemComplexity: 2,
      trueFalseBias: 0.9
    };
  }

  if (resolvedMode === "review") {
    return {
      numberScale: 0.96,
      factScale: 0.95,
      preferNoRegrouping: false,
      wordProblemComplexity: 1,
      trueFalseBias: 0.55
    };
  }

  return {
    numberScale: 1,
    factScale: 1,
    preferNoRegrouping: false,
    wordProblemComplexity: 1,
    trueFalseBias: 0.5
  };
}

function getAdditionSubtractionRange(gradeNumber, difficultyIndex, mode) {
  const baseByGrade = {
    1: [10, 20, 20],
    2: [20, 99, 99],
    3: [99, 399, 999],
    4: [199, 799, 1999],
    5: [499, 1999, 4999]
  };
  const adjustments = getModeAdjustments(mode);
  const baseValues = baseByGrade[gradeNumber] || baseByGrade[2];
  const scaledMax = Math.max(10, Math.round(baseValues[difficultyIndex] * adjustments.numberScale));
  const minValue = gradeNumber <= 2 ? 0 : Math.max(0, Math.floor(scaledMax * 0.12));

  return {
    min: minValue,
    max: scaledMax
  };
}

function getFactRange(gradeNumber, difficultyIndex, mode) {
  const baseByGrade = {
    1: [
      { min: 1, max: 3 },
      { min: 1, max: 5 },
      { min: 2, max: 5 }
    ],
    2: [
      { min: 1, max: 5 },
      { min: 2, max: 10 },
      { min: 3, max: 12 }
    ],
    3: [
      { min: 2, max: 8 },
      { min: 3, max: 12 },
      { min: 4, max: 12 }
    ],
    4: [
      { min: 3, max: 12 },
      { min: 4, max: 12 },
      { min: 6, max: 12 }
    ],
    5: [
      { min: 4, max: 12 },
      { min: 5, max: 12 },
      { min: 7, max: 15 }
    ]
  };
  const adjustments = getModeAdjustments(mode);
  const base = baseByGrade[gradeNumber]?.[difficultyIndex] || baseByGrade[2][1];

  return {
    min: Math.max(1, Math.round(base.min * adjustments.factScale)),
    max: Math.max(2, Math.round(base.max * adjustments.factScale))
  };
}

export function getOperationProfile({
  operation,
  difficulty = "medium",
  grade = "Grade 2",
  mode = "practice",
  complexity = 1
}) {
  const gradeNumber = getGradeNumber(grade);
  const difficultyIndex = clamp(getDifficultyIndex(difficulty) + complexity, 0, 2);
  const adjustments = getModeAdjustments(mode);
  const resolvedOperation = normalizeOperation(operation);

  if (resolvedOperation === "multiplication" || resolvedOperation === "division") {
    const facts = getFactRange(gradeNumber, difficultyIndex, mode);
    const allowTwoDigitFactor = resolvedOperation === "multiplication" && gradeNumber >= 3 && difficultyIndex >= 1;
    const allowLargeDividend = resolvedOperation === "division" && gradeNumber >= 3 && difficultyIndex >= 1;

    return {
      gradeNumber,
      difficulty: difficultyLabelFromIndex(difficultyIndex),
      range: facts,
      mode: normalizeMode(mode),
      allowTwoDigitFactor,
      allowLargeDividend,
      allowRemainderStyle: false,
      trueFalseBias: adjustments.trueFalseBias,
      wordProblemComplexity: adjustments.wordProblemComplexity
    };
  }

  const range = getAdditionSubtractionRange(gradeNumber, difficultyIndex, mode);
  const regroupingByGrade = {
    1: [false, false, true],
    2: [false, true, true],
    3: [false, true, true],
    4: [true, true, true],
    5: [true, true, true]
  };
  const maxCarryStepsByGrade = {
    1: [0, 0, 1],
    2: [0, 1, 2],
    3: [0, 2, 3],
    4: [1, 2, 4],
    5: [1, 3, 4]
  };

  return {
    gradeNumber,
    difficulty: difficultyLabelFromIndex(difficultyIndex),
    range,
    mode: normalizeMode(mode),
    allowRegrouping: regroupingByGrade[gradeNumber]?.[difficultyIndex] ?? true,
    preferNoRegrouping: adjustments.preferNoRegrouping,
    maxCarrySteps: maxCarryStepsByGrade[gradeNumber]?.[difficultyIndex] ?? 2,
    trueFalseBias: adjustments.trueFalseBias,
    wordProblemComplexity: adjustments.wordProblemComplexity
  };
}
