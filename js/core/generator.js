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

function buildOperandRange(operation, difficulty, gradeNumber) {
  const isEarlyGrade = gradeNumber <= 2;
  const isUpperGrade = gradeNumber >= 4;

  if (operation === "multiplication" || operation === "division") {
    if (difficulty === "easy") {
      return isEarlyGrade ? { minA: 1, maxA: 5, minB: 1, maxB: 5 } : { minA: 2, maxA: 8, minB: 2, maxB: 8 };
    }

    if (difficulty === "medium") {
      return isUpperGrade ? { minA: 3, maxA: 12, minB: 3, maxB: 12 } : { minA: 2, maxA: 10, minB: 2, maxB: 10 };
    }

    return isUpperGrade ? { minA: 6, maxA: 12, minB: 4, maxB: 12 } : { minA: 3, maxA: 12, minB: 3, maxB: 12 };
  }

  if (difficulty === "easy") {
    return isEarlyGrade ? { min: 0, max: 20 } : { min: 0, max: 50 };
  }

  if (difficulty === "medium") {
    return isUpperGrade ? { min: 20, max: 200 } : { min: 10, max: 100 };
  }

  return isUpperGrade ? { min: 100, max: 999 } : { min: 40, max: 250 };
}

function createAnswer(text) {
  return String(text);
}

function buildAdditionQuestion(difficulty, gradeNumber, mode = "practice") {
  const range = buildOperandRange("addition", difficulty, gradeNumber);
  const a = getRandomNumber(range.min, range.max);
  const b = getRandomNumber(range.min, range.max);
  const patternPool = mode === "remediation"
    ? ["standard", "standard", "compare", "missing-addend"]
    : mode === "challenge"
      ? ["missing-addend", "compare", "missing-addend", "standard"]
      : ["standard", "missing-addend", "compare"];
  const pattern = pickRandom(patternPool);

  if (pattern === "missing-addend") {
    return {
      text: `${a} + ___ = ${a + b}`,
      answer: createAnswer(`Missing number: ${b}`)
    };
  }

  if (pattern === "compare") {
    return {
      text: `Find the sum: ${a} + ${b} =`,
      answer: a + b
    };
  }

  return {
    text: `${a} + ${b} =`,
    answer: createAnswer(a + b)
  };
}

function buildSubtractionQuestion(difficulty, gradeNumber, mode = "practice") {
  const range = buildOperandRange("subtraction", difficulty, gradeNumber);
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

  if (pattern === "missing-number") {
    return {
      text: `${a} - ___ = ${a - b}`,
      answer: createAnswer(`Missing number: ${b}`)
    };
  }

  if (pattern === "wording") {
    return {
      text: `Subtract: ${a} - ${b} =`,
      answer: a - b
    };
  }

  return {
    text: `${a} - ${b} =`,
    answer: createAnswer(a - b)
  };
}

function buildMultiplicationQuestion(difficulty, gradeNumber, mode = "practice") {
  const range = buildOperandRange("multiplication", difficulty, gradeNumber);
  const a = getRandomNumber(range.minA, range.maxA);
  const b = getRandomNumber(range.minB, range.maxB);
  const patternPool = mode === "remediation"
    ? ["standard", "groups", "standard", "missing-factor"]
    : mode === "challenge"
      ? ["missing-factor", "groups", "standard", "missing-factor"]
      : ["standard", "missing-factor", "groups"];
  const pattern = pickRandom(patternPool);

  if (pattern === "missing-factor") {
    return {
      text: `${a} × ___ = ${a * b}`,
      answer: createAnswer(`Missing factor: ${b}`)
    };
  }

  if (pattern === "groups") {
    return {
      text: `${a} groups of ${b} =`,
      answer: createAnswer(`Total: ${a * b}`)
    };
  }

  return {
    text: `${a} × ${b} =`,
    answer: createAnswer(a * b)
  };
}

function buildDivisionQuestion(difficulty, gradeNumber, mode = "practice") {
  const range = buildOperandRange("division", difficulty, gradeNumber);
  const divisor = getRandomNumber(range.minB, range.maxB);
  const quotient = getRandomNumber(range.minA, range.maxA);
  const dividend = divisor * quotient;
  const patternPool = mode === "remediation"
    ? ["standard", "share", "standard", "missing-divisor"]
    : mode === "challenge"
      ? ["missing-divisor", "share", "standard", "missing-divisor"]
      : ["standard", "missing-divisor", "share"];
  const pattern = pickRandom(patternPool);

  if (pattern === "missing-divisor") {
    return {
      text: `${dividend} ÷ ___ = ${quotient}`,
      answer: createAnswer(`Missing divisor: ${divisor}`)
    };
  }

  if (pattern === "share") {
    return {
      text: `Share ${dividend} into ${divisor} equal groups =`,
      answer: createAnswer(`Each group: ${quotient}`)
    };
  }

  return {
    text: `${dividend} ÷ ${divisor} =`,
    answer: createAnswer(quotient)
  };
}

function buildQuestionByOperation(operation, difficulty, gradeNumber, mode) {
  if (operation === "addition") {
    return buildAdditionQuestion(difficulty, gradeNumber, mode);
  }

  if (operation === "subtraction") {
    return buildSubtractionQuestion(difficulty, gradeNumber, mode);
  }

  if (operation === "multiplication") {
    return buildMultiplicationQuestion(difficulty, gradeNumber, mode);
  }

  if (operation === "division") {
    return buildDivisionQuestion(difficulty, gradeNumber, mode);
  }

  return buildAdditionQuestion(difficulty, gradeNumber, mode);
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

export function createQuestion(operation, difficulty, grade = "Grade 2", mode = "practice") {
  const gradeNumber = getGradeNumber(grade);
  const resolvedOperation = operation === "mixed"
    ? pickRandom(["addition", "subtraction", "multiplication", "division"])
    : operation;

  return buildQuestionByOperation(resolvedOperation, difficulty, gradeNumber, normalizeMode(mode));
}

export function generateQuestions({ operation, difficulty, questionCount, grade, mode = "practice" }) {
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
      const question = createQuestion(operation, effectiveDifficulty, grade, mode);

      if (!uniqueQuestions.has(question.text)) {
        uniqueQuestions.set(question.text, question);
        break;
      }

      attempts += 1;
    }
  }

  while (uniqueQuestions.size < questionCount) {
    const fallbackQuestion = createQuestion(operation, difficulty, grade, mode);
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
