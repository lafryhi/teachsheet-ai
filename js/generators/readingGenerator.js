const READING_BANK = [
  [
    "Read: Sam has a blue backpack. He puts two books inside. What color is Sam's backpack?",
    "blue"
  ],
  [
    "Read: Lina waters the flowers every morning. When does Lina water the flowers?",
    "every morning"
  ],
  [
    "Read: Adam saw a rabbit near the garden fence. What animal did Adam see?",
    "a rabbit"
  ],
  [
    "Read: Sara bakes bread with her grandmother on Sunday. Who bakes bread with Sara?",
    "her grandmother"
  ],
  [
    "Read: Youssef lost his pencil under the desk. Where was the pencil?",
    "under the desk"
  ]
];

export function generateReadingWorksheet({ count }) {
  return {
    questions: Array.from({ length: count }, (_, index) => {
      const [text, answer] = READING_BANK[index % READING_BANK.length];
      return { text, answer };
    }),
    showAnswerKey: true
  };
}
