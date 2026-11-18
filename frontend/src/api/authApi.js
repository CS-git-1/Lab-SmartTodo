const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api")
    .replace(/\/+$/, "");

async function authRequest(path, options = {}) {
    const { method = "GET", body } = options;
    let response;
    try {
        response = await fetch(`${API_BASE_URL}/auth/${path}`, {
            method,
            headers: {
                Accept: "application/json",
                ...(body != null ? { "Content-Type": "application/json" } : {}),
            },
            credentials: "include",
            ...(body != null ? { body: JSON.stringify(body) } : {}),
        });
    } catch (cause) {
        const error = new Error("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง");
        error.cause = cause;
        error.code = "NETWORK_ERROR";
        throw error;
    }
    let result;
    try { result = await response.json(); } catch { result = null; }
    if (!response.ok) {
        const error = new Error(result?.error?.message || result?.message || `Authentication failed (${response.status})`);
        error.status = response.status;
        error.code = result?.error?.code;
        throw error;
    }
    return result?.data;
}

export function login(email, password) {
    return authRequest("login", { method: "POST", body: { email, password } }).catch((error) => {
        if (error.status === 401 && error.code === "INVALID_CREDENTIALS") {
            throw new Error("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
        }
        throw error;
    });
}

export function register(email, displayName, password) {
    return authRequest("register", { method: "POST", body: { email, displayName, password } });
}

export function getCurrentUser() {
    return authRequest("me");
}

export function logout() {
    return authRequest("logout", { method: "POST" });
}

export function requestPasswordReset(email) {
    return authRequest("forgot-password", { method: "POST", body: { email } });
}

export function completePasswordReset(token, password) {
    return authRequest("reset-password", { method: "POST", body: { token, password } });
}
