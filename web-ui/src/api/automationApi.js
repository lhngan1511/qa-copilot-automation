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
