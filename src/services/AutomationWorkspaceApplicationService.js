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
    ASSERTION_DUPLICATE: "ASSERTION_DUPLICATE",
    TESTDATA_BINDING_REQUIRED: "TESTDATA_BINDING_REQUIRED",
    // P0 TC001 — UNRESOLVED: input chưa xác định data source/intent → chặn Generate.
    TESTDATA_UNRESOLVED: "TESTDATA_UNRESOLVED",
    GENERATE_FAILED: "GENERATE_FAILED",
    NOT_GENERATED: "NOT_GENERATED",
    STALE_GENERATED: "STALE_GENERATED",
    RUNNER_NOT_AVAILABLE: "RUNNER_NOT_AVAILABLE",
    INVALID_STATE_TRANSITION: "INVALID_STATE_TRANSITION",
    INVALID_REQUEST: "INVALID_REQUEST",
    // 5C-0 — Record Mapping (tester-owned, không AI, không theo thứ tự).
    RECORDING_MAPPING_REQUIRED: "RECORDING_MAPPING_REQUIRED",
    SEGMENT_NOT_CONFIRMED: "SEGMENT_NOT_CONFIRMED",
    SEGMENT_MAPPING_INVALID: "SEGMENT_MAPPING_INVALID",
    SEGMENT_INVALID: "SEGMENT_INVALID",
    SEGMENT_OVERLAP: "SEGMENT_OVERLAP",
    SEGMENT_TYPE_REQUIRES_TESTCASE: "SEGMENT_TYPE_REQUIRES_TESTCASE",
    SEGMENT_NOT_FOUND: "SEGMENT_NOT_FOUND",
    // 6B — ActionBlock
    BLOCK_NOT_FOUND: "BLOCK_NOT_FOUND",
    BLOCK_LABEL_REQUIRED: "BLOCK_LABEL_REQUIRED",
    BLOCK_NOT_CONFIRMED: "BLOCK_NOT_CONFIRMED"
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
    ASSERTION_DUPLICATE: 400,
    NOT_GENERATED: 409,
    STALE_GENERATED: 409,
    RUNNER_NOT_AVAILABLE: 503,
    TESTDATA_BINDING_REQUIRED: 422,
    TESTDATA_UNRESOLVED: 422,
    GENERATE_FAILED: 500,
    INVALID_STATE_TRANSITION: 409,
    INVALID_REQUEST: 400,
    RECORDING_MAPPING_REQUIRED: 409,
    SEGMENT_NOT_CONFIRMED: 409,
    SEGMENT_MAPPING_INVALID: 422,
    SEGMENT_INVALID: 400,
    SEGMENT_OVERLAP: 409,
    SEGMENT_TYPE_REQUIRES_TESTCASE: 400,
    SEGMENT_NOT_FOUND: 404,
    BLOCK_NOT_FOUND: 404,
    BLOCK_LABEL_REQUIRED: 400,
    BLOCK_NOT_CONFIRMED: 409
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
    TESTDATA_UNRESOLVED: "TESTDATA_UNRESOLVED",
    ASSERTION_CONFIRMATION_REQUIRED: "ASSERTION_CONFIRMATION_REQUIRED",
    ASSERTION_DUPLICATE: "ASSERTION_DUPLICATE",
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

