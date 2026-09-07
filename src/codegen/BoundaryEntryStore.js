import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

/*
 BoundaryEntryStore — Kiểm thử biên (Boundary Testing), HOÀN TOÀN độc lập với Automation
 Workspace/Action Library/testDataBindings.

 - Lưu độc lập: data/boundary-entries.json.
 - Mỗi entry = 1 script Playwright đã dán (KHÔNG cần lấy từ Thư viện thao tác hay 1 testcase
   nào) + 1 bước FILL được tester đánh dấu làm mục tiêu kiểm thử biên. Khóa theo entryId, không
   có workspaceId/testCaseId/businessField — tách hẳn khỏi khái niệm Automation Workspace.
 - candidates[].defectFlag là đánh giá THỦ CÔNG của tester (UNREVIEWED/OK/DEFECT), độc lập với
   lastStatus (pass/fail tự động của Playwright) — chạy lại chỉ cập nhật lastStatus/lastRunAt,
   KHÔNG bao giờ tự đổi defectFlag.
 - runs[] là báo cáo BẤT BIẾN theo từng lần chạy (unshift, tối đa MAX_RUNS_KEPT) — "báo cáo cho
   từng lần test", không ghi đè report cũ.
*/

function newEntryId() {
    return `BNDE-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
}

function newCandidateId() {
    return `C-${crypto.randomUUID().slice(0, 8)}`;
}

function newRunId() {
    return `RUN-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
}

const MAX_RUNS_KEPT = 20;

export default class BoundaryEntryStore {
    constructor({ metadataFile = null } = {}) {
        this.metadataFile = metadataFile ?? path.resolve("data", "boundary-entries.json");
        this.ensureFile();
        this.entries = this.load();
    }

    ensureFile() {
        fs.mkdirSync(path.dirname(this.metadataFile), { recursive: true });
        if (!fs.existsSync(this.metadataFile)) {
            fs.writeFileSync(this.metadataFile, JSON.stringify({ version: 1, entries: [] }, null, 2), "utf8");
        }
    }

    load() {
        try {
            const data = JSON.parse(fs.readFileSync(this.metadataFile, "utf8"));
            return Array.isArray(data.entries) ? data.entries : [];
        } catch {
            return [];
        }
    }

    persist() {
        fs.mkdirSync(path.dirname(this.metadataFile), { recursive: true });
        fs.writeFileSync(this.metadataFile, JSON.stringify({ version: 1, entries: this.entries }, null, 2), "utf8");
    }

    get(entryId) {
        const e = this.entries.find(x => x.entryId === entryId);
        return e ? { ...e } : null;
    }

    list({ projectId = null } = {}) {
        return this.entries
            .filter(e => (projectId ? e.projectId === projectId : true))
            .map(e => ({ ...e }));
    }

    /** Tạo entry mới — từ script đã dán (parseRecording ở service) HOẶC từ 1 block trong Thư viện
     *  thao tác (`sourceLibraryBlockId` set, `scriptSource` rỗng vì không có script thô gốc). */
    create({ projectId, label, scriptSource, steps, assertions, sourceLibraryBlockId = null }) {
        const now = new Date().toISOString();
        const entry = {
            entryId: newEntryId(),
            projectId: projectId ?? null,
            label: String(label ?? "").trim() || "Kiểm thử biên chưa đặt tên",
            scriptSource: String(scriptSource ?? ""),
            sourceLibraryBlockId: sourceLibraryBlockId ?? null,
            steps: Array.isArray(steps) ? steps.map(s => ({ ...s })) : [],
            assertions: Array.isArray(assertions) ? assertions.map(a => ({ ...a })) : [],
            targetStep: null,
            sensitiveOverrides: {},
            candidates: [],
            runs: [],
            createdAt: now,
            updatedAt: now
        };
        this.entries.push(entry);
        this.persist();
        return { ...entry };
    }

    /** Đánh dấu 1 bước FILL làm mục tiêu kiểm thử biên. */
    setTarget(entryId, targetStep) {
        const entry = this.entries.find(e => e.entryId === entryId);
        if (!entry) return null;
        entry.targetStep = targetStep;
        entry.updatedAt = new Date().toISOString();
        this.persist();
        return { ...entry };
    }

