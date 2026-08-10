import fs from "node:fs";
import path from "node:path";
import { WORKSPACE_MODES } from "../codegen/AutomationWorkspace.js";
import { suggestAssertions } from "../codegen/assertionSuggester.js";

/*
 AutomationWorkspaceApplicationService — Application Service (Architecture V3, Bước 4).

 Trách nhiệm (điểm 7 — Route không chứa business logic):
   - validate input;
   - load workspace / approved testcase snapshot;
   - gọi CurrentRecordingSession (start/stop);
   - gọi CodeGenRecordingStore (approve/reject, list versions);
   - gọi GenerateService (generate);
   - transition workspace state;
   - trả DTO gọn cho API.

 Route KHÔNG gọi Renderer trực tiếp, KHÔNG gọi Store để tự xử lý nghiệp vụ,
 KHÔNG tự gán trạng thái, KHÔNG tự ghi file.

 Security: KHÔNG log password/captcha/secret/runtimeEnv value/code đầy đủ.
 Không cài logger dữ liệu nhạy cảm — service không log giá trị.
*/

export const V3_ERRORS = {
    WORKSPACE_NOT_FOUND: "WORKSPACE_NOT_FOUND",
    TESTCASE_NOT_FOUND: "TESTCASE_NOT_FOUND",
    TESTCASE_NOT_SELECTED: "TESTCASE_NOT_SELECTED",
    RECORDING_ALREADY_ACTIVE: "RECORDING_ALREADY_ACTIVE",
    RECORDING_NOT_FOUND: "RECORDING_NOT_FOUND",
    RECORDING_APPROVAL_REQUIRED: "RECORDING_APPROVAL_REQUIRED",
    RECORDING_DELETE_FORBIDDEN: "RECORDING_DELETE_FORBIDDEN",
    RECORDING_CHANGED_AFTER_APPROVAL: "RECORDING_CHANGED_AFTER_APPROVAL",
    ASSERTION_CONFIRMATION_REQUIRED: "ASSERTION_CONFIRMATION_REQUIRED",
    TESTDATA_BINDING_REQUIRED: "TESTDATA_BINDING_REQUIRED",
    GENERATE_FAILED: "GENERATE_FAILED",
    INVALID_STATE_TRANSITION: "INVALID_STATE_TRANSITION",
    INVALID_REQUEST: "INVALID_REQUEST",
    // 5C-0 — Record Mapping (tester-owned, không AI, không theo thứ tự).
    RECORDING_MAPPING_REQUIRED: "RECORDING_MAPPING_REQUIRED",
    SEGMENT_NOT_CONFIRMED: "SEGMENT_NOT_CONFIRMED",
    SEGMENT_MAPPING_INVALID: "SEGMENT_MAPPING_INVALID",
    SEGMENT_INVALID: "SEGMENT_INVALID",
    SEGMENT_OVERLAP: "SEGMENT_OVERLAP",
    SEGMENT_TYPE_REQUIRES_TESTCASE: "SEGMENT_TYPE_REQUIRES_TESTCASE",
    SEGMENT_NOT_FOUND: "SEGMENT_NOT_FOUND"
};

const STATUS_BY_CODE = {
    WORKSPACE_NOT_FOUND: 404,
    TESTCASE_NOT_FOUND: 404,
    TESTCASE_NOT_SELECTED: 409,
    RECORDING_ALREADY_ACTIVE: 409,
    RECORDING_NOT_FOUND: 404,
    RECORDING_APPROVAL_REQUIRED: 409,
    RECORDING_DELETE_FORBIDDEN: 409,
    RECORDING_CHANGED_AFTER_APPROVAL: 409,
    ASSERTION_CONFIRMATION_REQUIRED: 409,
    TESTDATA_BINDING_REQUIRED: 422,
    GENERATE_FAILED: 500,
    INVALID_STATE_TRANSITION: 409,
    INVALID_REQUEST: 400,
    RECORDING_MAPPING_REQUIRED: 409,
    SEGMENT_NOT_CONFIRMED: 409,
    SEGMENT_MAPPING_INVALID: 422,
    SEGMENT_INVALID: 400,
    SEGMENT_OVERLAP: 409,
    SEGMENT_TYPE_REQUIRES_TESTCASE: 400,
    SEGMENT_NOT_FOUND: 404
};

/** Ném lỗi V3 thống nhất (errorCode + statusCode + message + details). */
function fail(code, message, details = null) {
    const error = new Error(message);
    error.code = code;
    error.statusCode = STATUS_BY_CODE[code] ?? 400;
    error.details = details;
    throw error;
}

/** Map errorCode từ Renderer/GenerateService về V3 error (không để code bên ngoài lọt ra). */
const RENDERER_TO_V3 = {
    RECORDING_APPROVAL_REQUIRED: "RECORDING_APPROVAL_REQUIRED",
    RECORDING_CHANGED_AFTER_APPROVAL: "RECORDING_CHANGED_AFTER_APPROVAL",
    TESTDATA_BINDING_REQUIRED: "TESTDATA_BINDING_REQUIRED",
    ASSERTION_CONFIRMATION_REQUIRED: "ASSERTION_CONFIRMATION_REQUIRED",
    RECORDING_MAPPING_REQUIRED: "RECORDING_MAPPING_REQUIRED",
    SEGMENT_NOT_CONFIRMED: "SEGMENT_NOT_CONFIRMED",
    SEGMENT_MAPPING_INVALID: "SEGMENT_MAPPING_INVALID"
};

