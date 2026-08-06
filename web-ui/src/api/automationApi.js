import { apiClient } from "./apiClient.js";

async function post(path, body, signal) {
    const response = await apiClient.post(path, {
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body),
        signal
    });

    return response?.data ?? null;
}

export function analyzeAutomation({
    module = "",
    testCases,
    codegenText,
    confirmedFacts = [],
    signal
} = {}) {
    return post(
        "/automation-workspace/analyze",
        {
            module,
            testCases,
            codegenText,
            confirmedFacts
        },
        signal
    );
}

export function generateAutomation({
    testCase,
    mapping,
    codegenText,
    confirmedFacts = [],
    baseUrl = "",
    signal
} = {}) {
    return post(
        "/automation-workspace/generate",
        {
            testCase,
            mapping,
            codegenText,
            confirmedFacts,
            baseUrl
        },
        signal
    );
}

export function runAutomation({ filePath, env = {}, testCaseId = "", signal } = {}) {
    return post(
        "/automation-workspace/run",
        {
            filePath,
            env,
            testCaseId
        },
        signal
    );
}

export function exportAutomation({ module = "", testCases, filePath, signal } = {}) {
    return post(
        "/automation-workspace/export",
        {
            module,
            testCases,
            filePath
        },
        signal
    );
}

/** Đọc cấu hình server (BASE_URL fallback từ .env) qua /health. */
export async function fetchServerConfig(signal) {
    try {
        const response = await fetch("/health", { signal });
        if (!response.ok) return { baseUrl: "" };
        const json = await response.json();
        return { baseUrl: String(json?.data?.baseUrl ?? "") || "" };
    } catch {
        return { baseUrl: "" };
    }
}
