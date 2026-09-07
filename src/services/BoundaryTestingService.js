import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { parseRecording } from "../codegen/recordingParser.js";
import { renderStandaloneBoundarySpec } from "../codegen/rendererBoundaryStandalone.js";
import { suggestBoundaryValuesRuleBased, suggestBoundaryValuesAI } from "../codegen/boundarySuggester.js";

/*
 BoundaryTestingService — Kiểm thử biên (Boundary Testing), HOÀN TOÀN độc lập với
 AutomationWorkspaceApplicationService/GenerateService/Action Library. Luồng: dán 1 script
 Playwright đã ghi (không cần lấy từ Thư viện thao tác hay 1 testcase nào) → parse → tester đánh
 dấu 1 bước FILL làm mục tiêu → đề xuất giá trị biên (rule-based + AI) → tester duyệt/sửa → chạy
 hàng loạt, gom kết quả riêng từng giá trị → tester đánh dấu lỗi thật → chạy lại chỉ tập con đó.
 Mỗi lần chạy thêm 1 report bất biến vào lịch sử (không ghi đè).
*/

export const BOUNDARY_ERRORS = {
    INVALID_REQUEST: "INVALID_REQUEST",
    ENTRY_NOT_FOUND: "ENTRY_NOT_FOUND",
    SCRIPT_EMPTY: "SCRIPT_EMPTY",
    STEP_NOT_FOUND: "STEP_NOT_FOUND",
    STEP_NOT_FILL: "STEP_NOT_FILL",
    TARGET_NOT_SET: "TARGET_NOT_SET",
    SENSITIVE_VALUE_REQUIRED: "SENSITIVE_VALUE_REQUIRED",
    NO_CANDIDATES: "NO_CANDIDATES",
    CANDIDATE_NOT_FOUND: "CANDIDATE_NOT_FOUND",
    RUNNER_NOT_AVAILABLE: "RUNNER_NOT_AVAILABLE",
    RUN_FAILED: "RUN_FAILED"
};

const STATUS_BY_CODE = {
    INVALID_REQUEST: 400,
    ENTRY_NOT_FOUND: 404,
    SCRIPT_EMPTY: 400,
    STEP_NOT_FOUND: 404,
    STEP_NOT_FILL: 400,
    TARGET_NOT_SET: 409,
    SENSITIVE_VALUE_REQUIRED: 409,
    NO_CANDIDATES: 400,
    CANDIDATE_NOT_FOUND: 404,
    RUNNER_NOT_AVAILABLE: 503,
    RUN_FAILED: 409
};

function fail(code, message, details = null) {
    const error = new Error(message);
    error.code = code;
    error.statusCode = STATUS_BY_CODE[code] ?? 400;
    error.details = details;
    throw error;
}

export default class BoundaryTestingService {
    constructor({ store = null, runner = null, outputDir = null, runnerAgentService = null } = {}) {
        this.store = store;       // BoundaryEntryStore
        this.runner = runner;     // PlaywrightRunner (dùng chung với Automation Workspace)
        this.outputDir = outputDir ?? path.resolve("outputs", "generated-tests", "boundary");
        // Chạy từ xa qua Runner Agent (Ngân yêu cầu 2026-09-07) — gán SAU khi khởi tạo ở
        // createApp.js (giống RemoteCodeGenService.runnerAgentService), vì /api/boundary-testing
        // mount TRƯỚC khi runnerAgentService tồn tại.
        this.runnerAgentService = runnerAgentService;
    }

    ensureEntry(entryId) {
        const entry = this.store?.get(entryId);
        if (!entry) fail(BOUNDARY_ERRORS.ENTRY_NOT_FOUND, "Không tìm thấy kiểm thử biên.");
        return entry;
    }

    /** Dán script Playwright đã ghi -> parse thành steps/assertions. Không cần workspace/testcase
     *  hay Thư viện thao tác nào. */
    createEntry({ projectId, label, scriptSource }) {
        const source = String(scriptSource ?? "").trim();
        if (!source) fail(BOUNDARY_ERRORS.SCRIPT_EMPTY, "Chưa dán script.");
        const { steps, assertions } = parseRecording(source);
        if (!steps || steps.length === 0) {
            fail(BOUNDARY_ERRORS.SCRIPT_EMPTY, "Không nhận diện được bước nào trong script đã dán — kiểm tra lại nội dung.");
        }
        const entry = this.store.create({ projectId, label, scriptSource: source, steps, assertions });
        return this.entryDto(entry);
    }

