import { generateQuestions } from "../core/generator.js";

export function generateMathWorksheet({ topic, difficulty, count, grade }) {
  return {
    questions: generateQuestions({
      operation: topic,
      difficulty,
      questionCount: count,
      grade
    }),
    showAnswerKey: true
  };
}
