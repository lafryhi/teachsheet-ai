const LAYOUT_PRESETS = {
  "two-columns": {
    columns: "repeat(2, minmax(0, 1fr))",
    columnsCount: 2,
    fontFamily: "Arial, Helvetica, sans-serif",
    questionBorderStyle: "dashed",
    questionBackground: "#ffffff",
    questionRadius: 14,
    answerColumns: "repeat(5, minmax(0, 1fr))"
  },
  "single-column": {
    columns: "1fr",
    columnsCount: 1,
    fontFamily: "Georgia, 'Times New Roman', serif",
    questionBorderStyle: "solid",
    questionBackground: "#fffdf8",
    questionRadius: 10,
    answerColumns: "repeat(4, minmax(0, 1fr))"
  },
  "playful-grid": {
    columns: "repeat(2, minmax(0, 1fr))",
    columnsCount: 2,
    fontFamily: "'Trebuchet MS', 'Comic Sans MS', sans-serif",
    questionBorderStyle: "solid",
    questionBackground: "#f7fffb",
    questionRadius: 18,
    answerColumns: "repeat(4, minmax(0, 1fr))"
  },
  "compact-homework": {
    columns: "repeat(2, minmax(0, 1fr))",
    columnsCount: 2,
    fontFamily: "Verdana, Geneva, sans-serif",
    questionBorderStyle: "dashed",
    questionBackground: "#fcfdff",
    questionRadius: 12,
    answerColumns: "repeat(6, minmax(0, 1fr))"
  }
};

export const templates = [
  {
    id: "classic-math",
    name: "Classic Math",
    description: "Balanced classroom worksheet with the familiar two-column printable layout.",
    theme: "blue",
    questionsPerPage: 10,
    layout: "two-columns",
    fontSize: 22,
    spacing: 18
  },
  {
    id: "exam-style",
    name: "Exam Style",
    description: "Formal single-column layout with tighter structure for tests and evaluations.",
    theme: "gold",
    questionsPerPage: 12,
    layout: "single-column",
    fontSize: 20,
    spacing: 16
  },
  {
    id: "kids-colorful",
    name: "Kids Colorful",
    description: "Friendly colorful cards with larger text and extra breathing room for young learners.",
    theme: "green",
    questionsPerPage: 8,
    layout: "playful-grid",
    fontSize: 24,
    spacing: 22
  },
  {
    id: "homework-sheet",
    name: "Homework Sheet",
    description: "Compact take-home worksheet that fits more practice while staying readable.",
    theme: "blue",
    questionsPerPage: 14,
    layout: "compact-homework",
    fontSize: 18,
    spacing: 14
  }
];

export function getDefaultTemplate() {
  return templates[0];
}

export function getTemplateById(templateId) {
  return templates.find((template) => template.id === templateId) || getDefaultTemplate();
}

export function getTemplateOptions() {
  return templates.map((template) => ({
    value: template.id,
    label: template.name,
    description: template.description
  }));
}

export function getTemplatePresentation(templateLike) {
  const template = typeof templateLike === "string" ? getTemplateById(templateLike) : getTemplateById(templateLike?.id);
  const preset = LAYOUT_PRESETS[template.layout] || LAYOUT_PRESETS["two-columns"];
  const gap = Math.max(12, template.spacing);

  return {
    ...template,
    ...preset,
    questionsGap: gap,
    questionPadding: Math.max(12, Math.round(gap * 0.8)),
    questionLineHeight: template.layout === "single-column" ? 1.55 : 1.4,
    answerGap: Math.max(8, Math.round(gap * 0.45))
  };
}