    /** Đánh dấu 1 bước FILL làm mục tiêu kiểm thử biên. */
    setTarget({ entryId, stepOrder }) {
        const entry = this.ensureEntry(entryId);
        const step = (entry.steps ?? []).find(s => s.order === stepOrder);
        if (!step) fail(BOUNDARY_ERRORS.STEP_NOT_FOUND, "Không tìm thấy bước này trong script.");
        if (String(step.actionType).toUpperCase() !== "FILL") {
            fail(BOUNDARY_ERRORS.STEP_NOT_FILL, "Chỉ có thể chọn bước nhập liệu (FILL) làm mục tiêu kiểm thử biên.");
        }
        const updated = this.store.setTarget(entryId, { order: step.order, locator: step.locator, target: step.target });
        return this.entryDto(updated);
    }

    /** Giá trị thật cho các bước FILL nhạy cảm KHÁC mục tiêu (đã bị redact "REDACTED" lúc parse). */
    setSensitiveOverrides({ entryId, overrides }) {
        this.ensureEntry(entryId);
        const updated = this.store.setSensitiveOverrides(entryId, overrides ?? {});
        return this.entryDto(updated);
    }

    /** Đề xuất giá trị biên: rule-based (luôn có) + AI (bổ sung, best-effort, không throw). */
    async suggestValues({ entryId }) {
        const entry = this.ensureEntry(entryId);
        if (!entry.targetStep) fail(BOUNDARY_ERRORS.TARGET_NOT_SET, "Chưa đánh dấu bước cần kiểm thử biên.");
        const targetStep = (entry.steps ?? []).find(s => s.order === entry.targetStep.order);
        const currentValue = targetStep?.sensitive ? "" : String(targetStep?.recordedValue ?? "");
        const ruleBased = suggestBoundaryValuesRuleBased({ currentValue });
        const ai = await suggestBoundaryValuesAI({ businessField: entry.targetStep.target, currentValue });
        const seen = new Set(ruleBased.map(c => c.value));
        const extra = ai.candidates.filter(c => !seen.has(c.value) && seen.add(c.value));
        return { candidates: [...ruleBased, ...extra], currentValue, aiError: ai.error };
    }

    /** Ghi đè danh sách candidate tester đã duyệt/sửa (giữ lastStatus/defectFlag theo id trùng). */
    saveCandidates({ entryId, candidates }) {
        this.ensureEntry(entryId);
        if (!Array.isArray(candidates) || candidates.length === 0) {
            fail(BOUNDARY_ERRORS.NO_CANDIDATES, "Danh sách giá trị biên trống.");
        }
        const updated = this.store.saveCandidates(entryId, candidates);
        return this.entryDto(updated);
    }

    /** Xem trước mã sẽ chạy — KHÔNG ghi file, KHÔNG chạy Playwright. */
    previewSpec({ entryId, candidates }) {
        const entry = this.ensureEntry(entryId);
        const list = Array.isArray(candidates) ? candidates : [];
        if (list.length === 0) fail(BOUNDARY_ERRORS.NO_CANDIDATES, "Danh sách giá trị biên trống.");
        const rendered = renderStandaloneBoundarySpec({
            steps: entry.steps,
            assertions: entry.assertions,
            targetStep: entry.targetStep,
            sensitiveOverrides: entry.sensitiveOverrides,
            candidates: list.map(c => ({ id: String(c.id ?? ""), value: c.value })),
            label: entry.label
        });
        if (!rendered.ok) this.failRendered(rendered);
        return { code: rendered.code };
    }

