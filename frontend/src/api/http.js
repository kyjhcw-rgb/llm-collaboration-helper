const BASE_URL = "/api";

export async function request(endpoint, options = {}) {
    const token = localStorage.getItem("accessToken");

    const response = await fetch(`${BASE_URL}${endpoint}`, {
        headers: {
            "Content-Type": "application/json",
            ...(token && { Authorization: `Bearer ${token}` }),
        },
        ...options,
    });

    if (!response.ok) {
        let errorMessage = `API 오류: ${response.status}`;
        try {
            const errorData = await response.json();
            if (errorData.message) errorMessage = errorData.message;
        } catch (e) {
            // 파싱 실패 시 기본 상태 코드 에러
        }
        throw new Error(errorMessage);
    }

    const text = await response.text();
    return text ? JSON.parse(text) : {};
}