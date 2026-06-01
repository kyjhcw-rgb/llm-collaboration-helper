const BASE_URL = "/api";

export async function request(url, options = {}) {
    const token = localStorage.getItem("accessToken");

    // URL이 /auth로 시작하는 요청(로그인, 회원가입, 이메일 인증)은 토큰을 보내지 않음
    const isAuthApi = url.startsWith("/auth");

    const headers = {
        "Content-Type": "application/json",
    };

    // 인증 API가 아니고, 토큰이 존재할 때만 헤더에 추가
    if (!isAuthApi && token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${BASE_URL}${url}`, {
        headers,
        ...options,
    });

    if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
    }

    const text = await response.text();
    return text ? JSON.parse(text) : {};
}