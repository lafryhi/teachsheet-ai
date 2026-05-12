import {
  getOperationProfile,
  normalizeLayoutMode
} from "./curriculumRules.js";
import { estimateQuestionLayout } from "./paginationEstimator.js";

function getRandomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function choose(items) {
  return items[getRandomNumber(0, items.length - 1)];
}

function countCarrySteps(a, b) {
  let left = a;
  let right = b;
  let carries = 0;
  let carry = 0;

  while (left > 0 || right > 0) {
    const digitSum = (left % 10) + (right % 10) + carry;
    if (digitSum >= 10) {
      carries += 1;
      carry = 1;
    } else {
      carry = 0;
    }
    left = Math.floor(left / 10);
    right = Math.floor(right / 10);
  }

  return carries;
}

function countBorrowSteps(a, b) {
  const topDigits = String(a).split("").reverse().map(Number);
  const bottomDigits = String(b).split("").reverse().map(Number);
  const length = Math.max(topDigits.length, bottomDigits.length);
  let borrow = 0;
  let borrowCount = 0;

  for (let index = 0; index < length; index += 1) {
    const topDigit = (topDigits[index] || 0) - borrow;
    const bottomDigit = bottomDigits[index] || 0;

    if (topDigit < bottomDigit) {
      borrow = 1;
      borrowCount += 1;
    } else {
      borrow = 0;
    }
  }

  return borrowCount;
}

function padLeft(value, width) {
  return String(value).padStart(width, " ");
}

function formatVerticalOperation(topLine, bottomLine, answerPlaceholder = "____") {
  return [topLine, bottomLine, "----", answerPlaceholder].join("\n");
}

function buildSignature(operation, patternId, operands, extra = "") {
  return `${operation}|${patternId}|${operands.join(",")}${extra ? `|${extra}` : ""}`;
}

function decorateQuestion(question) {
  const layoutHints = estimateQuestionLayout(question);

  return {
    ...question,
    layoutHints
  };
}

function createQuestion({
  text,
  answer,
  operation,
  patternId,
  family,
  operands = [],
  result = null,
  format = "horizontal",
  answerLine = format !== "vertical",
  commutative = false
}) {
  return decorateQuestion({
    text,
    answer: String(answer),
    answerLine,
    format,
    operation,
    patternId,
    family,
    operands,
    result,
    resultKey: result === null || result === undefined ? null : String(result),
    signature: buildSignature(operation, patternId, operands, format),
    commutative
  });
}

function pickAdditionOperands(profile, needsRegrouping) {
  const { min, max } = profile.range;

  for (let attempt = 0; attempt < 80; attempt += 1) {
    const a = getRandomNumber(min, max);
    const b = getRandomNumber(min, max);
    const carrySteps = countCarrySteps(a, b);

    if (needsRegrouping && carrySteps === 0) {
      continue;
    }

    if (!needsRegrouping && carrySteps > 0) {
      continue;
    }

    if (carrySteps > profile.maxCarrySteps) {
      continue;
    }

    return { a, b };
  }

  return {
    a: getRandomNumber(min, max),
    b: getRandomNumber(min, max)
  };
}

function pickSubtractionOperands(profile, needsRegrouping) {
  const { min, max } = profile.range;

  for (let attempt = 0; attempt < 80; attempt += 1) {
    let a = getRandomNumber(min, max);
    let b = getRandomNumber(min, max);

    if (b > a) {
      [a, b] = [b, a];
    }

    const borrowSteps = countBorrowSteps(a, b);

    if (needsRegrouping && borrowSteps === 0) {
      continue;
    }

    if (!needsRegrouping && borrowSteps > 0) {
      continue;
    }

    if (borrowSteps > profile.maxCarrySteps) {
      continue;
    }

    return { a, b };
  }

  let a = getRandomNumber(min, max);
  let b = getRandomNumber(min, max);
  if (b > a) {
    [a, b] = [b, a];
  }
  return { a, b };
}

function pickMultiplicationOperands(profile) {
  const a = getRandomNumber(profile.range.min, profile.range.max);
  const b = getRandomNumber(profile.range.min, profile.range.max);

  if (profile.allowTwoDigitFactor && Math.random() > 0.58) {
    return {
      a: getRandomNumber(12, 99),
      b
    };
  }

  return { a, b };
}

function pickDivisionOperands(profile) {
  const divisor = getRandomNumber(profile.range.min, profile.range.max);
  const quotient = getRandomNumber(profile.range.min, profile.range.max);
  const dividend = divisor * quotient;

  if (profile.allowLargeDividend && Math.random() > 0.55) {
    const largeQuotient = getRandomNumber(Math.max(6, profile.range.min), profile.range.max + 6);
    return {
      divisor,
      quotient: largeQuotient,
      dividend: divisor * largeQuotient
    };
  }

  return { divisor, quotient, dividend };
}

