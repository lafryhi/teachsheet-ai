import { getTemplateById } from "../templates/templates.js";
import { normalizeLanguage, t } from "./language.js";

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDate(dateValue, language = "en") {
  const date = new Date(dateValue);
  const locale = normalizeLanguage(language) === "fr" ? "fr-FR" : undefined;

  if (Number.isNaN(date.getTime())) {
    return {
      full: "Unknown date",
      short: "Unknown time"
    };
  }

  return {
      full: date.toLocaleString(locale),
      short: date.toLocaleDateString(locale, {
      year: "numeric",
      month: "short",
      day: "numeric"
    })
  };
}

function buildProjectTitle(project) {
  if (project.prompt) {
    return project.prompt;
  }

  const grade = project.settings?.grade || "Worksheet";
  const operation = project.settings?.operation || "practice";
  return `${grade} - ${operation}`;
}

function sortProjects(projects) {
  return [...projects].sort((left, right) => {
    const leftTime = new Date(left.createdAt).getTime() || 0;
    const rightTime = new Date(right.createdAt).getTime() || 0;
    return rightTime - leftTime;
  });
}

export function renderSavedProjects(projects, activeProjectId = null, language = "en") {
  const resolvedLanguage = normalizeLanguage(language);

  if (!projects.length) {
    return `
      <div class="saved-projects-empty">
        <strong>${escapeHtml(t(resolvedLanguage, "noSavedProjects"))}</strong>
        <span>${escapeHtml(t(resolvedLanguage, "noSavedProjectsBody"))}</span>
      </div>
    `;
  }

  return sortProjects(projects).map((project) => {
    const isActive = project.id === activeProjectId ? " active-project" : "";
    const formattedDate = formatDate(project.createdAt, resolvedLanguage);
    const templateName = getTemplateById(project.template || "classic-math").name;

    return `
      <div class="saved-project-card${isActive}">
        <h4>${escapeHtml(buildProjectTitle(project))}</h4>
        <div class="saved-project-meta">
          <div><strong>${escapeHtml(t(resolvedLanguage, "savedAt"))}</strong> ${escapeHtml(formattedDate.full)}</div>
          <div><strong>${escapeHtml(t(resolvedLanguage, "savedDay"))}</strong> ${escapeHtml(formattedDate.short)}</div>
          <div><strong>${escapeHtml(t(resolvedLanguage, "templateLabel"))}</strong> ${escapeHtml(templateName)}</div>
        </div>
        <div class="saved-project-actions">
          <button type="button" data-load-project="${escapeHtml(project.id)}">${escapeHtml(t(resolvedLanguage, "load"))}</button>
          <button type="button" class="delete-project" data-delete-project="${escapeHtml(project.id)}">${escapeHtml(t(resolvedLanguage, "delete"))}</button>
        </div>
      </div>
    `;
  }).join("");
}
