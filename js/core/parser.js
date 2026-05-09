import { templates } from "../templates/templates.js";

const WORKSHEET_TYPES = ["math", "grammar", "reading", "tracing", "coloring"];
const OPERATION_TOPICS = ["addition", "subtraction", "multiplication", "division", "mixed"];
const DEFAULTS_BY_TYPE = {
  math: { difficulty: "medium", count: 15, grade: "Grade 2", template: "classic-math" },
  grammar: { difficulty: "medium", count: 15, grade: null, template: "classic-math" },
  reading: { difficulty: "medium", count: 5, grade: null, template: "classic-math" },
  tracing: { difficulty: "easy", count: 1, grade: null, template: "kids-colorful" },
  coloring: { difficulty: "easy", count: 1, grade: null, template: "kids-colorful" }
};

function normalizePrompt(prompt = "") {
  return String(prompt)
    .trim()
    .replace(/\s+/g, " ");
}

function toSegments(prompt = "") {
  return normalizePrompt(prompt)
    .split("+")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => ({
      raw: segment,
      normalized: segment.toLowerCase()
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

    if (OPERATION_TOPICS.includes(segment.normalized)) {
      return "math";
    }
  }

  return null;
}

function detectGrade(segments) {
  for (const segment of segments) {
    const match = segment.normalized.match(/^grade\s*([1-5])$/);
    if (match) {
      return `Grade ${match[1]}`;
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
    const match = segment.normalized.match(/^(\d+)\s+questions?$/);
    if (match) {
      return Number.parseInt(match[1], 10);
    }
  }

  return null;
}

function isMetadataSegment(segment) {
  return (
    WORKSHEET_TYPES.includes(segment.normalized) ||
    OPERATION_TOPICS.includes(segment.normalized) ||
    ["easy", "medium", "hard"].includes(segment.normalized) ||
    /^grade\s*[1-5]$/.test(segment.normalized) ||
    /^\d+\s+questions?$/.test(segment.normalized) ||
    templates.some((template) => normalizeTemplateAliases(template).includes(segment.normalized))
  );
}

function detectTopic(segments, type) {
  if (type === "math") {
    const operationSegment = segments.find((segment) => OPERATION_TOPICS.includes(segment.normalized));
    return operationSegment ? operationSegment.normalized : "addition";
  }

  const topicSegment = segments.find((segment) => !isMetadataSegment(segment));
  return topicSegment ? topicSegment.raw : type;
}

export function hasRecognizedWorksheetPrompt(prompt) {
  const segments = toSegments(prompt);
  return segments.some((segment) => (
    WORKSHEET_TYPES.includes(segment.normalized) ||
    OPERATION_TOPICS.includes(segment.normalized) ||
    /^grade\s*[1-5]$/.test(segment.normalized) ||
    /^\d+\s+questions?$/.test(segment.normalized)
  ));
}

export function parseWorksheetPrompt(prompt) {
  const segments = toSegments(prompt);
  const detectedType = detectType(segments) || "math";
  const defaults = DEFAULTS_BY_TYPE[detectedType];
  const topic = detectTopic(segments, detectedType);
  const explicitTemplateId = detectTemplate(segments);

  return {
    type: detectedType,
    subject: detectedType === "math" ? "math" : detectedType,
    topic,
    difficulty: detectDifficulty(segments) || defaults.difficulty,
    count: detectCount(segments) || defaults.count,
    grade: detectGrade(segments) || defaults.grade,
    template: explicitTemplateId || defaults.template,
    templateExplicit: Boolean(explicitTemplateId)
  };
}
