const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL || "/api";
export const API_BASE_URL = configuredBaseUrl.replace(/\/+$/, "");
export const API_ORIGIN = /^https?:\/\//i.test(API_BASE_URL) ? new URL(API_BASE_URL).origin : "";

export class ApiError extends Error {
    constructor({ status = 0, code = "REQUEST_FAILED", message, details = null } = {}) {
        super(message || "Không thể hoàn tất yêu cầu.");
        this.name = "ApiError";
        this.status = status;
        this.code = code;
        this.details = details;
    }
}

async function parseResponse(response) {
    const text = await response.text();

    if (!text) return null;

    try {
        return JSON.parse(text);
    } catch {
        if (!response.ok) {
            throw new ApiError({
                status: response.status,
                code: "INVALID_ERROR_RESPONSE",
                message: "Máy chủ trả về phản hồi không hợp lệ."
            });
        }

        throw new ApiError({
            status: response.status,
            code: "INVALID_JSON_RESPONSE",
            message: "Không thể đọc dữ liệu phản hồi từ máy chủ."
        });
    }
}

async function request(
    path,
    { method = "GET", headers = {}, body, signal, baseUrl = API_BASE_URL } = {}
) {
    let response;
    const selectedProjectId = window.localStorage.getItem("qa-copilot-project-id") ?? "";

    try {
        response = await fetch(`${baseUrl}${path}`, {
            method,
            headers: {
                Accept: "application/json",
                ...(selectedProjectId && !String(path).startsWith("/projects") ? { "X-Project-Id": selectedProjectId } : {}),
                ...headers
            },
            body,
            signal
        });
    } catch (error) {
        if (error?.name === "AbortError") throw error;

        throw new ApiError({
            code: "NETWORK_ERROR",
            message: "Không thể kết nối đến QA Copilot backend."
        });
    }

    const payload = await parseResponse(response);

    if (!response.ok || payload?.success === false) {
        // P0 — 2 shape error response tồn tại song song:
        //   V3 (automationV3Routes.sendError): { success:false, errorCode, message, details }
        //   cũ (AutomationController/CodeGenController): { success:false, data, error:{ code, message, details } }
        // Trước đây apiClient CHỈ đọc payload.error.* → V3 bị nuốt hết (message fallback
        // "Yêu cầu thất bại (422).", mất errorCode + details.unresolvedFields). Parse cả 2.
        const err = payload?.error && typeof payload.error === "object" ? payload.error : {};
        throw new ApiError({
            status: response.status,
            code: err?.code ?? payload?.errorCode ?? "REQUEST_FAILED",
            message: err?.message ?? payload?.message ?? `Yêu cầu thất bại (${response.status}).`,
            details: err?.details ?? payload?.details ?? null
        });
    }

    return payload;
}

export const apiClient = {
    get(path, options) {
        return request(path, options);
    },
    post(path, options) {
        return request(path, {
            ...options,
            method: "POST"
        });
    },
    patch(path, options) {
        return request(path, {
            ...options,
            method: "PATCH"
        });
    },
    put(path, options) {
        return request(path, {
            ...options,
            method: "PUT"
        });
    },
    delete(path, options) {
        return request(path, {
            ...options,
            method: "DELETE"
        });
    }
};
