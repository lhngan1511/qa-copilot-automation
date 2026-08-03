import { apiClient } from "./apiClient.js";

export async function listAutomationModules({ signal } = {}) {
    const response = await apiClient.get("/automation/modules", { signal });
    return response?.data ?? { total: 0, modules: [] };
}

export async function getAutomationMapping(module, { signal } = {}) {
    const params = new URLSearchParams({ module });
    const response = await apiClient.get(`/automation/mapping?${params}`, { signal });
    return response?.data ?? null;
}

export async function runAutomation(module, { signal } = {}) {
    const response = await apiClient.post("/automation/run", {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module }),
        signal
    });
    return response?.data ?? null;
}

export async function analyzeMapping({ testCases, module, testCase, codegenText, codegenFile = null, confirmedFacts = [], signal } = {}) {
    const response = await apiClient.post("/automation/analyze", {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module, testCases, testCase, codegenText, codegenFile, confirmedFacts }),
        signal
    });
    // Trả về toàn bộ data (module mapping hoặc mapping 1 TC) — normalize về dạng module.
    const data = response?.data ?? null;
    if (data && data.testCaseMappings) return data; // module mapping
    if (data && data.mapping) {
        return { module: data.mapping.module ?? module ?? "", testCaseMappings: [data.mapping] };
    }
    return null;
}

export async function generateCode({ testCase, mapping, codegenText, codegenFile = null, confirmedFacts = [], signal } = {}) {
    const response = await apiClient.post("/automation/generate", {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testCase, mapping, codegenText, codegenFile, confirmedFacts }),
        signal
    });
    return response?.data ?? null;
}

export async function runGeneratedFile({ filePath, env = {}, signal } = {}) {
    const response = await apiClient.post("/automation/run", {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filePath, env }),
        signal
    });
    return response?.data ?? null;
}
