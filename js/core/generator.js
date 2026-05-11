function getRandomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getGradeNumber(grade = "Grade 2") {
  const match = String(grade).match(/(\d+)/);
  return match ? Number.parseInt(match[1], 10) : 2;
}

function pickRandom(items) {
  return items[getRandomNumber(0, items.length - 1)];
}

function clampDifficultyIndex(index) {
  return Math.max(0, Math.min(2, index));
}

function difficultyLabelFromIndex(index) {
  return ["easy", "medium", "hard"][clampDifficultyIndex(index)];
}

function getDifficultyIndex(difficulty = "medium") {
  return {
    easy: 0,
    medium: 1,
    hard: 2
  }[difficulty] ?? 1;
}

function normalizeMode(mode = "practice") {
  return ["practice", "review", "remediation", "challenge"].includes(mode) ? mode : "practice";
}

function normalizeLayoutMode(layoutMode = "horizontal") {
  return layoutMode === "vertical" ? "vertical" : "horizontal";
}

function buildOperandRange(operation, difficulty, gradeNumber, mode = "practice") {
  const isEarlyGrade = gradeNumber <= 2;
  const isUpperGrade = gradeNumber >= 4;
  const resolvedMode = normalizeMode(mode);

  if (operation === "multiplication" || operation === "division") {
    if (difficulty === "easy") {
      if (resolvedMode === "remediation") {
        return { minA: 1, maxA: 4, minB: 1, maxB: 4 };
      }

      return isEarlyGrade ? { minA: 1, maxA: 5, minB: 1, maxB: 5 } : { minA: 2, maxA: 8, minB: 2, maxB: 8 };
    }

    if (difficulty === "medium") {
      if (resolvedMode === "challenge") {
        return isUpperGrade ? { minA: 4, maxA: 12, minB: 4, maxB: 12 } : { minA: 3, maxA: 11, minB: 3, maxB: 11 };
      }

      return isUpperGrade ? { minA: 3, maxA: 12, minB: 3, maxB: 12 } : { minA: 2, maxA: 10, minB: 2, maxB: 10 };
    }

    if (resolvedMode === "challenge") {
      return isUpperGrade ? { minA: 7, maxA: 12, minB: 5, maxB: 12 } : { minA: 4, maxA: 12, minB: 4, maxB: 12 };
    }

    return isUpperGrade ? { minA: 6, maxA: 12, minB: 4, maxB: 12 } : { minA: 3, maxA: 12, minB: 3, maxB: 12 };
  }

  if (difficulty === "easy") {
    if (resolvedMode === "remediation") {
      return isEarlyGrade ? { min: 0, max: 15 } : { min: 0, max: 30 };
    }

    return isEarlyGrade ? { min: 0, max: 20 } : { min: 0, max: 50 };
  }

  if (difficulty === "medium") {
    if (resolvedMode === "challenge") {
      return isUpperGrade ? { min: 40, max: 250 } : { min: 20, max: 130 };
    }

    return isUpperGrade ? { min: 20, max: 200 } : { min: 10, max: 100 };
  }

  if (resolvedMode === "challenge") {
    return isUpperGrade ? { min: 150, max: 999 } : { min: 60, max: 320 };
  }

  return isUpperGrade ? { min: 100, max: 999 } : { min: 40, max: 250 };
}

function createAnswer(text) {
  return String(text);
}

function formatVerticalOperation(topLine, bottomLine, answerPlaceholder = "____") {
  return [topLine, bottomLine, "----", answerPlaceholder].join("\n");
}

function padLeft(value, width) {
  return String(value).padStart(width, " ");
}

function createStandardQuestion(text, answer, layoutMode) {
  return {
    text,
    answer: createAnswer(answer),
    answerLine: layoutMode !== "vertical",
    format: layoutMode
  };
}

