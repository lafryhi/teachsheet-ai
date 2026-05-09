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

  const headerElement = worksheetElement.querySelector(".worksheet-header");
  if (headerElement) {
    headerElement.style.borderBottomColor = theme.border;
  }

  worksheetElement.querySelectorAll(".question").forEach((questionElement) => {
    questionElement.style.borderColor = theme.dashed;
  });
}
