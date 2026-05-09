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
    return "No worksheet created yet";
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

function getLatestProject(projects, currentProject) {
  if (currentProject) {
    return currentProject;
  }

  return [...projects].sort((left, right) => {
    const leftTime = new Date(left.createdAt).getTime() || 0;
    const rightTime = new Date(right.createdAt).getTime() || 0;
    return rightTime - leftTime;
  })[0] || null;
}

export function renderDashboard({ user, projects, currentProject }) {
  if (!user) {
    return "";
  }

  const latestProject = getLatestProject(projects, currentProject);
  const userLabel = user.displayName || user.email || "Teacher";

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
        <div class="dashboard-stat dashboard-stat-wide">
          <span class="dashboard-stat-label">Last Worksheet</span>
          <strong>${escapeHtml(buildProjectTitle(latestProject))}</strong>
          <span class="dashboard-stat-subtle">${escapeHtml(formatDate(latestProject?.createdAt))}</span>
        </div>
      </div>
    </div>
  `;
}