function buildAdditionQuestion(difficulty, gradeNumber, mode = "practice", layoutMode = "horizontal") {
  const range = buildOperandRange("addition", difficulty, gradeNumber, mode);
  const a = getRandomNumber(range.min, range.max);
  const b = getRandomNumber(range.min, range.max);
  const patternPool = mode === "remediation"
    ? ["standard", "standard", "compare", "missing-addend"]
    : mode === "challenge"
      ? ["missing-addend", "compare", "missing-addend", "standard"]
      : ["standard", "missing-addend", "compare"];
  const pattern = pickRandom(patternPool);
  const resolvedLayout = normalizeLayoutMode(layoutMode);

  if (pattern === "missing-addend") {
    return createStandardQuestion(`${a} + ___ = ${a + b}`, `Missing number: ${b}`, "horizontal");
  }

  if (pattern === "compare") {
    return createStandardQuestion(`Find the sum: ${a} + ${b} =`, a + b, "horizontal");
  }

  if (resolvedLayout === "vertical") {
    const width = Math.max(String(a).length, String(b).length) + 1;
    return createStandardQuestion(
      formatVerticalOperation(padLeft(a, width), `+${padLeft(b, width - 1)}`),
      a + b,
      "vertical"
    );
  }

  return createStandardQuestion(`${a} + ${b} =`, a + b, "horizontal");
}

function buildSubtractionQuestion(difficulty, gradeNumber, mode = "practice", layoutMode = "horizontal") {
  const range = buildOperandRange("subtraction", difficulty, gradeNumber, mode);
  let a = getRandomNumber(range.min, range.max);
  let b = getRandomNumber(range.min, range.max);

  if (b > a) {
    [a, b] = [b, a];
  }

  const patternPool = mode === "remediation"
    ? ["standard", "wording", "standard", "missing-number"]
    : mode === "challenge"
      ? ["missing-number", "wording", "standard", "missing-number"]
      : ["standard", "missing-number", "wording"];
  const pattern = pickRandom(patternPool);
  const resolvedLayout = normalizeLayoutMode(layoutMode);

  if (pattern === "missing-number") {
    return createStandardQuestion(`${a} - ___ = ${a - b}`, `Missing number: ${b}`, "horizontal");
  }

  if (pattern === "wording") {
    return createStandardQuestion(`Subtract: ${a} - ${b} =`, a - b, "horizontal");
  }

  if (resolvedLayout === "vertical") {
    const width = Math.max(String(a).length, String(b).length) + 1;
    return createStandardQuestion(
      formatVerticalOperation(padLeft(a, width), `-${padLeft(b, width - 1)}`),
      a - b,
      "vertical"
    );
  }

  return createStandardQuestion(`${a} - ${b} =`, a - b, "horizontal");
}

function buildMultiplicationQuestion(difficulty, gradeNumber, mode = "practice", layoutMode = "horizontal") {
  const range = buildOperandRange("multiplication", difficulty, gradeNumber, mode);
  const a = getRandomNumber(range.minA, range.maxA);
  const b = getRandomNumber(range.minB, range.maxB);
  const patternPool = mode === "remediation"
    ? ["standard", "groups", "standard", "missing-factor"]
    : mode === "challenge"
      ? ["missing-factor", "groups", "standard", "missing-factor"]
      : ["standard", "missing-factor", "groups"];
  const pattern = pickRandom(patternPool);
  const resolvedLayout = normalizeLayoutMode(layoutMode);

  if (pattern === "missing-factor") {
    return createStandardQuestion(`${a} x ___ = ${a * b}`, `Missing factor: ${b}`, "horizontal");
  }

  if (pattern === "groups") {
    return createStandardQuestion(`${a} groups of ${b} =`, `Total: ${a * b}`, "horizontal");
  }

  if (resolvedLayout === "vertical") {
    const width = Math.max(String(a).length, String(b).length) + 1;
    return createStandardQuestion(
      formatVerticalOperation(padLeft(a, width), `x${padLeft(b, width - 1)}`),
      a * b,
      "vertical"
    );
  }

  return createStandardQuestion(`${a} x ${b} =`, a * b, "horizontal");
}

function buildDivisionQuestion(difficulty, gradeNumber, mode = "practice", layoutMode = "horizontal") {
  const range = buildOperandRange("division", difficulty, gradeNumber, mode);
  const divisor = getRandomNumber(range.minB, range.maxB);
  const quotient = getRandomNumber(range.minA, range.maxA);
  const dividend = divisor * quotient;
  const patternPool = mode === "remediation"
    ? ["standard", "share", "standard", "missing-divisor"]
    : mode === "challenge"
      ? ["missing-divisor", "share", "standard", "missing-divisor"]
      : ["standard", "missing-divisor", "share"];
  const pattern = pickRandom(patternPool);
  const resolvedLayout = normalizeLayoutMode(layoutMode);

  if (pattern === "missing-divisor") {
    return createStandardQuestion(`${dividend} / ___ = ${quotient}`, `Missing divisor: ${divisor}`, "horizontal");
  }

  if (pattern === "share") {
    return createStandardQuestion(`Share ${dividend} into ${divisor} equal groups =`, `Each group: ${quotient}`, "horizontal");
  }

  if (resolvedLayout === "vertical") {
    return createStandardQuestion(
      `  ${dividend}\n${divisor})____`,
      quotient,
      "vertical"
    );
  }

  return createStandardQuestion(`${dividend} / ${divisor} =`, quotient, "horizontal");
}