function buildWordProblemText(operation, left, right, result, complexity = 1) {
  const contexts = {
    addition: [
      ["sticks", "Aya collected", "found"],
      ["books", "Sam stacked", "added"],
      ["stickers", "Lina had", "received"]
    ],
    subtraction: [
      ["crayons", "Omar had", "then gave away"],
      ["shells", "Sara collected", "then used"],
      ["cookies", "Youssef baked", "then shared"]
    ],
    multiplication: [
      ["boxes", "A teacher prepared", "with"],
      ["rows of chairs", "The hall arranged", "with"],
      ["bags", "A shop packed", "with"]
    ],
    division: [
      ["markers", "Ms. Amal shared", "equally among"],
      ["cards", "A class sorted", "equally into"],
      ["apples", "A farmer packed", "equally into"]
    ]
  };
  const [objectLabel, leadPhrase, transitionPhrase] = choose(contexts[operation] || contexts.addition);

  if (operation === "addition") {
    return complexity >= 2
      ? `${leadPhrase} ${left} ${objectLabel}. Later, she ${transitionPhrase} ${right} more. How many ${objectLabel} does she have now?`
      : `${leadPhrase} ${left} ${objectLabel} and ${transitionPhrase} ${right} more. How many ${objectLabel} are there altogether?`;
  }

  if (operation === "subtraction") {
    return complexity >= 2
      ? `${leadPhrase} ${left} ${objectLabel}. Next, ${right} were taken away. How many ${objectLabel} are left?`
      : `${leadPhrase} ${left} ${objectLabel}, then ${right} were taken away. How many ${objectLabel} remain?`;
  }

  if (operation === "multiplication") {
    return complexity >= 2
      ? `${leadPhrase} ${left} ${objectLabel}, each ${transitionPhrase} ${right} items. How many items are there in total?`
      : `${leadPhrase} ${left} ${objectLabel} with ${right} in each. How many are there altogether?`;
  }

  return complexity >= 2
    ? `${leadPhrase} ${left} ${objectLabel} ${transitionPhrase} ${right} groups. How many are in each group?`
    : `${leadPhrase} ${left} ${objectLabel} into ${right} equal groups. How many are in each group?`;
}

function createTrueFalseStatement(expression, correctAnswer) {
  const shouldBeTrue = Math.random() > 0.45;
  const offset = choose([-2, -1, 1, 2, 5, 10]);
  const shownAnswer = shouldBeTrue ? correctAnswer : correctAnswer + offset;

  return {
    text: `True or False: ${expression} = ${shownAnswer}`,
    answer: shouldBeTrue ? "True" : "False"
  };
}

function createAdditionCandidate(patternId, profile, layoutMode) {
  const needsRegrouping = profile.allowRegrouping && !profile.preferNoRegrouping && ["vertical", "word-problem", "compare-total"].includes(patternId);
  const { a, b } = pickAdditionOperands(profile, needsRegrouping);
  const result = a + b;
  const width = Math.max(String(a).length, String(b).length) + 1;

  if (patternId === "vertical") {
    return createQuestion({
      text: formatVerticalOperation(padLeft(a, width), `+${padLeft(b, width - 1)}`),
      answer: result,
      operation: "addition",
      patternId,
      family: "direct",
      operands: [a, b],
      result,
      format: "vertical",
      commutative: true
    });
  }

  if (patternId === "missing-addend") {
    return createQuestion({
      text: `${a} + ___ = ${result}`,
      answer: `Missing number: ${b}`,
      operation: "addition",
      patternId,
      family: "reasoning",
      operands: [a, b],
      result,
      commutative: true
    });
  }

  if (patternId === "compare-total") {
    const { a: c, b: d } = pickAdditionOperands(profile, false);
    const leftTotal = a + b;
    const rightTotal = c + d;

    return createQuestion({
      text: `Compare the totals: ${a} + ${b} __ ${c} + ${d}`,
      answer: leftTotal === rightTotal ? "=" : leftTotal > rightTotal ? ">" : "<",
      operation: "addition",
      patternId,
      family: "reasoning",
      operands: [a, b, c, d],
      result: `${leftTotal}-${rightTotal}`,
      commutative: false
    });
  }

  if (patternId === "mental-math") {
    const left = choose([a, Math.round(a / 10) * 10, a % 10 === 0 ? a : a + (10 - (a % 10))]);
    const right = choose([b, 10 - (left % 10 || 10), b]);
    return createQuestion({
      text: `Mental math: ${left} + ${Math.max(1, right)} =`,
      answer: left + Math.max(1, right),
      operation: "addition",
      patternId,
      family: "fluency",
      operands: [left, Math.max(1, right)],
      result: left + Math.max(1, right),
      commutative: true
    });
  }

  if (patternId === "true-false") {
    const statement = createTrueFalseStatement(`${a} + ${b}`, result);
    return createQuestion({
      text: statement.text,
      answer: statement.answer,
      operation: "addition",
      patternId,
      family: "checking",
      operands: [a, b],
      result,
      commutative: true
    });
  }

  if (patternId === "word-problem") {
    return createQuestion({
      text: buildWordProblemText("addition", a, b, result, profile.wordProblemComplexity),
      answer: result,
      operation: "addition",
      patternId,
      family: "application",
      operands: [a, b],
      result,
      commutative: true
    });
  }

  return createQuestion({
    text: `${a} + ${b} =`,
    answer: result,
    operation: "addition",
    patternId: "horizontal",
    family: "direct",
    operands: [a, b],
    result,
    commutative: true
  });
}

