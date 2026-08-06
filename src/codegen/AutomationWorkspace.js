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
            selectedTestCases: (Array.isArray(testCases) ? testCases : []).map(tc => this.initTestCase(tc))
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
            // Trạng thái automation — tách hẳn khỏi approved-testcases.json
            selectedForAutomation: false,
            recordingStatus: "NOT_RECORDED",
            reviewStatus: "NOT_SELECTED",
            generateStatus: "NOT_GENERATED",
            runStatus: "NOT_RUN",
            recordingId: null,
            generatedFile: null,
            lastRun: null,
            automationAssertions: []
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
}