function newAssertionId() {
    return `ASRT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function newSegmentId() {
    return `SEG-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const AUTOMATION_DECISIONS = new Set(["UNDECIDED", "MANUAL_ONLY", "AUTOMATED"]);

export default class AutomationWorkspaceApplicationService {
    constructor({ workspace = null, store = null, session = null, generateService = null } = {}) {
        this.workspace = workspace;       // AutomationWorkspace
        this.store = store;               // CodeGenRecordingStore
        this.session = session;           // CurrentRecordingSession
        this.generateService = generateService; // GenerateService
    }

    /* ============================== A. Workspace ============================== */

    /** Tạo workspace từ danh sách approved testcase. Chỉ load reviewStatus=APPROVED. */
    createWorkspace({ source = "NEW", approvedTestCases = [], module = "", sourceFile = null } = {}) {
        const mode = String(source || "NEW").toUpperCase();
        if (!WORKSPACES_MODES_HAS(mode)) fail(V3_ERRORS.INVALID_REQUEST, `source không hợp lệ: ${source}`);
        const raw = Array.isArray(approvedTestCases) ? approvedTestCases : [];
        if (raw.length === 0 && sourceFile) {
            // load snapshot từ file approved-testcases.json (chỉ đọc).
            raw.push(...loadApprovedFile(sourceFile));
        }
        // Chỉ lấy testcase đã APPROVED.
        const approved = raw.filter(tc => {
            const status = String(tc?.reviewStatus ?? tc?.status ?? "APPROVED").toUpperCase();
            return status === "APPROVED";
        });
        if (approved.length === 0) {
            fail(V3_ERRORS.INVALID_REQUEST, "Không có testcase APPROVED để tạo workspace.");
        }
        const testCases = approved.map(tc => ({
            id: String(tc?.id ?? tc?.testcaseId ?? "").trim(),
            title: String(tc?.title ?? tc?.scenario ?? "").trim(),
            module: String(tc?.module ?? "").trim(),
            type: String(tc?.type ?? "").trim(),
            testData: tc?.testData ?? null,
            expectedResult: String(tc?.expectedResult ?? tc?.expected ?? "").trim()
        }));
        const ws = this.workspace.create({ mode, module: module || testCases[0]?.module || "", testCases });
        return {
            workspaceId: ws.workspaceId,
            status: mode,
            approvedCount: testCases.length,
            items: (ws.selectedTestCases ?? []).map(entry => this.toItem(entry, ws.workspaceId))
        };
    }

    /** Lấy toàn bộ trạng thái workspace (DTO gọn cho API). */
    getWorkspace(workspaceId) {
        const ws = this.workspace.get(workspaceId);
        if (!ws) fail(V3_ERRORS.WORKSPACE_NOT_FOUND, "Không tìm thấy workspace.");
        return {
            workspaceId: ws.workspaceId,
            module: ws.module,
            source: ws.source,
            status: "OPEN",
            items: (ws.selectedTestCases ?? []).map(entry => this.toItem(entry, ws.workspaceId))
        };
    }

    selectTestCase({ workspaceId, testCaseId }) {
        this.ensureTestCase(workspaceId, testCaseId);
        const entry = this.workspace.setSelected(workspaceId, testCaseId, true);
        return this.toItem(entry, workspaceId);
    }

    unselectTestCase({ workspaceId, testCaseId }) {
        this.ensureTestCase(workspaceId, testCaseId);
        const entry = this.workspace.setSelected(workspaceId, testCaseId, false);
        return this.toItem(entry, workspaceId);
    }

    /* ============================== B. Recording ============================== */

    /** Start recording — validate workspace + testcase selected (TESTCASE CÓ testCaseId) rồi gọi session. */
    startRecording({ workspaceId, testCaseId = null, type = "TESTCASE", url = "", browser = "chrome" }) {
        this.ensureWorkspace(workspaceId);
        const recType = String(type ?? "TESTCASE").toUpperCase() === "SETUP" ? "SETUP" : "TESTCASE";
        // 5C-0: TESTCASE có thể chưa gán testCaseId (1 bản ghi dài gán nhiều testcase qua Segment).
        if (recType === "TESTCASE" && testCaseId) {
            this.ensureTestCase(workspaceId, testCaseId);
            const entry = this.workspace.getTestCase(workspaceId, testCaseId);
            if (!entry.selectedForAutomation) {
                fail(V3_ERRORS.TESTCASE_NOT_SELECTED, "Testcase chưa được chọn để automation.");
            }
        }
        // Session tự reject nếu đã có recording đang hoạt động (RECORDING_ALREADY_ACTIVE).
        let session;
        try {
            session = this.session.start({ workspaceId, testCaseId, type: recType, url, browser });
        } catch (error) {
            if (error?.code === "RECORDING_ALREADY_ACTIVE") {
                fail(V3_ERRORS.RECORDING_ALREADY_ACTIVE, error.message);
            }
            fail(V3_ERRORS.INVALID_REQUEST, error?.message ?? "Không start được recording.");
        }
        // Transition: SELECTED → RECORDING (chỉ khi có testCaseId).
        if (recType === "TESTCASE" && session.testCaseId) {
            this.workspace.transition(workspaceId, session.testCaseId, { reviewStatus: "RECORDING" });
        }
        return {
            recordingId: session.recordingId,
            sessionId: session.id,
            workspaceId,
            testCaseId: session.testCaseId,
            type: session.type,
            status: session.status
        };
    }

    /** Stop recording — giữ đúng workspaceId/recordingId đã start; không đổi testCaseId. */
    stopRecording({ workspaceId, recordingId, source = "" }) {
        this.ensureWorkspace(workspaceId);
        const active = this.session.current();
        if (!active) fail(V3_ERRORS.INVALID_STATE_TRANSITION, "Không có recording đang hoạt động.");
        if (active.workspaceId !== workspaceId || (recordingId && active.recordingId !== recordingId)) {
            fail(V3_ERRORS.INVALID_STATE_TRANSITION, "Recording đang hoạt động không khớp workspace/recordingId.");
        }
        let session;
        try {
            session = this.session.stop({ source });
        } catch (error) {
            fail(V3_ERRORS.INVALID_STATE_TRANSITION, error?.message ?? "Không stop được recording.");
        }
        return {
            recordingId: session.recordingId,
            sessionId: session.id,
            workspaceId: session.workspaceId,
            testCaseId: session.testCaseId,
            type: session.type,
            status: session.status === "PARSED" ? "RECORDED" : session.status,
            recordingVersion: session.recordingVersion,
            recordingHash: session.recordingHash,
            summary: session.summary,
            stepCount: (session.steps ?? []).length,
            assertionCount: (session.assertions ?? []).length
        };
    }

    /** Approve recording — lưu approvedBy/approvedAt, khóa hash, transition → APPROVED. */
    approveRecording({ workspaceId, recordingId, approvedBy = "tester" }) {
        this.ensureWorkspace(workspaceId);
        const rec = this.store?.getRaw(recordingId);
        if (!rec) fail(V3_ERRORS.RECORDING_NOT_FOUND, "Không tìm thấy recording.");
        if (rec.status !== "RECORDED") {
            fail(V3_ERRORS.INVALID_STATE_TRANSITION, "Chỉ approve recording đã RECORDED.");
        }
        this.store.update(recordingId, {
            status: "APPROVED",
            approvedBy: String(approvedBy ?? "tester"),
            approvedAt: new Date().toISOString(),
            // khóa hash — recordingHash đã có từ lúc stop.
            recordingHash: rec.recordingHash ?? null
        });
        // Transition workspace item → APPROVED (chỉ với TESTCASE, không với SETUP).
        if (rec.type === "TESTCASE" && rec.testCaseId && rec.testCaseId !== "SETUP") {
            const entry = this.workspace.getTestCase(workspaceId, rec.testCaseId);
            if (entry) {
                this.workspace.transition(workspaceId, rec.testCaseId, {
                    reviewStatus: "APPROVED",
                    recordingId: rec.recordingId,
                    recordingVersion: rec.recordingVersion ?? null,
                    recordingHash: rec.recordingHash ?? null
                });
            }
        }
        const updated = this.store?.getRaw(recordingId);
        return {
            recordingId: updated.recordingId,
            testCaseId: updated.testCaseId,
            type: updated.type,
            status: "APPROVED",
            recordingVersion: updated.recordingVersion,
            recordingHash: updated.recordingHash,
            approvedBy: updated.approvedBy,
            approvedAt: updated.approvedAt
        };
    }

    /** Reject recording — đánh dấu REJECTED, transition workspace về REVIEW_REQUIRED. */
    rejectRecording({ workspaceId, recordingId, reason = "" }) {
        this.ensureWorkspace(workspaceId);
        const rec = this.store?.getRaw(recordingId);
        if (!rec) fail(V3_ERRORS.RECORDING_NOT_FOUND, "Không tìm thấy recording.");
        this.store.update(recordingId, {
            status: "REJECTED",
            rejectedBy: "tester",
            rejectedAt: new Date().toISOString(),
            rejectionReason: String(reason ?? "")
        });
        if (rec.type === "TESTCASE" && rec.testCaseId && rec.testCaseId !== "SETUP") {
            const entry = this.workspace.getTestCase(workspaceId, rec.testCaseId);
            if (entry) {
                this.workspace.transition(workspaceId, rec.testCaseId, { reviewStatus: "REVIEW_REQUIRED" });
            }
        }
        const updated = this.store?.getRaw(recordingId);
        return {
            recordingId: updated.recordingId,
            testCaseId: updated.testCaseId,
            status: "REJECTED",
            rejectedAt: updated.rejectedAt
        };
    }

    /** List recording versions của testcase — chỉ metadata/summary, KHÔNG trả steps/source (Bước 5B). */
    listRecordings({ workspaceId, testCaseId }) {
        this.ensureTestCase(workspaceId, testCaseId);
        // 6A — fix BUG 1: đọc recording qua MAPPING HIỆN HÀNH của testcase (segment refs trong workspace),
        // không quay lại gán testCaseId vào recording để chữa UI. Legacy fallback (allByTestCase) giữ
        // compatibility cho dữ liệu 5B cũ (recording gắn thẳng testCaseId).
        const refs = this.workspace.getSegmentRefs(workspaceId, testCaseId);
        let recordings;
        if (refs.length > 0) {
            recordings = [];
            const seen = new Set();
            for (const ref of refs) {
                const rec = this.store?.getRaw(ref.recordingId);
                if (rec && !seen.has(ref.recordingId)) {
                    seen.add(ref.recordingId);
                    recordings.push(rec);
                }
            }
        } else {
            recordings = this.store?.allByTestCase(testCaseId) ?? [];
        }
        return recordings
            .map(r => ({
                recordingId: r.recordingId,
                testCaseId: r.testCaseId,
                type: r.type,
                status: r.status,
                version: r.recordingVersion ?? null,
                approvedBy: r.approvedBy ?? null,
                approvedAt: r.approvedAt ?? null,
                createdAt: r.createdAt,
                summary: {
                    actionCount: (r.steps ?? []).length,
                    assertionCount: (r.assertions ?? []).length,
                    duration: r.summary?.duration ?? null
                }
            }))
            .sort((a, b) => (b.version || 0) - (a.version || 0));
    }

    /** Chi tiết recording cho Review / Mapping — trả steps/assertions/segments (đã sanitize), KHÔNG trả source. */
    getRecordingDetail({ workspaceId, recordingId }) {
        this.ensureWorkspace(workspaceId);
        const rec = this.store?.getRaw(recordingId);
        if (!rec) fail(V3_ERRORS.RECORDING_NOT_FOUND, "Không tìm thấy recording.");
        return {
            recordingId: rec.recordingId,
            testCaseId: rec.testCaseId,
            type: rec.type,
            status: rec.status,
            version: rec.recordingVersion ?? null,
            approvedBy: rec.approvedBy ?? null,
            approvedAt: rec.approvedAt ?? null,
            createdAt: rec.createdAt,
            summary: {
                actionCount: (rec.steps ?? []).length,
                assertionCount: (rec.assertions ?? []).length,
                duration: rec.summary?.duration ?? null
            },
            steps: (rec.steps ?? []).map(step => this.sanitizeStep(step)),
            assertions: (rec.assertions ?? []).map(a => this.sanitizeAssertion(a)),
            segments: (rec.segments ?? []).map(seg => this.segmentDto(seg, rec.steps))
        };
    }

    /** Source code — CHỈ tải khi tester chủ động bấm "Xem mã". */
    getRecordingSource({ workspaceId, recordingId }) {
        this.ensureWorkspace(workspaceId);
        const rec = this.store?.getRaw(recordingId);
        if (!rec) fail(V3_ERRORS.RECORDING_NOT_FOUND, "Không tìm thấy recording.");
        return {
            recordingId: rec.recordingId,
            testCaseId: rec.testCaseId,
            version: rec.recordingVersion ?? null,
            source: rec.scriptContent ?? ""
        };
    }

    /** Xóa recording — từ chối khi APPROVED / đã sinh file (tránh workspace sai trạng thái). */
    deleteRecording({ workspaceId, recordingId }) {
        this.ensureWorkspace(workspaceId);
        const rec = this.store?.getRaw(recordingId);
        if (!rec) fail(V3_ERRORS.RECORDING_NOT_FOUND, "Không tìm thấy recording.");
        if (rec.status === "APPROVED") {
            fail(V3_ERRORS.RECORDING_DELETE_FORBIDDEN, "Không thể xóa recording đã duyệt.");
        }
        const entry = rec.testCaseId ? this.workspace.getTestCase(workspaceId, rec.testCaseId) : null;
        if (entry && entry.generateStatus === "GENERATED") {
            fail(V3_ERRORS.RECORDING_DELETE_FORBIDDEN, "Không thể xóa recording đã sinh file.");
        }
        this.store.remove(recordingId);
        // 5C-0 — gỡ mọi mapping segment trỏ tới recording này (kể cả bản ghi chưa gán testcase).
        this.workspace.removeSegmentRefsByRecording(workspaceId, recordingId);
        // Nếu xóa recording đang được workspace tham chiếu → reset trạng thái recording.
        if (entry && entry.recordingId === recordingId) {
            this.workspace.transition(workspaceId, rec.testCaseId, {
                recordingId: null,
                recordingStatus: "NOT_RECORDED",
                reviewStatus: entry.generateStatus === "GENERATED" ? entry.reviewStatus : "SELECTED"
            });
        }
        return { recordingId, testCaseId: rec.testCaseId ?? null, deleted: true };
    }

    /* ============================== B2. Segment — Record Mapping (5C-0) ============================== */

    /** Tạo segment DRAFT — tester chọn khoảng steps + loại (SETUP/TESTCASE) + testCaseId. KHÔNG dùng AI. */
    createSegment({ workspaceId, recordingId, startStep, endStep, type = "TESTCASE", testCaseId = null }) {
        this.ensureWorkspace(workspaceId);
        const rec = this.store?.getRaw(recordingId);
        if (!rec || rec.workspaceId !== workspaceId) fail(V3_ERRORS.RECORDING_NOT_FOUND, "Không tìm thấy recording.");
        const segType = String(type ?? "TESTCASE").toUpperCase() === "SETUP" ? "SETUP" : "TESTCASE";
        this.assertRangeValid(rec.steps, startStep, endStep);

        if (segType === "TESTCASE") {
            if (!testCaseId) fail(V3_ERRORS.SEGMENT_TYPE_REQUIRES_TESTCASE, "Đoạn Testcase bắt buộc chọn testcase.");
            this.ensureTestCase(workspaceId, testCaseId);
        }

        // Chặn chồng lấn trong cùng recording (1 bước không thể thuộc 2 đoạn).
        for (const seg of this.store.getSegments(recordingId)) {
            if (rangesOverlap(startStep, endStep, seg.startStep, seg.endStep)) {
                fail(V3_ERRORS.SEGMENT_OVERLAP, `Đoạn thao tác trùng với đoạn đã gán (bước ${seg.startStep} → ${seg.endStep}).`);
            }
        }

        const segment = {
            segmentId: newSegmentId(),
            recordingId,
            startStep,
            endStep,
            type: segType,
            testCaseId: segType === "TESTCASE" ? testCaseId : null,
            status: "DRAFT",
            confirmedAt: null,
            confirmedBy: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        const saved = this.store.addSegment(recordingId, segment);
        // Mapping testcase ↔ segment lưu bằng segmentId (KHÔNG theo index/order).
        if (segType === "TESTCASE") {
            this.workspace.addSegmentRef(workspaceId, testCaseId, { segmentId: saved.segmentId, recordingId });
        }
        return this.segmentDto(saved, rec.steps);
    }

    /** Sửa segment — đổi range/loại/testcase → tự quay về DRAFT chờ xác nhận lại (quyết định đã duyệt). */
    updateSegment({ workspaceId, recordingId, segmentId, startStep, endStep, type, testCaseId }) {
        this.ensureWorkspace(workspaceId);
        const rec = this.store?.getRaw(recordingId);
        if (!rec || rec.workspaceId !== workspaceId) fail(V3_ERRORS.RECORDING_NOT_FOUND, "Không tìm thấy recording.");
        const current = this.store?.getSegment(recordingId, segmentId);
        if (!current) fail(V3_ERRORS.SEGMENT_NOT_FOUND, "Không tìm thấy đoạn thao tác.");

        const nextStart = Number.isInteger(startStep) ? startStep : current.startStep;
        const nextEnd = Number.isInteger(endStep) ? endStep : current.endStep;
        const nextType = type ? (String(type).toUpperCase() === "SETUP" ? "SETUP" : "TESTCASE") : current.type;
        let nextTestCase = testCaseId !== undefined ? testCaseId : current.testCaseId;
        this.assertRangeValid(rec.steps, nextStart, nextEnd);

        if (nextType === "TESTCASE") {
            if (!nextTestCase) fail(V3_ERRORS.SEGMENT_TYPE_REQUIRES_TESTCASE, "Đoạn Testcase bắt buộc chọn testcase.");
            this.ensureTestCase(workspaceId, nextTestCase);
        } else {
            nextTestCase = null;
        }

        for (const seg of this.store.getSegments(recordingId)) {
            if (seg.segmentId === segmentId) continue;
            if (rangesOverlap(nextStart, nextEnd, seg.startStep, seg.endStep)) {
                fail(V3_ERRORS.SEGMENT_OVERLAP, `Đoạn thao tác trùng với đoạn đã gán (bước ${seg.startStep} → ${seg.endStep}).`);
            }
        }

        // Đổi testcase → chuyển ref trong workspace (bỏ cũ, thêm mới).
        if (nextType === "TESTCASE" && current.type === "TESTCASE" && current.testCaseId && current.testCaseId !== nextTestCase) {
            this.workspace.removeSegmentRef(workspaceId, current.testCaseId, segmentId);
            this.workspace.addSegmentRef(workspaceId, nextTestCase, { segmentId, recordingId });
        } else if (nextType === "TESTCASE" && current.type !== "TESTCASE") {
            this.workspace.addSegmentRef(workspaceId, nextTestCase, { segmentId, recordingId });
        } else if (nextType !== "TESTCASE" && current.type === "TESTCASE" && current.testCaseId) {
            this.workspace.removeSegmentRef(workspaceId, current.testCaseId, segmentId);
        }

        // Quyết định #2: sửa segment → DRAFT.
        const saved = this.store.updateSegment(recordingId, segmentId, {
            startStep: nextStart,
            endStep: nextEnd,
            type: nextType,
            testCaseId: nextType === "TESTCASE" ? nextTestCase : null,
            status: "DRAFT",
            confirmedAt: null,
            confirmedBy: null
        });
        return this.segmentDto(saved, rec.steps);
    }

    /** Xác nhận segment (DRAFT → CONFIRMED) — tester là người quyết định. */
    confirmSegment({ workspaceId, recordingId, segmentId }) {
        this.ensureWorkspace(workspaceId);
        const rec = this.store?.getRaw(recordingId);
        if (!rec || rec.workspaceId !== workspaceId) fail(V3_ERRORS.RECORDING_NOT_FOUND, "Không tìm thấy recording.");
        const current = this.store?.getSegment(recordingId, segmentId);
        if (!current) fail(V3_ERRORS.SEGMENT_NOT_FOUND, "Không tìm thấy đoạn thao tác.");
        this.assertRangeValid(rec.steps, current.startStep, current.endStep);
        if (current.type === "TESTCASE" && !current.testCaseId) {
            fail(V3_ERRORS.SEGMENT_TYPE_REQUIRES_TESTCASE, "Đoạn Testcase bắt buộc chọn testcase.");
        }
        const saved = this.store.updateSegment(recordingId, segmentId, {
            status: "CONFIRMED",
            confirmedAt: new Date().toISOString(),
            confirmedBy: "tester"
        });
        // Có đoạn TESTCASE đã xác nhận → testcase tự chuyển "Có automation".
        if (saved.type === "TESTCASE" && saved.testCaseId) {
            this.workspace.setAutomationDecision(workspaceId, saved.testCaseId, "AUTOMATED");
        }
        return this.segmentDto(saved, rec.steps);
    }

    /** Xóa segment — gỡ luôn mapping trong workspace. */
    deleteSegment({ workspaceId, recordingId, segmentId }) {
        this.ensureWorkspace(workspaceId);
        const current = this.store?.getSegment(recordingId, segmentId);
        if (!current) fail(V3_ERRORS.SEGMENT_NOT_FOUND, "Không tìm thấy đoạn thao tác.");
        this.store.removeSegment(recordingId, segmentId);
        if (current.type === "TESTCASE" && current.testCaseId) {
            this.workspace.removeSegmentRef(workspaceId, current.testCaseId, segmentId);
        }
        return { segmentId, recordingId, testCaseId: current.testCaseId ?? null, deleted: true };
    }

    /** Sắp xếp lại thứ tự đoạn của 1 testcase (↑/↓) — Generate dùng đúng thứ tự này. */
    reorderTestCaseSegments({ workspaceId, testCaseId, segmentIds = [] }) {
        this.ensureTestCase(workspaceId, testCaseId);
        const refs = this.workspace.getSegmentRefs(workspaceId, testCaseId);
        if (!Array.isArray(segmentIds) || segmentIds.length !== refs.length || segmentIds.length === 0) {
            fail(V3_ERRORS.INVALID_REQUEST, "Danh sách thứ tự đoạn không hợp lệ.");
        }
        const entry = this.workspace.reorderSegmentRefs(workspaceId, testCaseId, segmentIds);
        if (!entry) fail(V3_ERRORS.INVALID_REQUEST, "Không sắp xếp được đoạn thao tác.");
        return this.toItem(entry, workspaceId);
    }

    /** Tester đặt trạng thái tự động hóa: UNDECIDED | MANUAL_ONLY | AUTOMATED. */
    setAutomationDecision({ workspaceId, testCaseId, decision }) {
        this.ensureTestCase(workspaceId, testCaseId);
        const d = String(decision ?? "UNDECIDED").toUpperCase();
        if (!AUTOMATION_DECISIONS.has(d)) fail(V3_ERRORS.INVALID_REQUEST, `Trạng thái tự động hóa không hợp lệ: ${decision}`);
        const entry = this.workspace.setAutomationDecision(workspaceId, testCaseId, d);
        return this.toItem(entry, workspaceId);
    }

    /** Validate khoảng bước: số nguyên, trong phạm vi steps của recording, start ≤ end. */
    assertRangeValid(steps, startStep, endStep) {
        const count = Array.isArray(steps) ? steps.length : 0;
        if (!Number.isInteger(startStep) || !Number.isInteger(endStep) || startStep < 1 || endStep < 1
            || startStep > endStep || endStep > count) {
            fail(V3_ERRORS.SEGMENT_INVALID, "Khoảng bước không hợp lệ.");
        }
    }

    /** DTO segment (kèm số bước) — không lộ field nội bộ. */
    segmentDto(seg, steps) {
        return {
            segmentId: seg.segmentId,
            recordingId: seg.recordingId,
            startStep: seg.startStep,
            endStep: seg.endStep,
            stepCount: seg.endStep - seg.startStep + 1,
            type: seg.type,
            testCaseId: seg.testCaseId ?? null,
            status: seg.status,
            confirmedAt: seg.confirmedAt ?? null,
            confirmedBy: seg.confirmedBy ?? null
        };
    }

    /* ============================== C. Assertions ============================== */

    saveDraftAssertion({ workspaceId, testCaseId, assertion = {} }) {
        this.ensureTestCase(workspaceId, testCaseId);
        const entry = this.workspace.getTestCase(workspaceId, testCaseId);
        const current = Array.isArray(entry.automationAssertions) ? entry.automationAssertions : [];
        const draft = {
            id: assertion.id ?? newAssertionId(),
            testCaseId,
            type: String(assertion.type ?? "").trim(),
            target: String(assertion.target ?? "").trim(),
            locator: String(assertion.locator ?? "").trim(),
            expected: assertion.expected,
            matcher: String(assertion.matcher ?? "").trim(),
            source: String(assertion.source ?? "TESTER_INPUT").trim(),
            status: "DRAFT"
        };
        this.workspace.saveAssertions(workspaceId, testCaseId, [...current, draft]);
        return draft;
    }

    confirmAssertion({ workspaceId, testCaseId, assertionId }) {
        const entry = this.ensureAssertion(workspaceId, testCaseId, assertionId);
        const list = (entry.automationAssertions ?? []).map(a => {
            if (a.id === assertionId) return { ...a, status: "TESTER_CONFIRMED", confirmedAt: new Date().toISOString() };
            return a;
        });
        this.workspace.saveAssertions(workspaceId, testCaseId, list);
        return list.find(a => a.id === assertionId);
    }

    rejectAssertion({ workspaceId, testCaseId, assertionId, reason = "" }) {
        this.ensureAssertion(workspaceId, testCaseId, assertionId);
        const list = (this.workspace.getTestCase(workspaceId, testCaseId).automationAssertions ?? []).map(a => {
            if (a.id === assertionId) return { ...a, status: "REJECTED", rejectionReason: String(reason ?? "") };
            return a;
        });
        this.workspace.saveAssertions(workspaceId, testCaseId, list);
        return list.find(a => a.id === assertionId);
    }

    removeAssertion({ workspaceId, testCaseId, assertionId }) {
        this.ensureAssertion(workspaceId, testCaseId, assertionId);
        const list = (this.workspace.getTestCase(workspaceId, testCaseId).automationAssertions ?? [])
            .filter(a => a.id !== assertionId);
        this.workspace.saveAssertions(workspaceId, testCaseId, list);
        return { removed: assertionId, remaining: list.length };
    }

    listAssertions({ workspaceId, testCaseId }) {
        this.ensureTestCase(workspaceId, testCaseId);
        return this.workspace.getTestCase(workspaceId, testCaseId).automationAssertions ?? [];
    }

    /* ============================== C2. Expected Result + Đề xuất (5C) ============================== */

    /** Tester sửa Expected Result (working copy trong workspace — KHÔNG sửa approved). Rỗng → về bản gốc. */
    updateExpectedResult({ workspaceId, testCaseId, expectedResult }) {
        this.ensureTestCase(workspaceId, testCaseId);
        const entry = this.workspace.saveExpectedResult(workspaceId, testCaseId, expectedResult);
        if (!entry) fail(V3_ERRORS.TESTCASE_NOT_FOUND, "Không tìm thấy testcase.");
        return this.toItem(entry, workspaceId);
    }

    /** Đề xuất điều kiện xác nhận (deterministic, KHÔNG AI) — Expected Result do tester sở hữu. */
    suggestAssertionsForTestcase({ workspaceId, testCaseId }) {
        this.ensureTestCase(workspaceId, testCaseId);
        const expectedResult = this.workspace.effectiveExpectedResult(workspaceId, testCaseId);
        const steps = this.collectTestCaseSteps(workspaceId, testCaseId);
        return {
            testCaseId,
            expectedResult,
            suggestions: suggestAssertions({ expectedResult, steps })
        };
    }

    /** Sửa assertion — tự quay về DRAFT chờ xác nhận lại (giống quyết định segment). */
    updateAssertion({ workspaceId, testCaseId, assertionId, assertion = {} }) {
        const entry = this.ensureAssertion(workspaceId, testCaseId, assertionId);
        const list = (entry.automationAssertions ?? []).map(a => {
            if (a.id !== assertionId) return a;
            return {
                ...a,
                type: String(assertion.type ?? a.type ?? "").trim(),
                target: String(assertion.target ?? a.target ?? "").trim(),
                locator: String(assertion.locator ?? a.locator ?? "").trim(),
                expected: assertion.expected !== undefined ? assertion.expected : a.expected,
                matcher: String(assertion.matcher ?? a.matcher ?? "").trim(),
                source: String(assertion.source ?? a.source ?? "TESTER_INPUT").trim(),
                status: "DRAFT",
                confirmedAt: null,
                updatedAt: new Date().toISOString()
            };
        });
        this.workspace.saveAssertions(workspaceId, testCaseId, list);
        return list.find(a => a.id === assertionId);
    }

    /** Steps thực tế của testcase (từ segment TESTCASE CONFIRMED; legacy: recording APPROVED gắn testCaseId). */
    collectTestCaseSteps(workspaceId, testCaseId) {
        const steps = [];
        const refs = this.workspace.getSegmentRefs(workspaceId, testCaseId);
        if (refs.length > 0) {
            for (const ref of refs) {
                const seg = this.store?.getSegment(ref.recordingId, ref.segmentId) ?? null;
                if (!seg || seg.type !== "TESTCASE" || seg.testCaseId !== testCaseId || seg.status !== "CONFIRMED") continue;
                const raw = this.store?.getRaw(ref.recordingId) ?? null;
                if (!raw) continue;
                for (const s of raw.steps ?? []) {
                    if (Number.isInteger(s?.order) && s.order >= seg.startStep && s.order <= seg.endStep) steps.push(s);
                }
            }
        } else {
            const recs = (this.store?.allByTestCase(testCaseId) ?? [])
                .filter(r => r.status === "APPROVED")
                .sort((a, b) => (b.recordingVersion || 0) - (a.recordingVersion || 0));
            const latest = recs[0] ?? null;
            if (latest) {
                const raw = this.store?.getRaw(latest.recordingId) ?? latest;
                steps.push(...(raw.steps ?? []));
            }
        }
        return steps;
    }

    /* ============================== D. Generate ============================== */

    generate({ workspaceId, testCaseId, confirmedTestData = {} }) {
        this.ensureTestCase(workspaceId, testCaseId);
        const entry = this.workspace.getTestCase(workspaceId, testCaseId);
        if (!entry.selectedForAutomation) {
            fail(V3_ERRORS.TESTCASE_NOT_SELECTED, "Testcase chưa được chọn để automation.");
        }
        // ===== 5C-0 — Pre-check Record Mapping (chỉ kiểm tra testcase đang Generate; không yêu cầu toàn bộ recording được mapping) =====
        // Mapping testcase ↔ segment do tester xác nhận (bằng testCaseId, KHÔNG theo thứ tự/index).
        const refs = this.workspace.getSegmentRefs(workspaceId, testCaseId);
        let segmentsPayload = null;
        if (refs.length > 0) {
            for (const ref of refs) {
                const seg = this.store?.getSegment(ref.recordingId, ref.segmentId) ?? null;
                if (!seg || seg.type !== "TESTCASE" || seg.testCaseId !== testCaseId) {
                    fail(V3_ERRORS.SEGMENT_MAPPING_INVALID, "Chưa xác định đầy đủ đoạn thao tác cho testcase.");
                }
                if (seg.status !== "CONFIRMED") {
                    fail(V3_ERRORS.SEGMENT_NOT_CONFIRMED, "Bản ghi thao tác chưa được xác nhận.");
                }
            }
            segmentsPayload = refs;
        } else {
            // Legacy 5B (tương thích dữ liệu cũ): recording APPROVED gắn thẳng testCaseId.
            const approved = (this.store?.allByTestCase(testCaseId) ?? []).filter(r => r.status === "APPROVED");
            if (approved.length === 0) {
                fail(V3_ERRORS.RECORDING_MAPPING_REQUIRED, "Không có bản ghi thao tác cho testcase này.");
            }
        }
        // Assertion phải có TESTER_CONFIRMED.
        const confirmedAssertions = (entry.automationAssertions ?? []).filter(a => a.status === "TESTER_CONFIRMED");
        if (confirmedAssertions.length === 0) {
            fail(V3_ERRORS.ASSERTION_CONFIRMATION_REQUIRED, "Chưa có điều kiện xác nhận phù hợp với kết quả mong đợi.");
        }
        // Lưu confirmedTestData vào workspace (restart vẫn giữ).
        if (confirmedTestData && typeof confirmedTestData === "object" && Object.keys(confirmedTestData).length > 0) {
            this.workspace.saveTestData(workspaceId, testCaseId, confirmedTestData);
        }
        const confirmedData = this.workspace.getTestCase(workspaceId, testCaseId).confirmedTestData ?? confirmedTestData;
        const approvedTestData = entry.approvedTestData ?? {};

        let result;
        try {
            result = this.generateService.generate({
                workspaceId,
                testCaseId,
                approvedTestData,
                confirmedTestData: confirmedData,
                confirmedAssertions,
                segments: segmentsPayload
            });
        } catch (error) {
            fail(V3_ERRORS.GENERATE_FAILED, "Generate thất bại.", { reason: error?.message ?? "Lỗi nội bộ." });
        }
        if (!result?.ok) {
            const code = RENDERER_TO_V3[result?.errorCode] ?? V3_ERRORS.GENERATE_FAILED;
            const status = code === V3_ERRORS.GENERATE_FAILED ? 500 : (STATUS_BY_CODE[code] ?? 409);
            const error = new Error(result?.reason ?? "Generate thất bại.");
            error.code = code;
            error.statusCode = status;
            throw error;
        }
        return {
            status: "GENERATED",
            testCaseId,
            outputPath: result.outputPath,
            metadata: result.metadata,
            runtimeEnvKeys: Object.keys(result.runtimeEnv ?? {}),
            validation: result.validation
        };
    }

    /* ============================== Helpers ============================== */

    ensureWorkspace(workspaceId) {
        if (!this.workspace?.get(workspaceId)) fail(V3_ERRORS.WORKSPACE_NOT_FOUND, "Không tìm thấy workspace.");
        return this.workspace.get(workspaceId);
    }

    ensureTestCase(workspaceId, testCaseId) {
        this.ensureWorkspace(workspaceId);
        const entry = this.workspace.getTestCase(workspaceId, testCaseId);
        if (!entry) fail(V3_ERRORS.TESTCASE_NOT_FOUND, `Không tìm thấy testcase ${testCaseId} trong workspace.`);
        return entry;
    }

    ensureAssertion(workspaceId, testCaseId, assertionId) {
        const entry = this.ensureTestCase(workspaceId, testCaseId);
        const found = (entry.automationAssertions ?? []).find(a => a.id === assertionId);
        if (!found) fail(V3_ERRORS.INVALID_REQUEST, `Không tìm thấy assertion ${assertionId}.`);
        return entry;
    }

    /** Sanitize step — bỏ sourceRange, mask giá trị nhạy cảm. */
    sanitizeStep(step) {
        return {
            order: step.order,
            actionType: step.actionType,
            locator: step.locator,
            target: step.target,
            valueKind: step.valueKind,
            recordedValue: step.sensitive ? "••••" : (step.recordedValue ?? "")
        };
    }

    /** Sanitize assertion — bỏ sourceRange. */
    sanitizeAssertion(a) {
        return {
            order: a.order,
            statement: a.statement ?? "",
            locator: a.locator,
            matcher: a.matcher,
            expected: a.expected
        };
    }

    /** DTO gọn cho 1 item testcase trong workspace. */
    toItem(entry, workspaceId) {
        const recs = (this.store?.allByTestCase(entry.testCaseId) ?? [])
            .filter(r => r.status === "APPROVED")
            .sort((a, b) => (b.recordingVersion || 0) - (a.recordingVersion || 0));
        const rec = recs[0] ?? null;
        const assertions = entry.automationAssertions ?? [];
        // 5C-0 — mapping segment (theo thứ tự tester sắp xếp).
        const segments = this.workspace
            .getSegmentRefs(workspaceId, entry.testCaseId)
            .map(ref => {
                const seg = this.store?.getSegment(ref.recordingId, ref.segmentId) ?? null;
                if (!seg) return null;
                return {
                    segmentId: seg.segmentId,
                    recordingId: seg.recordingId,
                    orderInTestCase: ref.orderInTestCase,
                    startStep: seg.startStep,
                    endStep: seg.endStep,
                    stepCount: seg.endStep - seg.startStep + 1,
                    type: seg.type,
                    testCaseId: seg.testCaseId ?? null,
                    status: seg.status
                };
            })
            .filter(Boolean);
        return {
            testCaseId: entry.testCaseId,
            title: entry.title,
            module: entry.module,
            type: entry.type,
            selectedForAutomation: Boolean(entry.selectedForAutomation),
            automationStatus: entry.reviewStatus,
            automationDecision: entry.automationDecision ?? "UNDECIDED",
            expectedResult: (entry.expectedResultEdited ?? entry.expectedResult ?? "").trim(),
            expectedResultEdited: entry.expectedResultEdited ?? null,
            expectedResultOriginal: entry.expectedResult ?? "",
            recordingSummary: rec
                ? { status: rec.status, recordingId: rec.recordingId, version: rec.recordingVersion, hash: rec.recordingHash, approvedBy: rec.approvedBy, approvedAt: rec.approvedAt }
                : { status: "NOT_RECORDED", recordingId: null, version: null, hash: null, approvedBy: null, approvedAt: null },
            segments,
            segmentSummary: {
                total: segments.length,
                confirmed: segments.filter(s => s.status === "CONFIRMED").length,
                draft: segments.filter(s => s.status === "DRAFT").length
            },
            assertionStatus: {
                total: assertions.length,
                confirmed: assertions.filter(a => a.status === "TESTER_CONFIRMED").length,
                draft: assertions.filter(a => a.status === "DRAFT").length,
                rejected: assertions.filter(a => a.status === "REJECTED").length
            },
            generateStatus: entry.generateStatus,
            runStatus: entry.runStatus,
            generatedFile: entry.generatedFile ?? null
        };
    }
}

function WORKSPACES_MODES_HAS(mode) {
    return WORKSPACE_MODES.has(mode);
}

/** 5C-0 — hai khoảng bước có chồng lấn hay không (theo order, không theo index mảng). */
function rangesOverlap(aStart, aEnd, bStart, bEnd) {
    return aStart <= bEnd && bStart <= aEnd;
}

/** Đọc file approved-testcases.json (chỉ đọc) — trả list testcase. Không sửa file. */
function loadApprovedFile(sourceFile) {
    const abs = path.resolve(sourceFile);
    const data = JSON.parse(fs.readFileSync(abs, "utf8"));
    const items = Array.isArray(data) ? data : Array.isArray(data?.testCases) ? data.testCases : [];
    return items;
}
