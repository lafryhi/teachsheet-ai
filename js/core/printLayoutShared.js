export const PDF_PAGE_LAYOUT = {
  width: 210,
  height: 297,
  paddingX: 20,
  paddingTop: 20,
  paddingBottom: 20,
  footerBottom: 8,
  footerHeight: 8,
  footerGap: 12
};

export const QUESTION_SECTION_HEADER_HEIGHT = 8.4;
export const ANSWER_SECTION_HEADER_HEIGHT = 7.8;

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function scaleMetric(value, factor, minimum) {
  return Math.max(minimum, Number((value * factor).toFixed(2)));
}

function simplifyDescriptorFocusLabel(focusLabel = "", language = "en") {
  const rawLabel = String(focusLabel || "").trim();

  if (!rawLabel) {
    return "";
  }

  if (String(language || "en").toLowerCase().startsWith("fr")) {
    return rawLabel.replace(/\s+—\s+Niveau\s+(facile|moyen|difficile)\s*$/i, "").trim();
  }

  return rawLabel.replace(/\s+-\s+(Easy|Medium|Hard)\s*$/i, "").trim();
}

export function getPdfLayoutMetrics(presentation) {
  const isSingleColumn = presentation.layout === "single-column";
  const isKids = presentation.id === "kids-colorful";

  return {
    questionFontSize: isKids ? 12.4 : isSingleColumn ? 11.7 : 11.5,
    questionLineHeight: isKids ? 4.9 : isSingleColumn ? 4.55 : 4.32,
    answerLineHeight: 3.9,
    questionPadding: isKids ? 4.2 : isSingleColumn ? 4 : 3.8,
    questionMinHeight: isKids ? 24 : isSingleColumn ? 21.5 : 20.5,
    verticalQuestionMinHeight: isKids ? 31 : 28.5,
    answerAreaHeight: isKids ? 8.2 : 6.8,
    answerLineWidth: isKids ? 40 : isSingleColumn ? 82 : 28,
    answerCardMinHeight: isSingleColumn ? 10 : 9.6,
    answerCardPadding: 2.6,
    answerCardLineHeight: 3.55,
    rowGap: isSingleColumn ? 4.8 : 4.3,
    columnGap: isSingleColumn ? 0 : 6,
    titleFontSize: 16.8,
    titleSubtitleFontSize: 7.6,
    subtitleFontSize: 8.8,
    schoolFontSize: 6.9,
    introFontSize: 8.3,
    introLineHeight: 3.65,
    metaFontSize: 7.45,
    metaLineHeight: 3.35,
    schoolLogoSize: 10.6,
    schoolLogoGap: 2,
    schoolGap: 3.45,
    titleGap: 5.45,
    subtitleGap: 3.2,
    dividerGap: 2.6,
    fieldHeight: 8.5,
    titleLineUnit: 4.55,
    descriptorLineUnit: 3.25,
    descriptorMinHeight: 3.7,
    metaTopGap: 1.2,
    metaMinHeight: 3.35,
    schoolBaselineOffset: 2.45,
    titleBaselineOffset: 4.2,
    descriptorBaselineOffset: 2.55,
    metaBaselineOffset: 2.6,
    identityTopGap: 1.45,
    introTopGap: 2.95,
    introBaselineOffset: 2.95,
    notesTopGap: 2.65,
    dividerTopGap: 1.3,
    headerBottomGap: 3.75,
    fieldLabelBaseline: 2.75,
    fieldValueBaseline: 6.2,
    notesLabelGap: 3.55,
    notesLabelBaseline: 3.35,
    notesPadding: 2.55,
    notesTextTopOffset: 6.1,
    notesLineHeight: 3.65,
    notesMinHeight: 9.1,
    footerFontSize: 8.2,
    footerLineInset: 1.8
  };
}