    /** Chạy (hoặc chạy lại 1 phần) — candidateIds=null nghĩa là TẤT CẢ, dùng chung cho cả nút
     *  "Chạy" và "Chạy lại các giá trị đã đánh dấu lỗi". Có agentId -> chạy TỪ XA qua Runner Agent
     *  đã chọn (Ngân yêu cầu 2026-09-07) thay vì chạy trên máy chủ — trả về QUEUED ngay, kết quả
     *  thật đến sau qua completeRemoteRun() khi agent báo job xong. */
    async runEntry({ entryId, candidateIds = null, env = {}, agentId = null, userId = null }) {
        const entry = this.ensureEntry(entryId);
        const idsToRun = Array.isArray(candidateIds) && candidateIds.length > 0
            ? new Set(candidateIds)
            : new Set((entry.candidates ?? []).map(c => c.id));
        const candidatesToRun = (entry.candidates ?? []).filter(c => idsToRun.has(c.id));
        if (candidatesToRun.length === 0) fail(BOUNDARY_ERRORS.CANDIDATE_NOT_FOUND, "Không tìm thấy giá trị biên cần chạy.");

        const rendered = renderStandaloneBoundarySpec({
            steps: entry.steps,
            assertions: entry.assertions,
            targetStep: entry.targetStep,
            sensitiveOverrides: entry.sensitiveOverrides,
            candidates: candidatesToRun,
            label: entry.label
        });
        if (!rendered.ok) this.failRendered(rendered);

        if (agentId) {
            if (!this.runnerAgentService) fail(BOUNDARY_ERRORS.RUNNER_NOT_AVAILABLE, "Runner Agent chưa sẵn sàng trong môi trường này.");
            this.runnerAgentService.requireOwnedByUser(agentId, userId);
            const job = this.runnerAgentService.enqueue({
                agentId,
                type: "RUN_BOUNDARY",
                payload: { entryId, code: rendered.code, env, candidateIds: candidatesToRun.map(c => c.id) }
            });
            return { runStatus: "QUEUED", jobId: job.jobId, agentId, entryId };
        }

        if (!this.runner) fail(BOUNDARY_ERRORS.RUNNER_NOT_AVAILABLE, "Runner chưa sẵn sàng trong môi trường này.");
        fs.mkdirSync(this.outputDir, { recursive: true });
        const outputPath = path.join(this.outputDir, `${entryId}-${crypto.randomUUID().slice(0, 8)}.spec.js`);
        fs.writeFileSync(outputPath, rendered.code, "utf8");

        const screenshotsDir = path.join(this.outputDir, "screenshots");
        const runResult = await this.runner.runBoundarySpec(outputPath, { env, screenshotsDir });
        if (!runResult.ok) {
            // Lỗi môi trường/cấu hình (thiếu BASE_URL, browser chưa cài...) — tester có thể tự
            // sửa và thử lại, KHÔNG phải lỗi hệ thống bất ngờ.
            fail(BOUNDARY_ERRORS.RUN_FAILED, runResult.error ?? "Chạy kiểm thử biên thất bại.");
        }
        // Runner chỉ trả TÊN FILE ảnh (screenshotFile) — ghép thành URL tĩnh mà frontend mở được
        // trực tiếp (đường dẫn hệ thống tuyệt đối của Playwright không mở được từ trình duyệt).
        const resultsById = new Map();
        for (const [candidateId, r] of runResult.resultsById.entries()) {
            resultsById.set(candidateId, {
                status: r.status,
                errorMessage: r.errorMessage,
                screenshotPath: r.screenshotFile ? `/api/boundary-testing/screenshots/${r.screenshotFile}` : null
            });
        }
        const updated = this.store.applyRunResults(entryId, resultsById);
        return this.entryDto(updated);
    }

