import { apiClient } from "./apiClient.js";

export async function startCodeGen({ url, signal }) {
    const response = await apiClient.post("/codegen/start", {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
        signal
    });
    return response.data;
}

export async function stopCodeGen({ signal }) {
    const response = await apiClient.post("/codegen/stop", {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
        signal
    });
    return response.data;
}

export async function getCodeGenStatus({ signal } = {}) {
    const response = await apiClient.get("/codegen/status", { signal });
    return response.data;
}

export async function runCodeGen({ script, filePath, env = {}, signal }) {
    const response = await apiClient.post("/codegen/run", {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script, filePath, env }),
        signal
    });
    return response.data;
}

export async function cleanupCodeGen({ signal }) {
    const response = await apiClient.post("/codegen/cleanup", {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
        signal
    });
    return response.data;
}
