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

/* ============================== Recording (Bước 5B) ============================== */

/** POST .../recordings/start */
export function startRecording(workspaceId, { testCaseId, type = "TESTCASE", url = "", browser = "chrome" } = {}) {
    return apiClient.post(
        `${BASE}/workspaces/${encodeURIComponent(workspaceId)}/recordings/start`,
        { headers: jsonHeaders(), body: JSON.stringify({ testCaseId, type, url, browser }) }
    );
}

/** POST .../recordings/stop */
export function stopRecording(workspaceId, { recordingId, source = "" } = {}) {
    return apiClient.post(
        `${BASE}/workspaces/${encodeURIComponent(workspaceId)}/recordings/stop`,
        { headers: jsonHeaders(), body: JSON.stringify({ recordingId, source }) }
    );
}

/** POST .../recordings/:recordingId/approve */
export function approveRecording(workspaceId, recordingId) {
    return apiClient.post(
        `${BASE}/workspaces/${encodeURIComponent(workspaceId)}/recordings/${encodeURIComponent(recordingId)}/approve`,
        { headers: jsonHeaders(), body: JSON.stringify({ approvedBy: "tester" }) }
    );
}

/** POST .../recordings/:recordingId/reject */
export function rejectRecording(workspaceId, recordingId, reason = "") {
    return apiClient.post(
        `${BASE}/workspaces/${encodeURIComponent(workspaceId)}/recordings/${encodeURIComponent(recordingId)}/reject`,
        { headers: jsonHeaders(), body: JSON.stringify({ reason }) }
    );
}

/** GET .../testcases/:testCaseId/recordings — list versions (metadata/summary) */
export function listRecordings(workspaceId, testCaseId) {
    return apiClient.get(
        `${BASE}/workspaces/${encodeURIComponent(workspaceId)}/testcases/${encodeURIComponent(testCaseId)}/recordings`
    );
}

/** GET .../recordings/:recordingId — chi tiết (steps, KHÔNG source) */
export function getRecordingDetail(workspaceId, recordingId) {
    return apiClient.get(
        `${BASE}/workspaces/${encodeURIComponent(workspaceId)}/recordings/${encodeURIComponent(recordingId)}`
    );
}

/** GET .../recordings/:recordingId/source — chỉ khi "Xem mã" */
export function getRecordingSource(workspaceId, recordingId) {
    return apiClient.get(
        `${BASE}/workspaces/${encodeURIComponent(workspaceId)}/recordings/${encodeURIComponent(recordingId)}/source`
    );
}

/** DELETE .../recordings/:recordingId */
export function deleteRecording(workspaceId, recordingId) {
    return apiClient.delete(
        `${BASE}/workspaces/${encodeURIComponent(workspaceId)}/recordings/${encodeURIComponent(recordingId)}`
    );
}

/* ============================== Record Mapping — Segment (5C-0) ============================== */

/** POST .../recordings/:recordingId/segments — tạo đoạn thao tác (DRAFT). */
export function createSegment(workspaceId, recordingId, { startStep, endStep, type = "TESTCASE", testCaseId = null } = {}) {
    return apiClient.post(
        `${BASE}/workspaces/${encodeURIComponent(workspaceId)}/recordings/${encodeURIComponent(recordingId)}/segments`,
        { headers: jsonHeaders(), body: JSON.stringify({ startStep, endStep, type, testCaseId }) }
    );
}

/** PATCH .../recordings/:recordingId/segments/:segmentId — sửa đoạn (tự quay về DRAFT). */
export function updateSegment(workspaceId, recordingId, segmentId, patch = {}) {
    return apiClient.patch(
        `${BASE}/workspaces/${encodeURIComponent(workspaceId)}/recordings/${encodeURIComponent(recordingId)}/segments/${encodeURIComponent(segmentId)}`,
        { headers: jsonHeaders(), body: JSON.stringify(patch) }
    );
}

/** POST .../recordings/:recordingId/segments/:segmentId/confirm — tester xác nhận đoạn. */
export function confirmSegment(workspaceId, recordingId, segmentId) {
    return apiClient.post(
        `${BASE}/workspaces/${encodeURIComponent(workspaceId)}/recordings/${encodeURIComponent(recordingId)}/segments/${encodeURIComponent(segmentId)}/confirm`,
        { headers: jsonHeaders() }
    );
}

/** DELETE .../recordings/:recordingId/segments/:segmentId */
export function deleteSegment(workspaceId, recordingId, segmentId) {
    return apiClient.delete(
        `${BASE}/workspaces/${encodeURIComponent(workspaceId)}/recordings/${encodeURIComponent(recordingId)}/segments/${encodeURIComponent(segmentId)}`
    );
}

