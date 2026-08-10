import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import createApp from "../src/server/createApp.js";

/*
 Bước 5C-0 + 6B — Record Mapping (Recording → ActionBlock → TestCaseAutomationBinding).

 Kiểm chứng (cập nhật theo CANONICAL 6B — block/binding; compatibility segment xem action-block-test F):
   1. Mapping bằng testCaseId — KHÔNG theo thứ tự JSON / thứ tự recording.
   2. Recording KHÔNG gắn testcase khi start (1 bản ghi dài phục vụ nhiều testcase).
   3. ActionBlock: tạo DRAFT / xác nhận / sửa → DRAFT / xóa; REUSABLE bắt buộc label.
   4. SETUP tách dùng chung (kind=SETUP — vị trí do tester sắp).
   5. Generate: chưa có block → RECORDING_MAPPING_REQUIRED; block DRAFT → SEGMENT_NOT_CONFIRMED;
      nhiều block sinh theo đúng thứ tự binding (reorder).
   6. Generate chỉ kiểm tra testcase đang Generate (recording còn bước chưa dùng không chặn).
   7. Tương thích ngược: testcase không block nhưng có recording APPROVED (luồng 5B legacy) vẫn sinh được.
   8. automationDecision: UNDECIDED → AUTOMATED (khi có block xác nhận) / MANUAL_ONLY (tester đặt).
*/

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "v3-map-"));

// JSON approved — cố tình xếp NGƯỢC thứ tự thao tác (TC002 trước TC001).
const APPROVED = [
    {
        id: "TC002", title: "Sửa đơn vị tính", module: "Danh mục", type: "POSITIVE",
        reviewStatus: "APPROVED",
        testData: { fields: { "Tài khoản": { value: "admin", purpose: "VALID" }, "Mật khẩu": { value: "Admin@123", purpose: "VALID" }, "Tên đơn vị tính": { value: "Kg2", purpose: "VALID" } } }
    },
    {
        id: "TC001", title: "Thêm đơn vị tính", module: "Danh mục", type: "POSITIVE",
        reviewStatus: "APPROVED",
        testData: { fields: { "Tài khoản": { value: "admin", purpose: "VALID" }, "Mật khẩu": { value: "Admin@123", purpose: "VALID" }, "Tên đơn vị tính": { value: "Kg", purpose: "VALID" } } }
    },
    {
        id: "TC004", title: "Đăng nhập", module: "Login", type: "POSITIVE",
        reviewStatus: "APPROVED",
        testData: { fields: { "Tài khoản": { value: "admin", purpose: "VALID" }, "Mật khẩu": { value: "Admin@123", purpose: "VALID" } } }
    },
    {
        id: "TC003", title: "Xóa đơn vị tính", module: "Danh mục", type: "POSITIVE",
        reviewStatus: "APPROVED",
        testData: { fields: { "Tên đơn vị tính": { value: "Kg", purpose: "VALID" } } }
    }
];

const SRC = `import { test, expect } from '@playwright/test';
test('TC', async ({ page }) => {
  await page.goto('http://172.16.1.100:9230/wasuco/login');
  await page.getByRole('textbox', { name: 'Tài khoản' }).fill('admin');
  await page.getByRole('textbox', { name: 'Mật khẩu' }).fill('Admin@123');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.getByText('Danh mục phần mềm quản lý').click();
  await page.getByRole('button', { name: 'Thêm' }).click();
  await page.getByLabel('Tên đơn vị tính').fill('Kg');
  await page.getByRole('button', { name: 'Lưu' }).click();
  await page.getByRole('button', { name: 'Sửa' }).click();
  await page.getByLabel('Tên đơn vị tính').fill('Kg2');
  await page.getByRole('button', { name: 'Xóa' }).click();
  await page.getByRole('button', { name: 'Xác nhận xóa' }).click();
});`;

const SRC2 = `import { test } from '@playwright/test';
test('TC3', async ({ page }) => {
  await page.goto('http://172.16.1.100:9230/wasuco/login');
  await page.getByRole('button', { name: 'Xóa' }).click();
  await page.getByRole('button', { name: 'Xác nhận xóa' }).click();
});`;

