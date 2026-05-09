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
    return "No worksheet activity yet";
  }

  return date.toLocaleString();
}

function buildProjectTitle(project) {
  if (!project) {
    return "No worksheet created yet";
  }

  if (project.prompt) {
    return project.prompt;
  }

  const grade = project.settings?.grade || "Worksheet";
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

export function renderDashboard({ user, projects, currentWorksheetSummary }) {
  if (!user) {
    return "";
  }

  const latestSavedProject = getLatestSavedProject(projects);
  const userLabel = user.displayName || user.email || "Teacher";
  const lastGeneratedTitle = currentWorksheetSummary?.title || "No worksheet generated yet";
  const lastGeneratedTime = currentWorksheetSummary?.timestamp
    ? formatDate(currentWorksheetSummary.timestamp)
    : "Generate a worksheet to see it here.";
  const lastSavedTitle = latestSavedProject ? buildProjectTitle(latestSavedProject) : "No saved projects yet";
  const lastSavedTime = latestSavedProject
    ? `${formatDate(latestSavedProject.createdAt)} - ${latestSavedProject.template || "classic-math"}`
    : "Save a worksheet to keep it on this account.";

  return `
    <div class="dashboard-card">
      <div class="dashboard-header">
        <div>
          <div class="dashboard-eyebrow">User Dashboard</div>
          <h3>Welcome, ${escapeHtml(userLabel)}</h3>
          <p>Keep your worksheets organized, revisit the latest work, and jump back into creation quickly.</p>
        </div>
        <button type="button" id="dashboardCreateButton" class="dashboard-create-button">Create New Worksheet</button>
      </div>
      <div class="dashboard-grid">
        <div class="dashboard-stat">
          <span class="dashboard-stat-label">Saved Projects</span>
          <strong>${projects.length}</strong>
        </div>
        ${renderSummaryCard("Last Generated Worksheet", lastGeneratedTitle, lastGeneratedTime, !currentWorksheetSummary)}
        ${renderSummaryCard("Last Saved Project", lastSavedTitle, lastSavedTime, !latestSavedProject)}
      </div>
    </div>
  `;
}
