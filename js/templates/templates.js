const LAYOUT_PRESETS = {
  "two-columns": {
    columns: "repeat(2, minmax(0, 1fr))",
    columnsCount: 2,
    fontFamily: "'Aptos', 'Segoe UI', 'Trebuchet MS', sans-serif",
    questionBorderStyle: "dashed",
    questionBackground: "#ffffff",
    questionRadius: 14,
    answerColumns: "repeat(5, minmax(0, 1fr))"
  },
  "single-column": {
    columns: "1fr",
    columnsCount: 1,
    fontFamily: "Cambria, Georgia, 'Times New Roman', serif",
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

const VISUAL_THEME_PRESETS = {
  "clean-professional": {
    pageBackground: "#fffefc",
    pageBorder: "#d7e4ef",
    titleColor: "#183153",
    textColor: "#1f2937",
    mutedText: "#5f6b7a",
    subtleText: "#7a8794",
    dividerColor: "#dbe5ef",
    badgeBackground: "#edf4fb",
    fieldBackground: "#ffffff",
    fieldBorder: "#cfdeeb",
    metaBackground: "#f8fbff",
    metaBorder: "#dbe7f3",
    notesBackground: "#f8fbff",
    notesBorder: "#dbe7f3",
    questionBorder: "#c8d8e8",
    questionShadow: "rgba(15, 23, 42, 0.05)",
    answerBackground: "#f8fbff",
    answerBorder: "#d9e6f2",
    footerLine: "#dbe5ef"
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
  const visualTheme = VISUAL_THEME_PRESETS["clean-professional"];

  return {
    ...template,
    ...preset,
    worksheetThemeId: "clean-professional",
    visualTheme,
    questionsGap: gap,
    questionPadding: Math.max(14, Math.round(gap * 0.82)),
    questionLineHeight: template.layout === "single-column" ? 1.62 : 1.5,
    answerGap: Math.max(10, Math.round(gap * 0.52)),
    answerAreaHeight: template.id === "kids-colorful" ? 18 : template.layout === "single-column" ? 14 : 13,
    answerLineWidth: template.id === "kids-colorful" ? 148 : 124,
    questionMinHeight: template.id === "kids-colorful" ? 104 : template.layout === "single-column" ? 92 : 96,
    verticalQuestionMinHeight: template.id === "kids-colorful" ? 168 : 150,
    answerCardMinHeight: template.layout === "single-column" ? 56 : 50,
    previewPadding: template.layout === "single-column" ? 40 : 36
  };
}
