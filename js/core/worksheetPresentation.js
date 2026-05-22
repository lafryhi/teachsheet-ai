import { getLocalizedGradeLabel, normalizeLanguage, t } from "../ui/language.js";

export function normalizeWhitespace(value = "") {
  return String(value).replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
}

export function normalizeStudentName(value = "") {
  const normalized = normalizeWhitespace(value);

  if (!normalized) {
    return "";
  }

  return normalized.replace(/^sdudent\b/i, "student");
}

export function hasMeaningfulStudentName(value = "") {
  const normalized = normalizeStudentName(value);

  if (!normalized) {
    return false;
  }

  return !/^student(?:\s*\d+)?$/i.test(normalized);
}

export function getStudentDisplayValue(value = "", fallback = "---") {
  return hasMeaningfulStudentName(value) ? normalizeStudentName(value) : fallback;
}

export function getWorksheetHeaderMetaItems({
  identity = {},
  grade = "",
  subjectLabel = "",
  language = "en"
} = {}) {
  const localizedGrade = getLocalizedGradeLabel(language, grade || "");
  const teacherName = normalizeWhitespace(identity.teacherName || "");

  return [
    localizedGrade ? { label: t(language, "classGrade"), value: localizedGrade } : null,
    subjectLabel ? { label: t(language, "subject"), value: subjectLabel } : null,
    teacherName ? { label: t(language, "teacher"), value: teacherName } : null
  ].filter(Boolean);
}

export function getScoreTarget(value = "", fallback = "10") {
  const normalized = normalizeWhitespace(value).replace(/^_+\s*\/?\s*/g, "").replace(/^\/+\s*/, "");
  return normalized || fallback;
}

export function sanitizeTeacherNotes(value = "") {
  const normalized = String(value)
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n")
    .trim();

  if (!normalized) {
    return "";
  }

  const compact = normalized.toLowerCase();

  if (/^(test|note|notes|debug|todo|t\d+)$/i.test(compact)) {
    return "";
  }

  if (compact.length <= 6 && !compact.includes(" ")) {
    return "";
  }

  return normalized;
}

export function shouldShowTeacherNotes(value = "", { currentPage = 1, pageKind = "questions" } = {}) {
  return currentPage === 1 && pageKind !== "answer-key" && Boolean(sanitizeTeacherNotes(value));
}

function extractQuestionTextCandidate(question = {}) {
  if (!question || typeof question !== "object") {
    return question;
  }

  if (typeof question.finalText === "string" && question.finalText.trim()) {
    return question.finalText;
  }

  if (typeof question.displayText === "string" && question.displayText.trim()) {
    return question.displayText;
  }

  if (typeof question.text === "string" && question.text.trim()) {
    return question.text;
  }

  if (typeof question.prompt === "string" && question.prompt.trim()) {
    return question.prompt;
  }

  if (Array.isArray(question.content) && question.content.length > 0) {
    return question.content.join("\n");
  }

  if (typeof question.content === "string" && question.content.trim()) {
    return question.content;
  }

  return "";
}

function trimBlankOuterLines(lines = []) {
  const copy = [...lines];

  while (copy.length > 0 && !String(copy[0] || "").trim()) {
    copy.shift();
  }

  while (copy.length > 0 && !String(copy[copy.length - 1] || "").trim()) {
    copy.pop();
  }

  return copy;
}

export function getQuestionDisplayText(question = {}) {
  const preserveIndentation = question?.format === "vertical";
  const candidate = extractQuestionTextCandidate(question);

  if (candidate === null || candidate === undefined) {
    return "";
  }

  const normalized = String(candidate).replace(/\r\n/g, "\n");
  const lines = trimBlankOuterLines(normalized.split("\n"));

  if (lines.length === 0) {
    return "";
  }

  if (preserveIndentation) {
    return lines
      .map((line) => String(line).replace(/\t/g, "    ").replace(/[ \t]+$/g, ""))
      .join("\n")
      .trimEnd();
  }

  return lines
    .map((line) => String(line).replace(/[ \t]+/g, " ").trim())
    .filter((line, index, values) => line || index === values.length - 1)
    .join("\n")
    .trim();
}

function localizeMathQuestionLabel(label, language = "en") {
  if (normalizeLanguage(language) !== "fr") {
    return label;
  }

  const mapping = {
    "mental math": "Calcul mental",
    "compare the totals": "Compare les résultats",
    "compare the differences": "Compare les différences",
    "true or false": "Vrai ou faux",
    "missing number": "Nombre manquant",
    "missing divisor": "Diviseur manquant",
    "missing factor": "Facteur manquant",
    "each group": "Chaque groupe",
    total: "Total"
  };

  return mapping[String(label || "").trim().toLowerCase()] || label;
}

