const GRAMMAR_BANK = {
  verbs: [
    ["Circle the verb in this sentence: The children jump outside.", "jump"],
    ["Choose the verb: Mother cooks dinner every night.", "cooks"],
    ["Find the action word: Birds sing in the tree.", "sing"],
    ["Underline the verb: We walk to school together.", "walk"],
    ["Write the verb you hear: The baby sleeps quietly.", "sleeps"]
  ],
  nouns: [
    ["Circle the noun: The cat sleeps on the sofa.", "cat"],
    ["Find the naming word: My brother rides a bike.", "brother"],
    ["Underline the noun: The teacher opened the book.", "teacher"],
    ["Choose the noun: The flowers smell fresh.", "flowers"],
    ["Write the noun: The apple is red.", "apple"]
  ],
  adjectives: [
    ["Circle the adjective: The blue balloon floated away.", "blue"],
    ["Find the describing word: We saw a tall building.", "tall"],
    ["Underline the adjective: She wore a shiny dress.", "shiny"],
    ["Choose the adjective: The soup is hot.", "hot"],
    ["Write the adjective: They found a small shell.", "small"]
  ]
};

export function generateGrammarWorksheet({ topic, count }) {
  const bank = GRAMMAR_BANK[String(topic).trim().toLowerCase()] || GRAMMAR_BANK.verbs;

  return {
    questions: Array.from({ length: count }, (_, index) => {
      const [text, answer] = bank[index % bank.length];
      return { text, answer };
    }),
    showAnswerKey: true
  };
}
