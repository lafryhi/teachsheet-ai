const READING_PASSAGES = [
  {
    title: "The Library Visit",
    passage: "Mina visits the school library every Tuesday. She borrows one storybook and one science book. After reading, she tells her teacher which book she liked best.",
    question: "When does Mina visit the library?",
    answer: "every Tuesday"
  },
  {
    title: "The Garden Helper",
    passage: "Omar fills a small watering can in the morning. He waters the tomatoes, the mint, and the sunflowers before the weather gets hot.",
    question: "What does Omar water before the weather gets hot?",
    answer: "the tomatoes, the mint, and the sunflowers"
  },
  {
    title: "A Rainy Walk",
    passage: "Lina wears her yellow raincoat when clouds fill the sky. She walks to the bakery with her father and carries warm bread home in a paper bag.",
    question: "What color is Lina's raincoat?",
    answer: "yellow"
  },
  {
    title: "Classroom Job",
    passage: "Before the lesson starts, Sami wipes the board and arranges the markers by color. His classmates thank him because the room looks tidy.",
    question: "Why do Sami's classmates thank him?",
    answer: "because the room looks tidy"
  },
  {
    title: "The Weekend Match",
    passage: "Aya practices football in the park on Saturday afternoon. She brings water, cones, and a ball so she can train with her cousin for one hour.",
    question: "Who trains with Aya in the park?",
    answer: "her cousin"
  },
  {
    title: "Breakfast Time",
    passage: "Youssef wakes up early and helps set the breakfast table. He places cups, spoons, and napkins before his family sits down to eat.",
    question: "What does Youssef place on the table?",
    answer: "cups, spoons, and napkins"
  }
];

function normalizeTopic(topic = "") {
  return String(topic).trim().toLowerCase();
}

function selectPassages(topic) {
  if (normalizeTopic(topic).includes("short passage")) {
    return READING_PASSAGES;
  }

  return READING_PASSAGES;
}

export function generateReadingWorksheet({ topic, count }) {
  const bank = selectPassages(topic);

  return {
    questions: Array.from({ length: count }, (_, index) => {
      const entry = bank[index % bank.length];
      return {
        text: [
          `Read the passage: ${entry.title}`,
          entry.passage,
          `Question: ${entry.question}`
        ].join("\n"),
        answer: entry.answer
      };
    }),
    showAnswerKey: true
  };
}