function parseCanonicalTrueFalse(text = "") {
  const match = String(text).match(/^True or False:\s*(.+?)\s*=\s*(.+)$/i);
  if (!match) {
    return null;
  }

  return {
    expression: match[1].trim(),
    shownAnswer: match[2].trim()
  };
}

function localizeQuestionTextByPattern(question = {}, language = "en") {
  if (normalizeLanguage(language) !== "fr" || !question || typeof question !== "object") {
    return "";
  }

  const patternId = String(question.patternId || "");
  const operation = String(question.operation || "");
  const operands = Array.isArray(question.operands) ? question.operands : [];
  const result = question.result;
  const symbolMap = {
    addition: "+",
    subtraction: "-",
    multiplication: "x",
    division: "/"
  };
  const symbol = symbolMap[operation] || "+";

  if (patternId === "mental-math" && operands.length >= 2) {
    return `Calcul mental : ${operands[0]} ${symbol} ${operands[1]} =`;
  }

  if (patternId === "compare-total" && operands.length >= 4) {
    return `Compare les résultats : ${operands[0]} + ${operands[1]} __ ${operands[2]} + ${operands[3]}`;
  }

  if (patternId === "compare-difference" && operands.length >= 4) {
    return `Compare les différences : ${operands[0]} - ${operands[1]} __ ${operands[2]} - ${operands[3]}`;
  }

  if (patternId === "missing-addend" && operands.length >= 2) {
    return `${operands[0]} + ___ = ${result}`;
  }

  if (patternId === "missing-subtrahend" && operands.length >= 2) {
    return `${operands[0]} - ___ = ${result}`;
  }

  if (patternId === "missing-factor" && operands.length >= 2) {
    return `${operands[0]} x ___ = ${result}`;
  }

  if (patternId === "missing-divisor" && operands.length >= 2) {
    return `${operands[0]} / ___ = ${result}`;
  }

  if (patternId === "groups" && operands.length >= 2) {
    return `${operands[0]} groupes de ${operands[1]} =`;
  }

  if (patternId === "equal-groups" && operands.length >= 2) {
    return `Partage ${operands[0]} en ${operands[1]} groupes égaux =`;
  }

  if (patternId === "true-false") {
    const parsed = parseCanonicalTrueFalse(getQuestionDisplayText(question));
    if (parsed) {
      return `Vrai ou faux : ${parsed.expression} = ${parsed.shownAnswer}`;
    }
  }

  if (patternId === "word-problem" && operands.length >= 2) {
    if (operation === "addition") {
      return `Lina a ${operands[0]} billes. Elle en re\u00e7oit ${operands[1]} de plus. Combien de billes a-t-elle maintenant ?`;
    }

    if (operation === "subtraction") {
      return `Lina a ${operands[0]} billes. On lui en retire ${operands[1]}. Combien lui en reste-t-il ?`;
    }

    if (operation === "multiplication") {
      return `${operands[0]} bo\u00eetes contiennent ${operands[1]} crayons chacune. Combien y a-t-il de crayons en tout ?`;
    }

    if (operation === "division") {
      return `${operands[0]} billes sont partag\u00e9es en ${operands[1]} groupes \u00e9gaux. Combien y a-t-il de billes dans chaque groupe ?`;
    }
  }

  return "";
}