async function startServer(dataDir, v3Out) {
    const app = createApp({ repositoryType: "file", dataDir, outputDir: path.join(dataDir, "o"), v3OutputDir: v3Out });
    return new Promise(resolve => {
        const server = app.listen(0, "127.0.0.1", () => resolve({ server, baseUrl: `http://127.0.0.1:${server.address().port}` }));
    });
}
function closeServer(server) { return new Promise(r => server.close(r)); }
async function req(baseUrl, method, p, body) {
    const json = body !== undefined;
    const res = await fetch(`${baseUrl}${p}`, {
        method,
        headers: json ? { "content-type": "application/json" } : {},
        body: json ? JSON.stringify(body) : undefined
    });
    let data; try { data = await res.json(); } catch { data = null; }
    return { status: res.status, body: data };
}
async function addConfirmedAssertion(baseUrl, wid, tcId) {
    const draft = await req(baseUrl, "POST",
        `/api/automation-v3/workspaces/${wid}/testcases/${tcId}/assertions`,
        { type: "TEXT_VISIBLE", target: "Danh mục", locator: "page.getByText('Danh mục phần mềm quản lý')", expected: "Danh mục phần mềm quản lý", matcher: "toBeVisible", source: "TESTER_INPUT", status: "DRAFT" });
    await req(baseUrl, "PATCH",
        `/api/automation-v3/workspaces/${wid}/testcases/${tcId}/assertions/${draft.body.id}/confirm`);
}

