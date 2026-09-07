import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import RunnerDeviceService from "../src/services/RunnerDeviceService.js";
import RunnerAgentService from "../src/services/RunnerAgentService.js";
import BoundaryEntryStore from "../src/codegen/BoundaryEntryStore.js";
import BoundaryTestingService from "../src/services/BoundaryTestingService.js";

/* Kiểm thử biên chạy từ xa qua Runner Agent (Ngân yêu cầu 2026-09-07) — job RUN_BOUNDARY (KHÁC
   RUN_TESTCASE, vì cần kết quả RIÊNG TỪNG candidate + ảnh chụp màn hình, xem
   tools/runner/boundaryExecution.mjs). Test này KHÔNG spawn Playwright thật — chỉ kiểm tra plumbing:
   ownership, payload gửi tới RunnerAgentService.enqueue(), completeRemoteRun() ghi ảnh base64 ra
   đĩa server đúng chỗ + gọi applyRunResults() đúng shape (giống hệt luồng local). */

const SCRIPT = `import { test, expect } from '@playwright/test';
test('test', async ({ page }) => {
  await page.goto('http://x/login');
  await page.getByRole('textbox', { name: 'Tài khoản' }).click();
  await page.getByRole('textbox', { name: 'Tài khoản' }).fill('admin');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByText('Sai tài khoản')).toBeVisible();
});`;

// 1x1 PNG hợp lệ (magic bytes đủ để test giải mã base64 -> file thật).
const TINY_PNG_BASE64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

function setup() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "boundary-remote-"));
    const runnerDeviceService = new RunnerDeviceService({ dataDir: root });
    const runnerAgentService = new RunnerAgentService({ deviceService: runnerDeviceService });
    const store = new BoundaryEntryStore({ metadataFile: path.join(root, "boundary-entries.json") });
    const outputDir = path.join(root, "out", "boundary");
    const service = new BoundaryTestingService({ store, outputDir, runnerAgentService });
    return { root, runnerDeviceService, runnerAgentService, store, service, outputDir };
}

function pairAndOnline(runnerDeviceService, runnerAgentService, { userId = "U1", machineName = "Máy Ngân" } = {}) {
    const { device, token } = runnerDeviceService.create({ userId, machineName });
    runnerAgentService.register({ agentId: device.runnerId, token, machineName });
    return { agentId: device.runnerId, token };
}

function makeReadyEntry(service, userId) {
    const entry = service.createEntry({ projectId: null, label: "Đăng nhập", scriptSource: SCRIPT });
    const taiKhoan = entry.steps.find(s => s.actionType === "FILL" && s.target === "Tài khoản");
    service.setTarget({ entryId: entry.entryId, stepOrder: taiKhoan.order });
    const saved = service.saveCandidates({ entryId: entry.entryId, candidates: [{ value: "" }, { value: "abc" }] });
    return saved;
}

// 1. runEntry với agentId yêu cầu ownership đúng (agent offline/user khác -> từ chối). runEntry()
// là async -> phải dùng assert.rejects (assert.throws không bắt được promise reject).
{
    const { service, runnerDeviceService, runnerAgentService } = setup();
    const entry = makeReadyEntry(service, "U1");
    await assert.rejects(
        () => service.runEntry({ entryId: entry.entryId, agentId: "AGENT-KHONG-TON-TAI", userId: "U1" }),
        /không thuộc tài khoản|Cần đăng nhập/
    );

    const { agentId } = pairAndOnline(runnerDeviceService, runnerAgentService, { userId: "OWNER" });
    await assert.rejects(
        () => service.runEntry({ entryId: entry.entryId, agentId, userId: "KHONG-PHAI-OWNER" }),
        /không thuộc tài khoản/
    );
}