function localizeQuestionTextFallback(text = "", language = "en") {
  if (normalizeLanguage(language) !== "fr") {
    return text;
  }

  return String(text || "")
    .replace(/^Mental math:/i, "Calcul mental :")
    .replace(/^Compare the totals:/i, "Compare les résultats :")
    .replace(/^Compare the differences:/i, "Compare les différences :")
    .replace(/^True or False:/i, "Vrai ou faux :")
    .replace(/^Missing number:/i, "Nombre manquant :")
    .replace(/^Missing divisor:/i, "Diviseur manquant :")
    .replace(/^Missing factor:/i, "Facteur manquant :")
    .replace(/^Each group:/i, "Chaque groupe :")
    .replace(/^Total:/i, "Total :")
    .replace(/^Share (\d+) into (\d+) equal groups =$/i, "Partage $1 en $2 groupes égaux =")
    .replace(/^(\d+) groups of (\d+) =$/i, "$1 groupes de $2 =")
    .replace(/^Read the sentence and write the correct answer\.$/i, "Lis la phrase et écris la bonne réponse.")
    .replace(/^Read the short passage and answer the question\.$/i, "Lis le petit texte et réponds à la question.")
    .replace(/^Trace the model carefully on the line\.$/i, "Repasse soigneusement le modèle sur la ligne.")
    .replace(/^Color the picture carefully and follow the instruction\.$/i, "Colorie l’image avec soin et suis la consigne.")
    .replace(/^Complete question (\d+)\.$/i, "Complète la question $1.")
    .replace(/Circle the verb in this sentence:/gi, "Entoure le verbe dans cette phrase :")
    .replace(/Choose the verb:/gi, "Choisis le verbe :")
    .replace(/Find the action word:/gi, "Trouve le mot d’action :")
    .replace(/Underline the verb:/gi, "Souligne le verbe :")
    .replace(/Write the verb in this sentence:/gi, "Écris le verbe dans cette phrase :")
    .replace(/Pick the verb:/gi, "Choisis le verbe :")
    .replace(/Find the verb:/gi, "Trouve le verbe :")
    .replace(/Circle the action word:/gi, "Entoure le mot d’action :")
    .replace(/Circle the noun:/gi, "Entoure le nom :")
    .replace(/Find the naming word:/gi, "Trouve le nom :")
    .replace(/Underline the noun:/gi, "Souligne le nom :")
    .replace(/Choose the noun:/gi, "Choisis le nom :")
    .replace(/Write the noun in this sentence:/gi, "Écris le nom dans cette phrase :")
    .replace(/Pick the noun:/gi, "Choisis le nom :")
    .replace(/Circle the adjective:/gi, "Entoure l’adjectif :")
    .replace(/Find the describing word:/gi, "Trouve l’adjectif :")
    .replace(/Underline the adjective:/gi, "Souligne l’adjectif :")
    .replace(/Choose the adjective:/gi, "Choisis l’adjectif :")
    .replace(/Write the adjective in this sentence:/gi, "Écris l’adjectif dans cette phrase :")
    .replace(/Read and answer:/gi, "Lis puis réponds :")
    .replace(/Write only the correct word on the line\./gi, "Écris seulement le mot correct sur la ligne.")
    .replace(/Grammar check:/gi, "Vérification de grammaire :")
    .replace(/Then use the word \"([^\"]+)\" in a short new sentence\./i, "Puis utilise le mot \"$1\" dans une nouvelle phrase courte.")
    .replace(/The children jump outside after lunch\./g, "Les enfants sautent dehors après le déjeuner.")
    .replace(/Mother cooks dinner every night for the family\./g, "Maman prépare le dîner chaque soir pour la famille.")
    .replace(/Birds sing on the branch before sunrise\./g, "Les oiseaux chantent sur la branche avant le lever du soleil.")
    .replace(/We walk to school together every morning\./g, "Nous allons à l'école ensemble chaque matin.")
    .replace(/The baby sleeps quietly in the crib\./g, "Le bébé dort tranquillement dans son berceau.")
    .replace(/My brother carries his books in a blue bag\./g, "Mon frère porte ses livres dans un sac bleu.")
    .replace(/The rain falls softly on the playground\./g, "La pluie tombe doucement sur la cour de récréation.")
    .replace(/The teacher explains the lesson clearly\./g, "L'enseignant explique la leçon clairement.")
    .replace(/The cat sleeps on the sofa near the window\./g, "Le chat dort sur le canapé près de la fenêtre.")
    .replace(/My brother rides a bike after school\./g, "Mon frère fait du vélo après l'école.")
    .replace(/The teacher opened the book on the table\./g, "L'enseignant a ouvert le livre sur la table.")
    .replace(/The flowers smell fresh in the garden\./g, "Les fleurs sentent bon dans le jardin.")
    .replace(/The apple is red and shiny\./g, "La pomme est rouge et brillante.")
    .replace(/The bus stopped beside the library\./g, "Le bus s'est arrêté près de la bibliothèque.")
    .replace(/Sara packed a notebook and a pencil\./g, "Sara a rangé un cahier et un crayon.")
    .replace(/The river flows behind the village\./g, "La rivière coule derrière le village.")
    .replace(/The blue balloon floated across the yard\./g, "Le ballon bleu a traversé la cour.")
    .replace(/We saw a tall building near the square\./g, "Nous avons vu un grand bâtiment près de la place.")
    .replace(/She wore a shiny dress for the play\./g, "Elle portait une robe brillante pour le spectacle.")
    .replace(/The soup is hot and tasty\./g, "La soupe est chaude et savoureuse.")
    .replace(/They found a small shell on the beach\./g, "Ils ont trouvé un petit coquillage sur la plage.")
    .replace(/We sat under a shady tree in the park\./g, "Nous nous sommes assis sous un arbre ombragé dans le parc.")
    .replace(/The kitten has soft fur\./g, "Le chaton a une fourrure douce.")
    .replace(/Omar solved a difficult puzzle\./g, "Omar a résolu un puzzle difficile.")
    .replace(/"jump"/g, "\"sautent\"")
    .replace(/"cooks"/g, "\"prépare\"")
    .replace(/"sing"/g, "\"chantent\"")
    .replace(/"walk"/g, "\"allons\"")
    .replace(/"sleeps"/g, "\"dort\"")
    .replace(/"carries"/g, "\"porte\"")
    .replace(/"falls"/g, "\"tombe\"")
    .replace(/"explains"/g, "\"explique\"")
    .replace(/"cat"/g, "\"chat\"")
    .replace(/"brother"/g, "\"frère\"")
    .replace(/"teacher"/g, "\"enseignant\"")
    .replace(/"flowers"/g, "\"fleurs\"")
    .replace(/"apple"/g, "\"pomme\"")
    .replace(/"notebook"/g, "\"cahier\"")
    .replace(/"river"/g, "\"rivière\"")
    .replace(/"blue"/g, "\"bleu\"")
    .replace(/"tall"/g, "\"grand\"")
    .replace(/"shiny"/g, "\"brillante\"")
    .replace(/"hot"/g, "\"chaude\"")
    .replace(/"small"/g, "\"petit\"")
    .replace(/"shady"/g, "\"ombragé\"")
    .replace(/"soft"/g, "\"douce\"")
    .replace(/"difficult"/g, "\"difficile\"");
}

