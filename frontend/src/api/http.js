const BASE_URL = "http://localhost:8080/api/v1";

export async function request(url, options = {}) {
  const token = localStorage.getItem("token"); // 나중에 OAuth 연결할 때 쓸 토큰임

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