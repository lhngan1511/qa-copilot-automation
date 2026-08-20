import { apiClient } from "./apiClient.js";

export async function listProjects() { return (await apiClient.get("/projects"))?.data ?? []; }
export async function createProject(input) {
    return (await apiClient.post("/projects", { headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }))?.data;
}
export async function deleteProject(projectId) {
    return (await apiClient.delete(`/projects/${encodeURIComponent(projectId)}`))?.data;
}
