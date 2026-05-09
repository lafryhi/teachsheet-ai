const COLORING_TOPICS = {
  animals: ["lion", "rabbit", "elephant", "bird", "fish"]
};

export function generateColoringWorksheet({ topic, count }) {
  const normalizedTopic = String(topic).trim().toLowerCase();
  const items = COLORING_TOPICS[normalizedTopic] || ["star", "tree", "house", "flower", "balloon"];

  return {
    questions: Array.from({ length: count }, (_, index) => ({
      text: [
        `Color the picture idea: ${items[index % items.length]}.`,
        "Choose 2 or 3 strong colors and keep the outline neat.",
        `After coloring, say one short fact about the ${items[index % items.length]}.`
      ].join("\n"),
      answer: "Coloring activity",
      answerLine: false
    })),
    showAnswerKey: false
  };
}
