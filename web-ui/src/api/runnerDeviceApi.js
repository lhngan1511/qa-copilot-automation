import { apiClient, API_BASE_URL, ApiError } from "./apiClient.js";
const json = body => ({ headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
export async function listRunnerDevices() { return (await apiClient.get("/runner-devices"))?.data ?? []; }
export async function createRunnerDevice(machineName) { return (await apiClient.post("/runner-devices", json({ machineName })))?.data ?? null; }
export async function revokeRunnerDevice(runnerId) { return (await apiClient.post(`/runner-devices/${encodeURIComponent(runnerId)}/revoke`, json({})))?.data ?? null; }

/** Tải gói cài đặt Runner Agent 1-click (Ngân yêu cầu 2026-09-07) — response là file .zip nhị
 *  phân, KHÔNG qua apiClient (apiClient chỉ parse JSON) — dùng fetch thô, nhận blob rồi cho trình
 *  duyệt lưu file qua 1 thẻ <a download> tạm. Token chỉ hiện đúng 1 lần lúc tạo Runner Device nên
 *  phải gọi ngay lúc còn trong tay, không lưu lại. */
export async function downloadRunnerPackage(runnerId, token) {
    const response = await fetch(`${API_BASE_URL}/runner-devices/${encodeURIComponent(runnerId)}/package`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token })
    });
    if (!response.ok) {
        let message = `Không tải được gói cài đặt (${response.status}).`;
        try {
            const payload = await response.json();
            message = payload?.error?.message ?? message;
        } catch {
            /* response không phải JSON — giữ message mặc định */
        }
        throw new ApiError({ status: response.status, message });
    }
    const disposition = response.headers.get("content-disposition") ?? "";
    const match = disposition.match(/filename="([^"]+)"/);
    const fileName = match?.[1] ?? "qa-copilot-runner.zip";
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}
