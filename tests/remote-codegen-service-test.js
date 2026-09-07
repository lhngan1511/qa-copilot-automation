import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import CodeGenSessionManager from "../src/codegen/CodeGenSessionManager.js";
import CodeGenRecordingStore from "../src/codegen/CodeGenRecordingStore.js";
import RunnerDeviceService from "../src/services/RunnerDeviceService.js";
import RunnerAgentService from "../src/services/RunnerAgentService.js";
import RemoteCodeGenService from "../src/services/RemoteCodeGenService.js";

/* Ghi CodeGen từ xa qua Runner Agent (Ngân yêu cầu 2026-09-07) — RemoteCodeGenService là sibling
   độc lập với CodeGenSessionManager (KHÔNG dùng state machine phiên GLOBAL của manager đó), chỉ
   dùng chung store (để "Bản ghi đã lưu" hiện đúng recording từ xa) + setScript() (tái dùng
   parseRecording, không viết lại). Test này KHÔNG spawn Playwright thật — chỉ kiểm tra plumbing:
   ownership, trạng thái QUEUED_START/RECORDING/STOPPING/SAVED/STOPPED/ERROR, payload gửi tới
   RunnerAgentService.enqueue(). */

const tempRoots = [];

// Mỗi setup() dùng 1 thư mục tạm RIÊNG — tránh RunnerDeviceService của các block test khác nhau
// cùng đọc/ghi 1 file runner-devices.json (đụng "Tên máy chạy này đã được đăng ký" giữa các block
// dù mỗi block đáng lẽ độc lập).
function setup() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "remote-codegen-"));
    tempRoots.push(root);
    const runnerDeviceService = new RunnerDeviceService({ dataDir: root });
    const runnerAgentService = new RunnerAgentService({ deviceService: runnerDeviceService });
    const manager = new CodeGenSessionManager({
        rootDir: root,
        store: new CodeGenRecordingStore({
            metadataFile: path.join(root, "codegen-recordings.json"),
            scriptsDir: path.join(root, "outputs-codegen")
        })
    });
    const service = new RemoteCodeGenService({ manager });
    service.runnerAgentService = runnerAgentService;
    return { runnerDeviceService, runnerAgentService, manager, service };
}

function pairAndOnline(runnerDeviceService, runnerAgentService, { userId = "U1", machineName = "Máy Ngân" } = {}) {
    const { device, token } = runnerDeviceService.create({ userId, machineName });
    runnerAgentService.register({ agentId: device.runnerId, token, machineName });
    return { agentId: device.runnerId, token };
}

// 1. startRemote yêu cầu agentId + đăng nhập (userId).
{
    const { service } = setup();
    assert.throws(() => service.startRemote({ url: "https://x", agentId: "AGENT-X", userId: null }), /Cần đăng nhập/);
    assert.throws(() => service.startRemote({ url: "", agentId: "AGENT-X", userId: "U1" }), /URL không được để trống/);
}

// 2. startRemote với agent chưa online -> RUNNER_AGENT_OFFLINE (agent chưa register), không tạo recording rác.
{
    const { service, manager } = setup();
    assert.throws(() => service.startRemote({ url: "https://x", agentId: "AGENT-KHONG-TON-TAI", userId: "U1" }), error => error.code === "RUNNER_DEVICE_FORBIDDEN" || error.code === "AUTH_REQUIRED");
    assert.equal(manager.store.list().length, 0, "không được tạo recording khi chưa xác thực agent");
}

// 3. Runner thuộc user KHÁC -> forbidden, không cho enqueue job vào máy người khác.
{
    const { service, runnerDeviceService, runnerAgentService } = setup();
    const { agentId } = pairAndOnline(runnerDeviceService, runnerAgentService, { userId: "OWNER" });
    assert.throws(() => service.startRemote({ url: "https://x", agentId, userId: "KHONG-PHAI-OWNER" }), /không thuộc tài khoản/);
}

