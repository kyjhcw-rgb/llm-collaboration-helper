export const qualityDashboardMock = {
  summary: {
    buildStatus: "PASS",
    testCoverage: 82,
    lintErrors: 3,
  },
};

export const teamDashboardMock = {
  aiAdvice: {
    summary: "팀 커뮤니케이션이 안정적입니다.",
    detail: "리뷰 주기가 일정하고 특정 인원 쏠림이 없습니다.",
  },
  members: [
    { name: "Alice", role: "Frontend", activeScore: 87 },
    { name: "Bob", role: "Backend", activeScore: 78 },
    { name: "Charlie", role: "AI", activeScore: 92 },
  ],
};

export const trendDashboardMock = {
  weeklyTrend: [
    { week: "1주차", commits: 24 },
    { week: "2주차", commits: 31 },
  ],
  scoreTrend: [70, 75, 80, 85],
};
