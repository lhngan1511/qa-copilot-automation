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
    signal
} = {}) {
    return post(
        "/automation-workspace/generate",
        {
            testCase,
            mapping,
            codegenText,
            confirmedFacts
        },
        signal
    );
}

export function runAutomation({ filePath, env = {}, signal } = {}) {
    return post(
        "/automation-workspace/run",
        {
            filePath,
            env
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
