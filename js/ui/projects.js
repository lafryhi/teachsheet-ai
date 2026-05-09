import { getTemplateById } from "../templates/templates.js";

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDate(dateValue) {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return date.toLocaleString();
}

function buildProjectTitle(project) {
  if (project.prompt) {
    return project.prompt;
  }

  const grade = project.settings?.grade || "Worksheet";
  const operation = project.settings?.operation || "practice";
  return `${grade} · ${operation}`;
}

export function renderSavedProjects(projects, activeProjectId = null) {
  if (!projects.length) {
    return `<div class="saved-projects-empty">No saved projects yet.</div>`;
  }

  return projects.map((project) => {
    const isActive = project.id === activeProjectId ? " active-project" : "";

    return `
      <div class="saved-project-card${isActive}">
        <h4>${escapeHtml(buildProjectTitle(project))}</h4>
        <div class="saved-project-meta">
          <div><strong>Saved:</strong> ${escapeHtml(formatDate(project.createdAt))}</div>
          <div><strong>Template:</strong> ${escapeHtml(getTemplateById(project.template || "classic-math").name)}</div>
        </div>
        <div class="saved-project-actions">
          <button type="button" data-load-project="${escapeHtml(project.id)}">Load</button>
          <button type="button" class="delete-project" data-delete-project="${escapeHtml(project.id)}">Delete</button>
        </div>
      </div>
    `;
  }).join("");
}