// 2. Happy path: enqueue đúng job RUN_BOUNDARY, payload đúng entryId/code/candidateIds.
let happy;
{
    const { service, runnerDeviceService, runnerAgentService } = setup();
    const { agentId, token } = pairAndOnline(runnerDeviceService, runnerAgentService, { userId: "U1" });
    const entry = makeReadyEntry(service, "U1");

    const queued = await service.runEntry({ entryId: entry.entryId, agentId, userId: "U1" });
    assert.equal(queued.runStatus, "QUEUED");
    assert.ok(queued.jobId);

    const claimed = runnerAgentService.claim({ agentId, token });
    assert.equal(claimed.type, "RUN_BOUNDARY");
    assert.equal(claimed.payload.entryId, entry.entryId);
    assert.ok(claimed.payload.code.includes("test("), "payload.code phải là spec đã render");
    assert.deepEqual(claimed.payload.candidateIds, entry.candidates.map(c => c.id));

    happy = { service, runnerAgentService, agentId, token, claimed, entry };
}

// 3. completeRemoteRun(): ảnh base64 -> ghi file THẬT ra outputDir/screenshots/, applyRunResults()
// được gọi đúng (entry có run mới, screenshotPath đúng URL shape /api/boundary-testing/screenshots/<file>).
{
    const { service, runnerAgentService, agentId, token, claimed, entry } = happy;
    const [c1, c2] = entry.candidates;
    const completed = runnerAgentService.complete({
        agentId,
        token,
        jobId: claimed.jobId,
        result: {
            status: "PASSED",
            resultsById: {
                [c1.id]: { status: "PASSED", errorMessage: null, screenshotBase64: TINY_PNG_BASE64 },
                [c2.id]: { status: "FAILED", errorMessage: "Timeout", screenshotBase64: null }
            }
        }
    });
    service.completeRemoteRun({ job: completed.job, result: completed.job.result });

    const updated = service.getEntry({ entryId: entry.entryId });
    assert.equal(updated.runs.length, 1, "phải có 1 run mới sau completeRemoteRun");
    const run = updated.runs[0];
    const r1 = run.results.find(r => r.candidateId === c1.id);
    const r2 = run.results.find(r => r.candidateId === c2.id);
    assert.equal(r1.status, "PASSED");
    assert.match(r1.screenshotPath, /^\/api\/boundary-testing\/screenshots\/.+\.png$/);
    assert.equal(r2.status, "FAILED");
    assert.equal(r2.errorMessage, "Timeout");
    assert.equal(r2.screenshotPath, null, "candidate không có ảnh thì screenshotPath phải null, không lỗi");

    // Ảnh phải THẬT SỰ tồn tại trên đĩa, đúng nội dung đã giải mã từ base64.
    const fileName = r1.screenshotPath.split("/").pop();
    const filePath = path.join(service.outputDir, "screenshots", fileName);
    assert.ok(fs.existsSync(filePath), "file ảnh phải thực sự được ghi ra đĩa");
    const bytes = fs.readFileSync(filePath);
    assert.equal(bytes.slice(0, 8).toString("hex"), "89504e470d0a1a0a", "phải đúng magic bytes PNG");
}

// 4. Job cấp-job thất bại (status != PASSED) -> KHÔNG applyRunResults, không throw, chỉ log.
{
    const { service, runnerDeviceService, runnerAgentService } = setup();
    const { agentId, token } = pairAndOnline(runnerDeviceService, runnerAgentService, { userId: "U1" });
    const entry = makeReadyEntry(service, "U1");
    await service.runEntry({ entryId: entry.entryId, agentId, userId: "U1" });
    const claimed = runnerAgentService.claim({ agentId, token });
    const completed = runnerAgentService.complete({ agentId, token, jobId: claimed.jobId, result: { status: "FAILED", error: "Không đọc được BASE_URL." } });
    service.completeRemoteRun({ job: completed.job, result: completed.job.result }); // không được throw
    const after = service.getEntry({ entryId: entry.entryId });
    assert.equal(after.runs.length, 0, "job thất bại toàn bộ không được thêm run giả");
}

console.log("Boundary Testing remote run test: PASS");
