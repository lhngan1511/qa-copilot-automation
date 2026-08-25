import { apiClient } from "./apiClient.js";
const json = body => ({ headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
export async function currentUser() { return (await apiClient.get("/auth/me"))?.data ?? null; }
export async function login(username, password) { return (await apiClient.post("/auth/login", json({ username, password })))?.data ?? null; }
export async function logout() { await apiClient.post("/auth/logout", json({})); }
