import { apiClient } from "./apiClient.js";
const json = body => ({ headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
export async function currentUser() { return (await apiClient.get("/auth/me"))?.data ?? null; }
export async function login(username, password, rememberMe = false) { return (await apiClient.post("/auth/login", json({ username, password, rememberMe })))?.data ?? null; }
export async function logout() { await apiClient.post("/auth/logout", json({})); }
export async function listUsers() { return (await apiClient.get("/auth/users"))?.data ?? []; }
export async function resetUserPassword(username, newPassword) { return (await apiClient.post(`/auth/users/${encodeURIComponent(username)}/reset-password`, json({ newPassword })))?.data ?? null; }
