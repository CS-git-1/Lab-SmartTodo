const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api")
    .replace(/\/+$/, "");

async function authRequest(path, body) {
    const response = await fetch(`${API_BASE_URL}/auth/${path}`, {
        method: body ? "POST" : "GET",
        headers: {
            Accept: "application/json",
            ...(body ? { "Content-Type": "application/json" } : {}),

        },
        credentials: "include",
        ...(body ? { body: JSON.stringify(body) } : {}),
    });
    let result;
    try { result = await response.json(); } catch { result = null; }
    if (!response.ok) {
        const error = new Error(result?.error?.message || result?.message || `Authentication failed (${response.status})`);
        error.status = response.status;
        throw error;
    }
    return result?.data;
}

export function login(email, password) {
    return authRequest("login", { email, password });
}

export function register(email, displayName, password) {
    return authRequest("register", { email, displayName, password });
}

export function getCurrentUser() {
    return authRequest("me", null);
}

export function logout() {
    return authRequest("logout", {});
}