function buildQuestionByOperation(operation, difficulty, gradeNumber, mode, layoutMode) {
  if (operation === "addition") {
    return buildAdditionQuestion(difficulty, gradeNumber, mode, layoutMode);
  }

  if (operation === "subtraction") {
    return buildSubtractionQuestion(difficulty, gradeNumber, mode, layoutMode);
  }

  if (operation === "multiplication") {
    return buildMultiplicationQuestion(difficulty, gradeNumber, mode, layoutMode);
  }

  if (operation === "division") {
    return buildDivisionQuestion(difficulty, gradeNumber, mode, layoutMode);
  }

  return buildAdditionQuestion(difficulty, gradeNumber, mode, layoutMode);
}

function getProgressiveDifficultySequence({ difficulty, count, mode }) {
  const baseIndex = getDifficultyIndex(difficulty);
  const resolvedMode = normalizeMode(mode);

  if (resolvedMode === "remediation") {
    return Array.from({ length: count }, (_, index) =>
      difficultyLabelFromIndex(index < Math.ceil(count * 0.75) ? 0 : Math.min(1, baseIndex))
    );
  }

  if (resolvedMode === "review") {
    return Array.from({ length: count }, (_, index) =>
      difficultyLabelFromIndex(index < Math.ceil(count * 0.5) ? Math.max(0, baseIndex - 1) : Math.min(1, baseIndex))
    );
  }

  if (resolvedMode === "challenge") {
    return Array.from({ length: count }, (_, index) => {
      if (index < Math.ceil(count * 0.3)) {
        return difficultyLabelFromIndex(Math.max(0, baseIndex - 1));
      }

      if (index < Math.ceil(count * 0.7)) {
        return difficultyLabelFromIndex(baseIndex);
      }

      return difficultyLabelFromIndex(Math.min(2, baseIndex + 1));
    });
  }

  return Array.from({ length: count }, (_, index) => {
    if (index < Math.ceil(count * 0.35)) {
      return difficultyLabelFromIndex(Math.max(0, baseIndex - 1));
    }

    if (index < Math.ceil(count * 0.75)) {
      return difficultyLabelFromIndex(baseIndex);
    }

    return difficultyLabelFromIndex(Math.min(2, baseIndex + (baseIndex === 2 ? 0 : 1)));
  });
}

export function createQuestion(
  operation,
  difficulty,
  grade = "Grade 2",
  mode = "practice",
  layoutMode = "horizontal"
) {
  const gradeNumber = getGradeNumber(grade);
  const resolvedOperation = operation === "mixed"
    ? pickRandom(["addition", "subtraction", "multiplication", "division"])
    : operation;

  return buildQuestionByOperation(
    resolvedOperation,
    difficulty,
    gradeNumber,
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
  const uniqueQuestions = new Map();
  const difficultySequence = getProgressiveDifficultySequence({
    difficulty,
    count: questionCount,
    mode
  });

  for (let index = 0; index < difficultySequence.length; index += 1) {
    const effectiveDifficulty = difficultySequence[index];
    let attempts = 0;

    while (attempts < 20) {
      const question = createQuestion(operation, effectiveDifficulty, grade, mode, layoutMode);

      if (!uniqueQuestions.has(question.text)) {
        uniqueQuestions.set(question.text, question);
        break;
      }

      attempts += 1;
    }
  }

  while (uniqueQuestions.size < questionCount) {
    const fallbackQuestion = createQuestion(operation, difficulty, grade, mode, layoutMode);
    uniqueQuestions.set(`${fallbackQuestion.text} ${uniqueQuestions.size}`, fallbackQuestion);
  }

  return [...uniqueQuestions.values()];
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
