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

export function parseCompareQuestionText(text = "") {
  const normalized = String(text || "").trim();
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
      || parseCompareQuestionText(question?.text)
  );
}