/** POST .../testcases/:testCaseId/segments/reorder — sắp xếp thứ tự đoạn (↑/↓). */
export function reorderTestCaseSegments(workspaceId, testCaseId, segmentIds) {
    return apiClient.post(
        `${BASE}/workspaces/${encodeURIComponent(workspaceId)}/testcases/${encodeURIComponent(testCaseId)}/segments/reorder`,
        { headers: jsonHeaders(), body: JSON.stringify({ segmentIds }) }
    );
}

/** POST .../testcases/:testCaseId/automation-decision — tester đặt trạng thái tự động hóa. */
export function setAutomationDecision(workspaceId, testCaseId, decision) {
    return apiClient.post(
        `${BASE}/workspaces/${encodeURIComponent(workspaceId)}/testcases/${encodeURIComponent(testCaseId)}/automation-decision`,
        { headers: jsonHeaders(), body: JSON.stringify({ decision }) }
    );
}

/* ============================== 5C — Expected Result + Assertion confirmation ============================== */

/** PATCH .../testcases/:testCaseId/expected-result — tester sửa Expected Result (working copy). */
export function updateExpectedResult(workspaceId, testCaseId, expectedResult) {
    return apiClient.patch(
        `${BASE}/workspaces/${encodeURIComponent(workspaceId)}/testcases/${encodeURIComponent(testCaseId)}/expected-result`,
        { headers: jsonHeaders(), body: JSON.stringify({ expectedResult }) }
    );
}

/** GET .../testcases/:testCaseId/assertions — danh sách điều kiện xác nhận. */
export function listAssertions(workspaceId, testCaseId) {
    return apiClient.get(
        `${BASE}/workspaces/${encodeURIComponent(workspaceId)}/testcases/${encodeURIComponent(testCaseId)}/assertions`
    );
}

/** POST .../testcases/:testCaseId/assertions — tạo điều kiện (DRAFT). Dùng cho "Áp dụng" / "Bổ sung tay". */
export function createAssertion(workspaceId, testCaseId, assertion = {}) {
    return apiClient.post(
        `${BASE}/workspaces/${encodeURIComponent(workspaceId)}/testcases/${encodeURIComponent(testCaseId)}/assertions`,
        { headers: jsonHeaders(), body: JSON.stringify(assertion) }
    );
}

/** POST .../assertions/:assertionId/confirm — tester xác nhận điều kiện. */
export function confirmAssertion(workspaceId, testCaseId, assertionId) {
    return apiClient.post(
        `${BASE}/workspaces/${encodeURIComponent(workspaceId)}/testcases/${encodeURIComponent(testCaseId)}/assertions/${encodeURIComponent(assertionId)}/confirm`,
        { headers: jsonHeaders() }
    );
}

/** DELETE .../assertions/:assertionId — xóa điều kiện. */
export function removeAssertion(workspaceId, testCaseId, assertionId) {
    return apiClient.delete(
        `${BASE}/workspaces/${encodeURIComponent(workspaceId)}/testcases/${encodeURIComponent(testCaseId)}/assertions/${encodeURIComponent(assertionId)}`
    );
}

/** POST .../testcases/:testCaseId/assertions/suggest — đề xuất điều kiện (deterministic, KHÔNG AI). */
export function suggestAssertions(workspaceId, testCaseId) {
    return apiClient.post(
        `${BASE}/workspaces/${encodeURIComponent(workspaceId)}/testcases/${encodeURIComponent(testCaseId)}/assertions/suggest`,
        { headers: jsonHeaders() }
    );
}

/** PATCH .../assertions/:assertionId — sửa điều kiện (tự quay về Nháp). */
export function updateAssertion(workspaceId, testCaseId, assertionId, patch = {}) {
    return apiClient.patch(
        `${BASE}/workspaces/${encodeURIComponent(workspaceId)}/testcases/${encodeURIComponent(testCaseId)}/assertions/${encodeURIComponent(assertionId)}`,
        { headers: jsonHeaders(), body: JSON.stringify(patch) }
    );
}

/** POST .../testcases/:testCaseId/generate — Sinh automation (chỉ khi đủ gate). */
export function generateTestcase(workspaceId, testCaseId, confirmedTestData = {}) {
    return apiClient.post(
        `${BASE}/workspaces/${encodeURIComponent(workspaceId)}/testcases/${encodeURIComponent(testCaseId)}/generate`,
        { headers: jsonHeaders(), body: JSON.stringify({ confirmedTestData }) }
    );
}