export function getQuestionLineHeight(metrics, question = {}, lineCount = 1) {
  const base = metrics.questionLineHeight;
  const patternId = String(question?.patternId || "");
  const isWordProblem = patternId === "word-problem";
  const isCompare = patternId.startsWith("compare-");
  const isMentalMath = patternId === "mental-math";

  if (isMentalMath && lineCount <= 1) {
    return base;
  }

  if (isWordProblem) {
    return scaleMetric(base, lineCount >= 3 ? 1.12 : 1.08, base + 0.22);
  }

  if (isCompare || lineCount >= 3) {
    return scaleMetric(base, 1.08, base + 0.18);
  }

  if (lineCount === 2) {
    return scaleMetric(base, 1.04, base + 0.08);
  }

  return base;
}

export function getPageRowsHeight(rows, rowGap) {
  if (!rows.length) {
    return 0;
  }

  return rows.reduce((total, row, index) => (
    total + row.rowHeight + (index > 0 ? rowGap : 0)
  ), 0);
}

function getPageFillRatio(pageRows, usableHeight, rowGap) {
  if (!usableHeight || usableHeight <= 0 || !pageRows.length) {
    return 0;
  }

  return getPageRowsHeight(pageRows, rowGap) / usableHeight;
}

export function buildDensityProfile({ questionPages, questionUsableHeight, rowGap, questions }) {
  if (!questionPages.length) {
    return {
      compactness: 0,
      earlyFill: 1,
      averageFill: 1
    };
  }

  const fills = questionPages.map((pageRows) => getPageFillRatio(pageRows, questionUsableHeight, rowGap));
  const earlyPages = fills.slice(0, Math.min(2, fills.length));
  const earlyFill = earlyPages.reduce((total, fill) => total + fill, 0) / earlyPages.length;
  const averageFill = fills.reduce((total, fill) => total + fill, 0) / fills.length;
  const verticalShare = questions.length
    ? questions.filter((question) => question.format === "vertical").length / questions.length
    : 0;
  let compactness = 0;

  if (questionPages.length > 1) {
    compactness = (
      Math.max(0, 0.86 - earlyFill) * 0.55 +
      Math.max(0, 0.82 - averageFill) * 0.45
    );
  } else {
    compactness = Math.max(0, 0.76 - averageFill) * 0.35;
  }

  compactness += verticalShare * 0.03;

  return {
    compactness: clamp(compactness, 0, 0.18),
    earlyFill,
    averageFill
  };
}

export function getAdaptivePdfMetrics(baseMetrics, densityProfile) {
  const compactness = densityProfile?.compactness || 0;

  if (compactness <= 0.015) {
    return {
      ...baseMetrics,
      sectionHeaderHeight: QUESTION_SECTION_HEADER_HEIGHT,
      answerSectionHeaderHeight: ANSWER_SECTION_HEADER_HEIGHT
    };
  }

  const factor = 1 - compactness;

  return {
    ...baseMetrics,
    questionPadding: scaleMetric(baseMetrics.questionPadding, 1 - (compactness * 0.7), 3),
    questionMinHeight: scaleMetric(baseMetrics.questionMinHeight, factor, 18.5),
    verticalQuestionMinHeight: scaleMetric(baseMetrics.verticalQuestionMinHeight, 1 - (compactness * 0.85), 24.5),
    answerAreaHeight: scaleMetric(baseMetrics.answerAreaHeight, 1 - (compactness * 0.75), 5.8),
    answerCardMinHeight: scaleMetric(baseMetrics.answerCardMinHeight, factor, 8.8),
    rowGap: scaleMetric(baseMetrics.rowGap, 1 - (compactness * 0.9), 2.8),
    introLineHeight: scaleMetric(baseMetrics.introLineHeight, 1 - (compactness * 0.35), 3.4),
    notesLineHeight: scaleMetric(baseMetrics.notesLineHeight, 1 - (compactness * 0.35), 3.4),
    notesMinHeight: scaleMetric(baseMetrics.notesMinHeight, 1 - (compactness * 0.5), 8.2),
    sectionHeaderHeight: scaleMetric(QUESTION_SECTION_HEADER_HEIGHT, 1 - (compactness * 0.75), 6.4),
    answerSectionHeaderHeight: scaleMetric(ANSWER_SECTION_HEADER_HEIGHT, 1 - (compactness * 0.75), 6)
  };
}

