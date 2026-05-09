const SETTINGS_KEY = "teachsheet-ai:settings";
const WORKSHEET_KEY = "teachsheet-ai:worksheet";
const PROJECTS_KEY = "teachsheet-ai:projects";
const GUEST_SCOPE = "guest";

function canUseStorage() {
  try {
    return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
  } catch {
    return false;
  }
}

function normalizeScope(scope) {
  return scope || GUEST_SCOPE;
}

function getScopedKey(key, scope = GUEST_SCOPE) {
  return `${key}:${normalizeScope(scope)}`;
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

function removeKey(key) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(key);
}

function readScopedJson(baseKey, scope = GUEST_SCOPE) {
  const normalizedScope = normalizeScope(scope);
  const scopedValue = readJson(getScopedKey(baseKey, normalizedScope));

  if (scopedValue !== null) {
    return scopedValue;
  }

  if (normalizedScope === GUEST_SCOPE) {
    return readJson(baseKey);
  }

  return null;
}

export function getGuestScope() {
  return GUEST_SCOPE;
}

export function loadSettings() {
  return readJson(SETTINGS_KEY);
}

export function saveSettings(settings) {
  writeJson(SETTINGS_KEY, settings);
}

export function loadWorksheet(scope = GUEST_SCOPE) {
  return readScopedJson(WORKSHEET_KEY, scope);
}

export function saveWorksheet(worksheet, scope = GUEST_SCOPE) {
  writeJson(getScopedKey(WORKSHEET_KEY, scope), worksheet);
}

export function clearWorksheetStorage(scope = GUEST_SCOPE) {
  const normalizedScope = normalizeScope(scope);
  removeKey(getScopedKey(WORKSHEET_KEY, normalizedScope));

  if (normalizedScope === GUEST_SCOPE) {
    removeKey(WORKSHEET_KEY);
  }
}

export function loadProjects(scope = GUEST_SCOPE) {
  const projects = readScopedJson(PROJECTS_KEY, scope);
  return Array.isArray(projects) ? projects : [];
}

export function saveProjects(projects, scope = GUEST_SCOPE) {
  writeJson(getScopedKey(PROJECTS_KEY, scope), projects);
}

export function saveProject(project, scope = GUEST_SCOPE) {
  const projects = loadProjects(scope);
  const existingIndex = projects.findIndex((entry) => entry.id === project.id);

  if (existingIndex >= 0) {
    projects[existingIndex] = project;
  } else {
    projects.unshift(project);
  }

  saveProjects(projects, scope);
  return projects;
}

export function deleteProject(projectId, scope = GUEST_SCOPE) {
  const projects = loadProjects(scope).filter((project) => project.id !== projectId);
  saveProjects(projects, scope);
  return projects;
}
