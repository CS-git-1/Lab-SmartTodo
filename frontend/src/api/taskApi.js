const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api")
    .replace(/\/+$/, "");
const TASKS_URL = `${API_BASE_URL}/tasks`;

export class ApiError extends Error {
    constructor(message, status, details) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        this.details = details;
    }
}

async function request(url, options = {}) {
    let response;
    try {
        response = await fetch(url, {
            credentials: "include",
            ...options,
            headers: {
                Accept: "application/json",
                ...(options.body ? { "Content-Type": "application/json" } : {}),
                ...options.headers,
            },
        });
    } catch (error) {
        if (error.name === "AbortError") throw error;
        throw new ApiError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบเครือข่ายแล้วลองอีกครั้ง", 0);
    }

    if (!response.ok) {
        let message = `API request failed (${response.status})`;
        let details;
        try {
            details = await response.json();
            if (typeof details?.error?.message === "string") message = details.error.message;
            else if (typeof details?.message === "string") message = details.message;
        } catch {
            // Keep the status-based message when the error response has no JSON body.
        }
        throw new ApiError(message, response.status, details);
    }

    if (response.status === 204) return null;
    if (response.status === 205 || response.headers.get("content-length") === "0") return null;
    return response.json();
}

function taskFromResponse(result) {
    if (!result?.data || typeof result.data !== "object" || !result.data.id || !result.data.title) {
        throw new ApiError("เซิร์ฟเวอร์ตอบกลับข้อมูลไม่ครบ กรุณาโหลดรายการใหม่แล้วลองอีกครั้ง", 502, result);
    }
    return toTodo(result.data);
}

function toTodo(task) {
    const timestamp = (value) => value == null ? Date.now() : new Date(value).getTime();
    const dueDate = task.dueAt ? new Date(task.dueAt).toISOString().slice(0, 10) : null;
    return {
        id: task.id,
        title: task.title,
        description: task.description ?? "",
        priority: task.priority <= 1 ? "low" : task.priority === 2 ? "medium" : task.priority === 3 ? "high" : "urgent",
        dueDate,
        completed: task.isCompleted ?? task.status === "done",
        createdAt: timestamp(task.createdAt),
        updatedAt: timestamp(task.updatedAt),
    };
}

function toTaskChanges(changes) {
    const payload = {};
    if (Object.hasOwn(changes, "title")) payload.title = changes.title;
    if (Object.hasOwn(changes, "description")) payload.description = changes.description;
    if (Object.hasOwn(changes, "priority")) {
        payload.priority = { low: 1, medium: 2, high: 3, urgent: 4 }[changes.priority];
    }
    if (Object.hasOwn(changes, "dueDate")) {
        payload.dueAt = changes.dueDate ? `${changes.dueDate}T00:00:00.000Z` : null;
    }
    if (Object.hasOwn(changes, "completed")) payload.status = changes.completed ? "done" : "todo";
    return payload;
}

export async function listTasks(filters = {}, { signal } = {}) {
    const limit = Math.min(Number(filters.limit) || 100, 100);
    const tasks = [];
    let page = Number(filters.page) || 1;
    let pages = page;
    do {
        const url = new URL(TASKS_URL, window.location.origin);
        url.searchParams.set("page", String(page));
        url.searchParams.set("limit", String(limit));
        for (const key of ["status", "priority", "projectId", "q"]) {
            if (filters[key] !== undefined && filters[key] !== "") {
                url.searchParams.set(key, String(key === "priority" && typeof filters[key] === "string"
                    ? { low: 1, medium: 2, high: 3 }[filters[key]] ?? filters[key]
                    : filters[key]));
            }
        }
        const result = await request(url, {  signal });
        if (!Array.isArray(result?.data)) {
            throw new ApiError("รูปแบบรายการจากเซิร์ฟเวอร์ไม่ถูกต้อง กรุณาลองโหลดอีกครั้ง", 502, result);
        }
        tasks.push(...result.data.map(toTodo));
        pages = result?.pagination?.pages ?? page;
        page += 1;
    } while (page <= pages);
    return tasks;
}

export async function createTask(task, { signal } = {}) {
    const result = await request(TASKS_URL, {
        method: "POST",
        signal,
        body: JSON.stringify(toTaskChanges({ ...task, completed: false })),
    });
    return taskFromResponse(result);
}

export async function updateTask(taskId, changes, { signal } = {}) {
    const result = await request(`${TASKS_URL}/${encodeURIComponent(taskId)}`, {
        method: "PATCH",
        signal,
        body: JSON.stringify(toTaskChanges(changes)),
    });
    return taskFromResponse(result);
}

export async function replaceTask(taskId, task, { signal } = {}) {
    const { status: _status, ...optionalFields } = toTaskChanges(task);
    const result = await request(`${TASKS_URL}/${encodeURIComponent(taskId)}`, {
        method: "PUT",
        signal,
        body: JSON.stringify({
            title: task.title,
            isCompleted: Boolean(task.completed),
            ...optionalFields,
        }),
    });
    return taskFromResponse(result);
}

export async function deleteTask(taskId, { signal } = {}) {
    return request(`${TASKS_URL}/${encodeURIComponent(taskId)}`, {
        method: "DELETE",
        signal,
    });
}
