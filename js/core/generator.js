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

function buildAdditionQuestion(difficulty, gradeNumber) {
  const range = buildOperandRange("addition", difficulty, gradeNumber);
  const a = getRandomNumber(range.min, range.max);
  const b = getRandomNumber(range.min, range.max);
  const pattern = pickRandom(["standard", "missing-addend", "compare"]);

  if (pattern === "missing-addend") {
    return {
      text: `${a} + ___ = ${a + b}`,
      answer: b
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
    answer: a + b
  };
}

function buildSubtractionQuestion(difficulty, gradeNumber) {
  const range = buildOperandRange("subtraction", difficulty, gradeNumber);
  let a = getRandomNumber(range.min, range.max);
  let b = getRandomNumber(range.min, range.max);

  if (b > a) {
    [a, b] = [b, a];
  }

  const pattern = pickRandom(["standard", "missing-number", "wording"]);

  if (pattern === "missing-number") {
    return {
      text: `${a} - ___ = ${a - b}`,
      answer: b
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
    answer: a - b
  };
}

function buildMultiplicationQuestion(difficulty, gradeNumber) {
  const range = buildOperandRange("multiplication", difficulty, gradeNumber);
  const a = getRandomNumber(range.minA, range.maxA);
  const b = getRandomNumber(range.minB, range.maxB);
  const pattern = pickRandom(["standard", "missing-factor", "groups"]);

  if (pattern === "missing-factor") {
    return {
      text: `${a} × ___ = ${a * b}`,
      answer: b
    };
  }

  if (pattern === "groups") {
    return {
      text: `${a} groups of ${b} =`,
      answer: a * b
    };
  }

  return {
    text: `${a} × ${b} =`,
    answer: a * b
  };
}

function buildDivisionQuestion(difficulty, gradeNumber) {
  const range = buildOperandRange("division", difficulty, gradeNumber);
  const divisor = getRandomNumber(range.minB, range.maxB);
  const quotient = getRandomNumber(range.minA, range.maxA);
  const dividend = divisor * quotient;
  const pattern = pickRandom(["standard", "missing-divisor", "share"]);

  if (pattern === "missing-divisor") {
    return {
      text: `${dividend} ÷ ___ = ${quotient}`,
      answer: divisor
    };
  }

  if (pattern === "share") {
    return {
      text: `Share ${dividend} into ${divisor} equal groups =`,
      answer: quotient
    };
  }

  return {
    text: `${dividend} ÷ ${divisor} =`,
    answer: quotient
  };
}

function buildQuestionByOperation(operation, difficulty, gradeNumber) {
  if (operation === "addition") {
    return buildAdditionQuestion(difficulty, gradeNumber);
  }

  if (operation === "subtraction") {
    return buildSubtractionQuestion(difficulty, gradeNumber);
  }

  if (operation === "multiplication") {
    return buildMultiplicationQuestion(difficulty, gradeNumber);
  }

  if (operation === "division") {
    return buildDivisionQuestion(difficulty, gradeNumber);
  }

  return buildAdditionQuestion(difficulty, gradeNumber);
}

export function createQuestion(operation, difficulty, grade = "Grade 2") {
  const gradeNumber = getGradeNumber(grade);
  const resolvedOperation = operation === "mixed"
    ? pickRandom(["addition", "subtraction", "multiplication", "division"])
    : operation;

  return buildQuestionByOperation(resolvedOperation, difficulty, gradeNumber);
}

export function generateQuestions({ operation, difficulty, questionCount, grade }) {
  const uniqueQuestions = new Map();

  while (uniqueQuestions.size < questionCount) {
    const question = createQuestion(operation, difficulty, grade);
    uniqueQuestions.set(question.text, question);
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
