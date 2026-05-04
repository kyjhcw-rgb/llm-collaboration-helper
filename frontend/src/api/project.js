// 프로젝트 생성 (더미)
export function createProject(formData) {
  console.log("📦 더미 프로젝트 생성", [...formData.entries()]);

  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ projectId: 1 });
    }, 500);
  });
}

// 프로젝트 헤더 조회 (더미)
export function fetchProjectHeader(projectId) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        id: projectId,
        name: "LLM 프로젝트",
        dDay: "D-42",
        status: "진행 중",
        analysisPhase: "요구사항 분석",
      });
    }, 300);
  });
}