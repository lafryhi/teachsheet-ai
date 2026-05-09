function getRandomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRange(difficulty) {
  if (difficulty === "easy") {
    return { min: 1, max: 20 };
  }

  if (difficulty === "medium") {
    return { min: 10, max: 100 };
  }

  return { min: 50, max: 999 };
}

export function createQuestion(operation, difficulty) {
  const range = getRange(difficulty);
  let a = getRandomNumber(range.min, range.max);
  let b = getRandomNumber(range.min, range.max);

  if (operation === "mixed") {
    const operations = ["addition", "subtraction", "multiplication", "division"];
    operation = operations[getRandomNumber(0, operations.length - 1)];
  }

  if (operation === "addition") {
    return { text: `${a} + ${b} =`, answer: a + b };
  }

  if (operation === "subtraction") {
    if (b > a) {
      [a, b] = [b, a];
    }

    return { text: `${a} - ${b} =`, answer: a - b };
  }

  if (operation === "multiplication") {
    if (difficulty === "easy") {
      a = getRandomNumber(1, 10);
      b = getRandomNumber(1, 10);
    } else if (difficulty === "medium") {
      a = getRandomNumber(2, 12);
      b = getRandomNumber(2, 12);
    } else {
      a = getRandomNumber(10, 99);
      b = getRandomNumber(2, 12);
    }

    return { text: `${a} × ${b} =`, answer: a * b };
  }

  if (operation === "division") {
    b = getRandomNumber(2, 12);
    const result = getRandomNumber(2, 12);
    a = b * result;
    return { text: `${a} ÷ ${b} =`, answer: result };
  }

  return { text: `${a} + ${b} =`, answer: a + b };
}

export function generateQuestions({ operation, difficulty, questionCount }) {
  return Array.from({ length: questionCount }, () => createQuestion(operation, difficulty));
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
