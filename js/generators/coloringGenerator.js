const COLORING_TOPICS = {
  animals: [
    {
      item: "lion",
      tip: "Use warm colors for the mane and a lighter shade for the face.",
      extension: "After coloring, name one place where a lion can live."
    },
    {
      item: "rabbit",
      tip: "Color the ears and tail carefully with two soft colors.",
      extension: "After coloring, say one food a rabbit likes."
    },
    {
      item: "elephant",
      tip: "Keep the large body one main color and add a darker outline.",
      extension: "After coloring, tell one thing an elephant uses its trunk for."
    },
    {
      item: "bird",
      tip: "Choose bright colors for the wings and keep the beak clear.",
      extension: "After coloring, say where a bird might build a nest."
    },
    {
      item: "fish",
      tip: "Use two or three colors on the scales and keep the eye neat.",
      extension: "After coloring, name one place where fish swim."
    }
  ]
};

const DEFAULT_COLORING_ITEMS = [
  {
    item: "star",
    tip: "Use one bright main color and a second color for the outline.",
    extension: "After coloring, say where you might see a star."
  },
  {
    item: "tree",
    tip: "Color the leaves and trunk in different shades.",
    extension: "After coloring, name one thing that grows on or near a tree."
  },
  {
    item: "house",
    tip: "Choose one roof color and one wall color for a neat result.",
    extension: "After coloring, describe one room that could be inside."
  },
  {
    item: "flower",
    tip: "Use different colors for petals, stem, and center.",
    extension: "After coloring, say where flowers can grow."
  }
];

export function generateColoringWorksheet({ topic, count }) {
  const normalizedTopic = String(topic).trim().toLowerCase();
  const items = COLORING_TOPICS[normalizedTopic] || DEFAULT_COLORING_ITEMS;

  return {
    questions: Array.from({ length: count }, (_, index) => {
      const entry = items[index % items.length];
      return {
        text: [
          `Color this picture idea: ${entry.item}.`,
          entry.tip,
          "Stay inside the outline as neatly as you can.",
          entry.extension
        ].join("\n"),
        answer: entry.item,
        answerLine: false
      };
    }),
    showAnswerKey: false
  };
}
