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

  return {
    questions: Array.from({ length: count }, () => ({
      text: `Trace carefully: ${traceTarget} ${traceTarget} ${traceTarget} ${traceTarget} ${traceTarget}`,
      answer: "Tracing practice",
      answerLine: false
    })),
    showAnswerKey: false
  };
}
