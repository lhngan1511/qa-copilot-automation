/*
 RemoteCodeGenService — Ghi màn hình (CodeGen) TRÊN MÁY TESTER qua Runner Agent đã ghép đôi
 (Ngân yêu cầu 2026-09-07: chọn 1 máy Runner 1 lần, áp dụng cho CodeGen thay vì luôn ghi trên máy
 chủ). Sibling độc lập với CodeGenSessionManager — KHÔNG dùng lại state machine phiên GLOBAL của
 manager đó (this.session/this.status chỉ 1 phiên tại 1 thời điểm, sai mô hình khi nhiều tester ghi
 đồng thời trên nhiều máy khác nhau). Chỉ dùng lại 2 thứ từ manager: store chung (để recording từ
 xa hiện đúng trong "Bản ghi đã lưu" như bản ghi cục bộ) và setScript() (parse/lưu script — TÁI DÙNG
 nguyên vẹn, không viết lại logic parseRecording()).

 2 job REMOTE (xem tools/runner/codegenExecution.mjs + agent.mjs):
 - START_CODEGEN: agent spawn xong là hoàn tất ngay (không chờ tester ghi xong).
 - STOP_CODEGEN: agent dừng process + thử đọc script (có thể rỗng — không phải lỗi, tester rơi về
   luồng dán tay đã có sẵn).

 Trạng thái recording khi ghi từ xa: tái dùng ĐÚNG các giá trị status manager cục bộ đã dùng
 (RECORDING/SAVED/STOPPED/ERROR — setScript() tự quyết định SAVED/STOPPED tuỳ script có nội dung
 hay không, y hệt luồng dán tay cục bộ) — chỉ thêm 2 giá trị TẠM THỜI mới: QUEUED_START (đã gửi job
 bắt đầu, agent chưa xác nhận) và STOPPING (đã gửi job dừng, agent chưa xác nhận).
*/

function fail(code, message, statusCode = 400) {
    const error = new Error(message);
    error.code = code;
    error.statusCode = statusCode;
    throw error;
}

const BROWSER_CHANNEL = { chrome: "chrome", edge: "msedge", chromium: null };

export default class RemoteCodeGenService {
    constructor({ manager, runnerAgentService = null } = {}) {
        if (!manager) throw new Error("RemoteCodeGenService cần manager (CodeGenSessionManager).");
        this.manager = manager;
        // Gán sau khi RunnerAgentService được khởi tạo ở createApp.js (mirror
        // v3ApplicationService.runnerAgentService = runnerAgentService) — /api/codegen mount
        // trước khi runnerAgentService tồn tại nên không thể truyền qua constructor tại chỗ mount.
        this.runnerAgentService = runnerAgentService;
    }

    get store() {
        return this.manager.store;
    }

    requireAgentService() {
        if (!this.runnerAgentService) fail("RUNNER_AGENT_NOT_AVAILABLE", "Runner Agent chưa sẵn sàng trong môi trường này.", 500);
        return this.runnerAgentService;
    }

    startRemote({ url = "", browser = "chrome", mode = "FULL_FLOW", context = null, projectId = null, agentId, userId } = {}) {
        const normalizedUrl = String(url ?? "").trim();
        if (!normalizedUrl) fail("CODE_GEN_URL_REQUIRED", "URL không được để trống.");
        if (!agentId) fail("INVALID_REQUEST", "Thiếu agentId (máy Runner đã chọn).");
        const agentService = this.requireAgentService();
        agentService.requireOwnedByUser(agentId, userId);

        const recording = this.store.create({ mode, url: normalizedUrl, browser, context, projectId });
        this.store.update(recording.recordingId, { status: "QUEUED_START", remoteAgentId: agentId });

        const channel = BROWSER_CHANNEL[browser] ?? null;
        const job = agentService.enqueue({
            agentId,
            type: "START_CODEGEN",
            payload: { recordingId: recording.recordingId, url: normalizedUrl, browser, channel }
        });
        return { recordingId: recording.recordingId, status: "QUEUED_START", jobId: job.jobId };
    }

    stopRemote({ recordingId, userId } = {}) {
        const rec = this.store.getRaw(recordingId);
        if (!rec) fail("RECORDING_NOT_FOUND", "Không tìm thấy bản ghi.", 404);
        if (!rec.remoteAgentId) fail("INVALID_REQUEST", "Bản ghi này không được ghi từ máy Runner từ xa.");
        const agentService = this.requireAgentService();
        agentService.requireOwnedByUser(rec.remoteAgentId, userId);

        const job = agentService.enqueue({ agentId: rec.remoteAgentId, type: "STOP_CODEGEN", payload: { recordingId } });
        this.store.update(recordingId, { status: "STOPPING" });
        return { recordingId, status: "STOPPING", jobId: job.jobId };
    }

    /** Callback khi agent báo START_CODEGEN xong (routes/runnerAgentRoutes.js gọi khi job complete). */
    completeStartJob({ job, result = {} } = {}) {
        const recordingId = job?.payload?.recordingId;
        if (!recordingId) return;
        if (String(result?.status ?? "").toUpperCase() === "PASSED") {
            this.store.update(recordingId, { status: "RECORDING" });
        } else {
            this.store.update(recordingId, {
                status: "ERROR",
                lastRunResult: { status: "ERROR", passed: false, error: result?.error ?? "Không khởi động được CodeGen từ xa." }
            });
        }
    }

    /** Callback khi agent báo STOP_CODEGEN xong. */
    completeStopJob({ job, result = {} } = {}) {
        const recordingId = job?.payload?.recordingId;
        if (!recordingId) return;
        // Gọi setScript() KỂ CẢ khi scriptContent rỗng — hàm này tự quyết định SAVED/STOPPED, y hệt
        // luồng dán tay cục bộ (xem CodeGenSessionManager#setScript), không cần nhánh trạng thái
        // riêng ở đây.
        this.manager.setScript(recordingId, { script: String(result?.scriptContent ?? "") });
    }
}
