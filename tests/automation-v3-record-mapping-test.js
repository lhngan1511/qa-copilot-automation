import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import createApp from "../src/server/createApp.js";

/*
 Bước 5C-0 — Record Mapping (Recording Session → Segment → Tester Mapping).

 Kiểm chứng các quyết định đã duyệt (docs/DESIGN_RECORD_MAPPING.md + v3-record-mapping-wireframe.md):
   1. Mapping bằng testCaseId — KHÔNG theo thứ tự JSON / thứ tự recording.
   2. Recording KHÔNG gắn testcase khi start (1 bản ghi dài phục vụ nhiều testcase).
   3. Segment: tạo DRAFT / xác nhận / sửa → DRAFT / xóa; chặn chồng lấn + range lỗi + thiếu testcase.
   4. SETUP tách dùng chung (ghép trước steps testcase khi sinh).
   5. Generate: chưa có segment → RECORDING_MAPPING_REQUIRED; segment DRAFT → SEGMENT_NOT_CONFIRMED;
      nhiều segment sinh theo đúng thứ tự tester sắp xếp (↑/↓).
   6. Generate chỉ kiểm tra testcase đang Generate (recording còn bước chưa gán không chặn).
   7. Tương thích ngược: testcase không segment nhưng có recording APPROVED (luồng 5B legacy) vẫn sinh được.
   8. automationDecision: UNDECIDED → AUTOMATED (khi có segment xác nhận) / MANUAL_ONLY (tester đặt).
*/

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "v3-map-"));

// JSON approved — cố tình xếp NGƯỢC thứ tự thao tác (TC002 trước TC001) để chứng minh không phụ thuộc thứ tự.
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

// 1 take dài: đăng nhập → vào danh mục → thêm (6-8) → sửa (9-10) → xóa (11-12).
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
    const confirm = await req(baseUrl, "PATCH",
        `/api/automation-v3/workspaces/${wid}/testcases/${tcId}/assertions/${draft.body.id}/confirm`);
    assert.equal(confirm.body.status, "TESTER_CONFIRMED", `assertion TC${tcId} confirmed`);
}

