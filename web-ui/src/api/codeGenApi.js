import { apiClient } from "./apiClient.js";

export async function startCodeGen({ url, browser, mode, context, signal }) {
    const response = await apiClient.post("/codegen/start", {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, browser, mode, context }),
        signal
    });
    return response.data;
}

export async function setRecordingContext(recordingId, { context, signal }) {
    const response = await apiClient.post(`/codegen/recordings/${encodeURIComponent(recordingId)}/context`, {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context }),
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

export async function listRecordings({ signal } = {}) {
    const response = await apiClient.get("/codegen/recordings", { signal });
    return response.data;
}

export async function getRecording(recordingId, { signal } = {}) {
    const response = await apiClient.get(`/codegen/recordings/${encodeURIComponent(recordingId)}`, { signal });
    return response.data;
}

export async function setRecordingScript(recordingId, { script, signal }) {
    const response = await apiClient.post(`/codegen/recordings/${encodeURIComponent(recordingId)}/script`, {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script }),
        signal
    });
    return response.data;
}

export async function renameRecording(recordingId, { fileName, signal }) {
    const response = await apiClient.post(`/codegen/recordings/${encodeURIComponent(recordingId)}/rename`, {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName }),
        signal
    });
    return response.data;
}

export async function linkTestcases(recordingId, { testcaseIds, signal }) {
    const response = await apiClient.post(`/codegen/recordings/${encodeURIComponent(recordingId)}/link`, {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testcaseIds }),
        signal
    });
    return response.data;
}

export async function saveRecording(recordingId, { fileName, signal }) {
    const response = await apiClient.post(`/codegen/recordings/${encodeURIComponent(recordingId)}/save`, {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName }),
        signal
    });
    return response.data;
}

export async function runRecording(recordingId, { script, env = {}, signal }) {
    const response = await apiClient.post(`/codegen/recordings/${encodeURIComponent(recordingId)}/run`, {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script, env }),
        signal
    });
    return response.data;
}

export async function openFolder(recordingId, { signal }) {
    const response = await apiClient.post(`/codegen/recordings/${encodeURIComponent(recordingId)}/open-folder`, {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
        signal
    });
    return response.data;
}

export async function openReport(recordingId, { signal }) {
    const response = await apiClient.post(`/codegen/recordings/${encodeURIComponent(recordingId)}/open-report`, {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
        signal
    });
    return response.data;
}

export async function deleteRecording(recordingId, { signal }) {
    const response = await apiClient.delete(`/codegen/recordings/${encodeURIComponent(recordingId)}`, { signal });
    return response.data;
}

export async function getApprovedTestcases({ recordingId, signal } = {}) {
    const response = await apiClient.get(
        `/codegen/testcases${recordingId ? `?recordingId=${encodeURIComponent(recordingId)}` : ""}`,
        { signal }
    );
    return response.data;
}

export async function getCodeGenStatus({ signal } = {}) {
    const response = await apiClient.get("/codegen/status", { signal });
    return response.data;
}

export async function focusCodeGenBrowser({ signal } = {}) {
    const response = await apiClient.post("/codegen/focus", {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
        signal
    });
    return response.data;
}
