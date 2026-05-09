import { createQuestion } from "../core/generator.js";

export function generateMathWorksheet({ topic, difficulty, count }) {
  return {
    questions: Array.from({ length: count }, () => createQuestion(topic, difficulty)),
    showAnswerKey: true
  };
}