export function getAnswerSheetHeaderMetrics(baseMetrics) {
  return {
    ...baseMetrics,
    titleFontSize: scaleMetric(baseMetrics.titleFontSize, 0.89, 15.6),
    titleSubtitleFontSize: scaleMetric(baseMetrics.titleSubtitleFontSize, 0.92, 7),
    schoolFontSize: scaleMetric(baseMetrics.schoolFontSize, 0.9, 6.5),
    introFontSize: scaleMetric(baseMetrics.introFontSize, 0.94, 7.7),
    introLineHeight: scaleMetric(baseMetrics.introLineHeight, 0.92, 3.3),
    schoolGap: scaleMetric(baseMetrics.schoolGap, 0.78, 1.9),
    titleGap: scaleMetric(baseMetrics.titleGap, 0.82, 3.35),
    fieldHeight: scaleMetric(baseMetrics.fieldHeight, 0.88, 7.2),
    titleLineUnit: scaleMetric(baseMetrics.titleLineUnit, 0.88, 3.95),
    descriptorLineUnit: scaleMetric(baseMetrics.descriptorLineUnit, 0.9, 2.6),
    descriptorMinHeight: scaleMetric(baseMetrics.descriptorMinHeight, 0.9, 2.7),
    metaFontSize: scaleMetric(baseMetrics.metaFontSize, 0.95, 7),
    metaLineHeight: scaleMetric(baseMetrics.metaLineHeight, 0.92, 3),
    schoolLogoSize: scaleMetric(baseMetrics.schoolLogoSize, 0.88, 8.8),
    schoolLogoGap: scaleMetric(baseMetrics.schoolLogoGap, 0.84, 1.3),
    metaTopGap: scaleMetric(baseMetrics.metaTopGap, 0.78, 0.8),
    metaMinHeight: scaleMetric(baseMetrics.metaMinHeight, 0.88, 2.7),
    schoolBaselineOffset: scaleMetric(baseMetrics.schoolBaselineOffset, 0.88, 2.1),
    titleBaselineOffset: scaleMetric(baseMetrics.titleBaselineOffset, 0.9, 3.8),
    descriptorBaselineOffset: scaleMetric(baseMetrics.descriptorBaselineOffset, 0.9, 2.3),
    metaBaselineOffset: scaleMetric(baseMetrics.metaBaselineOffset, 0.9, 2.3),
    identityTopGap: scaleMetric(baseMetrics.identityTopGap, 0.7, 0.6),
    introTopGap: scaleMetric(baseMetrics.introTopGap, 0.72, 1.5),
    introBaselineOffset: scaleMetric(baseMetrics.introBaselineOffset, 0.88, 2.55),
    notesTopGap: scaleMetric(baseMetrics.notesTopGap, 0.75, 1.7),
    dividerTopGap: scaleMetric(baseMetrics.dividerTopGap, 0.82, 1.05),
    headerBottomGap: scaleMetric(baseMetrics.headerBottomGap, 0.72, 2.2),
    fieldLabelBaseline: scaleMetric(baseMetrics.fieldLabelBaseline, 0.9, 2.4),
    fieldValueBaseline: scaleMetric(baseMetrics.fieldValueBaseline, 0.9, 5.55),
    notesLabelGap: scaleMetric(baseMetrics.notesLabelGap, 0.82, 2.6),
    notesLabelBaseline: scaleMetric(baseMetrics.notesLabelBaseline, 0.9, 3),
    notesPadding: scaleMetric(baseMetrics.notesPadding, 0.9, 2.1),
    notesTextTopOffset: scaleMetric(baseMetrics.notesTextTopOffset, 0.9, 5.1),
    notesLineHeight: scaleMetric(baseMetrics.notesLineHeight, 0.92, 3.3),
    notesMinHeight: scaleMetric(baseMetrics.notesMinHeight, 0.84, 7.4)
  };
}

