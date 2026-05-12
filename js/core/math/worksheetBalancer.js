function normalizePair(values = [], commutative = false) {
  const cleaned = values.map((value) => Number(value));
  return commutative ? [...cleaned].sort((left, right) => left - right) : cleaned;
}

export function createWorksheetBalancer({ count = 15 } = {}) {
  const textSet = new Set();
  const operandSet = new Set();
  const signatureSet = new Set();
  const resultCounts = new Map();
  const patternCounts = new Map();
  const recentFamilies = [];

  const resultFrequencyLimit = count >= 24 ? 3 : 2;
  const patternFrequencyLimit = Math.max(2, Math.ceil(count * 0.22));

  function canUse(question) {
    const normalizedText = String(question.text || "").trim();

    if (!normalizedText || textSet.has(normalizedText)) {
      return false;
    }

    if (question.signature && signatureSet.has(question.signature)) {
      return false;
    }

    if (question.patternId) {
      const patternCount = patternCounts.get(question.patternId) || 0;
      if (patternCount >= patternFrequencyLimit) {
        return false;
      }
    }

    if (question.resultKey) {
      const resultCount = resultCounts.get(question.resultKey) || 0;
      if (resultCount >= resultFrequencyLimit) {
        return false;
      }
    }

    if (question.operands?.length) {
      const pairKey = `${question.operation}|${normalizePair(question.operands, question.commutative).join(",")}`;
      if (operandSet.has(pairKey)) {
        return false;
      }
    }

    if (question.family && recentFamilies.length >= 2) {
      const tail = recentFamilies.slice(-2);
      if (tail.every((family) => family === question.family)) {
        return false;
      }
    }

    return true;
  }

  function record(question) {
    textSet.add(String(question.text || "").trim());

    if (question.signature) {
      signatureSet.add(question.signature);
    }

    if (question.patternId) {
      patternCounts.set(question.patternId, (patternCounts.get(question.patternId) || 0) + 1);
    }

    if (question.resultKey) {
      resultCounts.set(question.resultKey, (resultCounts.get(question.resultKey) || 0) + 1);
    }

    if (question.operands?.length) {
      operandSet.add(`${question.operation}|${normalizePair(question.operands, question.commutative).join(",")}`);
    }

    if (question.family) {
      recentFamilies.push(question.family);
      if (recentFamilies.length > 4) {
        recentFamilies.shift();
      }
    }
  }

  return {
    canUse,
    record
  };
}
