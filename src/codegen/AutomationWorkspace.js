import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

/*
 AutomationWorkspace — "bộ não" của Architecture V3 (Record by Testcase).

 - Lưu MỌI trạng thái automation (selectedForAutomation, recordingStatus,
   reviewStatus, generateStatus, runStatus) tách hẳn khỏi approved-testcases.json.
 - KHÔNG bao giờ sửa approved-testcases.json.
 - Mỗi testcase có vòng đời:
     NOT_SELECTED → SELECTED → RECORDING → RECORDED → UNDER_REVIEW → APPROVED
     → GENERATED → RUNNING → PASS / FAIL
 - GĐ1 = Mở Workspace (new / open / import / clone) — không phải "upload testcase".
*/

export const WORKSPACE_MODES = new Set(["NEW", "OPEN", "IMPORT", "CLONE"]);

export const TESTCASE_STATUS = {
    NOT_SELECTED: "NOT_SELECTED",
    SELECTED: "SELECTED",
    RECORDING: "RECORDING",
    RECORDED: "RECORDED",
    UNDER_REVIEW: "UNDER_REVIEW",
    APPROVED: "APPROVED",
    GENERATED: "GENERATED",
    RUNNING: "RUNNING",
    PASS: "PASS",
    FAIL: "FAIL"
};

