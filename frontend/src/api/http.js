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
        // 토큰이 만료되었거나 다중 탭 테스트로 토큰이 날아간 경우 깔끔하게 로그아웃 처리
        if (response.status === 401 || response.status === 403) {
            localStorage.removeItem("accessToken");
            window.location.href = "/login";
            throw new Error(`Auth Error: ${response.status}`);
        }
        throw new Error(`API Error: ${response.status}`);
    }

    const text = await response.text();
    return text ? JSON.parse(text) : {};
}

// FormData(파일 업로드) 전용 — Content-Type을 직접 지정하지 않아야 브라우저가
// multipart 경계(boundary)를 알아서 채워줌. request()와 달리 JSON 헤더를 강제하지 않는다.
export async function requestUpload(url, formData) {
    const token = localStorage.getItem("accessToken");
    const headers = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const response = await fetch(`${BASE_URL}${url}`, {
        method: "POST",
        headers,
        body: formData,
    });

    if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
            localStorage.removeItem("accessToken");
            window.location.href = "/login";
            throw new Error(`Auth Error: ${response.status}`);
        }
        throw new Error(`API Error: ${response.status}`);
    }

    const text = await response.text();
    return text ? JSON.parse(text) : {};
}