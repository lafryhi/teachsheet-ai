const THEMES = {
  blue: {
    id: "blue",
    accent: "#008cff",
    border: "#1d9bf0",
    dashed: "#b7d9f5"
  },
  green: {
    id: "green",
    accent: "#20b26b",
    border: "#20b26b",
    dashed: "#97d9b5"
  },
  gold: {
    id: "gold",
    accent: "#d99a00",
    border: "#d99a00",
    dashed: "#f1cf73"
  }
};

export function getTheme(themeId = "blue") {
  return THEMES[themeId] || THEMES.blue;
}

export function applyTheme(worksheetElement, themeId = "blue") {
  const theme = getTheme(themeId);

  worksheetElement.dataset.theme = theme.id;
  worksheetElement.style.borderColor = theme.border;
  worksheetElement.style.boxShadow = `0 20px 45px ${theme.border}20`;

  const headerElement = worksheetElement.querySelector(".worksheet-header");
  if (headerElement) {
    headerElement.style.borderBottomColor = theme.border;
  }

  const headerTitleElement = worksheetElement.querySelector(".worksheet-header h2");
  if (headerTitleElement) {
    headerTitleElement.style.color = theme.accent;
  }

  worksheetElement.querySelectorAll(".question").forEach((questionElement) => {
    questionElement.style.borderColor = theme.dashed;
  });

  const answerKeyElement = worksheetElement.querySelector(".answer-key");
  if (answerKeyElement) {
    answerKeyElement.style.borderTopColor = theme.border;
  }
}