function newWorkspaceId() {
    return `WS-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
}

export default class AutomationWorkspace {
    constructor({ metadataFile = null } = {}) {
        this.metadataFile =
            metadataFile ?? path.resolve("data", "automation-workspaces.json");
        this.ensureFile();
        this.workspaces = this.load();
    }

    ensureFile() {
        fs.mkdirSync(path.dirname(this.metadataFile), { recursive: true });
        if (!fs.existsSync(this.metadataFile)) {
            fs.writeFileSync(this.metadataFile, JSON.stringify({ version: 1, workspaces: [] }, null, 2), "utf8");
        }
    }

    load() {
        try {
            const data = JSON.parse(fs.readFileSync(this.metadataFile, "utf8"));
            return Array.isArray(data.workspaces) ? data.workspaces : [];
        } catch {
            return [];
        }
    }

    persist() {
        fs.mkdirSync(path.dirname(this.metadataFile), { recursive: true });
        fs.writeFileSync(this.metadataFile, JSON.stringify({ version: 1, workspaces: this.workspaces }, null, 2), "utf8");
    }

    /** Tạo Workspace mới từ danh sách testcase approved. */
    create({ sourceFile = null, mode = "NEW", module = "", testCases = [] } = {}) {
        const workspace = {
            workspaceId: newWorkspaceId(),
            source: {
                file: sourceFile,
                mode: WORKSPACE_MODES.has(String(mode).toUpperCase()) ? String(mode).toUpperCase() : "NEW",
                importedFrom: null
            },
            module: String(module ?? ""),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            selectedTestCases: (Array.isArray(testCases) ? testCases : []).map(tc => this.initTestCase(tc)),
            // 6B — ActionBlock library (canonical reusable automation artifact, snapshot steps).
            actionBlocks: []
        };
        this.workspaces.push(workspace);
        this.persist();
        return workspace;
    }

    /** Khởi tạo entry testcase trong workspace (trạng thái automation mặc định). */
    initTestCase(tc) {
        const id = String(tc?.id ?? tc?.testcaseId ?? "");
        return {
            testCaseId: id,
            title: String(tc?.title ?? tc?.scenario ?? "").trim(),
            module: String(tc?.module ?? "").trim(),
            type: String(tc?.type ?? "").trim(),
            // Snapshot testData từ approved (chỉ ĐỌC, không sửa approved-testcases.json) —
            // dùng cho Generate. Lưu trong workspace để restart vẫn load được.
            approvedTestData: tc?.testData && typeof tc?.testData === "object"
                ? tc.testData
                : (tc?.approvedTestData && typeof tc.approvedTestData === "object" ? tc.approvedTestData : null),
            // Trạng thái automation — tách hẳn khỏi approved-testcases.json
            selectedForAutomation: false,
            recordingStatus: "NOT_RECORDED",
            reviewStatus: "NOT_SELECTED",
            generateStatus: "NOT_GENERATED",
            runStatus: "NOT_RUN",
            recordingId: null,
            generatedFile: null,
            // P0-C — fingerprint tại thời điểm Generate (phát hiện stale khi testcase/action/data/assertion đổi).
            generatedFingerprint: null,
            lastRun: null,
            automationAssertions: [],
            // 5C-0 — Record Mapping (legacy compatibility): mapping segment → testcase (sẽ migrate sang binding ở 6B).
            automationDecision: "UNDECIDED", // UNDECIDED | MANUAL_ONLY | AUTOMATED
            segments: [], // [{ segmentId, recordingId, orderInTestCase }] — legacy 5C-0
            // 6B — TestCaseAutomationBinding (CANONICAL): sequence các ActionBlock theo THỨ TỰ tester xác nhận.
            binding: { sequence: [] }, // [{ blockId, order }]
            // 5C — Expected Result: bản gốc từ approved (chỉ đọc) + bản làm việc do tester sửa (workspace).
            expectedResult: String(tc?.expectedResult ?? "").trim(),
            expectedResultEdited: null
        };
    }

    get(workspaceId) {
        return this.workspaces.find(w => w.workspaceId === workspaceId) ?? null;
    }

    list() {
        return this.workspaces.map(w => ({
            workspaceId: w.workspaceId,
            module: w.module,
            source: w.source,
            createdAt: w.createdAt,
            updatedAt: w.updatedAt,
            selectedCount: (w.selectedTestCases ?? []).length
        }));
    }

    /** Chọn / bỏ chọn một testcase trong workspace. */
    /** P0-D (C) — Xóa workspace (chỉ state automation; KHÔNG đụng Action Library / approved / generated). */
    remove(workspaceId) {
        const idx = this.workspaces.findIndex(w => w.workspaceId === workspaceId);
        if (idx === -1) return false;
        this.workspaces.splice(idx, 1);
        this.persist();
        return true;
    }

    setSelected(workspaceId, testCaseId, selected) {
        const ws = this.get(workspaceId);
        if (!ws) return null;
        const entry = (ws.selectedTestCases ?? []).find(tc => tc.testCaseId === testCaseId);
        if (!entry) return null;
        entry.selectedForAutomation = Boolean(selected);
        entry.reviewStatus = selected ? "SELECTED" : "NOT_SELECTED";
        if (!selected) {
            entry.recordingStatus = "NOT_RECORDED";
            entry.generateStatus = "NOT_GENERATED";
            entry.runStatus = "NOT_RUN";
        }
        ws.updatedAt = new Date().toISOString();
        this.persist();
        return entry;
    }

    /** Lấy / cập nhật trạng thái testcase (trả về entry mới nhất). */
    getTestCase(workspaceId, testCaseId) {
        const ws = this.get(workspaceId);
        if (!ws) return null;
        return (ws.selectedTestCases ?? []).find(tc => tc.testCaseId === testCaseId) ?? null;
    }

    /** Đồng bộ các trạng thái theo vòng đời khi 1 bước hoàn tất. */
    transition(workspaceId, testCaseId, patch) {
        const ws = this.get(workspaceId);
        if (!ws) return null;
        const entry = (ws.selectedTestCases ?? []).find(tc => tc.testCaseId === testCaseId);
        if (!entry) return null;
        Object.assign(entry, patch);
        ws.updatedAt = new Date().toISOString();
        this.persist();
        return entry;
    }

    /** Lưu automationAssertions cho testcase (tách khỏi expectedResult gốc). */
    saveAssertions(workspaceId, testCaseId, assertions) {
        const ws = this.get(workspaceId);
        if (!ws) return null;
        const entry = (ws.selectedTestCases ?? []).find(tc => tc.testCaseId === testCaseId);
        if (!entry) return null;
        entry.automationAssertions = Array.isArray(assertions) ? assertions : [];
        ws.updatedAt = new Date().toISOString();
        this.persist();
        return entry;
    }

    /** Lưu confirmedTestData của tester (dữ liệu đã xác nhận) — lưu workspace, không sửa approved. */
    saveTestData(workspaceId, testCaseId, confirmedTestData) {
        const ws = this.get(workspaceId);
        if (!ws) return null;
        const entry = (ws.selectedTestCases ?? []).find(tc => tc.testCaseId === testCaseId);
        if (!entry) return null;
        entry.confirmedTestData = confirmedTestData && typeof confirmedTestData === "object"
            ? confirmedTestData
            : (entry.confirmedTestData ?? null);
        ws.updatedAt = new Date().toISOString();
        this.persist();
        return entry;
    }

    /* ================= 5C-0 — Record Mapping (segment ↔ testcase, tester-owned) ================= */

    /** Tester đặt trạng thái tự động hóa: UNDECIDED | MANUAL_ONLY | AUTOMATED. */
    setAutomationDecision(workspaceId, testCaseId, decision) {
        const ws = this.get(workspaceId);
        if (!ws) return null;
        const entry = (ws.selectedTestCases ?? []).find(tc => tc.testCaseId === testCaseId);
        if (!entry) return null;
        const d = String(decision ?? "UNDECIDED").toUpperCase();
        entry.automationDecision = ["UNDECIDED", "MANUAL_ONLY", "AUTOMATED"].includes(d) ? d : "UNDECIDED";
        ws.updatedAt = new Date().toISOString();
        this.persist();
        return entry;
    }

    /** Thêm tham chiếu segment cho testcase (mapping bằng segmentId — không theo thứ tự JSON/recording). */
    addSegmentRef(workspaceId, testCaseId, { segmentId = "", recordingId = "" } = {}) {
        const ws = this.get(workspaceId);
        if (!ws) return null;
        const entry = (ws.selectedTestCases ?? []).find(tc => tc.testCaseId === testCaseId);
        if (!entry) return null;
        entry.segments = Array.isArray(entry.segments) ? entry.segments : [];
        if (segmentId && !entry.segments.some(s => s.segmentId === segmentId)) {
            const maxOrder = entry.segments.reduce((m, s) => Math.max(m, s.orderInTestCase || 0), 0);
            entry.segments.push({ segmentId, recordingId, orderInTestCase: maxOrder + 1 });
        }
        ws.updatedAt = new Date().toISOString();
        this.persist();
        return entry;
    }

    /** Gỡ tham chiếu segment khỏi testcase (khi xóa segment / đổi testcase). */
    removeSegmentRef(workspaceId, testCaseId, segmentId) {
        const ws = this.get(workspaceId);
        if (!ws) return null;
        const entry = (ws.selectedTestCases ?? []).find(tc => tc.testCaseId === testCaseId);
        if (!entry) return null;
        entry.segments = (entry.segments ?? []).filter(s => s.segmentId !== segmentId);
        entry.segments.forEach((s, i) => { s.orderInTestCase = i + 1; });
        ws.updatedAt = new Date().toISOString();
        this.persist();
        return entry;
    }

    /** Gỡ mọi tham chiếu segment thuộc recording (khi xóa recording). */
    removeSegmentRefsByRecording(workspaceId, recordingId) {
        const ws = this.get(workspaceId);
        if (!ws) return null;
        let changed = false;
        for (const entry of ws.selectedTestCases ?? []) {
            const before = (entry.segments ?? []).length;
            entry.segments = (entry.segments ?? []).filter(s => s.recordingId !== recordingId);
            entry.segments.forEach((s, i) => { s.orderInTestCase = i + 1; });
            if (before !== (entry.segments ?? []).length) changed = true;
        }
        if (changed) {
            ws.updatedAt = new Date().toISOString();
            this.persist();
        }
        return ws;
    }

    /** Sắp xếp lại thứ tự segment của testcase — đúng thứ tự tester xác nhận (Generate dùng thứ tự này). */
    reorderSegmentRefs(workspaceId, testCaseId, segmentIds) {
        const ws = this.get(workspaceId);
        if (!ws) return null;
        const entry = (ws.selectedTestCases ?? []).find(tc => tc.testCaseId === testCaseId);
        if (!entry) return null;
        const current = entry.segments ?? [];
        if (!Array.isArray(segmentIds) || segmentIds.length !== current.length) return null;
        const idSet = new Set(segmentIds);
        if (current.some(s => !idSet.has(s.segmentId))) return null;
        const byId = new Map(current.map(s => [s.segmentId, s]));
        entry.segments = segmentIds.map((id, i) => ({ ...byId.get(id), orderInTestCase: i + 1 }));
        ws.updatedAt = new Date().toISOString();
        this.persist();
        return entry;
    }

    /** Danh sách segment đã gán của testcase — theo thứ tự tester sắp xếp. */
    getSegmentRefs(workspaceId, testCaseId) {
        const entry = this.getTestCase(workspaceId, testCaseId);
        if (!entry) return [];
        return (entry.segments ?? []).sort((a, b) => (a.orderInTestCase || 0) - (b.orderInTestCase || 0));
    }

    /* ================= 5C — Expected Result (tester sở hữu; không sửa approved) ================= */

    /** Lưu bản Expected Result do tester sửa (working copy). Rỗng → quay về bản gốc approved. */
    saveExpectedResult(workspaceId, testCaseId, expectedResult) {
        const ws = this.get(workspaceId);
        if (!ws) return null;
        const entry = (ws.selectedTestCases ?? []).find(tc => tc.testCaseId === testCaseId);
        if (!entry) return null;
        const trimmed = String(expectedResult ?? "").trim();
        entry.expectedResultEdited = trimmed && trimmed !== entry.expectedResult ? trimmed : null;
        ws.updatedAt = new Date().toISOString();
        this.persist();
        return entry;
    }

    /** Expected Result hiệu lực (bản làm việc nếu có, nếu không bản gốc approved). */
    effectiveExpectedResult(workspaceId, testCaseId) {
        const entry = this.getTestCase(workspaceId, testCaseId);
        if (!entry) return "";
        return (entry.expectedResultEdited ?? entry.expectedResult ?? "").trim();
    }

    /* ================= 6B — ActionBlock (canonical reusable automation artifact, SNAPSHOT steps) ================= */

    newBlockId() {
        return `BLK-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    }

    blockHash(block) {
        return crypto.createHash("sha256")
            .update(JSON.stringify({ steps: block.steps, recordedAssertions: block.recordedAssertions, sourceRange: block.sourceRange, label: block.label, kind: block.kind }))
            .digest("hex").slice(0, 12);
    }

    getActionBlocks(workspaceId) {
        const ws = this.get(workspaceId);
        return ws ? (Array.isArray(ws.actionBlocks) ? ws.actionBlocks : []) : [];
    }

    getActionBlock(workspaceId, blockId) {
        return this.getActionBlocks(workspaceId).find(b => b.blockId === blockId) ?? null;
    }

    /** Tạo ActionBlock — steps + recordedAssertions là SNAPSHOT (không phải live view recording). */
    addActionBlock(workspaceId, { sourceRecordingId = null, label = null, scope = "PRIVATE", kind = "ACTION", steps = [], recordedAssertions = [], sourceRange = null, status = "DRAFT", confirmedAt = null, confirmedBy = null } = {}) {
        const ws = this.get(workspaceId);
        if (!ws) return null;
        const block = {
            blockId: this.newBlockId(),
            workspaceId,
            sourceRecordingId: sourceRecordingId ?? null,
            label: label ? String(label).trim() : null,
            scope: scope === "REUSABLE" ? "REUSABLE" : "PRIVATE",
            kind: kind === "SETUP" ? "SETUP" : "ACTION",
            steps: Array.isArray(steps) ? steps.map(s => ({ ...s })) : [], // SNAPSHOT — copy
            recordedAssertions: Array.isArray(recordedAssertions) ? recordedAssertions.map(a => ({ ...a })) : [], // SNAPSHOT — copy (6C.2)
            sourceRange: sourceRange && Number.isInteger(sourceRange.startStep) ? { startStep: sourceRange.startStep, endStep: sourceRange.endStep } : null,
            status: status === "CONFIRMED" ? "CONFIRMED" : "DRAFT",
            version: 1,
            hash: null,
            confirmedAt: confirmedAt ?? null,
            confirmedBy: confirmedBy ?? null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        block.hash = this.blockHash(block);
        ws.actionBlocks = Array.isArray(ws.actionBlocks) ? ws.actionBlocks : [];
        ws.actionBlocks.push(block);
        ws.updatedAt = new Date().toISOString();
        this.persist();
        return { ...block };
    }

    /** Sửa ActionBlock — đổi steps/sourceRange/recordedAssertions → DRAFT + version++ (nội dung đổi, phải xác nhận lại);
     *  đổi label/scope/kind (metadata) → GIỮ nguyên status (không phá CONFIRMED — 6C.1). */
    updateActionBlock(workspaceId, blockId, { label = undefined, scope = undefined, kind = undefined, steps = undefined, recordedAssertions = undefined, sourceRange = undefined } = {}) {
        const ws = this.get(workspaceId);
        const block = this.getActionBlock(workspaceId, blockId);
        if (!ws || !block) return null;
        const contentChanged = steps !== undefined || sourceRange !== undefined || recordedAssertions !== undefined;
        if (label !== undefined) block.label = String(label).trim() || null;
        if (scope !== undefined) block.scope = scope === "REUSABLE" ? "REUSABLE" : "PRIVATE";
        if (kind !== undefined) block.kind = kind === "SETUP" ? "SETUP" : "ACTION";
        if (steps !== undefined) { block.steps = Array.isArray(steps) ? steps.map(s => ({ ...s })) : []; }
        if (recordedAssertions !== undefined) { block.recordedAssertions = Array.isArray(recordedAssertions) ? recordedAssertions.map(a => ({ ...a })) : []; }
        if (sourceRange !== undefined) {
            block.sourceRange = sourceRange && Number.isInteger(sourceRange.startStep) ? { startStep: sourceRange.startStep, endStep: sourceRange.endStep } : null;
        }
        // Chỉ nội dung thao tác đổi mới quay về DRAFT; metadata (tên/scope/kind) giữ CONFIRMED.
        if (contentChanged) {
            block.status = "DRAFT";
            block.confirmedAt = null;
            block.confirmedBy = null;
            block.version = (block.version || 1) + 1;
        }
        block.hash = this.blockHash(block);
        block.updatedAt = new Date().toISOString();
        ws.updatedAt = new Date().toISOString();
        this.persist();
        return { ...block };
    }

    confirmActionBlock(workspaceId, blockId) {
        const ws = this.get(workspaceId);
        const block = this.getActionBlock(workspaceId, blockId);
        if (!ws || !block) return null;
        block.status = "CONFIRMED";
        block.confirmedAt = new Date().toISOString();
        block.confirmedBy = "tester";
        block.updatedAt = new Date().toISOString();
        ws.updatedAt = new Date().toISOString();
        this.persist();
        return { ...block };
    }

    /** Xóa ActionBlock + gỡ khỏi mọi binding. */
    removeActionBlock(workspaceId, blockId) {
        const ws = this.get(workspaceId);
        if (!ws) return null;
        ws.actionBlocks = (ws.actionBlocks ?? []).filter(b => b.blockId !== blockId);
        for (const entry of ws.selectedTestCases ?? []) {
            const seq = (entry.binding?.sequence ?? []).filter(ref => ref.blockId !== blockId);
            if (seq.length !== (entry.binding?.sequence ?? []).length) {
                entry.binding = { sequence: seq };
            }
        }
        ws.updatedAt = new Date().toISOString();
        this.persist();
        return blockId;
    }

    /* ================= 6B — TestCaseAutomationBinding (sequence) ================= */

    getBinding(workspaceId, testCaseId) {
        const entry = this.getTestCase(workspaceId, testCaseId);
        if (!entry) return null;
        return entry.binding ?? { sequence: [] };
    }

    /** Set nguyên sequence binding (dùng cho migrate / khởi tạo). */
    setBinding(workspaceId, testCaseId, sequence) {
        const ws = this.get(workspaceId);
        const entry = this.getTestCase(workspaceId, testCaseId);
        if (!ws || !entry) return null;
        entry.binding = { sequence: (Array.isArray(sequence) ? sequence : []).map((r, i) => ({ blockId: r.blockId, order: r.order ?? i + 1 })) };
        ws.updatedAt = new Date().toISOString();
        this.persist();
        return { ...entry.binding };
    }

    /** Gán block vào binding (append — tester-owned order; KHÔNG tự sắp xếp).
     *  Unit-type: cho phép CÙNG blockId xuất hiện NHIỀU LẦN (D → E → D). */
    bindBlockToTestCase(workspaceId, testCaseId, blockId) {
        const ws = this.get(workspaceId);
        const entry = this.getTestCase(workspaceId, testCaseId);
        if (!ws || !entry) return null;
        const seq = (entry.binding?.sequence ?? []).slice();
        const maxOrder = seq.reduce((m, r) => Math.max(m, r.order || 0), 0);
        seq.push({ blockId, order: maxOrder + 1 });
        entry.binding = { sequence: seq };
        ws.updatedAt = new Date().toISOString();
        this.persist();
        return { ...entry.binding };
    }

    /** Gỡ block khỏi binding. Mặc định xóa TẤT CẢ occurrence; truyền order để xóa ĐÚNG 1 occurrence (D→E→D). */
    unbindBlockFromTestCase(workspaceId, testCaseId, blockId, order = null) {
        const ws = this.get(workspaceId);
        const entry = this.getTestCase(workspaceId, testCaseId);
        if (!ws || !entry) return null;
        let seq = entry.binding?.sequence ?? [];
        if (Number.isInteger(order)) {
            let removed = false;
            seq = seq.filter(ref => {
                if (removed) return true;
                if (ref.blockId === blockId && ref.order === order) { removed = true; return false; }
                return true;
            });
        } else {
            seq = seq.filter(ref => ref.blockId !== blockId);
        }
        // Đánh lại order liên tục (1..n).
        seq = seq.map((r, i) => ({ blockId: r.blockId, order: i + 1 }));
        entry.binding = { sequence: seq };
        ws.updatedAt = new Date().toISOString();
        this.persist();
        return { ...entry.binding };
    }

    /** Sắp xếp lại sequence — đúng thứ tự tester xác nhận (Generate dùng thứ tự này).
     *  Unit-type: support DUPLICATE blockId (D → E → D) — so multiset, không dùng Set/Map làm mất trùng. */
    reorderBinding(workspaceId, testCaseId, blockIds) {
        const ws = this.get(workspaceId);
        const entry = this.getTestCase(workspaceId, testCaseId);
        if (!ws || !entry) return null;
        const current = entry.binding?.sequence ?? [];
        if (!Array.isArray(blockIds) || blockIds.length !== current.length) return null;
        // Multiset equality (giữ duplicate).
        const countOf = arr => arr.reduce((m, x) => m.set(x, (m.get(x) || 0) + 1), new Map());
        const curCount = countOf(current.map(r => r.blockId));
        const newCount = countOf(blockIds);
        if (curCount.size !== newCount.size) return null;
        for (const [k, v] of curCount) if (newCount.get(k) !== v) return null;
        // Rebuild theo thứ tự mới; tiêu thụ từng ref (không mất occurrence trùng).
        const pool = current.slice();
        const byId = new Map();
        for (const r of pool) {
            if (!byId.has(r.blockId)) byId.set(r.blockId, []);
            byId.get(r.blockId).push(r);
        }
        const seq = blockIds.map((id, i) => {
            const refs = byId.get(id) || [];
            const ref = refs.shift() || { blockId: id };
            return { ...ref, blockId: id, order: i + 1 };
        });
        entry.binding = { sequence: seq };
        ws.updatedAt = new Date().toISOString();
        this.persist();
        return { ...entry.binding };
    }

    /** Reverse dependency: blockId → testCaseIds[] (derive deterministic từ bindings). */
    getBlockUsage(workspaceId, blockId) {
        const ws = this.get(workspaceId);
        if (!ws) return [];
        const ids = [];
        for (const entry of ws.selectedTestCases ?? []) {
            if ((entry.binding?.sequence ?? []).some(ref => ref.blockId === blockId)) ids.push(entry.testCaseId);
        }
        return ids;
    }
}
