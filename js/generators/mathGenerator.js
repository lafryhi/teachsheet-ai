import { buildMathWorksheetIntelligence, generateQuestions } from "../core/generator.js";

export function generateMathWorksheet({ topic, difficulty, count, grade, mode, layoutMode, teacherMode, focusPattern }) {
  const questions = generateQuestions({
    operation: topic,
    difficulty,
    questionCount: count,
    grade,
    mode,
    layoutMode,
    teacherMode,
    focusPattern
  });

  return {
    questions,
    ...buildMathWorksheetIntelligence({
      type: "math",
      topic,
      difficulty,
      count,
      grade,
      mode,
      layoutMode,
      teacherMode,
      focusPattern
    }, questions),
    showAnswerKey: true
  };
}
