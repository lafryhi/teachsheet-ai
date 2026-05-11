import { generateQuestions } from "../core/generator.js";

export function generateMathWorksheet({ topic, difficulty, count, grade, mode, layoutMode }) {
  return {
    questions: generateQuestions({
      operation: topic,
      difficulty,
      questionCount: count,
      grade,
      mode,
      layoutMode
    }),
    showAnswerKey: true
  };
}