function newBlockId() {
    return `BLK-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** P0 — normalize tên field để so khớp evidence (bỏ dấu tiếng Việt + lower + strip ký tự đặc biệt). */
function normalizeFieldName(name) {
    const map = {
        "àáạảãâầấậẩẫăằắặẳẵ": "a", "èéẹẻẽêềếệểễ": "e", "ìíịỉĩ": "i",
        "òóọỏõôồốộổỗơờớợởỡ": "o", "ùúụủũưừứựửữ": "u", "ỳýỵỷỹ": "y",
        "đ": "d"
    };
    let t = String(name ?? "").toLowerCase();
    for (const [src, dst] of Object.entries(map)) {
        for (const ch of src) t = t.split(ch).join(dst);
    }
    return t.replace(/[^a-z0-9]+/g, "").trim();
}

export default class AutomationWorkspaceApplicationService {
    constructor({ workspace = null, store = null, session = null, generateService = null, actionLibrary = null, runner = null } = {}) {
        this.workspace = workspace;       // AutomationWorkspace
        this.store = store;               // CodeGenRecordingStore
        this.session = session;           // CurrentRecordingSession
        this.generateService = generateService; // GenerateService
        this.actionLibrary = actionLibrary;     // ActionLibrary (shared asset)
        this.runner = runner;                   // PlaywrightRunner (P0-C: run thu)
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
        // P0 — M = tổng approved có thể quản lý: snapshot (workspace mới) hoặc
        // selectedCount (workspace cũ thiếu snapshot) — không bao giờ 0 khi có testcase.
        const approvedTotal = (ws?.approvedTestCaseSnapshot ?? []).length || (ws?.selectedTestCases ?? []).length;
        return {
            approvedTotal,
            workspaceId: ws.workspaceId,
            status: mode,
            approvedCount: testCases.length,
            items: (ws.selectedTestCases ?? []).map(entry => this.toItem(entry, ws.workspaceId))
        };
    }

    /** Lấy toàn bộ trạng thái workspace (DTO gọn cho API). */
    /** P0-D (C) — Danh sách workspace (sort updatedAt DESC; không lộ raw ID làm primary). */
    listWorkspaces() {
        return (this.workspace?.list?.() ?? [])
            .slice()
            .sort((a, b) => String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")))
            .map(w => ({
                workspaceId: w.workspaceId,
                module: w.module ?? "",
                source: w.source ?? "NEW",
                selectedCount: w.selectedCount ?? 0,
                createdAt: w.createdAt ?? null,
                updatedAt: w.updatedAt ?? null
            }));
    }

    /** P0-D (C) — Xóa workspace (confirm phía UI). KHÔNG cascade Action Library/approved/generated. */
    /** P0 (D) — Loại testcase khỏi workspace (approved/library/recording/generated không đổi). */
    removeTestCaseFromWorkspace({ workspaceId, testCaseId }) {
        this.ensureWorkspace(workspaceId);
        // Self-healing: workspace cũ (trước commit thêm approvedTestCaseSnapshot) thiếu snapshot
        // -> điền từ entry trước khi xóa để [+ Thêm testcase] vẫn hoạt động.
        const ws = this.workspace.get(workspaceId);
        const entry = (ws?.selectedTestCases ?? []).find(tc => tc.testCaseId === testCaseId);
        if (entry && !(ws?.approvedTestCaseSnapshot ?? []).some(t => t.id === testCaseId)) {
            ws.approvedTestCaseSnapshot = ws.approvedTestCaseSnapshot ?? [];
            ws.approvedTestCaseSnapshot.push({
                id: entry.testCaseId,
                title: entry.title,
                module: entry.module,
                type: entry.type,
                testData: entry.approvedTestData ?? null,
                expectedResult: entry.expectedResult ?? ""
            });
        }
        const removed = this.workspace?.removeTestCase?.(workspaceId, testCaseId) ?? false;
        if (!removed) fail(V3_ERRORS.TESTCASE_NOT_FOUND, `Không tìm thấy testcase ${testCaseId} trong workspace.`);
        return { workspaceId, testCaseId, removed: true };
    }

    /** P0 (E) — Approved testcase CHƯA có trong workspace (để [+ Thêm testcase]). */
    listAvailableTestcases({ workspaceId }) {
        this.ensureWorkspace(workspaceId);
        const ws = this.workspace.get(workspaceId);
        const snap = ws?.approvedTestCaseSnapshot ?? [];
        const selected = new Set((ws?.selectedTestCases ?? []).map(tc => tc.testCaseId));
        return snap
            .filter(tc => !selected.has(tc.id))
            .map(tc => ({ testCaseId: tc.id, title: tc.title, module: tc.module, type: tc.type }));
    }

    /** P0 (E) — Thêm lại testcase (trạng thái MỚI, không phục hồi automation state cũ). */
    addTestCaseToWorkspace({ workspaceId, testCaseId }) {
        this.ensureWorkspace(workspaceId);
        const entry = this.workspace?.addTestCase?.(workspaceId, testCaseId) ?? null;
        if (!entry) fail(V3_ERRORS.INVALID_REQUEST, `Không thêm được testcase ${testCaseId} (đã có hoặc không trong snapshot).`);
        return this.toItem(entry, workspaceId);
    }

    /** P0 — AUTO-BIND evidence: action input (step.target) -> business field khi tên khớp
     *  (normalize). KHÔNG đoán khi không khớp. Tester không phải quản lý locator name.
     *
     *  P0 REGRESSION — business-only: fieldNames CHỈ chứa business field name
     *  (bỏ setup env-bound + bỏ technical target). Legacy confirmedTestData có thể
     *  chứa key = step.target ('text search') — nếu đưa vào fieldNames, normalize khớp
     *  chính target -> self-binding 'text search'->'text search' -> UI lộ technical row.
     *
     *  HEAL (self-healing dữ liệu cũ, deterministic):
     *   - Xóa binding self-referential (target == businessField — kỹ thuật, không business);
     *   - confirmedTestData keyed theo target (trước binding canonical) -> migrate giá trị
     *     sang business field khi CÓ binding thật (giữ lựa chọn tester, không mất 'cai'). */
    autoBindTestData(workspaceId, testCaseId) {
        const entry = this.workspace.getTestCase(workspaceId, testCaseId);
        if (!entry) return;
        const seq = (entry?.binding?.sequence ?? []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
        const setupRe = /tài khoản|username|account|mật khẩu|password|mã xác nhận|captcha/;
        // Technical targets của selected actions (FILL) — phân biệt với business field name.
        const targets = new Set();
        for (const ref of seq) {
            const block = this.resolveBlock(workspaceId, ref.blockId) ?? null;
            if (!block) continue;
            for (const step of block.steps ?? []) {
                if (String(step.actionType ?? "").toUpperCase() !== "FILL") continue;
                const target = String(step.target ?? "").trim();
                if (target) targets.add(target);
            }
        }
        // Business field names: approved (fields/inputs) + confirmed — KHÔNG setup env.
        // P0 TC001 (fix lỗ hổng D): approved keys LUÔN là business (tester-authored) — kể cả
        // khi trùng technical target (TC001: 'Mã đơn vị tính' vừa là field vừa là locator name).
        // Chỉ CONFIRMED keys bị loại khi trùng target (legacy confirmed keyed theo step.target).
        const approved = entry.approvedTestData ?? {};
        const fieldNames = new Set();
        // Business fields CÓ DATA (non-setup, non-empty) — unique rule dùng cái này (canonical:
        // không đoán theo số field tổng; chỉ cần ĐÚNG 1 business field có giá trị thật).
        const businessFieldsWithData = new Set();
        const considerBusiness = (k, raw) => {
            if (setupRe.test(String(k ?? "").toLowerCase())) return;
            const v = raw == null ? "" : String(raw && typeof raw === "object" ? (raw.value ?? "") : raw).trim();
            fieldNames.add(k);
            if (v !== "") businessFieldsWithData.add(k);
        };
        if (approved.fields && typeof approved.fields === "object") for (const [k, f] of Object.entries(approved.fields)) considerBusiness(k, f);
        if (approved.inputs && typeof approved.inputs === "object") for (const [k, v] of Object.entries(approved.inputs)) considerBusiness(k, v);
        for (const [k, v] of Object.entries(entry.confirmedTestData ?? {})) {
            if (setupRe.test(k.toLowerCase()) || targets.has(k)) continue;
            considerBusiness(k, v);
        }
        const bindings = { ...(entry.testDataBindings ?? {}) };
        let changed = false;
        // HEAL — bỏ binding self-referential (target == businessField) — kỹ thuật, không business.
        for (const [t, bf] of Object.entries(bindings)) {
            if (String(bf) === t) { delete bindings[t]; changed = true; }
        }
        // Thu thập input chưa map (bỏ setup env-bound — Login dùng LOGIN_*, không auto-map).
        // P0 RUNTIME FIX — dedupe: recording noise có thể FILL CÙNG input 2 lần ('text search'
        // 'Bộ' rồi 'text search' '...') — KHÔNG tính là 2 input (unique rule phải chạy được).
        const pending = [...new Set(
            (() => {
                const list = [];
                for (const ref of seq) {
                    const block = this.resolveBlock(workspaceId, ref.blockId) ?? null;
                    if (!block) continue;
                    for (const step of block.steps ?? []) {
                        if (String(step.actionType ?? "").toUpperCase() !== "FILL") continue;
                        const target = String(step.target ?? "").trim();
                        if (!target || bindings[target] || setupRe.test(target.toLowerCase())) continue;
                        list.push(target);
                    }
                }
                return list;
            })()
        )];
        for (const target of pending) {
            const nt = normalizeFieldName(target);
            let matched = null;
            for (const f of fieldNames) {
                const nf = normalizeFieldName(f);
                if (nf && (nf === nt || nf.includes(nt) || nt.includes(nf))) { matched = f; break; }
            }
            // Unique: CHỈ 1 input chưa map (non-setup, đã dedupe) và CHỈ 1 business field CÓ DATA
            // -> auto-map (không đoán: dữ liệu thật đơn trị; recorded không được thắng business data).
            if (!matched && pending.length === 1 && businessFieldsWithData.size === 1) matched = [...businessFieldsWithData][0];
            // P0 TC001 — KHÔNG tạo self-binding (target == businessField): binding tự thân vô nghĩa,
            // resolution field đã xử lý; tránh binding kỹ thuật làm nhiễu UI.
            if (matched && matched !== target) { bindings[target] = matched; changed = true; }
        }
        // HEAL — confirmed legacy keyed theo step.target -> business field khi có binding thật.
        const conf = entry.confirmedTestData ?? {};
        for (const [t, bf] of Object.entries(bindings)) {
            if (t === bf) continue;
            if (Object.prototype.hasOwnProperty.call(conf, t) && !Object.prototype.hasOwnProperty.call(conf, bf)) {
                conf[bf] = conf[t];
                delete conf[t];
                changed = true;
            }
        }
        // P0 LEGACY-INCLUDE-FIX — HEAL deterministic: stepDecisions từ kiến trúc mới CHỈ có
        // Ý NGHĨA EXCLUDE / REVIEW_REQUIRED. Xóa MỌI entry status === "INCLUDE" (UI pre-6b76241
        // từng viết INCLUDE + value — KHÔNG bao giờ được dùng làm nguồn Test Data).
        // TUYỆT ĐỐI giữ EXCLUDE. Chạy khi load/recompute (getWorkspace/generate/saveTestData).
        const decisions = entry.stepDecisions ?? {};
        for (const [k, d] of Object.entries(decisions)) {
            if (d?.status === "INCLUDE") {
                delete decisions[k];
                changed = true;
            }
        }
        if (changed) {
            entry.testDataBindings = bindings;
            entry.confirmedTestData = conf;
            entry.stepDecisions = decisions;
            const ws = this.workspace.get(workspaceId);
            if (ws) ws.updatedAt = new Date().toISOString();
            this.workspace.persist();
        }
        return bindings;
    }

    deleteWorkspace({ workspaceId }) {
        const removed = this.workspace?.remove?.(workspaceId) ?? false;
        if (!removed) fail(V3_ERRORS.WORKSPACE_NOT_FOUND, "Không tìm thấy workspace.");
        return { workspaceId, removed: true };
    }

    getWorkspace(workspaceId) {
        const ws = this.workspace.get(workspaceId);
        if (!ws) fail(V3_ERRORS.WORKSPACE_NOT_FOUND, "Không tìm thấy workspace.");
        // P0 — M = tổng approved có thể quản lý: snapshot (workspace mới) hoặc
        // selectedCount (workspace cũ thiếu snapshot) — không bao giờ 0 khi có testcase.
        const approvedTotal = (ws?.approvedTestCaseSnapshot ?? []).length || (ws?.selectedTestCases ?? []).length;
        // P0 — auto-bind evidence trước khi build DTO (editor/run hiển thị theo business field).
        for (const e of ws?.selectedTestCases ?? []) this.autoBindTestData(workspaceId, e.testCaseId);
        return {
            approvedTotal,
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
        // 6B — đọc recording qua binding (block.sourceRecordingId) — canonical; legacy fallback
        // (segments refs / allByTestCase) giữ compatibility cho dữ liệu 5C-0/5B cũ.
        this.migrateLegacySegments(workspaceId);
        const entry = this.workspace.getTestCase(workspaceId, testCaseId);
        const seq = (entry.binding?.sequence ?? []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
        let recordings;
        const seen = new Set();
        recordings = [];
        for (const ref of seq) {
            const block = this.resolveBlock(workspaceId, ref.blockId);
            if (!block?.sourceRecordingId) continue;
            const rec = this.store?.getRaw(block.sourceRecordingId);
            if (rec && !seen.has(rec.recordingId)) {
                seen.add(rec.recordingId);
                recordings.push(rec);
            }
        }
        // Legacy 5C-0: segments refs chưa migrate (nếu binding rỗng).
        if (recordings.length === 0) {
            for (const ref of this.workspace.getSegmentRefs(workspaceId, testCaseId)) {
                const rec = this.store?.getRaw(ref.recordingId);
                if (rec && !seen.has(rec.recordingId)) {
                    seen.add(rec.recordingId);
                    recordings.push(rec);
                }
            }
        }
        // Legacy 5B: recording gắn thẳng testCaseId.
        if (recordings.length === 0) {
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

    /* ============================== B3. ActionBlock + Binding (6B — CANONICAL) ============================== */

    /**
     * 6B — Migration deterministic: Segment 5C legacy → ActionBlock + Binding.
     * Mỗi segment ref (entry.segments) → 1 ActionBlock PRIVATE (snapshot steps từ recording)
     * + binding.sequence theo đúng thứ tự cũ. Idempotent (chạy 1 lần / workspace trong session).
     * Segment chỉ còn là legacy compatibility INPUT — canonical sau 6B là ActionBlock + Binding.
     */
    migrateLegacySegments(workspaceId) {
        const ws = this.workspace?.get(workspaceId);
        if (!ws) return;
        // Idempotent theo từng entry: chỉ migrate khi entry CÓ segments legacy và CHƯA có binding.
        for (const entry of ws.selectedTestCases ?? []) {
            const refs = (entry.segments ?? []).slice().sort((a, b) => (a.orderInTestCase || 0) - (b.orderInTestCase || 0));
            if (refs.length === 0) continue;
            if ((entry.binding?.sequence ?? []).length > 0) continue;
            const seq = [];
            for (const ref of refs) {
                const seg = this.store?.getSegment(ref.recordingId, ref.segmentId) ?? null;
                if (!seg) continue;
                const raw = this.store?.getRaw(ref.recordingId) ?? null;
                const steps = this.sliceSteps(raw?.steps ?? [], seg.startStep, seg.endStep);
                if (steps.length === 0) continue;
                const block = this.workspace.addActionBlock(workspaceId, {
                    sourceRecordingId: ref.recordingId,
                    label: null,
                    scope: "PRIVATE",
                    kind: seg.type === "SETUP" ? "SETUP" : "ACTION",
                    steps,
                    sourceRange: { startStep: seg.startStep, endStep: seg.endStep },
                    status: seg.status === "CONFIRMED" ? "CONFIRMED" : "DRAFT",
                    confirmedAt: seg.confirmedAt ?? null,
                    confirmedBy: seg.confirmedBy ?? null
                });
                if (block) seq.push({ blockId: block.blockId, order: ref.orderInTestCase ?? seq.length + 1 });
            }
            if (seq.length > 0) this.workspace.setBinding(workspaceId, entry.testCaseId, seq);
        }
    }

    /** Tạo ActionBlock (SNAPSHOT steps) — scope PRIVATE mặc định; REUSABLE bắt buộc label. KHÔNG tự gán testcase. */
    createBlock({ workspaceId, recordingId, startStep, endStep, label = null, scope = "PRIVATE", kind = "ACTION" }) {
        this.ensureWorkspace(workspaceId);
        const rec = this.store?.getRaw(recordingId);
        if (!rec || rec.workspaceId !== workspaceId) fail(V3_ERRORS.RECORDING_NOT_FOUND, "Không tìm thấy bản ghi.");
        const blockScope = String(scope ?? "PRIVATE").toUpperCase() === "REUSABLE" ? "REUSABLE" : "PRIVATE";
        const blockKind = String(kind ?? "ACTION").toUpperCase() === "SETUP" ? "SETUP" : "ACTION";
        if (blockScope === "REUSABLE" && !String(label ?? "").trim()) {
            fail(V3_ERRORS.INVALID_REQUEST, "Thao tác dùng lại bắt buộc đặt tên.");
        }
        this.assertRangeValid(rec.steps, startStep, endStep);
        const steps = this.sliceSteps(rec.steps, startStep, endStep);
        if (steps.length === 0) fail(V3_ERRORS.SEGMENT_INVALID, "Khoảng bước không hợp lệ.");
        // 6C.2 — snapshot recorded assertions thuộc phạm vi source của block (theo SOURCE POSITION, không theo step index).
        const recordedAssertions = this.recordedAssertionsInRange(rec, startStep, endStep);
        const block = this.workspace.addActionBlock(workspaceId, {
            sourceRecordingId: recordingId,
            label: String(label ?? "").trim() || null,
            scope: blockScope,
            kind: blockKind,
            steps,
            recordedAssertions,
            sourceRange: { startStep, endStep }
        });
        return this.blockDto(block);
    }

    /** Sửa ActionBlock — đổi range → re-snapshot; mọi thay đổi → DRAFT + version++ (tester xác nhận lại). */
    updateBlock({ workspaceId, blockId, label, scope, kind, startStep, endStep }) {
        this.ensureWorkspace(workspaceId);
        const block = this.workspace.getActionBlock(workspaceId, blockId);
        if (!block) fail(V3_ERRORS.BLOCK_NOT_FOUND, "Không tìm thấy thao tác.");
        const nextScope = scope !== undefined ? (String(scope).toUpperCase() === "REUSABLE" ? "REUSABLE" : "PRIVATE") : block.scope;
        const nextKind = kind !== undefined ? (String(kind).toUpperCase() === "SETUP" ? "SETUP" : "ACTION") : block.kind;
        const nextLabel = label !== undefined ? String(label).trim() : block.label;
        if (nextScope === "REUSABLE" && !nextLabel) fail(V3_ERRORS.INVALID_REQUEST, "Thao tác dùng lại bắt buộc đặt tên.");

        let steps = block.steps;
        let recordedAssertions = block.recordedAssertions;
        let sourceRange = block.sourceRange;
        if (Number.isInteger(startStep) && Number.isInteger(endStep)) {
            const rec = block.sourceRecordingId ? this.store?.getRaw(block.sourceRecordingId) : null;
            if (!rec) fail(V3_ERRORS.RECORDING_NOT_FOUND, "Không tìm thấy bản ghi nguồn để cập nhật phạm vi.");
            this.assertRangeValid(rec.steps, startStep, endStep);
            steps = this.sliceSteps(rec.steps, startStep, endStep);
            recordedAssertions = this.recordedAssertionsInRange(rec, startStep, endStep);
            sourceRange = { startStep, endStep };
        }
        const updated = this.workspace.updateActionBlock(workspaceId, blockId, { label: nextLabel, scope: nextScope, kind: nextKind, steps, recordedAssertions, sourceRange });
        return this.blockDto(updated);
    }

    /** Xác nhận ActionBlock (DRAFT → CONFIRMED) — tester là người quyết định. */
    confirmBlock({ workspaceId, blockId }) {
        this.ensureWorkspace(workspaceId);
        const block = this.workspace.getActionBlock(workspaceId, blockId);
        if (!block) fail(V3_ERRORS.BLOCK_NOT_FOUND, "Không tìm thấy thao tác.");
        const updated = this.workspace.confirmActionBlock(workspaceId, blockId);
        return this.blockDto(updated);
    }

    /** Xóa ActionBlock + gỡ khỏi mọi binding. */
    deleteBlock({ workspaceId, blockId }) {
        this.ensureWorkspace(workspaceId);
        const block = this.workspace.getActionBlock(workspaceId, blockId);
        if (!block) fail(V3_ERRORS.BLOCK_NOT_FOUND, "Không tìm thấy thao tác.");
        this.workspace.removeActionBlock(workspaceId, blockId);
        return { blockId, deleted: true };
    }

    /** Bind block vào binding của testcase (append — tester-owned order). */
    bindBlock({ workspaceId, testCaseId, blockId }) {
        this.ensureTestCase(workspaceId, testCaseId);
        const block = this.workspace.getActionBlock(workspaceId, blockId);
        if (!block) fail(V3_ERRORS.BLOCK_NOT_FOUND, "Không tìm thấy thao tác.");
        if (block.workspaceId !== workspaceId) fail(V3_ERRORS.BLOCK_NOT_FOUND, "Thao tác không thuộc workspace này.");
        const binding = this.workspace.bindBlockToTestCase(workspaceId, testCaseId, blockId);
        // Có block CONFIRMED trong binding → testcase tự chuyển "Có automation" (giữ hành vi 5C-0).
        if (block.status === "CONFIRMED") {
            this.workspace.setAutomationDecision(workspaceId, testCaseId, "AUTOMATED");
        }
        return this.bindingDto(workspaceId, testCaseId, binding);
    }

    /** Gỡ block khỏi binding — truyền order để xóa đúng 1 occurrence (D→E→D); không truyền = xóa tất cả. */
    unbindBlock({ workspaceId, testCaseId, blockId, order = null }) {
        this.ensureTestCase(workspaceId, testCaseId);
        const binding = this.workspace.unbindBlockFromTestCase(workspaceId, testCaseId, blockId, Number.isInteger(order) ? order : null);
        return this.bindingDto(workspaceId, testCaseId, binding);
    }

    /** Sắp xếp lại sequence (↑/↓) — Generate dùng đúng thứ tự này. */
    reorderBinding({ workspaceId, testCaseId, blockIds }) {
        this.ensureTestCase(workspaceId, testCaseId);
        const current = this.workspace.getBinding(workspaceId, testCaseId);
        if (!Array.isArray(blockIds) || blockIds.length !== (current?.sequence ?? []).length || blockIds.length === 0) {
            fail(V3_ERRORS.INVALID_REQUEST, "Danh sách thứ tự thao tác không hợp lệ.");
        }
        const binding = this.workspace.reorderBinding(workspaceId, testCaseId, blockIds);
        if (!binding) fail(V3_ERRORS.INVALID_REQUEST, "Không sắp xếp được thao tác.");
        return this.bindingDto(workspaceId, testCaseId, binding);
    }

    /** Lấy binding hiện tại (sequence + thông tin block). */
    getBinding({ workspaceId, testCaseId }) {
        this.ensureTestCase(workspaceId, testCaseId);
        this.migrateLegacySegments(workspaceId);
        return this.bindingDto(workspaceId, testCaseId, this.workspace.getBinding(workspaceId, testCaseId));
    }

    /** Reverse dependency: blockId → testCaseIds[] (deterministic, derive từ bindings). */
    getBlockUsage({ workspaceId, blockId }) {
        this.ensureWorkspace(workspaceId);
        this.migrateLegacySegments(workspaceId);
        const block = this.workspace.getActionBlock(workspaceId, blockId);
        if (!block) fail(V3_ERRORS.BLOCK_NOT_FOUND, "Không tìm thấy thao tác.");
        return { blockId, testCaseIds: this.workspace.getBlockUsage(workspaceId, blockId) };
    }

    /** DTO block (không lộ field nội bộ). Kèm steps sanitized để UI "Xem" expanded. */
    blockDto(b) {
        return {
            blockId: b.blockId,
            workspaceId: b.workspaceId ?? null,
            sourceRecordingId: b.sourceRecordingId,
            label: b.label ?? null,
            groupName: b.groupName ?? null,
            scope: b.scope ?? (String(b.blockId ?? "").startsWith("LIB-") ? "REUSABLE" : "PRIVATE"),
            kind: b.kind,
            startStep: b.sourceRange?.startStep ?? null,
            endStep: b.sourceRange?.endStep ?? null,
            sourceRange: b.sourceRange ?? null,
            stepCount: (b.steps ?? []).length,
            steps: (b.steps ?? []).map(s => ({
                order: s.order,
                actionType: s.actionType,
                locator: s.locator,
                target: s.target,
                recordedValue: s.sensitive ? "••••" : (s.recordedValue ?? "")
            })),
            recordedAssertionCount: (b.recordedAssertions ?? []).length,
            recordedAssertions: (b.recordedAssertions ?? []).map(a => ({
                order: a.order,
                statement: a.statement ?? "",
                locator: a.locator ?? null,
                matcher: a.matcher ?? null,
                expected: a.expected ?? null,
                sourceLine: a.sourceLine ?? null
            })),
            status: b.status,
            version: b.version,
            hash: b.hash ?? null,
            confirmedAt: b.confirmedAt ?? null,
            confirmedBy: b.confirmedBy ?? null,
            createdAt: b.createdAt,
            updatedAt: b.updatedAt
        };
    }

    /** Boundary — resolve block từ workspace (compatibility) hoặc Action Library (LIB-* shared asset). */
    resolveBlock(workspaceId, blockId) {
        const b = this.workspace.getActionBlock(workspaceId, blockId) ?? null;
        if (b) return b;
        if (String(blockId ?? "").startsWith("LIB-")) return this.actionLibrary?.get(blockId) ?? null;
        return null;
    }

    /* ================= B5. ACTION LIBRARY (Boundary — shared asset, MVP) ================= */

    /** Tester chủ động LƯU thao tác vào Thư viện (REUSABLE, bắt buộc label). KHÔNG tự lưu. */
    saveToLibrary({ workspaceId, blockId, label }) {
        this.ensureWorkspace(workspaceId);
        const block = this.workspace.getActionBlock(workspaceId, blockId);
        if (!block) fail(V3_ERRORS.BLOCK_NOT_FOUND, "Không tìm thấy thao tác.");
        if (!this.actionLibrary) fail(V3_ERRORS.INVALID_REQUEST, "Action Library chưa được cấu hình.");
        // Copy snapshot từ block hiện tại (không di chuyển — block workspace giữ nguyên compatibility).
        let saved;
        try {
            saved = this.actionLibrary.addBlock({
                label: label ?? block.label ?? "",
                kind: block.kind,
                steps: block.steps,
                recordedAssertions: block.recordedAssertions,
                sourceRecordingId: block.sourceRecordingId,
                sourceRange: block.sourceRange
            });
        } catch (e) {
            fail(V3_ERRORS.BLOCK_LABEL_REQUIRED, e?.message ?? "Thiếu tên thao tác.");
        }
        return this.libraryBlockDto(saved);
    }

    /** Danh sách thao tác trong Library (kèm usage derive từ bindings của MỌI workspace). */
    listLibrary({ workspaceId }) {
        this.ensureWorkspace(workspaceId);
        const blocks = this.actionLibrary ? this.actionLibrary.list() : [];
        const usage = this.countLibraryUsage();
        return blocks.map(b => this.libraryBlockDto(b, usage.get(b.blockId) ?? 0));
    }

    /** Dùng thao tác từ Library cho testcase (bind). */
    bindLibraryBlock({ workspaceId, testCaseId, blockId }) {
        this.ensureTestCase(workspaceId, testCaseId);
        const lib = this.actionLibrary?.get(blockId);
        if (!lib) fail(V3_ERRORS.BLOCK_NOT_FOUND, "Không tìm thấy thao tác trong thư viện.");
        if (lib.status !== "CONFIRMED") fail(V3_ERRORS.BLOCK_NOT_CONFIRMED, "Thao tác thư viện chưa được xác nhận.");
        const binding = this.workspace.bindBlockToTestCase(workspaceId, testCaseId, blockId);
        // P0-D (B) — bind Library action ĐẦU TIÊN là mốc thể hiện ý định làm automation:
        // UNDECIDED -> AUTOMATED (giống bindBlock 5C-0). Generate/Run KHÔNG hạ decision.
        this.workspace.setAutomationDecision(workspaceId, testCaseId, "AUTOMATED");
        return this.bindingDto(workspaceId, testCaseId, binding);
    }

    /** Đếm usage cho từng block Library (derive từ bindings mọi workspace — KHÔNG lưu source of truth). */
    countLibraryUsage() {
        const map = new Map();
        for (const w of this.workspace?.list?.() ?? []) {
            const ws = this.workspace.get(w.workspaceId);
            for (const entry of ws?.selectedTestCases ?? []) {
                for (const ref of entry.binding?.sequence ?? []) {
                    map.set(ref.blockId, (map.get(ref.blockId) || 0) + 1);
                }
            }
        }
        return map;
    }

    /** DTO block Library (không lộ nội bộ; kèm usage đã derive). */
    libraryBlockDto(b, usedByTestCases = 0) {
        return {
            ...this.blockDto(b),
            usedByTestCases
        };
    }

    /** 6C — Danh sách block (library). reusableOnly=true → chỉ REUSABLE; kèm reverse dependency. */
    listBlocks({ workspaceId, reusableOnly = false }) {
        this.ensureWorkspace(workspaceId);
        return this.workspace
            .getActionBlocks(workspaceId)
            .filter(b => !reusableOnly || b.scope === "REUSABLE")
            .map(b => ({
                ...this.blockDto(b),
                usedByTestCases: this.workspace.getBlockUsage(workspaceId, b.blockId)
            }));
    }

    /** DTO binding: sequence + block chi tiết theo đúng thứ tự. */
    bindingDto(workspaceId, testCaseId, binding) {
        const seq = (binding?.sequence ?? []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
        const items = seq.map(ref => {
            const b = this.resolveBlock(workspaceId, ref.blockId);
            return b ? { ...this.blockDto(b), order: ref.order } : null;
        }).filter(Boolean);
        return { testCaseId, sequence: items };
    }

    /** Steps thuộc khoảng order [startStep..endStep] của recording. */
    sliceSteps(steps, startStep, endStep) {
        return (Array.isArray(steps) ? steps : [])
            .filter(s => Number.isInteger(s?.order) && s.order >= startStep && s.order <= endStep);
    }

    /**
     * 6C.2 — Recorded assertions thuộc phạm vi source tester chọn.
     * Rule deterministic (KHÔNG dùng step index):
     *   - Assertion có sourceStart/sourceEnd nằm TRONG [rangeSourceStart, rangeSourceEnd] → thuộc.
     *   - Assertion ngay SAU step cuối (sourceStart nằm trong khoảng [endSourceStart, endSourceEnd + trailing gap]) → kèm theo (expect nằm ngay sau action cuối).
     *   - Assertion XA phía sau (ngoài trailing window) → KHÔNG thuộc.
     * Trailing window: 0 → chỉ assertion nằm sát ngay sau (≤ 120 ký tự / cùng dòng liền kề).
     */
    recordedAssertionsInRange(rec, startStep, endStep) {
        const steps = Array.isArray(rec?.steps) ? rec.steps : [];
        const assertions = Array.isArray(rec?.assertions) ? rec.assertions : [];
        if (assertions.length === 0) return [];
        const selSteps = steps.filter(s => Number.isInteger(s?.order) && s.order >= startStep && s.order <= endStep);
        if (selSteps.length === 0) return [];
        const firstSourceStart = Math.min(...selSteps.map(s => s.sourceStart ?? Infinity));
        const lastSourceStart = Math.min(...selSteps.map(s => s.sourceStart ?? Infinity));
        const lastSourceEnd = Math.max(...selSteps.map(s => s.sourceEnd ?? 0));
        const TRAILING = 120; // ký tự cho phép giữa action cuối và expect liền sau

        return assertions
            .filter(a => {
                const as = a.sourceStart ?? -1;
                const ae = a.sourceEnd ?? -1;
                // Trong phạm vi steps đã chọn (source overlap).
                if (as >= firstSourceStart && ae <= lastSourceEnd) return true;
                // Ngay sau step cuối (expect liền sau action cuối — thường cùng khối).
                if (as >= lastSourceStart && as <= lastSourceEnd + TRAILING) return true;
                return false;
            })
            .map(a => ({
                order: a.order,
                statement: a.statement ?? "",
                locator: a.locator ?? null,
                matcher: a.matcher ?? null,
                expected: a.expected ?? null,
                sourceStart: a.sourceStart ?? null,
                sourceEnd: a.sourceEnd ?? null,
                sourceLine: a.sourceLine ?? null
            }));
    }

    /* ============================== C. Assertions ============================== */

    saveDraftAssertion({ workspaceId, testCaseId, assertion = {} }) {
        this.ensureTestCase(workspaceId, testCaseId);
        const entry = this.workspace.getTestCase(workspaceId, testCaseId);
        const current = Array.isArray(entry.automationAssertions) ? entry.automationAssertions : [];
        // P0-C — duplicate condition: không dedupe theo label; dùng identity matcher|locator|expected.
        const identityKey = `${String(assertion.matcher ?? "").trim()}|${String(assertion.locator ?? "").trim()}|${String(assertion.expected ?? "")}`;
        const dup = current.find(a => a.status !== "REJECTED"
            && `${String(a.matcher ?? "").trim()}|${String(a.locator ?? "").trim()}|${String(a.expected ?? "")}` === identityKey);
        if (dup) {
            fail(V3_ERRORS.ASSERTION_DUPLICATE, "Điều kiện kiểm tra này đã được thêm.");
        }
        // 6C.2 — recorded candidate được tester XÁC NHẬN → lưu thẳng TESTER_CONFIRMED (source=RECORDED);
        // thêm tay / đề xuất → DRAFT (vẫn cần xác nhận). Không cho status khác lọt vào.
        const requestedStatus = String(assertion.status ?? "DRAFT").toUpperCase();
        const status = requestedStatus === "TESTER_CONFIRMED" ? "TESTER_CONFIRMED" : "DRAFT";
        const draft = {
            id: assertion.id ?? newAssertionId(),
            testCaseId,
            type: String(assertion.type ?? "").trim(),
            target: String(assertion.target ?? "").trim(),
            locator: String(assertion.locator ?? "").trim(),
            expected: assertion.expected,
            matcher: String(assertion.matcher ?? "").trim(),
            source: String(assertion.source ?? "TESTER_INPUT").trim(),
            status,
            confirmedAt: status === "TESTER_CONFIRMED" ? new Date().toISOString() : null
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
    /** P0-A — Lưu Test Data tester edit cho lần automation (persist trong workspace,
     *  KHÔNG ghi ngược approved-testcases.json). Shape: { "<field>": "<value>" }. */
    saveTestData({ workspaceId, testCaseId, testData = null, bindings = null }) {
        this.ensureTestCase(workspaceId, testCaseId);
        // P0 TC001 — canonical semantics: entry có thể là string cũ (non-empty = VALUE; "" = UNRESOLVED)
        // hoặc object { value, intent } (intent: "VALUE" | "EMPTY" — EMPTY = xác nhận để trống).
        const normalized = testData && typeof testData === "object"
            ? Object.fromEntries(Object.entries(testData).map(([k, v]) => {
                if (v && typeof v === "object" && !Array.isArray(v)) {
                    const value = v.value === undefined || v.value === null ? "" : String(v.value);
                    const intent = String(v.intent ?? "").toUpperCase() === "EMPTY" ? "EMPTY" : "VALUE";
                    return [k, { value, intent }];
                }
                return [k, String(v ?? "")];
            }))
            : {};
        // P0 — canonical binding { stepTarget: businessField } (tester-owned; không AI tự quyết).
        this.workspace.saveTestData(workspaceId, testCaseId, normalized, bindings);
        // P0 422-LIFECYCLE (fix) — Test Data thay đổi → RECOMPUTE derived state NGAY tại save
        // (auto-bind + heal confirmed). Trước đây chỉ bind/re-add Action (qua getWorkspace) làm
        // việc này — bất đối xứng: save data xong rồi Generate vẫn có thể thấy binding cũ/thiếu
        // → 422 TESTDATA_UNRESOLVED dù tester đã nhập đủ. Tester KHÔNG phải remove/re-add Action.
        this.autoBindTestData(workspaceId, testCaseId);
        return this.toItem(this.workspace.getTestCase(workspaceId, testCaseId), workspaceId);
    }

    /** P0 — STEP DECISION: tester quyết định step (INCLUDE + data / EXCLUDE / REVIEW_REQUIRED).
     *  Chỉ áp dụng workspace/testcase hiện tại — KHÔNG mutate Action Library. Guard: lấy
     *  locator/actionType từ block step THẬT (không tin client). */
    saveStepDecision({ workspaceId, testCaseId, blockId, stepOrder, decision, value, intent }) {
        this.ensureTestCase(workspaceId, testCaseId);
        const status = String(decision ?? "").toUpperCase();
        if (!["INCLUDE", "EXCLUDE", "REVIEW_REQUIRED"].includes(status)) {
            fail(V3_ERRORS.INVALID_REQUEST, "Quyết định không hợp lệ (INCLUDE | EXCLUDE | REVIEW_REQUIRED).");
        }
        const block = this.resolveBlock(workspaceId, String(blockId ?? ""));
        if (!block) fail(V3_ERRORS.BLOCK_NOT_FOUND, "Không tìm thấy thao tác.");
        const step = (block.steps ?? []).find(s => s.order === Number(stepOrder));
        if (!step) fail(V3_ERRORS.INVALID_REQUEST, `Không tìm thấy bước ${stepOrder} trong thao tác '${block.label ?? blockId}'.`);
        let normValue = "";
        let normIntent = "";
        if (status === "INCLUDE") {
            normValue = value === undefined || value === null ? "" : String(value);
            normIntent = String(intent ?? "").toUpperCase() === "EMPTY" ? "EMPTY" : "VALUE";
        }
        this.workspace.saveStepDecision(workspaceId, testCaseId, {
            blockId: String(blockId),
            stepOrder: Number(stepOrder),
            status: status === "REVIEW_REQUIRED" ? null : status,
            value: normValue,
            intent: normIntent,
            locator: String(step.locator ?? ""),
            actionType: String(step.actionType ?? "")
        });
        return this.toItem(this.workspace.getTestCase(workspaceId, testCaseId), workspaceId);
    }

    updateExpectedResult({ workspaceId, testCaseId, expectedResult }) {
        this.ensureTestCase(workspaceId, testCaseId);
        const entry = this.workspace.saveExpectedResult(workspaceId, testCaseId, expectedResult);
        if (!entry) fail(V3_ERRORS.TESTCASE_NOT_FOUND, "Không tìm thấy testcase.");
        return this.toItem(entry, workspaceId);
    }

    /** Đề xuất điều kiện xác nhận (deterministic, KHÔNG AI) — Expected Result do tester sở hữu. */
    suggestAssertionsForTestcase({ workspaceId, testCaseId }) {
        this.ensureTestCase(workspaceId, testCaseId);
        this.migrateLegacySegments(workspaceId);
        const expectedResult = this.workspace.effectiveExpectedResult(workspaceId, testCaseId);
        const steps = this.collectTestCaseSteps(workspaceId, testCaseId);
        return {
            testCaseId,
            expectedResult,
            suggestions: suggestAssertions({ expectedResult, steps }),
            // 6C.2 — recorded verification (tester đã đánh dấu trong Playwright recording) = CANDIDATE.
            // KHÔNG tự kết luận = Expected Result; KHÔNG TESTER_CONFIRMED; tester phải xác nhận.
            recordedCandidates: this.recordedCandidatesForTestcase(workspaceId, testCaseId)
        };
    }

    /** 6C.2 — Recorded assertion candidates từ các block trong binding (snapshot recordedAssertions). */
    recordedCandidatesForTestcase(workspaceId, testCaseId) {
        const entry = this.workspace.getTestCase(workspaceId, testCaseId);
        const seq = (entry?.binding?.sequence ?? []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
        const candidates = [];
        const seen = new Set();
        // P0-C runtime bug — candidate da duoc them (ton tai trong automationAssertions,
        // khong REJECTED) KHONG duoc tra lai -> tranh 400 ASSERTION_DUPLICATE khi
        // tester bam [Xac nhan] lan 2.
        const existing = new Set(
            (entry?.automationAssertions ?? [])
                .filter(a => a.status !== "REJECTED")
                .map(a => `${String(a.matcher ?? "").trim()}|${String(a.locator ?? "").trim()}|${String(a.expected ?? "")}`)
        );
        for (const ref of seq) {
            // P0-B — resolveBlock (workspace + LIB-* fallback): selected action từ Action Library
            // cũng phải đóng góp recordedAssertions làm evidence (trước đây bỏ sót LIB blocks).
            const block = this.resolveBlock(workspaceId, ref.blockId) ?? null;
            if (!block) continue;
            for (const a of block.recordedAssertions ?? []) {
                const key = `${a.matcher}|${a.locator}`;
                if (seen.has(key)) continue;
                seen.add(key);
                const identity = `${String(a.matcher ?? "").trim()}|${String(a.locator ?? "").trim()}|${String(a.expected ?? this.recordedAssertionTarget(a) ?? "")}`;
                if (existing.has(identity)) continue; // da them -> khong hien lai
                candidates.push({
                    id: `RC-${block.blockId}-${a.order}`,
                    type: this.recordedAssertionType(a),
                    target: this.recordedAssertionTarget(a),
                    locator: a.locator ?? null,
                    expected: a.expected ?? this.recordedAssertionTarget(a),
                    matcher: a.matcher ?? "toBeVisible",
                    source: "RECORDED",
                    status: "SUGGESTED",
                    reason: "Nguồn: Playwright recording",
                    blockId: block.blockId,
                    // P0-B — hiển thị rõ nguồn ACTION của candidate (selected action trong binding).
                    actionLabel: block.label ?? `Bước ${block.sourceRange?.startStep ?? "?"}→${block.sourceRange?.endStep ?? "?"}`,
                    statement: a.statement ?? ""
                });
            }
        }
        return candidates;
    }

    /** Map recorded assertion → type (đồng bộ contract assertion). */
    recordedAssertionType(a) {
        const m = String(a.matcher ?? "");
        if (m === "toHaveURL") return "URL";
        if (m === "toHaveValue") return "VALUE_EQUALS";
        if (m === "toBeDisabled") return "ATTRIBUTE";
        if (m === "toHaveCount") return "COUNT";
        return "TEXT_VISIBLE"; // toBeVisible / toBeHidden / mặc định
    }

    /** Trích target nghiệp vụ từ locator (getByRole name / getByText / label). */
    recordedAssertionTarget(a) {
        const loc = String(a.locator ?? a.statement ?? "");
        const mRole = loc.match(/getByRole\([^,]+,\s*\{\s*name:\s*['"]([^'"]+)['"]/);
        if (mRole) return mRole[1];
        const mText = loc.match(/getByText\(\s*['"]([^'"]+)['"]\s*\)/);
        if (mText) return mText[1];
        const mLabel = loc.match(/getByLabel\(\s*['"]([^'"]+)['"]\s*\)/);
        if (mLabel) return mLabel[1];
        return "phần tử đã chọn";
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
        this.migrateLegacySegments(workspaceId);
        const entry = this.workspace.getTestCase(workspaceId, testCaseId);
        if (!entry.selectedForAutomation) {
            fail(V3_ERRORS.TESTCASE_NOT_SELECTED, "Testcase chưa được chọn để automation.");
        }
        // ===== 6B — Pre-check TestCaseAutomationBinding (CANONICAL) =====
        // Sequence do tester xác nhận (blockId + order) — không theo thứ tự/index/recording.
        const seq = (entry.binding?.sequence ?? []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
        let blocksPayload = null;
        if (seq.length > 0) {
            for (const ref of seq) {
                const block = this.resolveBlock(workspaceId, ref.blockId);
                if (!block) {
                    fail(V3_ERRORS.SEGMENT_MAPPING_INVALID, "Chưa xác định đầy đủ đoạn thao tác cho testcase.");
                }
                if (block.status !== "CONFIRMED") {
                    // 6C.1 — nói rõ thao tác nào chưa xác nhận (không dùng chữ 'Nháp' mơ hồ).
                    const name = block.label || entry.title || "thao tác";
                    fail(V3_ERRORS.SEGMENT_NOT_CONFIRMED, `Thao tác '${name}' chưa được xác nhận.`);
                }
            }
            blocksPayload = seq;
        } else {
            // Legacy 5B (tương thích dữ liệu cũ): recording APPROVED gắn thẳng testCaseId.
            const approved = (this.store?.allByTestCase(testCaseId) ?? []).filter(r => r.status === "APPROVED");
            if (approved.length === 0) {
                fail(V3_ERRORS.RECORDING_MAPPING_REQUIRED, "Không có bản ghi thao tác cho testcase này.");
            }
        }
        // Assertion phải có TESTER_CONFIRMED.
        // P0 — auto-bind evidence trước generate (binding mới từ tên khớp được dùng).
        this.autoBindTestData(workspaceId, testCaseId);
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
                testDataBindings: entry.testDataBindings ?? {},
                confirmedAssertions,
                segments: blocksPayload
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
            // P0 422-LIFECYCLE — structured: danh sách field gây block (UI/API không đoán).
            if (Array.isArray(result?.unresolvedFields)) {
                error.details = { unresolvedFields: result.unresolvedFields };
            }
            throw error;
        }
        return {
            status: "GENERATED",
            testCaseId,
            outputPath: result.outputPath,
            // P0-A — trả code string (cho UI Xem mã / test fidelity); P0-D sẽ dùng cho Lưu file.
            code: result.code ?? "",
            metadata: result.metadata,
            runtimeEnvKeys: Object.keys(result.runtimeEnv ?? {}),
            validation: result.validation
        };
    }

    /** P0-C — Chạy thử testcase đang mở: dùng ĐÚNG generated artifact (không generate ngầm).
     *  Nếu fingerprint hiện tại ≠ fingerprint lúc Generate → stale → chặn, yêu cầu Generate lại. */
    async runTestcase({ workspaceId, testCaseId, env = {} }) {
        this.ensureTestCase(workspaceId, testCaseId);
        const entry = this.workspace.getTestCase(workspaceId, testCaseId);
        if (entry.generateStatus !== "GENERATED" || !entry.generatedFile) {
            fail(V3_ERRORS.NOT_GENERATED, "Chưa có script. Hãy Sinh Playwright trước khi chạy thử.");
        }
        const current = this.generateService?.buildFingerprint?.({ workspaceId, testCaseId }) ?? null;
        if (current && entry.generatedFingerprint && current !== entry.generatedFingerprint) {
            fail(V3_ERRORS.STALE_GENERATED, "Testcase/action/data/điều kiện đã thay đổi sau lần Generate. Hãy Sinh lại rồi chạy thử.");
        }
        if (!this.runner) fail(V3_ERRORS.RUNNER_NOT_AVAILABLE, "Runner chưa sẵn sàng trong môi trường này.");
        const result = await this.runner.runFile(entry.generatedFile, { env, testCaseId });
        // P0-D (B) — runStatus enum: NOT_RUN | PASSED | FAILED (+ DIAGNOSTIC/ERROR khi chưa chạy được).
        // P0 RUNTIME FIX — runner thật trả status "PASSED"/"FAILED" (Playwright convention);
        // stub/test cũ trả "PASS"/"FAIL" — normalize CẢ HAI để `passed` luôn đúng.
        const raw = String(result?.status ?? "ERROR").toUpperCase();
        const passed = raw === "PASS" || raw === "PASSED";
        const status = passed ? "PASSED" : (raw === "FAIL" || raw === "FAILED" ? "FAILED" : raw);
        this.workspace.transition(workspaceId, testCaseId, {
            runStatus: status,
            lastRun: {
                at: new Date().toISOString(),
                status,
                passed,
                error: result?.errorMessage ?? result?.diagnostic ?? result?.error ?? null,
                durationMs: result?.durationMs ?? null
            }
        });
        return {
            testCaseId,
            runStatus: status,
            passed,
            error: result?.errorMessage ?? result?.diagnostic ?? result?.error ?? null,
            durationMs: result?.durationMs ?? null,
            filePath: entry.generatedFile
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
        // 6B — migrate legacy segments → binding (canonical) trước khi đọc.
        this.migrateLegacySegments(workspaceId);
        const recs = (this.store?.allByTestCase(entry.testCaseId) ?? [])
            .filter(r => r.status === "APPROVED")
            .sort((a, b) => (b.recordingVersion || 0) - (a.recordingVersion || 0));
        const rec = recs[0] ?? null;
        const assertions = entry.automationAssertions ?? [];
        // 6B — mapping qua TestCaseAutomationBinding (sequence blocks theo thứ tự tester).
        const seq = (entry.binding?.sequence ?? []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
        const segments = seq.map(ref => {
            const b = this.resolveBlock(workspaceId, ref.blockId);
            if (!b) return null;
            return {
                segmentId: b.blockId,
                recordingId: b.sourceRecordingId,
                orderInTestCase: ref.order,
                startStep: b.sourceRange?.startStep ?? null,
                endStep: b.sourceRange?.endStep ?? null,
                stepCount: (b.steps ?? []).length,
                type: b.kind,
                testCaseId: entry.testCaseId,
                status: b.status,
                label: b.label ?? null,
                scope: b.scope ?? "PRIVATE",
                recordedAssertionCount: (b.recordedAssertions ?? []).length,
                // KEY-FIX — inputs từ selected action: FILL steps → { field: target, recordedValue }.
                // Đây là key CHÍNH XÁC renderer sẽ lookup (step.target = accessible name từ locator);
                // Test Data editor phải dùng các key này để giá trị tester sửa thực sự tới được FILL.
                inputs: (b.steps ?? [])
                    .filter(s => String(s.actionType ?? "").toUpperCase() === "FILL" && String(s.target ?? "").trim())
                    .map(s => ({ field: String(s.target).trim(), recordedValue: s.recordedValue ?? "" })),
                // P0 — CẦN XÁC NHẬN THAO TÁC: steps sanitized để UI review area hiển thị
                // (locator/target/recorded sample của TỪNG step — không cần endpoint mới).
                steps: (b.steps ?? []).map(s => this.sanitizeStep(s))
            };
        }).filter(Boolean);
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
            // P0-A — Test Data fidelity: trả đúng approved test data của testcase (canonical = entry.approvedTestData)
            // và confirmedTestData (tester edit cho lần automation — persist riêng, KHÔNG sửa approved).
            testData: entry.approvedTestData ?? null,
            confirmedTestData: entry.confirmedTestData ?? null,
            testDataBindings: entry.testDataBindings ?? {},
            // P0 — STEP DECISION (workspace/testcase scope): { "<blockId>:<stepOrder>": { status, value, intent, locator, actionType } }
            stepDecisions: entry.stepDecisions ?? {},
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
            generatedFile: entry.generatedFile ?? null,
            generatedFingerprint: entry.generatedFingerprint ?? null,
            lastRun: entry.lastRun ?? null
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
