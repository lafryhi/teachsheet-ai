export function normalizeWhitespace(value = "") {
  return String(value).replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
}

export function normalizeStudentName(value = "") {
  const normalized = normalizeWhitespace(value);

  if (!normalized) {
    return "";
  }

  return normalized.replace(/^sdudent\b/i, "student");
}

export function hasMeaningfulStudentName(value = "") {
  const normalized = normalizeStudentName(value);

  if (!normalized) {
    return false;
  }

  return !/^student(?:\s*\d+)?$/i.test(normalized);
}

export function getStudentDisplayValue(value = "", fallback = "---") {
  return hasMeaningfulStudentName(value) ? normalizeStudentName(value) : fallback;
}

export function getScoreTarget(value = "", fallback = "10") {
  const normalized = normalizeWhitespace(value).replace(/^_+\s*\/?\s*/g, "").replace(/^\/+\s*/, "");
  return normalized || fallback;
}

export function sanitizeTeacherNotes(value = "") {
  const normalized = String(value)
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n")
    .trim();

  if (!normalized) {
    return "";
  }

  const compact = normalized.toLowerCase();

  if (/^(test|note|notes|debug|todo|t\d+)$/i.test(compact)) {
    return "";
  }

  if (compact.length <= 6 && !compact.includes(" ")) {
    return "";
  }

  return normalized;
}

export function shouldShowTeacherNotes(value = "", { currentPage = 1, pageKind = "questions" } = {}) {
  return currentPage === 1 && pageKind !== "answer-key" && Boolean(sanitizeTeacherNotes(value));
}

function extractQuestionTextCandidate(question = {}) {
  if (!question || typeof question !== "object") {
    return question;
  }

  if (typeof question.finalText === "string" && question.finalText.trim()) {
    return question.finalText;
  }

  if (typeof question.displayText === "string" && question.displayText.trim()) {
    return question.displayText;
  }

  if (typeof question.text === "string" && question.text.trim()) {
    return question.text;
  }

  if (typeof question.prompt === "string" && question.prompt.trim()) {
    return question.prompt;
  }

  if (Array.isArray(question.content) && question.content.length > 0) {
    return question.content.join("\n");
  }

  if (typeof question.content === "string" && question.content.trim()) {
    return question.content;
  }

  return "";
}

function trimBlankOuterLines(lines = []) {
  const copy = [...lines];

  while (copy.length > 0 && !String(copy[0] || "").trim()) {
    copy.shift();
  }

  while (copy.length > 0 && !String(copy[copy.length - 1] || "").trim()) {
    copy.pop();
  }

  return copy;
}

export function getQuestionDisplayText(question = {}) {
  const preserveIndentation = question?.format === "vertical";
  const candidate = extractQuestionTextCandidate(question);

  if (candidate === null || candidate === undefined) {
    return "";
  }

  const normalized = String(candidate).replace(/\r\n/g, "\n");
  const lines = trimBlankOuterLines(normalized.split("\n"));

  if (lines.length === 0) {
    return "";
  }

  if (preserveIndentation) {
    return lines
      .map((line) => String(line).replace(/\t/g, "    ").replace(/[ \t]+$/g, ""))
      .join("\n")
      .trimEnd();
  }

  return lines
    .map((line) => String(line).replace(/[ \t]+/g, " ").trim())
    .filter((line, index, values) => line || index === values.length - 1)
    .join("\n")
    .trim();
}

export function hasRenderableQuestionText(question = {}) {
  const displayText = getQuestionDisplayText(question);

  if (!displayText) {
    return false;
  }

  const meaningfulText = displayText
    .replace(/_{2,}/g, "")
    .replace(/[-=]{3,}/g, "")
    .replace(/\s+/g, "");

  return /[0-9A-Za-zÀ-ÿ+\-×x÷/><=()]/.test(meaningfulText);
}

export function parseCompareQuestionText(textOrQuestion = "") {
  const normalized = typeof textOrQuestion === "object" && textOrQuestion !== null
    ? getQuestionDisplayText(textOrQuestion)
    : String(textOrQuestion || "").trim();
  const match = normalized.match(/^Compare the ([^:]+):\s*(.+?)\s+_{2,}\s+(.+)$/i);

  if (!match) {
    return null;
  }

  return {
    heading: `Compare the ${match[1]}:`,
    leftExpression: match[2].trim(),
    rightExpression: match[3].trim()
  };
}

export function isCompareQuestion(question = {}) {
  return Boolean(
    ["compare-total", "compare-difference"].includes(question?.patternId)
      || parseCompareQuestionText(question)
  );
}
