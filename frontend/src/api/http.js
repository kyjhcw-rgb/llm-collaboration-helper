<<<<<<< HEAD
const BASE_URL = "http://localhost:8080/api/v1";

/**
 * 공통 fetch 래퍼 함수
 * @param {string} url - API 엔드포인트
 * @param {object} options - fetch 옵션
 */
export async function request(url, options = {}) {
  const token = localStorage.getItem("token"); // 나중에 OAuth 연결

  const response = await fetch(`${BASE_URL}${url}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }

  return response.json();
}
=======
const BASE_URL = "http://localhost:8080/api/v1";

/**
 * 공통 fetch 래퍼 함수
 * @param {string} url - API 엔드포인트
 * @param {object} options - fetch 옵션
 */
export async function request(url, options = {}) {
  const token = localStorage.getItem("token"); // 나중에 OAuth 연결

  const response = await fetch(`${BASE_URL}${url}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }

  return response.json();
}
>>>>>>> origin/develop
