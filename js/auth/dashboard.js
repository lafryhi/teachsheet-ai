import { normalizeLanguage, t } from "../ui/language.js";

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
    return normalizeLanguage(language) === "fr" ? "Aucune activité de fiche pour le moment" : "No worksheet activity yet";
  }

  return date.toLocaleString(locale);
}

function buildProjectTitle(project, language = "en") {
  if (!project) {
    return normalizeLanguage(language) === "fr" ? "Aucune fiche créée pour le moment" : "No worksheet created yet";
  }

  if (project.prompt) {
    return project.prompt;
  }

  const grade = project.settings?.grade || t(language, "worksheet");
  const operation = project.settings?.operation || "practice";
  return `${grade} - ${operation}`;
}

function getLatestSavedProject(projects) {
  return [...projects].sort((left, right) => {
    const leftTime = new Date(left.createdAt).getTime() || 0;
    const rightTime = new Date(right.createdAt).getTime() || 0;
    return rightTime - leftTime;
  })[0] || null;
}

function renderSummaryCard(label, title, subtitle = "", empty = false) {
  const emptyClassName = empty ? " dashboard-stat-empty" : "";

  return `
    <div class="dashboard-stat dashboard-stat-wide${emptyClassName}">
      <span class="dashboard-stat-label">${escapeHtml(label)}</span>
      <strong>${escapeHtml(title)}</strong>
      <span class="dashboard-stat-subtle">${escapeHtml(subtitle)}</span>
    </div>
  `;
}

export function renderDashboard({ user, projects, currentWorksheetSummary, language = "en" }) {
  if (!user) {
    return "";
  }

  const resolvedLanguage = normalizeLanguage(language);
  const latestSavedProject = getLatestSavedProject(projects);
  const userLabel = user.displayName || user.email || (resolvedLanguage === "fr" ? "Enseignant" : "Teacher");
  const lastGeneratedTitle = currentWorksheetSummary?.title || (resolvedLanguage === "fr" ? "Aucune fiche générée pour le moment" : "No worksheet generated yet");
  const lastGeneratedTime = currentWorksheetSummary?.timestamp
    ? formatDate(currentWorksheetSummary.timestamp, resolvedLanguage)
    : (resolvedLanguage === "fr" ? "Générez une fiche pour la voir ici." : "Generate a worksheet to see it here.");
  const lastSavedTitle = latestSavedProject ? buildProjectTitle(latestSavedProject, resolvedLanguage) : t(resolvedLanguage, "noSavedProjects");
  const lastSavedTime = latestSavedProject
    ? `${formatDate(latestSavedProject.createdAt, resolvedLanguage)} - ${latestSavedProject.template || "classic-math"}`
    : (resolvedLanguage === "fr" ? "Enregistrez une fiche pour la conserver sur ce compte." : "Save a worksheet to keep it on this account.");

  return `
    <div class="dashboard-card">
      <div class="dashboard-header">
        <div>
          <div class="dashboard-eyebrow">${escapeHtml(resolvedLanguage === "fr" ? "Tableau enseignant" : "User Dashboard")}</div>
          <h3>${escapeHtml(resolvedLanguage === "fr" ? `Bienvenue, ${userLabel}` : `Welcome, ${userLabel}`)}</h3>
          <p>${escapeHtml(resolvedLanguage === "fr" ? "Gardez vos fiches organisées, retrouvez les plus récentes et revenez vite à la création." : "Keep your worksheets organized, revisit the latest work, and jump back into creation quickly.")}</p>
        </div>
        <button type="button" id="dashboardCreateButton" class="dashboard-create-button">${escapeHtml(resolvedLanguage === "fr" ? "Créer une nouvelle fiche" : "Create New Worksheet")}</button>
      </div>
      <div class="dashboard-grid">
        <div class="dashboard-stat">
          <span class="dashboard-stat-label">${escapeHtml(t(resolvedLanguage, "savedProjects"))}</span>
          <strong>${projects.length}</strong>
        </div>
        ${renderSummaryCard(resolvedLanguage === "fr" ? "Dernière fiche générée" : "Last Generated Worksheet", lastGeneratedTitle, lastGeneratedTime, !currentWorksheetSummary)}
        ${renderSummaryCard(resolvedLanguage === "fr" ? "Dernier projet enregistré" : "Last Saved Project", lastSavedTitle, lastSavedTime, !latestSavedProject)}
      </div>
    </div>
  `;
}