function createSubtractionCandidate(patternId, profile) {
  const needsRegrouping = profile.allowRegrouping && !profile.preferNoRegrouping && ["vertical", "word-problem", "compare-difference"].includes(patternId);
  const { a, b } = pickSubtractionOperands(profile, needsRegrouping);
  const result = a - b;
  const width = Math.max(String(a).length, String(b).length) + 1;

  if (patternId === "vertical") {
    return createQuestion({
      text: formatVerticalOperation(padLeft(a, width), `-${padLeft(b, width - 1)}`),
      answer: result,
      operation: "subtraction",
      patternId,
      family: "direct",
      operands: [a, b],
      result,
      format: "vertical"
    });
  }

  if (patternId === "missing-subtrahend") {
    return createQuestion({
      text: `${a} - ___ = ${result}`,
      answer: `Missing number: ${b}`,
      operation: "subtraction",
      patternId,
      family: "reasoning",
      operands: [a, b],
      result
    });
  }

  if (patternId === "compare-difference") {
    const other = pickSubtractionOperands(profile, false);
    const otherResult = other.a - other.b;

    return createQuestion({
      text: `Compare the differences: ${a} - ${b} __ ${other.a} - ${other.b}`,
      answer: result === otherResult ? "=" : result > otherResult ? ">" : "<",
      operation: "subtraction",
      patternId,
      family: "reasoning",
      operands: [a, b, other.a, other.b],
      result: `${result}-${otherResult}`
    });
  }

  if (patternId === "mental-math") {
    const tenFriendly = Math.round(a / 10) * 10;
    const adjustment = Math.min(tenFriendly, Math.max(1, b % 10 || 5));
    return createQuestion({
      text: `Mental math: ${tenFriendly} - ${adjustment} =`,
      answer: tenFriendly - adjustment,
      operation: "subtraction",
      patternId,
      family: "fluency",
      operands: [tenFriendly, adjustment],
      result: tenFriendly - adjustment
    });
  }

  if (patternId === "true-false") {
    const statement = createTrueFalseStatement(`${a} - ${b}`, result);
    return createQuestion({
      text: statement.text,
      answer: statement.answer,
      operation: "subtraction",
      patternId,
      family: "checking",
      operands: [a, b],
      result
    });
  }

  if (patternId === "word-problem") {
    return createQuestion({
      text: buildWordProblemText("subtraction", a, b, result, profile.wordProblemComplexity),
      answer: result,
      operation: "subtraction",
      patternId,
      family: "application",
      operands: [a, b],
      result
    });
  }

  return createQuestion({
    text: `${a} - ${b} =`,
    answer: result,
    operation: "subtraction",
    patternId: "horizontal",
    family: "direct",
    operands: [a, b],
    result
  });
}