export function getLocalizedHeaderMetrics(baseMetrics, language = "en") {
  if (String(language || "en").toLowerCase().startsWith("fr") === false) {
    return baseMetrics;
  }

  return {
    ...baseMetrics,
    schoolGap: scaleMetric(baseMetrics.schoolGap, 1.12, baseMetrics.schoolGap + 0.22),
    titleGap: scaleMetric(baseMetrics.titleGap, 1.07, baseMetrics.titleGap + 0.25),
    descriptorLineUnit: scaleMetric(baseMetrics.descriptorLineUnit, 1.05, baseMetrics.descriptorLineUnit + 0.08),
    descriptorMinHeight: scaleMetric(baseMetrics.descriptorMinHeight, 1.06, baseMetrics.descriptorMinHeight + 0.18),
    schoolLogoGap: scaleMetric(baseMetrics.schoolLogoGap, 1.04, baseMetrics.schoolLogoGap + 0.06),
    metaLineHeight: scaleMetric(baseMetrics.metaLineHeight, 1.04, baseMetrics.metaLineHeight + 0.08),
    metaTopGap: scaleMetric(baseMetrics.metaTopGap, 1.05, baseMetrics.metaTopGap + 0.08),
    metaMinHeight: scaleMetric(baseMetrics.metaMinHeight, 1.05, baseMetrics.metaMinHeight + 0.08),
    identityTopGap: scaleMetric(baseMetrics.identityTopGap, 1.08, baseMetrics.identityTopGap + 0.18),
    introTopGap: scaleMetric(baseMetrics.introTopGap, 1.06, baseMetrics.introTopGap + 0.18),
    notesLabelGap: scaleMetric(baseMetrics.notesLabelGap, 1.06, baseMetrics.notesLabelGap + 0.18),
    notesTextTopOffset: scaleMetric(baseMetrics.notesTextTopOffset, 1.04, baseMetrics.notesTextTopOffset + 0.18),
    notesTopGap: scaleMetric(baseMetrics.notesTopGap, 1.05, baseMetrics.notesTopGap + 0.16),
    headerBottomGap: scaleMetric(baseMetrics.headerBottomGap, 1.05, baseMetrics.headerBottomGap + 0.12)
  };
}

function getHeightAfterRemovingRow(pageHeight, pageLength, rowHeight, rowGap) {
  if (pageLength <= 0) {
    return 0;
  }

  if (pageLength === 1) {
    return 0;
  }

  return pageHeight - rowHeight - rowGap;
}

function getHeightAfterAddingRow(pageHeight, pageLength, rowHeight, rowGap) {
  return pageHeight + rowHeight + (pageLength > 0 ? rowGap : 0);
}

function isMoveImprovement(
  currentLeftHeight,
  currentRightHeight,
  nextLeftHeight,
  nextRightHeight,
  leftTargetHeight,
  rightTargetHeight
) {
  const currentDistance = Math.abs(currentLeftHeight - leftTargetHeight) + Math.abs(currentRightHeight - rightTargetHeight);
  const nextDistance = Math.abs(nextLeftHeight - leftTargetHeight) + Math.abs(nextRightHeight - rightTargetHeight);

  return nextDistance + 1 < currentDistance;
}

