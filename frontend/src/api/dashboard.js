import {
  qualityDashboardMock,
  teamDashboardMock,
  trendDashboardMock,
} from "./mock/dashboard.mock";

export async function fetchQualityDashboard(projectId) {
  console.log("fetch quality dashboard:", projectId);
  return new Promise((resolve) =>
    setTimeout(() => resolve(qualityDashboardMock), 300)
  );
}

export async function fetchTeamDashboard(projectId) {
  console.log("fetch team dashboard:", projectId);
  return new Promise((resolve) =>
    setTimeout(() => resolve(teamDashboardMock), 300)
  );
}

export async function fetchTrendDashboard(projectId) {
  console.log("fetch trend dashboard:", projectId);
  return new Promise((resolve) =>
    setTimeout(() => resolve(trendDashboardMock), 300)
  );
}
