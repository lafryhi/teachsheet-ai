import {
  getGradeNumber,
  normalizeLayoutMode,
  normalizeMode,
  normalizeOperation
} from "./math/curriculumRules.js";
import { estimateQuestionLayout } from "./math/paginationEstimator.js";
import { createMathQuestionCandidate } from "./math/questionFactory.js";
import {
  getQuestionDisplayText,
  hasRenderableQuestionText
} from "./worksheetPresentation.js";

function resolveMathFallbackNumbers(operation, gradeNumber = 2) {
  const presets = {
    addition: {
      1: [8, 5],
      2: [12, 7],
      3: [24, 18],
      4: [46, 27],
      5: [125, 46]
    },
    subtraction: {
      1: [14, 3],
      2: [18, 6],
      3: [42, 17],
      4: [73, 28],
      5: [164, 57]
    },
    multiplication: {
      1: [3, 2],
      2: [4, 3],
      3: [6, 4],
      4: [8, 7],
      5: [12, 6]
    },
    division: {
      1: [12, 3],
      2: [16, 4],
      3: [24, 6],
      4: [36, 9],
      5: [48, 8]
    }
  };
  const safeGrade = Math.min(5, Math.max(1, gradeNumber || 2));

  return presets[operation]?.[safeGrade] || presets.addition[2];
}

function buildMathFallbackQuestion(question, request, index) {
  const operation = normalizeOperation(question?.operation || request?.topic || "addition");
  const safeOperation = operation === "mixed" ? "addition" : operation;
  const difficulty = question?.difficulty || request?.difficulty || "medium";
  const grade = request?.grade || "Grade 2";
  const mode = normalizeMode(request?.mode || "practice");
  const layoutMode = normalizeLayoutMode(
    question?.format === "vertical"
      ? "vertical"
      : (request?.layoutMode || "horizontal")
  );
  const fallbackCandidate = createMathQuestionCandidate({
    operation: safeOperation,
    pattern: {
      id: layoutMode === "vertical" ? "vertical" : "horizontal",
      family: "direct"
    },
    slot: {
      stage: "core",
      difficulty
    },
    grade,
    mode,
    layoutMode
  });

  if (hasRenderableQuestionText(fallbackCandidate)) {
    return {
      ...fallbackCandidate,
      fallbackApplied: true,
      fallbackReason: "blank-question-text"
    };
  }

  const gradeNumber = getGradeNumber(grade);
  const [left, right] = resolveMathFallbackNumbers(safeOperation, gradeNumber);
  const symbolMap = {
    addition: "+",
    subtraction: "-",
    multiplication: "x",
    division: "/"
  };
  const symbol = symbolMap[safeOperation] || "+";
  const computedAnswer = safeOperation === "addition"
    ? left + right
    : safeOperation === "subtraction"
      ? left - right
      : safeOperation === "multiplication"
        ? left * right
        : left / right;

  return {
    text: `${left} ${symbol} ${right} =`,
    finalText: `${left} ${symbol} ${right} =`,
    answer: String(computedAnswer),
    answerLine: true,
    format: "horizontal",
    operation: safeOperation,
    patternId: "horizontal",
    family: "direct",
    operands: [left, right],
    result: computedAnswer,
    resultKey: String(computedAnswer),
    commutative: ["addition", "multiplication"].includes(safeOperation),
    signature: `fallback|${safeOperation}|${index + 1}|${left},${right}`,
    fallbackApplied: true,
    fallbackReason: "blank-question-text",
    layoutHints: estimateQuestionLayout({
      text: `${left} ${symbol} ${right} =`,
      format: "horizontal",
      answerLine: true,
      patternId: "horizontal"
    })
  };
}

function buildGenericFallbackQuestion(question, request, index) {
  const type = String(request?.type || "worksheet").toLowerCase();
  const genericByType = {
    grammar: {
      text: "Read the sentence and write the correct answer.",
      answer: "Sample answer"
    },
    reading: {
      text: "Read the short passage and answer the question.",
      answer: "Sample answer"
    },
    tracing: {
      text: "Trace the model carefully on the line.",
      answer: "trace",
      answerLine: false
    },
    coloring: {
      text: "Color the picture carefully and follow the instruction.",
      answer: "color",
      answerLine: false
    }
  };
  const fallback = genericByType[type] || {
    text: `Complete question ${index + 1}.`,
    answer: "Sample answer"
  };

  return {
    ...question,
    ...fallback,
    finalText: fallback.text,
    fallbackApplied: true,
    fallbackReason: "blank-question-text",
    layoutHints: estimateQuestionLayout({
      text: fallback.text,
      format: question?.format || "horizontal",
      answerLine: fallback.answerLine === false ? false : true,
      patternId: question?.patternId || "horizontal"
    })
  };
}

function buildFallbackQuestion(question, request, index) {
  if ((request?.type || "math") === "math" || question?.operation) {
    return buildMathFallbackQuestion(question, request, index);
  }

  return buildGenericFallbackQuestion(question, request, index);
}

function normalizeQuestion(question, request, index) {
  const baseQuestion = question && typeof question === "object" ? { ...question } : {};
  const displayText = getQuestionDisplayText(baseQuestion);

  if (!hasRenderableQuestionText(baseQuestion)) {
    const fallbackQuestion = buildFallbackQuestion(baseQuestion, request, index);

    return {
      ...baseQuestion,
      ...fallbackQuestion,
      sequenceIndex: baseQuestion.sequenceIndex || fallbackQuestion.sequenceIndex || index + 1,
      difficulty: baseQuestion.difficulty || fallbackQuestion.difficulty || request?.difficulty || "medium",
      stage: baseQuestion.stage || fallbackQuestion.stage || "core",
      sectionKey: baseQuestion.sectionKey || fallbackQuestion.sectionKey || "practice",
      sectionLabel: baseQuestion.sectionLabel || fallbackQuestion.sectionLabel || "Practice",
      sectionInstruction: baseQuestion.sectionInstruction || fallbackQuestion.sectionInstruction || "",
      sectionStart: Boolean(baseQuestion.sectionStart)
    };
  }

  const normalizedQuestion = {
    ...baseQuestion,
    text: displayText,
    finalText: displayText,
    answer: baseQuestion.answer === undefined || baseQuestion.answer === null
      ? ""
      : String(baseQuestion.answer)
  };

  if (!normalizedQuestion.layoutHints) {
    normalizedQuestion.layoutHints = estimateQuestionLayout(normalizedQuestion);
  }

  return normalizedQuestion;
}

export function sanitizeWorksheetQuestions(questions, request = {}) {
  const safeQuestions = Array.isArray(questions) ? questions : [];
  let repairedCount = 0;

  const sanitizedQuestions = safeQuestions.map((question, index) => {
    const normalized = normalizeQuestion(question, request, index);

    if (normalized.fallbackApplied) {
      repairedCount += 1;
    }

    return normalized;
  });

  return {
    questions: sanitizedQuestions,
    repairedCount
  };
}
