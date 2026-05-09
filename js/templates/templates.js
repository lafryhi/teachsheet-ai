export const templates = [
  {
    id: "classic-math",
    name: "Classic Math Worksheet",
    layout: "two-columns",
    theme: "blue",
    questionsPerPage: 10
  }
];

export function getDefaultTemplate() {
  return templates[0];
}
