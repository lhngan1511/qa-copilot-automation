import { apiClient } from "./apiClient.js";

/*
 boundaryTestingApi — Kiểm thử biên (Boundary Testing), HOÀN TOÀN độc lập với Automation
 Workspace/Action Library. Chỉ gọi /api/boundary-testing. `X-Project-Id` được apiClient tự thêm
 (đã đọc localStorage "qa-copilot-project-id") — không cần truyền projectId thủ công.
*/

const BASE = "/boundary-testing";

function jsonHeaders() {
    return { "Content-Type": "application/json" };
}

/** Dán 1 script Playwright đã ghi -> parse thành các bước. Không cần workspace/testcase/Thư viện
 *  thao tác nào. */
export function createEntry(label, scriptSource) {
    return apiClient.post(`${BASE}/entries`, { headers: jsonHeaders(), body: JSON.stringify({ label, scriptSource }) });
}

/** Danh sách kiểm thử biên đã tạo (lọc theo project hiện tại). */
export function listEntries() {
    return apiClient.get(`${BASE}/entries`);
}

export function getEntry(entryId) {
    return apiClient.get(`${BASE}/entries/${encodeURIComponent(entryId)}`);
}

export function deleteEntry(entryId) {
    return apiClient.delete(`${BASE}/entries/${encodeURIComponent(entryId)}`);
}

/** Đánh dấu 1 bước FILL trong script làm mục tiêu kiểm thử biên. */
export function setTarget(entryId, stepOrder) {
    return apiClient.patch(`${BASE}/entries/${encodeURIComponent(entryId)}/target`, { headers: jsonHeaders(), body: JSON.stringify({ stepOrder }) });
}

/** Giá trị thật cho các bước FILL nhạy cảm KHÁC mục tiêu (Mật khẩu/Mã xác nhận... bị ẩn lúc dán). */
export function setSensitiveOverrides(entryId, overrides) {
    return apiClient.patch(`${BASE}/entries/${encodeURIComponent(entryId)}/sensitive-overrides`, { headers: jsonHeaders(), body: JSON.stringify({ overrides }) });
}

/** Đề xuất giá trị biên: rule-based (luôn có) + AI (bổ sung, best-effort). Không persist. */
export function suggestValues(entryId) {
    return apiClient.post(`${BASE}/entries/${encodeURIComponent(entryId)}/suggest`, { headers: jsonHeaders(), body: JSON.stringify({}) });
}

/** Lưu danh sách candidate tester đã duyệt/sửa. */
export function saveCandidates(entryId, candidates) {
    return apiClient.post(`${BASE}/entries/${encodeURIComponent(entryId)}/candidates`, { headers: jsonHeaders(), body: JSON.stringify({ candidates }) });
}

/** Xem trước mã Playwright sẽ chạy — KHÔNG lưu, KHÔNG chạy, KHÔNG cần BASE_URL. */
export function previewSpec(entryId, candidates) {
    return apiClient.post(`${BASE}/entries/${encodeURIComponent(entryId)}/preview`, { headers: jsonHeaders(), body: JSON.stringify({ candidates }) });
}

/** Chạy (candidateIds=null → tất cả) hoặc chạy lại 1 phần (candidateIds = tập con đã đánh dấu lỗi).
 *  Có agentId -> chạy TỪ XA qua Runner Agent đã chọn (Ngân yêu cầu 2026-09-07), trả về QUEUED ngay
 *  thay vì kết quả cuối — xem BoundaryEntryPanel.jsx#persistAndRun (poll getEntry tới khi có run mới). */
export function runEntry(entryId, candidateIds = null, env = {}, agentId = null) {
    return apiClient.post(`${BASE}/entries/${encodeURIComponent(entryId)}/run`, { headers: jsonHeaders(), body: JSON.stringify({ candidateIds, env, agentId }) });
}

/** Đánh dấu 1 candidate là lỗi thật/không phải lỗi (đánh giá thủ công, độc lập pass/fail Playwright). */
export function markDefect(entryId, candidateId, { defectFlag, note } = {}) {
    return apiClient.patch(`${BASE}/entries/${encodeURIComponent(entryId)}/candidates/${encodeURIComponent(candidateId)}`, { headers: jsonHeaders(), body: JSON.stringify({ defectFlag, note }) });
}
