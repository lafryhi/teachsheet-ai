import { generateQuestions } from "../core/generator.js";

export function generateMathWorksheet({ topic, difficulty, count, grade, mode }) {
  return {
    questions: generateQuestions({
      operation: topic,
      difficulty,
      questionCount: count,
      grade,
      mode
    }),
    showAnswerKey: true
  };
}
