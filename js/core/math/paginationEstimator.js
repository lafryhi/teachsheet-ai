function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function estimateQuestionLayout(question) {
  const textLength = String(question.text || "").replace(/\s+/g, " ").trim().length;
  const isVertical = question.format === "vertical";
  const patternId = question.patternId || "horizontal";

  let previewUnits = 1;
  let pdfMinHeight = isVertical ? 30 : 22;
  let answerAreaHeight = question.answerLine === false ? 0 : 8.2;
  let answerLineWidth = 32;
  let answerUnits = 1;

  if (isVertical) {
    previewUnits += 0.42;
    pdfMinHeight += 10;
    answerLineWidth = 24;
  }

  if (patternId.includes("word")) {
    previewUnits += 0.55;
    pdfMinHeight += 8;
    answerAreaHeight += 1.8;
    answerLineWidth = 54;
    answerUnits = 1.25;
  } else if (patternId.includes("compare") || patternId.includes("groups")) {
    previewUnits += 0.18;
    pdfMinHeight += 3;
    answerLineWidth = 42;
    answerUnits = 1.1;
  } else if (patternId.includes("true-false")) {
    previewUnits -= 0.08;
    answerAreaHeight = 0;
    answerLineWidth = 0;
  } else if (patternId.includes("mental")) {
    previewUnits -= 0.12;
    pdfMinHeight -= 1;
  }

  if (textLength > 58) {
    previewUnits += 0.18;
    pdfMinHeight += 4;
    answerUnits += 0.1;
  }

  if (textLength > 92) {
    previewUnits += 0.22;
    pdfMinHeight += 5;
    answerAreaHeight += 1.2;
  }

  return {
    previewUnits: clamp(Number(previewUnits.toFixed(2)), 0.72, 2.3),
    pdfMinHeight,
    answerAreaHeight: clamp(answerAreaHeight, 0, 15),
    answerLineWidth: Math.max(0, answerLineWidth),
    answerUnits: clamp(Number(answerUnits.toFixed(2)), 0.8, 1.5)
  };
}
