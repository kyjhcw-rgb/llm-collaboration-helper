import { request } from "./http";

/**
 * 수동 분석 요청
 */
export function requestAnalysis(projectId) {
  return request(`/projects/${projectId}/analyze`, {
    method: "POST",
  });
}

/**
 * 분석 상태 조회 (폴링용)
 */
export function fetchAnalysisStatus(projectId) {
  return request(`/projects/${projectId}/analyze/status`);
}
