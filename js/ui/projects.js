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
    return {
      full: "Unknown date",
      short: "Unknown time"
    };
  }

  return {
    full: date.toLocaleString(),
    short: date.toLocaleDateString(undefined, {
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

export function renderSavedProjects(projects, activeProjectId = null) {
  if (!projects.length) {
    return `
      <div class="saved-projects-empty">
        <strong>No saved projects yet.</strong>
        <span>Generate a worksheet first, then use Save Project to keep it ready for quick edits, PDF export, or later reuse.</span>
      </div>
    `;
  }

  return sortProjects(projects).map((project) => {
    const isActive = project.id === activeProjectId ? " active-project" : "";
    const formattedDate = formatDate(project.createdAt);
    const templateName = getTemplateById(project.template || "classic-math").name;

    return `
      <div class="saved-project-card${isActive}">
        <h4>${escapeHtml(buildProjectTitle(project))}</h4>
        <div class="saved-project-meta">
          <div><strong>Saved:</strong> ${escapeHtml(formattedDate.full)}</div>
          <div><strong>Day:</strong> ${escapeHtml(formattedDate.short)}</div>
          <div><strong>Template:</strong> ${escapeHtml(templateName)}</div>
        </div>
        <div class="saved-project-actions">
          <button type="button" data-load-project="${escapeHtml(project.id)}">Load</button>
          <button type="button" class="delete-project" data-delete-project="${escapeHtml(project.id)}">Delete</button>
        </div>
      </div>
    `;
  }).join("");
}