function createMultiplicationCandidate(patternId, profile) {
  const { a, b } = pickMultiplicationOperands(profile);
  const result = a * b;
  const width = Math.max(String(a).length, String(b).length) + 1;

  if (patternId === "vertical") {
    return createQuestion({
      text: formatVerticalOperation(padLeft(a, width), `x${padLeft(b, width - 1)}`),
      answer: result,
      operation: "multiplication",
      patternId,
      family: "direct",
      operands: [a, b],
      result,
      format: "vertical",
      commutative: true
    });
  }

  if (patternId === "missing-factor") {
    return createQuestion({
      text: `${a} x ___ = ${result}`,
      answer: `Missing factor: ${b}`,
      operation: "multiplication",
      patternId,
      family: "reasoning",
      operands: [a, b],
      result,
      commutative: true
    });
  }

  if (patternId === "groups") {
    return createQuestion({
      text: `${a} groups of ${b} =`,
      answer: `Total: ${result}`,
      operation: "multiplication",
      patternId,
      family: "application",
      operands: [a, b],
      result,
      commutative: true
    });
  }

  if (patternId === "mental-math") {
    const mentalLeft = choose([a, 5, 10]);
    const mentalRight = choose([b, 2, 4, 8]);
    return createQuestion({
      text: `Mental math: ${mentalLeft} x ${mentalRight} =`,
      answer: mentalLeft * mentalRight,
      operation: "multiplication",
      patternId,
      family: "fluency",
      operands: [mentalLeft, mentalRight],
      result: mentalLeft * mentalRight,
      commutative: true
    });
  }

  if (patternId === "true-false") {
    const statement = createTrueFalseStatement(`${a} x ${b}`, result);
    return createQuestion({
      text: statement.text,
      answer: statement.answer,
      operation: "multiplication",
      patternId,
      family: "checking",
      operands: [a, b],
      result,
      commutative: true
    });
  }

  if (patternId === "word-problem") {
    return createQuestion({
      text: buildWordProblemText("multiplication", a, b, result, profile.wordProblemComplexity),
      answer: result,
      operation: "multiplication",
      patternId,
      family: "application",
      operands: [a, b],
      result,
      commutative: true
    });
  }

  return createQuestion({
    text: `${a} x ${b} =`,
    answer: result,
    operation: "multiplication",
    patternId: "horizontal",
    family: "direct",
    operands: [a, b],
    result,
    commutative: true
  });
}

function createDivisionCandidate(patternId, profile) {
  const { divisor, quotient, dividend } = pickDivisionOperands(profile);
  const result = quotient;

  if (patternId === "vertical") {
    return createQuestion({
      text: `${divisor})${dividend}\n____`,
      answer: result,
      operation: "division",
      patternId,
      family: "direct",
      operands: [dividend, divisor],
      result,
      format: "vertical"
    });
  }

  if (patternId === "missing-divisor") {
    return createQuestion({
      text: `${dividend} / ___ = ${quotient}`,
      answer: `Missing divisor: ${divisor}`,
      operation: "division",
      patternId,
      family: "reasoning",
      operands: [dividend, divisor],
      result
    });
  }

  if (patternId === "equal-groups") {
    return createQuestion({
      text: `Share ${dividend} into ${divisor} equal groups =`,
      answer: `Each group: ${quotient}`,
      operation: "division",
      patternId,
      family: "application",
      operands: [dividend, divisor],
      result
    });
  }

  if (patternId === "mental-math") {
    const mentalDivisor = choose([2, 4, 5, 10]);
    const mentalQuotient = choose([3, 4, 6, 8, 9]);
    const mentalDividend = mentalDivisor * mentalQuotient;
    return createQuestion({
      text: `Mental math: ${mentalDividend} / ${mentalDivisor} =`,
      answer: mentalQuotient,
      operation: "division",
      patternId,
      family: "fluency",
      operands: [mentalDividend, mentalDivisor],
      result: mentalQuotient
    });
  }

  if (patternId === "true-false") {
    const statement = createTrueFalseStatement(`${dividend} / ${divisor}`, result);
    return createQuestion({
      text: statement.text,
      answer: statement.answer,
      operation: "division",
      patternId,
      family: "checking",
      operands: [dividend, divisor],
      result
    });
  }

  if (patternId === "word-problem") {
    return createQuestion({
      text: buildWordProblemText("division", dividend, divisor, result, profile.wordProblemComplexity),
      answer: result,
      operation: "division",
      patternId,
      family: "application",
      operands: [dividend, divisor],
      result
    });
  }

  return createQuestion({
    text: `${dividend} / ${divisor} =`,
    answer: result,
    operation: "division",
    patternId: "horizontal",
    family: "direct",
    operands: [dividend, divisor],
    result
  });
}

export function createMathQuestionCandidate({
  operation,
  pattern,
  slot,
  grade = "Grade 2",
  mode = "practice",
  layoutMode = "horizontal"
}) {
  const profile = getOperationProfile({
    operation,
    difficulty: slot.difficulty,
    grade,
    mode,
    complexity: slot.stage === "stretch" || slot.stage === "check-understanding" ? 1 : 0
  });
  const preferredLayout = normalizeLayoutMode(layoutMode);
  const patternId = pattern.id === "horizontal" || pattern.id === "vertical"
    ? preferredLayout === "vertical" && pattern.id === "horizontal"
      ? "horizontal"
      : pattern.id
    : pattern.id;

  if (operation === "addition") {
    return createAdditionCandidate(patternId, profile, preferredLayout);
  }

  if (operation === "subtraction") {
    return createSubtractionCandidate(patternId, profile, preferredLayout);
  }

  if (operation === "multiplication") {
    return createMultiplicationCandidate(patternId, profile, preferredLayout);
  }

  return createDivisionCandidate(patternId, profile, preferredLayout);
}