// 4. Happy path đầy đủ: start -> claim -> completeStart (RECORDING) -> stop -> claim -> completeStop
// (SAVED, script được parse qua setScript()).
{
    const { service, runnerDeviceService, runnerAgentService, manager } = setup();
    const { agentId, token } = pairAndOnline(runnerDeviceService, runnerAgentService, { userId: "U1" });
    const started = service.startRemote({ url: "https://x/login", browser: "chrome", agentId, userId: "U1" });
    const claimed = runnerAgentService.claim({ agentId, token });
    assert.equal(claimed.type, "START_CODEGEN");
    assert.equal(claimed.payload.recordingId, started.recordingId);
    assert.equal(claimed.payload.url, "https://x/login");
    assert.equal(claimed.payload.channel, "chrome", "browser=chrome phải map đúng channel");

    // completeStartJob: PASSED -> RECORDING.
    const completed = runnerAgentService.complete({ agentId, token, jobId: claimed.jobId, result: { status: "PASSED", pid: 4242 } });
    service.completeStartJob({ job: completed.job, result: completed.job.result });
    assert.equal(manager.store.getRaw(started.recordingId).status, "RECORDING");

    // stopRemote -> STOPPING, enqueue STOP_CODEGEN.
    const stopped = service.stopRemote({ recordingId: started.recordingId, userId: "U1" });
    assert.equal(stopped.status, "STOPPING");
    assert.equal(manager.store.getRaw(started.recordingId).status, "STOPPING");

    const claimedStop = runnerAgentService.claim({ agentId, token });
    assert.equal(claimedStop.type, "STOP_CODEGEN");
    assert.equal(claimedStop.payload.recordingId, started.recordingId);

    // completeStopJob với script THẬT -> setScript() tự chuyển SAVED + parse steps/assertions.
    const SCRIPT = "await page.goto('https://x/login');\nawait page.getByLabel('Tài khoản').fill('admin');\nawait page.getByRole('button', { name: 'Đăng nhập' }).click();";
    const completedStop = runnerAgentService.complete({ agentId, token, jobId: claimedStop.jobId, result: { status: "PASSED", scriptContent: SCRIPT } });
    service.completeStopJob({ job: completedStop.job, result: completedStop.job.result });
    const final = manager.store.getRaw(started.recordingId);
    assert.equal(final.status, "SAVED", "setScript() với script không rỗng phải chuyển SAVED, y hệt luồng dán tay cục bộ");
    assert.ok(final.steps.length > 0, "parseRecording() phải chạy qua setScript() và điền steps");
    assert.equal(final.scriptContent, SCRIPT);
}

// 5. completeStopJob với script RỖNG (capture thất bại) -> STOPPED, không phải lỗi.
{
    const { service, runnerDeviceService, runnerAgentService, manager } = setup();
    const { agentId, token } = pairAndOnline(runnerDeviceService, runnerAgentService, { userId: "U1" });
    const started = service.startRemote({ url: "https://x", agentId, userId: "U1" });
    const claimedStart = runnerAgentService.claim({ agentId, token });
    const completedStart = runnerAgentService.complete({ agentId, token, jobId: claimedStart.jobId, result: { status: "PASSED", pid: 1 } });
    service.completeStartJob({ job: completedStart.job, result: completedStart.job.result });

    service.stopRemote({ recordingId: started.recordingId, userId: "U1" });
    const claimedStop = runnerAgentService.claim({ agentId, token });
    const completedStop = runnerAgentService.complete({ agentId, token, jobId: claimedStop.jobId, result: { status: "PASSED", scriptContent: "" } });
    service.completeStopJob({ job: completedStop.job, result: completedStop.job.result });
    assert.equal(manager.store.getRaw(started.recordingId).status, "STOPPED", "script rỗng phải rơi về STOPPED (chờ dán tay), không phải lỗi");
}

// 6. completeStartJob với FAILED (agent không spawn được) -> ERROR + lastRunResult.error.
{
    const { service, runnerDeviceService, runnerAgentService, manager } = setup();
    const { agentId, token } = pairAndOnline(runnerDeviceService, runnerAgentService, { userId: "U1" });
    const started = service.startRemote({ url: "https://x", agentId, userId: "U1" });
    const claimed = runnerAgentService.claim({ agentId, token });
    const completed = runnerAgentService.complete({ agentId, token, jobId: claimed.jobId, result: { status: "FAILED", error: "Không tìm thấy Playwright CLI." } });
    service.completeStartJob({ job: completed.job, result: completed.job.result });
    const rec = manager.store.getRaw(started.recordingId);
    assert.equal(rec.status, "ERROR");
    assert.equal(rec.lastRunResult.error, "Không tìm thấy Playwright CLI.");
}

// 7. stopRemote trên recordingId không tồn tại / không phải bản ghi từ xa -> lỗi rõ.
{
    const { service } = setup();
    assert.throws(() => service.stopRemote({ recordingId: "REC-KHONG-TON-TAI", userId: "U1" }), /Không tìm thấy bản ghi/);
}
{
    const { service, manager } = setup();
    const local = manager.store.create({ mode: "FULL_FLOW", url: "https://x", browser: "chrome" });
    assert.throws(() => service.stopRemote({ recordingId: local.recordingId, userId: "U1" }), /không được ghi từ máy Runner/);
}

for (const root of tempRoots) fs.rmSync(root, { recursive: true, force: true });
console.log("Remote CodeGen service test: PASS");
