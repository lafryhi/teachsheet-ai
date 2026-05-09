const COLORING_TOPICS = {
  animals: ["lion", "rabbit", "elephant", "bird", "fish"]
};

export function generateColoringWorksheet({ topic, count }) {
  const normalizedTopic = String(topic).trim().toLowerCase();
  const items = COLORING_TOPICS[normalizedTopic] || ["star", "tree", "house", "flower", "balloon"];

  return {
    questions: Array.from({ length: count }, (_, index) => ({
      text: `Color this picture idea: ${items[index % items.length]}. Add your favorite colors.`,
      answer: "Coloring activity",
      answerLine: false
    })),
    showAnswerKey: false
  };
}