export function getLocalizedQuestionDisplayText(question = {}, language = "en") {
  const canonical = getQuestionDisplayText(question);

  if (!canonical) {
    return "";
  }

  const patternText = localizeQuestionTextByPattern(question, language);
  if (patternText) {
    return patternText;
  }

  return localizeQuestionTextFallback(canonical, language);
}

export function hasRenderableQuestionText(question = {}) {
  const displayText = getQuestionDisplayText(question);

  if (!displayText) {
    return false;
  }

  const meaningfulText = displayText
    .replace(/_{2,}/g, "")
    .replace(/[-=]{3,}/g, "")
    .replace(/\s+/g, "");

  return /[0-9A-Za-zÀ-ÿ+\-×x÷/><=()]/.test(meaningfulText);
}

export function getLocalizedAnswerText(question = {}, language = "en") {
  const answer = question?.answer === undefined || question?.answer === null
    ? ""
    : String(question.answer);

  if (normalizeLanguage(language) !== "fr") {
    return answer;
  }

  if (/^true$/i.test(answer)) {
    return "Vrai";
  }

  if (/^false$/i.test(answer)) {
    return "Faux";
  }

  const grammarAnswerMap = {
    jump: "sautent",
    cooks: "prépare",
    sing: "chantent",
    walk: "allons",
    sleeps: "dort",
    carries: "porte",
    falls: "tombe",
    explains: "explique",
    cat: "chat",
    brother: "frère",
    teacher: "enseignant",
    flowers: "fleurs",
    apple: "pomme",
    bus: "bus",
    notebook: "cahier",
    river: "rivière",
    blue: "bleu",
    tall: "grand",
    shiny: "brillante",
    hot: "chaude",
    small: "petit",
    shady: "ombragé",
    soft: "douce",
    difficult: "difficile"
  };

  if (grammarAnswerMap[answer]) {
    return grammarAnswerMap[answer];
  }

  return answer
    .replace(/^Missing number:/i, "Nombre manquant :")
    .replace(/^Missing divisor:/i, "Diviseur manquant :")
    .replace(/^Missing factor:/i, "Facteur manquant :")
    .replace(/^Each group:/i, "Chaque groupe :")
    .replace(/^Total:/i, "Total :");
}

export function parseCompareQuestionText(textOrQuestion = "", language = "en") {
  const normalized = typeof textOrQuestion === "object" && textOrQuestion !== null
    ? getQuestionDisplayText(textOrQuestion)
    : String(textOrQuestion || "").trim();
  const englishMatch = normalized.match(/^Compare the ([^:]+):\s*(.+?)\s+_{2,}\s+(.+)$/i);
  const frenchMatch = normalized.match(/^Compare les ([^:]+)\s*:\s*(.+?)\s+_{2,}\s+(.+)$/i);
  const match = englishMatch || frenchMatch;

  if (!match) {
    return null;
  }

  const labelPrefix = englishMatch ? `Compare the ${match[1]}` : `Compare les ${match[1]}`;

  return {
    heading: `${localizeMathQuestionLabel(labelPrefix, language)} :`,
    leftExpression: match[2].trim(),
    rightExpression: match[3].trim()
  };
}

export function isCompareQuestion(question = {}) {
  return Boolean(
    ["compare-total", "compare-difference"].includes(question?.patternId)
      || parseCompareQuestionText(question)
  );
}
