import { templates } from "../templates/templates.js";

const WORKSHEET_TYPES = ["math", "grammar", "reading", "tracing", "coloring"];
const OPERATION_TOPICS = ["addition", "subtraction", "multiplication", "division", "mixed"];
const MATH_WORKSHEET_MODES = ["practice", "review", "remediation", "challenge"];
const TEACHER_MODES = ["practice", "homework", "assessment", "remediation", "fast-review"];
const MATH_LAYOUT_MODES = ["vertical", "horizontal"];
const FRENCH_GRADE_MAP = {
  cp: "Grade 1",
  ce1: "Grade 2",
  ce2: "Grade 3",
  cm1: "Grade 4",
  cm2: "Grade 5"
};
const DEFAULTS_BY_TYPE = {
  math: {
    difficulty: "medium",
    count: 15,
    grade: "Grade 2",
    template: "classic-math",
    mode: "practice",
    layoutMode: "horizontal",
    teacherMode: "practice",
    focusPattern: null
  },
  grammar: { difficulty: "medium", count: 15, grade: null, template: "classic-math" },
  reading: { difficulty: "medium", count: 5, grade: null, template: "classic-math" },
  tracing: { difficulty: "easy", count: 1, grade: null, template: "kids-colorful" },
  coloring: { difficulty: "easy", count: 1, grade: null, template: "kids-colorful" }
};

function foldText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function hasMathIntent(text = "") {
  return /\b(addition|subtraction|multiplication|division|mixed|mental math|calcul mental|word problems?|compare|true or false|missing number|practice|review|assessment|remediation|fast review|revision|evaluation|entrainement|worksheet|exercices?)\b/.test(text);
}

function detectFocusPattern(segments) {
  for (const segment of segments) {
    if (segment.normalized.includes("mental math") || segment.normalized.includes("calcul mental")) {
      return "mental-math";
    }
  }

  return null;
}

function normalizePrompt(prompt = "") {
  return String(prompt)
    .trim()
    .replace(/\s+/g, " ");
}

function toSegments(prompt = "") {
  return normalizePrompt(prompt)
    .split(/[+,;|]/)
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => ({
      raw: segment,
      normalized: foldText(segment)
    }));
}

function normalizeTemplateAliases(template) {
  return [
    template.id,
    template.id.replaceAll("-", " "),
    template.name.toLowerCase(),
    template.name.toLowerCase().replaceAll("-", " ")
  ];
}

function detectTemplate(segments) {
  for (const segment of segments) {
    const foundTemplate = templates.find((template) =>
      normalizeTemplateAliases(template).some((alias) => alias === segment.normalized)
    );

    if (foundTemplate) {
      return foundTemplate.id;
    }
  }

  return null;
}

function detectType(segments) {
  for (const segment of segments) {
    if (WORKSHEET_TYPES.includes(segment.normalized)) {
      return segment.normalized;
    }

    const embeddedType = WORKSHEET_TYPES.find((type) => new RegExp(`\\b${type}\\b`).test(segment.normalized));
    if (embeddedType) {
      return embeddedType;
    }

    if (OPERATION_TOPICS.includes(segment.normalized)) {
      return "math";
    }

    if (detectTeacherMode([segment]) || detectMode([segment]) || detectFocusPattern([segment]) || hasMathIntent(segment.normalized)) {
      return "math";
    }
  }

  return null;
}

function detectGrade(segments) {
  for (const segment of segments) {
    const match = segment.normalized.match(/\bgrade\s*([1-5])\b/);
    if (match) {
      return `Grade ${match[1]}`;
    }

    const frenchGrade = Object.entries(FRENCH_GRADE_MAP).find(([label]) => (
      new RegExp(`\\b${label}\\b`).test(segment.normalized)
    ));

    if (frenchGrade) {
      return frenchGrade[1];
    }
  }

  return null;
}

function detectDifficulty(segments) {
  for (const segment of segments) {
    if (["easy", "medium", "hard"].includes(segment.normalized)) {
      return segment.normalized;
    }
  }

  return null;
}

function detectCount(segments) {
  for (const segment of segments) {
    const match = segment.normalized.match(/\b(\d+)\s+questions?\b/);
    if (match) {
      return Number.parseInt(match[1], 10);
    }
  }

  return null;
}

function detectMode(segments) {
  for (const segment of segments) {
    if (MATH_WORKSHEET_MODES.includes(segment.normalized)) {
      return segment.normalized;
    }

    if (segment.normalized.includes("review") || segment.normalized.includes("revision")) {
      return "review";
    }

    if (segment.normalized.includes("remediation")) {
      return "remediation";
    }

    if (segment.normalized.includes("challenge")) {
      return "challenge";
    }
  }

  return null;
}

function detectTeacherMode(segments) {
  for (const segment of segments) {
    if (segment.normalized.includes("homework") || segment.normalized.includes("devoir")) {
      return "homework";
    }

    if (segment.normalized.includes("assessment") || segment.normalized.includes("evaluation")) {
      return "assessment";
    }

    if (segment.normalized.includes("fast review") || segment.normalized.includes("revision rapide")) {
      return "fast-review";
    }

    if (segment.normalized.includes("review") || segment.normalized.includes("revision")) {
      return "fast-review";
    }

    if (segment.normalized.includes("remediation")) {
      return "remediation";
    }

    if (segment.normalized.includes("practice") || segment.normalized.includes("entrainement") || segment.normalized.includes("exercices")) {
      return "practice";
    }
  }

  return null;
}

