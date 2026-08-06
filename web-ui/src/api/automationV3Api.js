import { apiClient } from "./apiClient.js";

/*
 automationV3Api — Client cho Architecture V3 (Record by Testcase).

 Chỉ gọi các endpoint /api/automation-v3.
 UI KHÔNG gọi Store/Renderer trực tiếp.
*/

const BASE = "/automation-v3";

function jsonHeaders() {
    return { "Content-Type": "application/json" };
}

/** POST /workspaces — tạo/mở workspace từ approved testcase. */
export function createWorkspace({ approvedTestCases = [], module = "", source = "NEW" } = {}) {
    return apiClient.post(`${BASE}/workspaces`, {
        headers: jsonHeaders(),
        body: JSON.stringify({ source, module, approvedTestCases })
    });
}

/** GET /workspaces/:workspaceId — lấy trạng thái workspace. */
export function getWorkspace(workspaceId) {
    return apiClient.get(`${BASE}/workspaces/${encodeURIComponent(workspaceId)}`);
}

/** POST .../testcases/:testCaseId/select */
export function selectTestCase(workspaceId, testCaseId) {
    return apiClient.post(
        `${BASE}/workspaces/${encodeURIComponent(workspaceId)}/testcases/${encodeURIComponent(testCaseId)}/select`
    );
}

/** POST .../testcases/:testCaseId/unselect */
export function unselectTestCase(workspaceId, testCaseId) {
    return apiClient.post(
        `${BASE}/workspaces/${encodeURIComponent(workspaceId)}/testcases/${encodeURIComponent(testCaseId)}/unselect`
    );
}
