import { normalizeLayoutMode, normalizeOperation } from "./curriculumRules.js";
import { getTeacherModeLabel, normalizeTeacherMode } from "./teacherModes.js";

function capitalizeWords(text = "") {
  return String(text)
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getOperationPhrase(operation = "addition") {
  const resolvedOperation = normalizeOperation(operation);

  if (resolvedOperation === "mixed") {
    return "mixed operations";
  }

  return `${resolvedOperation}s`;
}

function getLayoutLead(operation, layoutMode, focusPattern) {
  const operationPhrase = getOperationPhrase(operation);
  const resolvedLayout = normalizeLayoutMode(layoutMode);

  if (focusPattern === "mental-math") {
    return "Complete each mental math question quickly and accurately.";
  }

  if (resolvedLayout === "vertical") {
    return `Solve the following vertical ${operationPhrase}. Keep each place value lined up neatly.`;
  }

  if (normalizeOperation(operation) === "mixed") {
    return "Solve each mixed operation question carefully. Check the sign before you answer.";
  }

  return `Solve the following ${operationPhrase} carefully and show clear working when needed.`;
}

function getTeacherModeGuidance(teacherMode) {
  const resolvedTeacherMode = normalizeTeacherMode(teacherMode);

  if (resolvedTeacherMode === "homework") {
    return "Work independently, keep your writing neat, and check each answer before you finish.";
  }

  if (resolvedTeacherMode === "assessment") {
    return "Work independently, show your thinking, and answer every question without rushing.";
  }

  if (resolvedTeacherMode === "remediation") {
    return "Take each question step by step and use the examples in the earlier section to help you.";
  }

  if (resolvedTeacherMode === "fast-review") {
    return "Answer the review questions efficiently and move on once you are confident.";
  }

  return "Start carefully, keep your work organized, and complete every question in order.";
}

export function buildWorksheetInstruction({
  type = "math",
  topic = "addition",
  layoutMode = "horizontal",
  teacherMode = "practice",
  focusPattern = null
} = {}) {
  if (type !== "math") {
    return "Read each question carefully and complete every answer in the space provided.";
  }

  return `${getLayoutLead(topic, layoutMode, focusPattern)} ${getTeacherModeGuidance(teacherMode)}`;
}

export function buildSectionInstruction({
  sectionKey,
  operation = "addition",
  layoutMode = "horizontal",
  teacherMode = "practice",
  focusPattern = null
} = {}) {
  const operationPhrase = getOperationPhrase(operation);
  const resolvedLayout = normalizeLayoutMode(layoutMode);
  const resolvedTeacherMode = normalizeTeacherMode(teacherMode);

  if (sectionKey === "warm-up") {
    return focusPattern === "mental-math"
      ? "Use quick strategies and aim for accurate mental calculations."
      : `Begin with these short ${operationPhrase} to build confidence.`;
  }

  if (sectionKey === "mental-math") {
    return "Solve mentally when possible and write only the final answer.";
  }

  if (sectionKey === "practice") {
    return resolvedLayout === "vertical"
      ? `Complete these vertical ${operationPhrase} with careful digit alignment.`
      : `Work through these ${operationPhrase} and keep your method clear.`;
  }

  if (sectionKey === "review") {
    return "Review each item carefully and use the strategy that fits best.";
  }

  if (sectionKey === "mastery") {
    return "Show full understanding here and explain tricky steps neatly if needed.";
  }

  if (sectionKey === "challenge") {
    return resolvedTeacherMode === "assessment"
      ? "Finish with the most demanding questions and check your accuracy."
      : "Try these challenge questions once the earlier work feels secure.";
  }

  return `Complete this ${capitalizeWords(sectionKey)} section carefully.`;
}

export function buildWorksheetModeLabel({
  type = "math",
  teacherMode = "practice",
  mode = "practice"
} = {}) {
  if (type !== "math") {
    return "";
  }

  const baseLabel = getTeacherModeLabel(teacherMode);

  if (mode === "challenge" && normalizeTeacherMode(teacherMode) === "practice") {
    return `${baseLabel} - Challenge Finish`;
  }

  if (mode === "review" && normalizeTeacherMode(teacherMode) === "practice") {
    return `${baseLabel} - Review Flow`;
  }

  return baseLabel;
}
