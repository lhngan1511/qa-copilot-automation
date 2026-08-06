import fs from "node:fs";
import path from "node:path";
import { WORKSPACE_MODES } from "../codegen/AutomationWorkspace.js";

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
    RECORDING_CHANGED_AFTER_APPROVAL: "RECORDING_CHANGED_AFTER_APPROVAL",
    ASSERTION_CONFIRMATION_REQUIRED: "ASSERTION_CONFIRMATION_REQUIRED",
    TESTDATA_BINDING_REQUIRED: "TESTDATA_BINDING_REQUIRED",
    GENERATE_FAILED: "GENERATE_FAILED",
    INVALID_STATE_TRANSITION: "INVALID_STATE_TRANSITION",
    INVALID_REQUEST: "INVALID_REQUEST"
};

const STATUS_BY_CODE = {
    WORKSPACE_NOT_FOUND: 404,
    TESTCASE_NOT_FOUND: 404,
    TESTCASE_NOT_SELECTED: 409,
    RECORDING_ALREADY_ACTIVE: 409,
    RECORDING_NOT_FOUND: 404,
    RECORDING_APPROVAL_REQUIRED: 409,
    RECORDING_CHANGED_AFTER_APPROVAL: 409,
    ASSERTION_CONFIRMATION_REQUIRED: 409,
    TESTDATA_BINDING_REQUIRED: 422,
    GENERATE_FAILED: 500,
    INVALID_STATE_TRANSITION: 409,
    INVALID_REQUEST: 400
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
    ASSERTION_CONFIRMATION_REQUIRED: "ASSERTION_CONFIRMATION_REQUIRED"
};

function newAssertionId() {
    return `ASRT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

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
            testData: tc?.testData ?? null
        }));
        const ws = this.workspace.create({ mode, module: module || testCases[0]?.module || "", testCases });
        return {
            workspaceId: ws.workspaceId,
            status: mode,
            approvedCount: testCases.length,
            items: (ws.selectedTestCases ?? []).map(entry => this.toItem(entry))
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
            items: (ws.selectedTestCases ?? []).map(entry => this.toItem(entry))
        };
    }

    selectTestCase({ workspaceId, testCaseId }) {
        this.ensureTestCase(workspaceId, testCaseId);
        const entry = this.workspace.setSelected(workspaceId, testCaseId, true);
        return this.toItem(entry);
    }

    unselectTestCase({ workspaceId, testCaseId }) {
        this.ensureTestCase(workspaceId, testCaseId);
        const entry = this.workspace.setSelected(workspaceId, testCaseId, false);
        return this.toItem(entry);
    }

    /* ============================== B. Recording ============================== */

    /** Start recording — validate workspace + testcase selected (TESTCASE) rồi gọi session. */
    startRecording({ workspaceId, testCaseId = null, type = "TESTCASE", url = "", browser = "chrome" }) {
        this.ensureWorkspace(workspaceId);
        const recType = String(type ?? "TESTCASE").toUpperCase() === "SETUP" ? "SETUP" : "TESTCASE";
        if (recType === "TESTCASE") {
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
        // Transition: SELECTED → RECORDING.
        if (recType === "TESTCASE") {
            this.workspace.transition(workspaceId, testCaseId, { reviewStatus: "RECORDING" });
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

    /** List recording versions của testcase (không kèm scriptContent — an toàn). */
    listRecordings({ workspaceId, testCaseId }) {
        this.ensureTestCase(workspaceId, testCaseId);
        return (this.store?.allByTestCase(testCaseId) ?? [])
            .map(r => ({
                recordingId: r.recordingId,
                testCaseId: r.testCaseId,
                type: r.type,
                status: r.status,
                recordingVersion: r.recordingVersion,
                recordingHash: r.recordingHash,
                approvedBy: r.approvedBy ?? null,
                approvedAt: r.approvedAt ?? null,
                createdAt: r.createdAt,
                stepCount: (r.steps ?? []).length
            }))
            .sort((a, b) => (b.recordingVersion || 0) - (a.recordingVersion || 0));
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

    /* ============================== D. Generate ============================== */

    generate({ workspaceId, testCaseId, confirmedTestData = {} }) {
        this.ensureTestCase(workspaceId, testCaseId);
        const entry = this.workspace.getTestCase(workspaceId, testCaseId);
        if (!entry.selectedForAutomation) {
            fail(V3_ERRORS.TESTCASE_NOT_SELECTED, "Testcase chưa được chọn để automation.");
        }
        // Pre-check: phải có latest APPROVED recording.
        const recordings = this.store?.allByTestCase(testCaseId) ?? [];
        const approved = recordings.filter(r => r.status === "APPROVED");
        if (approved.length === 0) {
            fail(V3_ERRORS.RECORDING_APPROVAL_REQUIRED, "Chưa có recording APPROVED cho testcase.");
        }
        // Assertion phải có TESTER_CONFIRMED.
        const confirmedAssertions = (entry.automationAssertions ?? []).filter(a => a.status === "TESTER_CONFIRMED");
        if (confirmedAssertions.length === 0) {
            fail(V3_ERRORS.ASSERTION_CONFIRMATION_REQUIRED, "Chưa có assertion TESTER_CONFIRMED.");
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
                confirmedAssertions
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

    /** DTO gọn cho 1 item testcase trong workspace. */
    toItem(entry) {
        const recs = (this.store?.allByTestCase(entry.testCaseId) ?? [])
            .filter(r => r.status === "APPROVED")
            .sort((a, b) => (b.recordingVersion || 0) - (a.recordingVersion || 0));
        const rec = recs[0] ?? null;
        const assertions = entry.automationAssertions ?? [];
        return {
            testCaseId: entry.testCaseId,
            title: entry.title,
            module: entry.module,
            type: entry.type,
            selectedForAutomation: Boolean(entry.selectedForAutomation),
            automationStatus: entry.reviewStatus,
            recordingSummary: rec
                ? { status: rec.status, recordingId: rec.recordingId, version: rec.recordingVersion, hash: rec.recordingHash, approvedBy: rec.approvedBy, approvedAt: rec.approvedAt }
                : { status: "NOT_RECORDED", recordingId: null, version: null, hash: null, approvedBy: null, approvedAt: null },
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

/** Đọc file approved-testcases.json (chỉ đọc) — trả list testcase. Không sửa file. */
function loadApprovedFile(sourceFile) {
    const abs = path.resolve(sourceFile);
    const data = JSON.parse(fs.readFileSync(abs, "utf8"));
    const items = Array.isArray(data) ? data : Array.isArray(data?.testCases) ? data.testCases : [];
    return items;
}
