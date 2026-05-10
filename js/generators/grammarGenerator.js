const GRAMMAR_BANK = {
  verbs: [
    { prompt: "Circle the verb in this sentence: The children jump outside after lunch.", answer: "jump" },
    { prompt: "Choose the verb: Mother cooks dinner every night for the family.", answer: "cooks" },
    { prompt: "Find the action word: Birds sing on the branch before sunrise.", answer: "sing" },
    { prompt: "Underline the verb: We walk to school together every morning.", answer: "walk" },
    { prompt: "Write the verb in this sentence: The baby sleeps quietly in the crib.", answer: "sleeps" },
    { prompt: "Pick the verb: My brother carries his books in a blue bag.", answer: "carries" },
    { prompt: "Find the verb: The rain falls softly on the playground.", answer: "falls" },
    { prompt: "Circle the action word: The teacher explains the lesson clearly.", answer: "explains" }
  ],
  nouns: [
    { prompt: "Circle the noun: The cat sleeps on the sofa near the window.", answer: "cat" },
    { prompt: "Find the naming word: My brother rides a bike after school.", answer: "brother" },
    { prompt: "Underline the noun: The teacher opened the book on the table.", answer: "teacher" },
    { prompt: "Choose the noun: The flowers smell fresh in the garden.", answer: "flowers" },
    { prompt: "Write the noun in this sentence: The apple is red and shiny.", answer: "apple" },
    { prompt: "Pick the noun: The bus stopped beside the library.", answer: "bus" },
    { prompt: "Find the naming word: Sara packed a notebook and a pencil.", answer: "notebook" },
    { prompt: "Circle the noun: The river flows behind the village.", answer: "river" }
  ],
  adjectives: [
    { prompt: "Circle the adjective: The blue balloon floated across the yard.", answer: "blue" },
    { prompt: "Find the describing word: We saw a tall building near the square.", answer: "tall" },
    { prompt: "Underline the adjective: She wore a shiny dress for the play.", answer: "shiny" },
    { prompt: "Choose the adjective: The soup is hot and tasty.", answer: "hot" },
    { prompt: "Write the adjective in this sentence: They found a small shell on the beach.", answer: "small" },
    { prompt: "Circle the adjective: We sat under a shady tree in the park.", answer: "shady" },
    { prompt: "Find the describing word: The kitten has soft fur.", answer: "soft" },
    { prompt: "Underline the adjective: Omar solved a difficult puzzle.", answer: "difficult" }
  ]
};

const GRAMMAR_PATTERNS = [
  (entry) => ({ text: entry.prompt, answer: entry.answer }),
  (entry) => ({
    text: `Read and answer:\n${entry.prompt}\nWrite only the correct word on the line.`,
    answer: entry.answer
  }),
  (entry) => ({
    text: `Grammar check:\n${entry.prompt}\nThen use the word "${entry.answer}" in a short new sentence.`,
    answer: entry.answer
  })
];

function normalizeTopic(topic = "") {
  return String(topic).trim().toLowerCase();
}

export function generateGrammarWorksheet({ topic, count }) {
  const bank = GRAMMAR_BANK[normalizeTopic(topic)] || GRAMMAR_BANK.verbs;

  return {
    questions: Array.from({ length: count }, (_, index) => {
      const entry = bank[index % bank.length];
      const pattern = GRAMMAR_PATTERNS[index % GRAMMAR_PATTERNS.length];
      return pattern(entry);
    }),
    showAnswerKey: true
  };
}
