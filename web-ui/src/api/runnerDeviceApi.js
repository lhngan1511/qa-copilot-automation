import { apiClient } from "./apiClient.js";
const json = body => ({ headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
export async function listRunnerDevices() { return (await apiClient.get("/runner-devices"))?.data ?? []; }
export async function createRunnerDevice(machineName) { return (await apiClient.post("/runner-devices", json({ machineName })))?.data ?? null; }
export async function revokeRunnerDevice(runnerId) { return (await apiClient.post(`/runner-devices/${encodeURIComponent(runnerId)}/revoke`, json({})))?.data ?? null; }
