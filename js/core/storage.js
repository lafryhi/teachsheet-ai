const SETTINGS_KEY = "teachsheet-ai:settings";
const WORKSHEET_KEY = "teachsheet-ai:worksheet";

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
