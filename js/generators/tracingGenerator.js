function extractTraceTarget(topic = "") {
  const rawTopic = String(topic).trim();
  const match = rawTopic.match(/letter\s+(.+)/i);

  if (match) {
    return match[1].trim();
  }

  return rawTopic || "A";
}

export function generateTracingWorksheet({ topic, count }) {
  const traceTarget = extractTraceTarget(topic);
  const uppercaseTarget = traceTarget.toUpperCase();
  const lowercaseTarget = traceTarget.toLowerCase();
  const supportWord = uppercaseTarget === "A" ? "apple" : `${lowercaseTarget}${lowercaseTarget}${lowercaseTarget}`;

  return {
    questions: Array.from({ length: count }, () => ({
      text: [
        `Trace the uppercase form: ${uppercaseTarget} ${uppercaseTarget} ${uppercaseTarget} ${uppercaseTarget} ${uppercaseTarget}`,
        `Trace the lowercase form: ${lowercaseTarget} ${lowercaseTarget} ${lowercaseTarget} ${lowercaseTarget} ${lowercaseTarget}`,
        `Say the sound, then trace the word: ${supportWord}`
      ].join("\n"),
      answer: "Tracing practice",
      answerLine: false
    })),
    showAnswerKey: false
  };
}
