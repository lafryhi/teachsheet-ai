const LETTER_WORDS = {
  A: "apple",
  B: "ball",
  C: "cat",
  D: "dog",
  E: "egg",
  F: "fish",
  G: "goat",
  H: "hat",
  I: "igloo",
  J: "juice",
  K: "kite",
  L: "leaf"
};

function extractTraceTarget(topic = "") {
  const rawTopic = String(topic).trim();
  const match = rawTopic.match(/letter\s+(.+)/i);

  if (match) {
    return match[1].trim();
  }

  return rawTopic || "A";
}

function buildTracingWord(letter) {
  return LETTER_WORDS[letter] || `${letter.toLowerCase()}-word`;
}

function repeatSequence(value, count) {
  return Array.from({ length: count }, () => value).join(" ");
}

export function generateTracingWorksheet({ topic, count }) {
  const traceTarget = extractTraceTarget(topic);
  const uppercaseTarget = traceTarget.toUpperCase().charAt(0);
  const lowercaseTarget = uppercaseTarget.toLowerCase();
  const supportWord = buildTracingWord(uppercaseTarget);

  return {
    questions: Array.from({ length: count }, (_, index) => ({
      text: [
        `Trace the uppercase letter: ${repeatSequence(uppercaseTarget, 6)}`,
        `Trace the lowercase letter: ${repeatSequence(lowercaseTarget, 6)}`,
        `Trace the word: ${supportWord}  ${supportWord}  ${supportWord}`,
        index % 2 === 0
          ? `Say the first sound you hear in "${supportWord}".`
          : `Circle the letter ${uppercaseTarget} inside the word "${supportWord}".`
      ].join("\n"),
      answer: supportWord,
      answerLine: false
    })),
    showAnswerKey: false
  };
}
