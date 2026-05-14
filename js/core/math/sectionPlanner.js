import { buildSectionInstruction } from "./instructionsEngine.js";
import { getTeacherModeProfile, normalizeTeacherMode } from "./teacherModes.js";

function allocateSectionCounts(count, sectionDefinitions) {
  if (count <= 0) {
    return [];
  }

  const seededCounts = sectionDefinitions.map((definition) => ({
    ...definition,
    count: Math.max(1, Math.floor(count * definition.ratio)),
    remainder: (count * definition.ratio) % 1
  }));
  let assigned = seededCounts.reduce((total, definition) => total + definition.count, 0);

  while (assigned > count) {
    const candidate = seededCounts
      .filter((definition) => definition.count > 1)
      .sort((left, right) => left.ratio - right.ratio)[0];

    if (!candidate) {
      break;
    }

    candidate.count -= 1;
    assigned -= 1;
  }

  while (assigned < count) {
    const candidate = [...seededCounts]
      .sort((left, right) => right.remainder - left.remainder)[0];

    candidate.count += 1;
    assigned += 1;
  }

  return seededCounts;
}

function getSectionDefinitions(teacherMode, focusPattern) {
  const sectionPreset = getTeacherModeProfile(teacherMode).sectionPreset;

  if (sectionPreset === "assessment") {
    return [
      { key: "warm-up", label: "Warm Up", ratio: 0.18 },
      { key: "practice", label: "Practice", ratio: 0.38 },
      { key: "mastery", label: "Mastery Check", ratio: 0.24 },
      { key: "challenge", label: "Challenge", ratio: 0.2 }
    ];
  }

  if (sectionPreset === "homework") {
    return [
      { key: "warm-up", label: "Warm Up", ratio: 0.18 },
      { key: "practice", label: "Practice", ratio: 0.48 },
      { key: "review", label: "Review", ratio: 0.18 },
      { key: "challenge", label: "Challenge", ratio: 0.16 }
    ];
  }

  if (sectionPreset === "remediation") {
    return [
      { key: "warm-up", label: "Warm Up", ratio: 0.32 },
      { key: "practice", label: "Practice", ratio: 0.44 },
      { key: "review", label: "Review", ratio: 0.24 }
    ];
  }

  if (sectionPreset === "fast-review") {
    return [
      { key: "mental-math", label: "Mental Math", ratio: 0.34 },
      { key: "review", label: "Review", ratio: 0.44 },
      { key: "challenge", label: "Challenge", ratio: 0.22 }
    ];
  }

  if (focusPattern === "mental-math") {
    return [
      { key: "warm-up", label: "Warm Up", ratio: 0.18 },
      { key: "mental-math", label: "Mental Math", ratio: 0.54 },
      { key: "challenge", label: "Challenge", ratio: 0.28 }
    ];
  }

  return [
    { key: "warm-up", label: "Warm Up", ratio: 0.22 },
    { key: "practice", label: "Practice", ratio: 0.54 },
    { key: "challenge", label: "Challenge", ratio: 0.24 }
  ];
}

export function buildSectionPlan({
  count = 15,
  operation = "addition",
  layoutMode = "horizontal",
  teacherMode = "practice",
  focusPattern = null
} = {}) {
  const resolvedTeacherMode = normalizeTeacherMode(teacherMode);
  const definitions = allocateSectionCounts(count, getSectionDefinitions(resolvedTeacherMode, focusPattern));
  const plan = [];
  let cursor = 0;

  definitions.forEach((definition, sectionIndex) => {
    for (let offset = 0; offset < definition.count; offset += 1) {
      plan[cursor] = {
        sectionKey: definition.key,
        sectionLabel: definition.label,
        sectionInstruction: buildSectionInstruction({
          sectionKey: definition.key,
          operation,
          layoutMode,
          teacherMode: resolvedTeacherMode,
          focusPattern
        }),
        sectionStart: offset === 0,
        sectionIndex
      };
      cursor += 1;
    }
  });

  return plan.slice(0, count);
}

export function listWorksheetSections(questions = []) {
  const sections = [];
  let lastSectionKey = null;

  questions.forEach((question) => {
    if (!question?.sectionKey || question.sectionKey === lastSectionKey) {
      return;
    }

    sections.push({
      key: question.sectionKey,
      label: question.sectionLabel,
      instruction: question.sectionInstruction
    });
    lastSectionKey = question.sectionKey;
  });

  return sections;
}