async function main() {
    const dataDir = path.join(tempRoot, "data");
    const v3Out = path.join(tempRoot, "out");
    let { server, baseUrl } = await startServer(dataDir, v3Out);

    // ===== 1. Workspace: JSON xếp TC002 trước TC001 =====
    const created = await req(baseUrl, "POST", "/api/automation-v3/workspaces", { source: "NEW", module: "Danh mục", approvedTestCases: APPROVED });
    const wid = created.body.workspaceId;
    assert.deepEqual(created.body.items.map(i => i.testCaseId), ["TC002", "TC001", "TC004", "TC003"], "JSON giữ thứ tự duyệt 2→1→4→3");
    for (const tc of ["TC001", "TC002", "TC003", "TC004"]) {
        await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/testcases/${tc}/select`);
    }

    // ===== 2. Start KHÔNG gắn testcase =====
    const start = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/recordings/start`, { type: "TESTCASE" });
    assert.equal(start.body.testCaseId, null, "recording chưa gán testcase");
    const recId = start.body.recordingId;
    const stop = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/recordings/stop`, { recordingId: recId, source: SRC });
    assert.equal(stop.body.stepCount, 12, "12 bước");

    // ===== 3. Tạo ActionBlock: SETUP + TC001 + TC002; validate lỗi =====
    const blkSetup = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/blocks`,
        { recordingId: recId, startStep: 1, endStep: 5, kind: "SETUP" });
    assert.equal(blkSetup.status, 200, "setup block 200");
    assert.equal(blkSetup.body.status, "DRAFT", "block mới DRAFT");
    assert.equal(blkSetup.body.kind, "SETUP", "kind SETUP");

    const blkTc1 = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/blocks`,
        { recordingId: recId, startStep: 6, endStep: 8 });
    assert.equal(blkTc1.status, 200, "TC001 block 200");

    const blkTc2 = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/blocks`,
        { recordingId: recId, startStep: 9, endStep: 10 });
    assert.equal(blkTc2.status, 200, "TC002 block 200");

    // Chồng lấn KHÔNG còn là ràng buộc block (block độc lập — tester cắt theo nội dung; không cần chặn overlap toàn recording).
    // Range ngoài steps → 400
    const badRange = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/blocks`,
        { recordingId: recId, startStep: 13, endStep: 14 });
    assert.equal(badRange.status, 400, "range 400");
    assert.equal(badRange.body.errorCode, "SEGMENT_INVALID", "SEGMENT_INVALID");

    // REUSABLE thiếu label → 400
    const noLabel = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/blocks`,
        { recordingId: recId, startStep: 11, endStep: 12, scope: "REUSABLE" });
    assert.equal(noLabel.status, 400, "REUSABLE thiếu label 400");

    // ===== 4. Xác nhận block → CONFIRMED; bind vào testcase =====
    for (const b of [blkSetup, blkTc1, blkTc2]) {
        await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/blocks/${b.body.blockId}/confirm`);
    }
    await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/binding/blocks`, { blockId: blkSetup.body.blockId });
    await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/binding/blocks`, { blockId: blkTc1.body.blockId });
    await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/testcases/TC002/binding/blocks`, { blockId: blkSetup.body.blockId });
    await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/testcases/TC002/binding/blocks`, { blockId: blkTc2.body.blockId });

    let ws = await req(baseUrl, "GET", `/api/automation-v3/workspaces/${wid}`);
    const tc1 = ws.body.items.find(i => i.testCaseId === "TC001");
    const tc2 = ws.body.items.find(i => i.testCaseId === "TC002");
    assert.equal(tc1.automationDecision, "AUTOMATED", "TC001 → Có automation");
    assert.equal(tc1.segmentSummary.confirmed, 2, "TC001 2 block xác nhận");
    assert.equal(tc2.automationDecision, "AUTOMATED", "TC002 → Có automation (dù đứng đầu JSON)");

    // ===== 5. Sửa block đã CONFIRMED → quay về DRAFT (giữ nguyên tắc) =====
    const edited = await req(baseUrl, "PATCH", `/api/automation-v3/workspaces/${wid}/blocks/${blkTc1.body.blockId}`,
        { startStep: 6, endStep: 7 });
    assert.equal(edited.body.status, "DRAFT", "sửa block → DRAFT");
    await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/blocks/${blkTc1.body.blockId}/confirm`);

    // ===== 6. Nhiều block cho TC001 (6-8 và 11-12) + sắp xếp lại binding =====
    const blkTc1b = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/blocks`,
        { recordingId: recId, startStep: 11, endStep: 12 });
    await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/blocks/${blkTc1b.body.blockId}/confirm`);
    await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/binding/blocks`, { blockId: blkTc1b.body.blockId });

    // Thứ tự mặc định: [setup, 6-8, 11-12] → đảo 2 block cuối
    const reorder = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/binding/reorder`,
        { blockIds: [blkSetup.body.blockId, blkTc1b.body.blockId, blkTc1.body.blockId] });
    assert.equal(reorder.status, 200, "reorder 200");
    assert.deepEqual(reorder.body.sequence.map(s => s.blockId), [blkSetup.body.blockId, blkTc1b.body.blockId, blkTc1.body.blockId], "thứ tự sau reorder");

    // ===== 7. Generate TC001: setup (kind SETUP) trước + thứ tự tester (xóa trước thêm) =====
    await addConfirmedAssertion(baseUrl, wid, "TC001");
    const gen1 = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/generate`, { confirmedTestData: {} });
    assert.equal(gen1.status, 200, "TC001 generate 200");
    const code1 = fs.readFileSync(gen1.body.outputPath, "utf8");
    assert.ok(code1.includes("page.goto('http://172.16.1.100:9230/wasuco/login')") || code1.includes('page.goto("http://172.16.1.100:9230/wasuco/login")'), "setup login có trong spec");
    assert.ok(code1.indexOf("name: 'Xóa'") < code1.indexOf("name: 'Thêm'"), "thứ tự tester: xóa trước thêm");
    assert.ok(Array.isArray(gen1.body.metadata.segments) && gen1.body.metadata.segments.length === 3, "metadata 3 block");
    assert.equal(gen1.body.validation.spec.syntaxValid, true, "syntax valid");

    // ===== 8. TC002 sinh từ đúng block của nó (9-10) — không lấy block TC001 dù TC002 đứng đầu JSON =====
    await addConfirmedAssertion(baseUrl, wid, "TC002");
    const gen2 = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/testcases/TC002/generate`, { confirmedTestData: {} });
    assert.equal(gen2.status, 200, "TC002 generate 200");
    const code2 = fs.readFileSync(gen2.body.outputPath, "utf8");
    assert.ok(code2.includes("name: 'Sửa'"), "TC002 có step sửa");
    assert.ok(!code2.includes("name: 'Thêm'"), "TC002 KHÔNG chứa step TC001 (binding theo testCaseId, không theo thứ tự)");

    // ===== 9. Generate gating: TC003 chưa block → RECORDING_MAPPING_REQUIRED =====
    const gen3 = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/testcases/TC003/generate`);
    assert.equal(gen3.status, 409, "TC003 chưa block 409");
    assert.equal(gen3.body.errorCode, "RECORDING_MAPPING_REQUIRED", "RECORDING_MAPPING_REQUIRED");
    assert.equal(gen3.body.message, "Không có bản ghi thao tác cho testcase này.", "message chuẩn");

    // ===== 10. Block DRAFT → SEGMENT_NOT_CONFIRMED (bản ghi thứ 2 riêng cho TC003) =====
    const start2 = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/recordings/start`, { type: "TESTCASE" });
    const rec2 = start2.body.recordingId;
    await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/recordings/stop`, { recordingId: rec2, source: SRC2 });
    const blkTc3 = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/blocks`,
        { recordingId: rec2, startStep: 2, endStep: 3 });
    assert.equal(blkTc3.status, 200, "TC003 block DRAFT");
    await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/testcases/TC003/binding/blocks`, { blockId: blkTc3.body.blockId });
    const gen3b = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/testcases/TC003/generate`);
    assert.equal(gen3b.body.errorCode, "SEGMENT_NOT_CONFIRMED", "DRAFT không generate");
    assert.equal(gen3b.body.message, "Bản ghi thao tác chưa được xác nhận.", "message chuẩn");

    await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/blocks/${blkTc3.body.blockId}/confirm`);
    await addConfirmedAssertion(baseUrl, wid, "TC003");
    const gen3c = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/testcases/TC003/generate`, { confirmedTestData: {} });
    assert.equal(gen3c.status, 200, "TC003 generate sau confirm");

    // ===== 11. Xóa block → gỡ khỏi binding =====
    const del = await req(baseUrl, "DELETE", `/api/automation-v3/workspaces/${wid}/blocks/${blkTc1b.body.blockId}`);
    assert.equal(del.body.deleted, true, "xóa block");
    ws = await req(baseUrl, "GET", `/api/automation-v3/workspaces/${wid}`);
    const tc1After = ws.body.items.find(i => i.testCaseId === "TC001");
    assert.equal(tc1After.segmentSummary.total, 2, "TC001 còn 2 block");

    // ===== 12. automationDecision: tester đặt MANUAL_ONLY =====
    const manual = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/testcases/TC002/automation-decision`, { decision: "MANUAL_ONLY" });
    assert.equal(manual.body.automationDecision, "MANUAL_ONLY", "đặt chỉ kiểm thử thủ công");
    const back = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/testcases/TC002/automation-decision`, { decision: "AUTOMATED" });
    assert.equal(back.body.automationDecision, "AUTOMATED", "cho phép lại");

    // ===== 13. Legacy 5B: TC004 không block nhưng recording APPROVED gắn thẳng testCaseId =====
    const startLegacy = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/recordings/start`, { testCaseId: "TC004", type: "TESTCASE" });
    const recLegacy = startLegacy.body.recordingId;
    await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/recordings/stop`, { recordingId: recLegacy, source: SRC });
    await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/recordings/${recLegacy}/approve`, { approvedBy: "tester" });
    await addConfirmedAssertion(baseUrl, wid, "TC004");
    const genLegacy = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/testcases/TC004/generate`, { confirmedTestData: {} });
    assert.equal(genLegacy.status, 200, "legacy generate 200 (tương thích ngược)");

    await closeServer(server);
    fs.rmSync(tempRoot, { recursive: true, force: true });
    console.log("Automation V3 Record Mapping test: PASS");
}
main().catch(e => { console.error(e); process.exit(1); });
