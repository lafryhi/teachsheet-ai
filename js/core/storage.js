const SETTINGS_KEY = "teachsheet-ai:settings";
const WORKSHEET_KEY = "teachsheet-ai:worksheet";
const PROJECTS_KEY = "teachsheet-ai:projects";

function canUseStorage() {
  try {
    return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
  } catch {
    return false;
  }
}

function readJson(key) {
  if (!canUseStorage()) {
    return null;
  }

  const rawValue = window.localStorage.getItem(key);

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue);
  } catch {
    return null;
  }
}

function writeJson(key, value) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

export function loadSettings() {
  return readJson(SETTINGS_KEY);
}

export function saveSettings(settings) {
  writeJson(SETTINGS_KEY, settings);
}

export function loadWorksheet() {
  return readJson(WORKSHEET_KEY);
}

export function saveWorksheet(worksheet) {
  writeJson(WORKSHEET_KEY, worksheet);
}

export function clearWorksheetStorage() {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(WORKSHEET_KEY);
}

export function loadProjects() {
  const projects = readJson(PROJECTS_KEY);
  return Array.isArray(projects) ? projects : [];
}

export function saveProjects(projects) {
  writeJson(PROJECTS_KEY, projects);
}

export function saveProject(project) {
  const projects = loadProjects();
  const existingIndex = projects.findIndex((entry) => entry.id === project.id);

  if (existingIndex >= 0) {
    projects[existingIndex] = project;
  } else {
    projects.unshift(project);
  }

  saveProjects(projects);
  return projects;
}

export function deleteProject(projectId) {
  const projects = loadProjects().filter((project) => project.id !== projectId);
  saveProjects(projects);
  return projects;
}