function rebalanceQuestionPages(pages, usableHeight, rowGap) {
  const balancedPages = pages
    .filter((pageRows) => pageRows.length > 0)
    .map((pageRows) => [...pageRows]);

  if (balancedPages.length < 2) {
    return balancedPages;
  }

  const totalContentHeight = balancedPages.reduce((total, pageRows) => (
    total + getPageRowsHeight(pageRows, rowGap)
  ), 0);
  const targetHeight = Math.min(usableHeight, totalContentHeight / balancedPages.length);
  const earlyTargetHeight = Math.min(
    usableHeight * 0.88,
    Math.max(targetHeight, usableHeight * 0.8)
  );
  let changed = true;
  let iterations = 0;

  while (changed && iterations < 20) {
    changed = false;
    iterations += 1;

    for (let pageIndex = 0; pageIndex < balancedPages.length - 1; pageIndex += 1) {
      const leftPage = balancedPages[pageIndex];
      const rightPage = balancedPages[pageIndex + 1];

      if (!leftPage.length || !rightPage.length) {
        continue;
      }

      let leftHeight = getPageRowsHeight(leftPage, rowGap);
      let rightHeight = getPageRowsHeight(rightPage, rowGap);
      const leftTargetHeight = pageIndex < 2 ? earlyTargetHeight : targetHeight;
      const rightTargetHeight = pageIndex + 1 < 2 ? earlyTargetHeight : targetHeight;

      if (leftHeight + 1 < leftTargetHeight && rightPage.length > 1) {
        const movedRow = rightPage[0];
        const nextLeftHeight = getHeightAfterAddingRow(leftHeight, leftPage.length, movedRow.rowHeight, rowGap);
        const nextRightHeight = getHeightAfterRemovingRow(rightHeight, rightPage.length, movedRow.rowHeight, rowGap);

        if (
          nextLeftHeight <= usableHeight &&
          nextRightHeight >= usableHeight * 0.22 &&
          isMoveImprovement(
            leftHeight,
            rightHeight,
            nextLeftHeight,
            nextRightHeight,
            leftTargetHeight,
            rightTargetHeight
          )
        ) {
          leftPage.push(rightPage.shift());
          leftHeight = nextLeftHeight;
          rightHeight = nextRightHeight;
          changed = true;
        }
      }

      if (rightHeight + 1 < rightTargetHeight && leftPage.length > 1) {
        const movedRow = leftPage[leftPage.length - 1];
        const nextLeftHeight = getHeightAfterRemovingRow(leftHeight, leftPage.length, movedRow.rowHeight, rowGap);
        const nextRightHeight = getHeightAfterAddingRow(rightHeight, rightPage.length, movedRow.rowHeight, rowGap);

        if (
          nextRightHeight <= usableHeight &&
          nextLeftHeight >= usableHeight * 0.22 &&
          isMoveImprovement(
            leftHeight,
            rightHeight,
            nextLeftHeight,
            nextRightHeight,
            leftTargetHeight,
            rightTargetHeight
          )
        ) {
          rightPage.unshift(leftPage.pop());
          changed = true;
        }
      }
    }
  }

  return balancedPages.filter((pageRows) => pageRows.length > 0);
}

export function paginateRows(rows, usableHeight, rowGap, continuationHeaderHeight = 0) {
  const pages = [];
  let currentPageRows = [];
  let usedHeight = 0;

  rows.forEach((row) => {
    let effectiveRow = row;
    let totalRowHeight = effectiveRow.rowHeight + (currentPageRows.length > 0 ? rowGap : 0);

    if (currentPageRows.length > 0 && usedHeight + totalRowHeight > usableHeight) {
      pages.push(currentPageRows);
      if (!row.showSectionHeader && row.sectionLabel && continuationHeaderHeight > 0) {
        effectiveRow = {
          ...row,
          continuedSectionHeader: true,
          rowHeight: row.rowHeight + continuationHeaderHeight,
          sectionHeaderHeight: (row.sectionHeaderHeight || 0) + continuationHeaderHeight
        };
      }

      currentPageRows = [effectiveRow];
      usedHeight = effectiveRow.rowHeight;
      return;
    }

    currentPageRows.push(effectiveRow);
    usedHeight += totalRowHeight;
  });

  if (currentPageRows.length > 0) {
    pages.push(currentPageRows);
  }

  const balancedPages = rebalanceQuestionPages(pages, usableHeight, rowGap);

  if (continuationHeaderHeight <= 0) {
    return balancedPages;
  }

  return balancedPages.map((pageRows, pageIndex) => pageRows.map((row, rowIndex) => {
    const shouldRepeatHeader = pageIndex > 0 && rowIndex === 0 && row.sectionLabel && !row.showSectionHeader;

    return {
      ...row,
      continuedSectionHeader: shouldRepeatHeader,
      sectionHeaderHeight: shouldRepeatHeader
        ? Math.max(row.sectionHeaderHeight || 0, continuationHeaderHeight)
        : (row.showSectionHeader ? row.sectionHeaderHeight : 0),
      rowHeight: shouldRepeatHeader
        ? (row.baseRowHeight || row.rowHeight) + continuationHeaderHeight
        : (row.baseRowHeight || row.rowHeight)
    };
  }));
}