function detectLayoutMode(segments) {
  for (const segment of segments) {
    for (const layoutMode of MATH_LAYOUT_MODES) {
      if (
        segment.normalized === layoutMode ||
        segment.normalized.startsWith(`${layoutMode} `) ||
        new RegExp(`\\b${layoutMode}\\b`).test(segment.normalized)
      ) {
        return layoutMode;
      }
    }
  }

  return null;
}

function detectOperation(segments) {
  for (const segment of segments) {
    if (segment.normalized.includes("soustraction")) {
      return "subtraction";
    }

    if (segment.normalized.includes("multiplication")) {
      return "multiplication";
    }

    if (segment.normalized.includes("division")) {
      return "division";
    }

    if (segment.normalized.includes("addition")) {
      return "addition";
    }

    if (segment.normalized.includes("mixed")) {
      return "mixed";
    }

    const directMatch = OPERATION_TOPICS.find((operation) => segment.normalized === operation);

    if (directMatch) {
      return directMatch;
    }

    const embeddedMatch = OPERATION_TOPICS.find((operation) => segment.normalized.endsWith(` ${operation}`));

    if (embeddedMatch) {
      return embeddedMatch;
    }

    const wordBoundaryMatch = OPERATION_TOPICS.find((operation) => (
      new RegExp(`\\b${operation}\\b`).test(segment.normalized)
    ));

    if (wordBoundaryMatch) {
      return wordBoundaryMatch;
    }
  }

  return null;
}

function isMetadataSegment(segment) {
  return (
    WORKSHEET_TYPES.includes(segment.normalized) ||
    OPERATION_TOPICS.includes(segment.normalized) ||
    MATH_WORKSHEET_MODES.includes(segment.normalized) ||
    TEACHER_MODES.includes(segment.normalized) ||
    segment.normalized.includes("homework") ||
    segment.normalized.includes("assessment") ||
    segment.normalized.includes("evaluation") ||
    segment.normalized.includes("review worksheet") ||
    segment.normalized.includes("revision") ||
    segment.normalized.includes("mental math") ||
    segment.normalized.includes("calcul mental") ||
    MATH_LAYOUT_MODES.includes(segment.normalized) ||
    MATH_LAYOUT_MODES.some((layoutMode) => segment.normalized.startsWith(`${layoutMode} `)) ||
    OPERATION_TOPICS.some((operation) => (
      segment.normalized.endsWith(` ${operation}`) ||
      new RegExp(`\\b${operation}\\b`).test(segment.normalized)
    )) ||
    ["easy", "medium", "hard"].includes(segment.normalized) ||
    /\bgrade\s*[1-5]\b/.test(segment.normalized) ||
    Object.keys(FRENCH_GRADE_MAP).some((label) => new RegExp(`\\b${label}\\b`).test(segment.normalized)) ||
    /\b\d+\s+questions?\b/.test(segment.normalized) ||
    templates.some((template) => normalizeTemplateAliases(template).includes(segment.normalized))
  );
}

function detectTopic(segments, type) {
  if (type === "math") {
    const explicitOperation = detectOperation(segments);

    if (explicitOperation) {
      return explicitOperation;
    }

    if (detectFocusPattern(segments) === "mental-math" || segments.some((segment) => hasMathIntent(segment.normalized))) {
      return "mixed";
    }

    return "addition";
  }

  const topicSegment = segments.find((segment) => !isMetadataSegment(segment));
  return topicSegment ? topicSegment.raw : type;
}

export function hasRecognizedWorksheetPrompt(prompt) {
  const segments = toSegments(prompt);
  return segments.some((segment) => (
    WORKSHEET_TYPES.includes(segment.normalized) ||
    OPERATION_TOPICS.includes(segment.normalized) ||
    detectTeacherMode([segment]) ||
    detectMode([segment]) ||
    detectFocusPattern([segment]) ||
    hasMathIntent(segment.normalized) ||
    /\bgrade\s*[1-5]\b/.test(segment.normalized) ||
    Object.keys(FRENCH_GRADE_MAP).some((label) => new RegExp(`\\b${label}\\b`).test(segment.normalized)) ||
    /\b\d+\s+questions?\b/.test(segment.normalized)
  ));
}

export function parseWorksheetPrompt(prompt) {
  const segments = toSegments(prompt);
  const detectedType = detectType(segments) || "math";
  const defaults = DEFAULTS_BY_TYPE[detectedType];
  const topic = detectTopic(segments, detectedType);
  const explicitTemplateId = detectTemplate(segments);
  const focusPattern = detectedType === "math" ? (detectFocusPattern(segments) || defaults.focusPattern) : null;
  const detectedMode = detectedType === "math" ? detectMode(segments) : null;
  const detectedTeacherMode = detectedType === "math" ? detectTeacherMode(segments) : null;
  const resolvedTeacherMode = detectedType === "math"
    ? (
      detectedTeacherMode
      || (detectedMode === "review" ? "fast-review" : null)
      || (detectedMode === "remediation" ? "remediation" : null)
      || (focusPattern === "mental-math" ? "fast-review" : null)
      || defaults.teacherMode
    )
    : null;

  return {
    type: detectedType,
    subject: detectedType === "math" ? "math" : detectedType,
    topic,
    difficulty: detectDifficulty(segments) || defaults.difficulty,
    count: detectCount(segments) || defaults.count,
    grade: detectGrade(segments) || defaults.grade,
    mode: detectedType === "math" ? (detectedMode || defaults.mode) : null,
    layoutMode: detectedType === "math" ? (detectLayoutMode(segments) || defaults.layoutMode) : null,
    teacherMode: resolvedTeacherMode,
    focusPattern,
    template: explicitTemplateId || defaults.template,
    templateExplicit: Boolean(explicitTemplateId)
  };
}