async function main() {
    const dataDir = path.join(tempRoot, "data");
    const v3Out = path.join(tempRoot, "out");
    let { server, baseUrl } = await startServer(dataDir, v3Out);

    // ===== 1. Workspace: JSON xếp TC002 trước TC001 (thứ tự duyệt ≠ thứ tự thao tác) =====
    const created = await req(baseUrl, "POST", "/api/automation-v3/workspaces", { source: "NEW", module: "Danh mục", approvedTestCases: APPROVED });
    assert.equal(created.status, 200, "workspace 200");
    const wid = created.body.workspaceId;
    const orderInJson = created.body.items.map(i => i.testCaseId);
    assert.deepEqual(orderInJson, ["TC002", "TC001", "TC004", "TC003"], "JSON giữ thứ tự duyệt 2→1→4→3");
    for (const tc of ["TC001", "TC002", "TC003", "TC004"]) {
        await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/testcases/${tc}/select`);
    }

    // ===== 2. Start KHÔNG gắn testcase (1 bản ghi dài cho nhiều testcase) =====
    const start = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/recordings/start`, { type: "TESTCASE" });
    assert.equal(start.status, 200, "start không testCaseId 200");
    assert.equal(start.body.testCaseId, null, "recording chưa gán testcase");
    const recId = start.body.recordingId;

    const stop = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/recordings/stop`, { recordingId: recId, source: SRC });
    assert.equal(stop.body.status, "RECORDED", "stop RECORDED");
    assert.equal(stop.body.stepCount, 12, "12 bước");

    // detail trả segments rỗng ban đầu
    let detail = await req(baseUrl, "GET", `/api/automation-v3/workspaces/${wid}/recordings/${recId}`);
    assert.ok(Array.isArray(detail.body.segments) && detail.body.segments.length === 0, "detail có segments rỗng");

    // ===== 3. Tạo segment: SETUP + TC001 + TC002; validate lỗi =====
    const segSetup = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/recordings/${recId}/segments`,
        { startStep: 1, endStep: 5, type: "SETUP" });
    assert.equal(segSetup.status, 200, "setup 200");
    assert.equal(segSetup.body.status, "DRAFT", "setup DRAFT");

    const segTc1 = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/recordings/${recId}/segments`,
        { startStep: 6, endStep: 8, type: "TESTCASE", testCaseId: "TC001" });
    assert.equal(segTc1.status, 200, "TC001 seg 200");
    assert.equal(segTc1.body.testCaseId, "TC001", "gán đúng testCaseId");

    const segTc2 = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/recordings/${recId}/segments`,
        { startStep: 9, endStep: 10, type: "TESTCASE", testCaseId: "TC002" });
    assert.equal(segTc2.status, 200, "TC002 seg 200");

    // Chồng lấn → 409
    const overlap = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/recordings/${recId}/segments`,
        { startStep: 7, endStep: 9, type: "TESTCASE", testCaseId: "TC003" });
    assert.equal(overlap.status, 409, "overlap 409");
    assert.equal(overlap.body.errorCode, "SEGMENT_OVERLAP", "SEGMENT_OVERLAP");

    // Range ngoài steps → 400
    const badRange = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/recordings/${recId}/segments`,
        { startStep: 13, endStep: 14, type: "TESTCASE", testCaseId: "TC003" });
    assert.equal(badRange.status, 400, "range 400");
    assert.equal(badRange.body.errorCode, "SEGMENT_INVALID", "SEGMENT_INVALID");

    // TESTCASE thiếu testCaseId → 400
    const noTc = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/recordings/${recId}/segments`,
        { startStep: 6, endStep: 7, type: "TESTCASE" });
    assert.equal(noTc.status, 400, "thiếu testcase 400");
    assert.equal(noTc.body.errorCode, "SEGMENT_TYPE_REQUIRES_TESTCASE", "SEGMENT_TYPE_REQUIRES_TESTCASE");

    // ===== 4. Xác nhận segment → CONFIRMED; workspace AUTOMATED =====
    for (const seg of [segSetup, segTc1, segTc2]) {
        const conf = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/recordings/${recId}/segments/${seg.body.segmentId}/confirm`);
        assert.equal(conf.body.status, "CONFIRMED", "confirm segment");
    }
    let ws = await req(baseUrl, "GET", `/api/automation-v3/workspaces/${wid}`);
    const tc1 = ws.body.items.find(i => i.testCaseId === "TC001");
    const tc2 = ws.body.items.find(i => i.testCaseId === "TC002");
    assert.equal(tc1.automationDecision, "AUTOMATED", "TC001 → Có automation");
    assert.equal(tc1.segmentSummary.confirmed, 1, "TC001 1 đoạn xác nhận");
    assert.equal(tc2.automationDecision, "AUTOMATED", "TC002 → Có automation (dù đứng đầu JSON)");

    // ===== 5. Sửa segment đã CONFIRMED → quay về DRAFT (quyết định #2) =====
    const edited = await req(baseUrl, "PATCH", `/api/automation-v3/workspaces/${wid}/recordings/${recId}/segments/${segTc1.body.segmentId}`,
        { startStep: 6, endStep: 7 });
    assert.equal(edited.body.status, "DRAFT", "sửa → DRAFT");
    const reconf = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/recordings/${recId}/segments/${segTc1.body.segmentId}/confirm`);
    assert.equal(reconf.body.status, "CONFIRMED", "xác nhận lại");

    // ===== 6. Nhiều segment cho TC001 (6-8 và 11-12) + sắp xếp lại =====
    const segTc1b = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/recordings/${recId}/segments`,
        { startStep: 11, endStep: 12, type: "TESTCASE", testCaseId: "TC001" });
    await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/recordings/${recId}/segments/${segTc1b.body.segmentId}/confirm`);

    // Thứ tự mặc định: [6-8, 11-12] → đảo thành [11-12, 6-8]
    const reorder = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/segments/reorder`,
        { segmentIds: [segTc1b.body.segmentId, segTc1.body.segmentId] });
    assert.equal(reorder.status, 200, "reorder 200");
    assert.deepEqual(reorder.body.segments.map(s => s.segmentId), [segTc1b.body.segmentId, segTc1.body.segmentId], "thứ tự sau reorder");

    // ===== 7. Generate TC001: SETUP trước + thứ tự tester (xóa trước thêm) =====
    await addConfirmedAssertion(baseUrl, wid, "TC001");
    const gen1 = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/generate`, { confirmedTestData: {} });
    assert.equal(gen1.status, 200, "TC001 generate 200");
    const code1 = fs.readFileSync(gen1.body.outputPath, "utf8");
    assert.ok(code1.includes('page.goto("http://172.16.1.100:9230/wasuco/login")'), "setup login có trong spec");
    assert.ok(code1.indexOf("name: 'Xóa'") < code1.indexOf("name: 'Thêm'"), "thứ tự tester: xóa trước thêm");
    assert.ok(Array.isArray(gen1.body.metadata.segments) && gen1.body.metadata.segments.length === 2, "metadata 2 segment");
    assert.equal(gen1.body.validation.spec.syntaxValid, true, "syntax valid");

    // ===== 8. TC002 sinh từ đúng segment của nó (9-10) — không lấy đoạn TC001 dù TC002 đứng đầu JSON =====
    await addConfirmedAssertion(baseUrl, wid, "TC002");
    const gen2 = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/testcases/TC002/generate`, { confirmedTestData: {} });
    assert.equal(gen2.status, 200, "TC002 generate 200");
    const code2 = fs.readFileSync(gen2.body.outputPath, "utf8");
    assert.ok(code2.includes("name: 'Sửa'"), "TC002 có step sửa");
    assert.ok(!code2.includes("name: 'Thêm'"), "TC002 KHÔNG chứa step TC001 (mapping theo testCaseId, không theo thứ tự)");

    // ===== 9. Generate gating: TC003 chưa segment → RECORDING_MAPPING_REQUIRED =====
    const gen3 = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/testcases/TC003/generate`);
    assert.equal(gen3.status, 409, "TC003 chưa segment 409");
    assert.equal(gen3.body.errorCode, "RECORDING_MAPPING_REQUIRED", "RECORDING_MAPPING_REQUIRED");
    assert.equal(gen3.body.message, "Không có bản ghi thao tác cho testcase này.", "message chuẩn");

    // ===== 10. Segment DRAFT → SEGMENT_NOT_CONFIRMED (bản ghi thứ 2 riêng cho TC003) =====
    const start2 = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/recordings/start`, { type: "TESTCASE" });
    const rec2 = start2.body.recordingId;
    await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/recordings/stop`, { recordingId: rec2, source: SRC2 });
    const segTc3 = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/recordings/${rec2}/segments`,
        { startStep: 2, endStep: 3, type: "TESTCASE", testCaseId: "TC003" });
    assert.equal(segTc3.status, 200, "TC003 seg DRAFT");
    const gen3b = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/testcases/TC003/generate`);
    assert.equal(gen3b.body.errorCode, "SEGMENT_NOT_CONFIRMED", "DRAFT không generate");
    assert.equal(gen3b.body.message, "Bản ghi thao tác chưa được xác nhận.", "message chuẩn");

    await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/recordings/${rec2}/segments/${segTc3.body.segmentId}/confirm`);
    await addConfirmedAssertion(baseUrl, wid, "TC003");
    const gen3c = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/testcases/TC003/generate`, { confirmedTestData: {} });
    assert.equal(gen3c.status, 200, "TC003 generate sau confirm");

    // ===== 11. Xóa segment → gỡ mapping =====
    const del = await req(baseUrl, "DELETE", `/api/automation-v3/workspaces/${wid}/recordings/${recId}/segments/${segTc1b.body.segmentId}`);
    assert.equal(del.body.deleted, true, "xóa segment");
    ws = await req(baseUrl, "GET", `/api/automation-v3/workspaces/${wid}`);
    const tc1After = ws.body.items.find(i => i.testCaseId === "TC001");
    assert.equal(tc1After.segmentSummary.total, 1, "TC001 còn 1 đoạn");

    // ===== 12. automationDecision: tester đặt MANUAL_ONLY =====
    const manual = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/testcases/TC002/automation-decision`, { decision: "MANUAL_ONLY" });
    assert.equal(manual.body.automationDecision, "MANUAL_ONLY", "đặt chỉ kiểm thử thủ công");
    const back = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/testcases/TC002/automation-decision`, { decision: "AUTOMATED" });
    assert.equal(back.body.automationDecision, "AUTOMATED", "cho phép lại");

    // ===== 13. Legacy 5B: TC004 không segment nhưng recording APPROVED gắn thẳng testCaseId =====
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