    /** Giá trị thật tester nhập lại cho các bước FILL nhạy cảm KHÁC mục tiêu (recordedValue của
     *  chúng đã bị redact "REDACTED" lúc parse — không giữ được giá trị gốc). */
    setSensitiveOverrides(entryId, overrides) {
        const entry = this.entries.find(e => e.entryId === entryId);
        if (!entry) return null;
        entry.sensitiveOverrides = { ...(overrides ?? {}) };
        entry.updatedAt = new Date().toISOString();
        this.persist();
        return { ...entry };
    }

    /** Ghi đè toàn bộ danh sách candidate (giữ lastStatus/lastRunAt/defectFlag/note/screenshotPath
     *  của candidate cũ nếu id trùng — sửa value không xóa mất lịch sử đánh giá của dòng khác). */
    saveCandidates(entryId, candidates) {
        const entry = this.entries.find(e => e.entryId === entryId);
        if (!entry) return null;
        const prevById = new Map((entry.candidates ?? []).map(c => [c.id, c]));
        const next = (Array.isArray(candidates) ? candidates : []).map(c => {
            const id = c.id && prevById.has(c.id) ? c.id : (c.id || newCandidateId());
            const prev = prevById.get(id);
            return {
                id,
                value: String(c.value ?? ""),
                source: c.source === "AI_SUGGESTED" || c.source === "TESTER" ? c.source : (prev?.source ?? "RULE_BASED"),
                lastStatus: prev?.lastStatus ?? null,
                lastRunAt: prev?.lastRunAt ?? null,
                lastError: prev?.lastError ?? null,
                defectFlag: prev?.defectFlag ?? "UNREVIEWED",
                note: prev?.note ?? "",
                screenshotPath: prev?.screenshotPath ?? null
            };
        });
        entry.candidates = next;
        entry.updatedAt = new Date().toISOString();
        this.persist();
        return { ...entry };
    }

    /** Cập nhật lastStatus/lastRunAt (tiện hiển thị nhanh) và thêm 1 report bất biến vào
     *  entry.runs (mới nhất lên đầu, tối đa MAX_RUNS_KEPT) — value snapshot tại thời điểm chạy. */
    applyRunResults(entryId, resultsByCandidateId) {
        const entry = this.entries.find(e => e.entryId === entryId);
        if (!entry) return null;
        const now = new Date().toISOString();
        const runResults = [];
        for (const candidate of entry.candidates) {
            const r = resultsByCandidateId.get(candidate.id);
            if (!r) continue;
            candidate.lastStatus = r.status;
            candidate.lastRunAt = now;
            candidate.lastError = r.errorMessage ?? null;
            candidate.screenshotPath = r.screenshotPath ?? null;
            runResults.push({ candidateId: candidate.id, value: candidate.value, status: r.status, errorMessage: r.errorMessage ?? null, screenshotPath: r.screenshotPath ?? null });
        }
        if (runResults.length > 0) {
            const run = {
                runId: newRunId(),
                ranAt: now,
                results: runResults,
                summary: {
                    total: runResults.length,
                    passed: runResults.filter(x => x.status === "PASSED").length,
                    failed: runResults.filter(x => x.status !== "PASSED").length
                }
            };
            entry.runs = Array.isArray(entry.runs) ? entry.runs : [];
            entry.runs.unshift(run);
            if (entry.runs.length > MAX_RUNS_KEPT) entry.runs.length = MAX_RUNS_KEPT;
        }
        entry.updatedAt = now;
        this.persist();
        return { ...entry };
    }

    markDefect(entryId, candidateId, { defectFlag, note }) {
        const entry = this.entries.find(e => e.entryId === entryId);
        if (!entry) return null;
        const candidate = entry.candidates.find(c => c.id === candidateId);
        if (!candidate) return null;
        if (defectFlag !== undefined) candidate.defectFlag = defectFlag;
        if (note !== undefined) candidate.note = String(note ?? "");
        entry.updatedAt = new Date().toISOString();
        this.persist();
        return { ...entry };
    }

    remove(entryId) {
        const idx = this.entries.findIndex(e => e.entryId === entryId);
        if (idx === -1) return false;
        this.entries.splice(idx, 1);
        this.persist();
        return true;
    }
}