export function getFooterMetrics(pageHeight) {
  const top = pageHeight - PDF_PAGE_LAYOUT.footerBottom - PDF_PAGE_LAYOUT.footerHeight;

  return {
    top,
    lineY: top - 1.8,
    textY: top + 5.4
  };
}

export function getIdentityFieldHeight(metrics) {
  return metrics.fieldHeight;
}

export function normalizePrintFocusLabel(subjectLabel, focusLabel, language = "en") {
  if (!focusLabel) {
    return "";
  }

  if (String(language || "en").toLowerCase().startsWith("fr")) {
    return String(focusLabel).trim();
  }

  if (subjectLabel === "Math") {
    return String(focusLabel).replace(/^Horizontal\s+/i, "");
  }

  return String(focusLabel);
}

export function normalizePrintWorksheetTitle(title, subjectLabel, focusLabel, language = "en") {
  const rawTitle = String(title || "").trim();

  if (!rawTitle) {
    return String(language || "en").toLowerCase().startsWith("fr") ? "Fiche d'exercices" : "Worksheet";
  }

  const normalized = rawTitle.toLowerCase();
  const genericTitles = new Set(["exercices", "exercises", "exercise", "worksheet"]);

  if (genericTitles.has(normalized)) {
    const focusPart = normalizePrintFocusLabel(subjectLabel, focusLabel, language);

    if (String(language || "en").toLowerCase().startsWith("fr")) {
      if (/calcul mental/i.test(focusPart)) {
        return "Calcul mental";
      }

      if (/op\u00e9rations mixtes/i.test(focusPart)) {
        return "R\u00e9vision des op\u00e9rations mixtes";
      }

      const operationMatch = focusPart.match(/(addition|soustraction|multiplication|division)/i);
      if (operationMatch) {
        return `Exercices de ${operationMatch[1].toLowerCase()}`;
      }

      return focusPart || "Fiche d'exercices";
    }

    return focusPart ? `${focusPart} Worksheet` : "Worksheet";
  }

  return rawTitle;
}

export function buildCompactDescriptorLine({
  pageKind,
  grade,
  subjectLabel,
  focusLabel,
  worksheetModeLabel,
  language = "en"
}) {
  const isFrench = String(language || "en").toLowerCase().startsWith("fr");
  const normalizedFocus = simplifyDescriptorFocusLabel(
    normalizePrintFocusLabel(subjectLabel, focusLabel, language),
    language
  );
  const parts = [];

  if (pageKind === "answer-key") {
    return [grade, isFrench ? "Corrigé" : "Answer Sheet"].filter(Boolean).join(isFrench ? " — " : " | ");
  }

  if (normalizedFocus) {
    parts.push(normalizedFocus);
  }

  if (grade) {
    parts.push(grade);
  } else if (subjectLabel && subjectLabel !== "Math" && subjectLabel !== "Math\u00e9matiques") {
    parts.push(subjectLabel);
  } else if (worksheetModeLabel) {
    parts.push(worksheetModeLabel);
  }

  return parts.filter(Boolean).join(isFrench ? " \u2014 " : " | ");
}

export function getNotesBlockHeight(linesCount, metrics) {
  return Math.max(
    metrics.notesMinHeight,
    (linesCount * metrics.notesLineHeight) + metrics.notesLabelGap + 4.8
  );
}

export function resolveAnswerColumnCount(questions = []) {
  const hasWideAnswers = questions.some((question) => (
    (question.layoutHints?.answerUnits || 1) > 1.2 || String(question.answer || "").length > 24
  ));
  const allAnswersCompact = questions.length > 0 && questions.every((question) => (
    (question.layoutHints?.answerUnits || 1) <= 1.05 && String(question.answer || "").length <= 16
  ));

  if (hasWideAnswers) {
    return 2;
  }

  return allAnswersCompact ? 4 : 3;
}