    /** Callback khi agent báo job RUN_BOUNDARY xong (runnerAgentRoutes.js gọi lúc job complete).
     *  Ảnh chụp màn hình đến dạng base64 (chụp trên máy tester) — ghi ra outputDir/screenshots/
     *  TRÊN SERVER rồi ghép URL tĩnh, ĐÚNG shape luồng chạy local đã dùng — frontend không cần
     *  biết đây là ảnh từ xa hay tại chỗ. */
    completeRemoteRun({ job, result = {} } = {}) {
        const entryId = job?.payload?.entryId;
        if (!entryId) return;
        if (String(result?.status ?? "").toUpperCase() !== "PASSED") {
            // Job tự nó chạy KHÔNG được (spawn lỗi, thiếu BASE_URL trên máy tester...) — khác hẳn
            // "1 candidate FAILED" bình thường. Entry không có chỗ lưu lỗi cấp-job riêng — log lại
            // để chẩn đoán; tester thấy "runs" không tăng sau khi chờ thì biết lần đó thất bại.
            console.error(`[BOUNDARY_REMOTE_RUN_FAILED] entryId=${entryId} agentId=${job?.agentId} error=${result?.error ?? "?"}`);
            return;
        }
        const resultsById = new Map();
        for (const [candidateId, r] of Object.entries(result.resultsById ?? {})) {
            let screenshotPath = null;
            if (r?.screenshotBase64) {
                try {
                    const screenshotsDir = path.join(this.outputDir, "screenshots");
                    fs.mkdirSync(screenshotsDir, { recursive: true });
                    const fileName = `${entryId}-${candidateId}-${Date.now()}.png`;
                    fs.writeFileSync(path.join(screenshotsDir, fileName), Buffer.from(r.screenshotBase64, "base64"));
                    screenshotPath = `/api/boundary-testing/screenshots/${fileName}`;
                } catch (e) {
                    console.error(`[BOUNDARY_REMOTE_SCREENSHOT_FAILED] entryId=${entryId} candidateId=${candidateId} error=${e.message}`);
                }
            }
            resultsById.set(candidateId, { status: r?.status ?? "FAILED", errorMessage: r?.errorMessage ?? null, screenshotPath });
        }
        this.store.applyRunResults(entryId, resultsById);
    }

    /** Đánh giá thủ công của tester cho 1 candidate — độc lập với lastStatus tự động. */
    markDefect({ entryId, candidateId, defectFlag, note }) {
        this.ensureEntry(entryId);
        if (defectFlag !== undefined && !["UNREVIEWED", "OK", "DEFECT"].includes(defectFlag)) {
            fail(BOUNDARY_ERRORS.INVALID_REQUEST, "defectFlag không hợp lệ.");
        }
        const updated = this.store.markDefect(entryId, candidateId, { defectFlag, note });
        if (!updated) fail(BOUNDARY_ERRORS.CANDIDATE_NOT_FOUND, "Không tìm thấy giá trị biên cần cập nhật.");
        return this.entryDto(updated);
    }

    listEntries({ projectId = null } = {}) {
        return this.store.list({ projectId }).map(e => this.entryDto(e));
    }

    getEntry({ entryId }) {
        const entry = this.store?.get(entryId);
        return entry ? this.entryDto(entry) : null;
    }

    deleteEntry({ entryId }) {
        const removed = this.store.remove(entryId);
        if (!removed) fail(BOUNDARY_ERRORS.ENTRY_NOT_FOUND, "Không tìm thấy kiểm thử biên.");
        return { entryId, removed: true };
    }

    failRendered(rendered) {
        const code = rendered.errorCode === "BOUNDARY_TARGET_NOT_SET" ? BOUNDARY_ERRORS.TARGET_NOT_SET
            : rendered.errorCode === "BOUNDARY_SENSITIVE_VALUE_REQUIRED" ? BOUNDARY_ERRORS.SENSITIVE_VALUE_REQUIRED
            : BOUNDARY_ERRORS.NO_CANDIDATES;
        fail(code, rendered.reason);
    }

    entryDto(entry) {
        if (!entry) return null;
        return {
            entryId: entry.entryId,
            projectId: entry.projectId,
            label: entry.label,
            scriptSource: entry.scriptSource,
            sourceLibraryBlockId: entry.sourceLibraryBlockId ?? null,
            steps: entry.steps.map(s => ({ ...s })),
            assertions: entry.assertions.map(a => ({ ...a })),
            targetStep: entry.targetStep ? { ...entry.targetStep } : null,
            sensitiveOverrides: { ...(entry.sensitiveOverrides ?? {}) },
            candidates: entry.candidates.map(c => ({ ...c })),
            runs: (entry.runs ?? []).map(r => ({ ...r, results: r.results.map(x => ({ ...x })) })),
            createdAt: entry.createdAt,
            updatedAt: entry.updatedAt
        };
    }
}
