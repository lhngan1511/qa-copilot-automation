import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import createApp from "../src/server/createApp.js";

/*
 Checkpoint 6C.2 — RECORDED ASSERTION CORRECTION.

   A. Parser: 3 actions + 1 expect → steps=3, assertions=1.
   B. Whole recording → ActionBlock snapshot recordedAssertions=1.
   C. Partial range → recorded assertion chỉ kèm khi source position thuộc rule (expect ngay sau action cuối).
   D. Snapshot: confirmed block → xóa raw recording → block vẫn giữ recorded assertion.
   E. UI candidate: source=RECORDED, status=SUGGESTED (không TESTER_CONFIRMED).
   F. Confirm candidate → TESTER_CONFIRMED → Generate dùng assertion.
   G. Ignore candidate → Generate không âm thầm dùng.
   H. No expect → UI fallback (không candidate).
   I. Multiple expect → tester chọn lọc.
   J. expect không làm tăng số thao tác (stepCount=3, recordedAssertionCount=1).
*/

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "v3-6c2-"));
const APPROVED = [{
    id: "TC001", title: "Đăng nhập thành công", module: "Login", type: "POSITIVE",
    reviewStatus: "APPROVED", expectedResult: "Người dùng đăng nhập thành công khi tài khoản và mật khẩu hợp lệ.", testData: { fields: {} }
}];
const SRC = `await page.goto('http://x/login');
await page.getByRole('textbox', { name: 'Tài khoản' }).fill('admin');
await page.getByRole('textbox', { name: 'Mật khẩu' }).fill('123456@Aa');
await page.getByRole('button', { name: 'Đăng nhập' }).click();
await expect(page.getByRole('button', { name: 'adminButton' })).toBeVisible();`;
const SRC_MULTI = `await page.getByRole('textbox', { name: 'Tìm kiếm' }).fill('ABC');
await page.getByRole('button', { name: 'Tìm kiếm' }).click();
await expect(page.getByText('ABC')).toBeVisible();
await expect(page.getByRole('heading', { name: 'Tổng số kết quả = 3' })).toBeVisible();`;
const SRC_NO_EXPECT = `await page.getByRole('button', { name: 'A' }).click();
await page.getByRole('button', { name: 'B' }).click();`;

async function startServer(dataDir, v3Out) {
    const app = createApp({ repositoryType: "file", dataDir, outputDir: path.join(dataDir, "o"), v3OutputDir: v3Out });
    return new Promise(resolve => { const server = app.listen(0, "127.0.0.1", () => resolve({ server, baseUrl: `http://127.0.0.1:${server.address().port}` })); });
}
function closeServer(server) { return new Promise(r => server.close(r)); }
async function req(baseUrl, method, p, body) {
    const json = body !== undefined;
    const res = await fetch(`${baseUrl}${p}`, { method, headers: json ? { "content-type": "application/json" } : {}, body: json ? JSON.stringify(body) : undefined });
    let data; try { data = await res.json(); } catch { data = null; }
    return { status: res.status, body: data };
}
async function paste(baseUrl, wid, src) {
    const st = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/recordings/start`, { type: "TESTCASE" });
    await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/recordings/stop`, { recordingId: st.body.recordingId, source: src });
    return st.body.recordingId;
}
async function makeBlock(baseUrl, wid, recId, startStep, endStep) {
    const b = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/blocks`, { recordingId: recId, startStep, endStep });
    await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/blocks/${b.body.blockId}/confirm`);
    return b.body;
}

async function main() {
    const dataDir = path.join(tempRoot, "data");
    const v3Out = path.join(tempRoot, "out");
    let { server, baseUrl } = await startServer(dataDir, v3Out);
    const created = await req(baseUrl, "POST", "/api/automation-v3/workspaces", { source: "NEW", module: "Login", approvedTestCases: APPROVED });
    const wid = created.body.workspaceId;
    await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/select`);

    // ===== A. Parser: 3 actions + 1 expect =====
    const recId = await paste(baseUrl, wid, SRC);
    const detail = await req(baseUrl, "GET", `/api/automation-v3/workspaces/${wid}/recordings/${recId}`);
    assert.equal(detail.body.steps.length, 4, "A: steps=4 (expect không tính là action)");
    assert.equal(detail.body.assertions.length, 1, "A: assertions=1");

    // ===== B. Whole recording → block snapshot recordedAssertions=1 =====
    const blkWhole = await makeBlock(baseUrl, wid, recId, 1, 4);
    assert.equal(blkWhole.stepCount, 4, "B: stepCount=4");
    assert.equal(blkWhole.recordedAssertionCount, 1, "B: recordedAssertionCount=1");
    assert.equal(blkWhole.recordedAssertions[0].matcher, "toBeVisible", "B: matcher giữ nguyên");
    assert.ok(blkWhole.recordedAssertions[0].locator.includes("adminButton"), "B: locator giữ nguyên");

    // ===== J. expect không tăng count =====
    assert.equal(blkWhole.steps.length, 4, "J: steps=4 (expect không tính)");

    // ===== D. Snapshot: xóa raw recording → block vẫn giữ =====
    await req(baseUrl, "DELETE", `/api/automation-v3/workspaces/${wid}/recordings/${recId}`);
    const blkAfter = await req(baseUrl, "GET", `/api/automation-v3/workspaces/${wid}/blocks/${blkWhole.blockId}`);
    // (dùng binding để lấy lại blockDto qua getBinding)
    const bind1 = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/binding/blocks`, { blockId: blkWhole.blockId });
    assert.equal(bind1.body.sequence.length, 1, "D: bind 1");
    const g2 = await req(baseUrl, "GET", `/api/automation-v3/workspaces/${wid}/testcases/TC001/binding`);
    assert.equal(g2.body.sequence[0].recordedAssertionCount, 1, "D: recorded assertion giữ sau khi xóa recording");
    assert.ok(g2.body.sequence[0].recordedAssertions[0].locator.includes("adminButton"), "D: snapshot giữ locator");

    // ===== E. UI candidate: source=RECORDED, status=SUGGESTED =====
    const sug = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/assertions/suggest`);
    assert.equal(sug.body.recordedCandidates.length, 1, "E: 1 recorded candidate");
    const cand = sug.body.recordedCandidates[0];
    assert.equal(cand.source, "RECORDED", "E: source=RECORDED");
    assert.equal(cand.status, "SUGGESTED", "E: status=SUGGESTED (không TESTER_CONFIRMED)");
    assert.ok(cand.locator.includes("adminButton"), "E: locator từ recording");

    // ===== F. Confirm candidate → TESTER_CONFIRMED → Generate dùng =====
    const confirmRes = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/assertions`,
        { type: cand.type, target: cand.target, locator: cand.locator, expected: cand.expected, matcher: cand.matcher, source: "RECORDED", status: "TESTER_CONFIRMED" });
    assert.equal(confirmRes.body.status, "TESTER_CONFIRMED", "F: confirm → TESTER_CONFIRMED");
    assert.equal(confirmRes.body.source, "RECORDED", "F: source=RECORDED");
    const genF = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/generate`, { confirmedTestData: {} });
    assert.equal(genF.status, 200, "F: generate PASS");
    const codeF = fs.readFileSync(genF.body.outputPath, "utf8");
    assert.ok(codeF.includes("adminButton") && codeF.includes("toBeVisible"), "F: spec dùng assertion recorded đã xác nhận");

    // ===== C. Partial range: expect ngay sau action cuối (click Login) → kèm theo =====
    // Recording SRC: 3 actions (goto, fill account, fill pass, click Login = 4 actions thực) — chọn 2..4 (fill+fill+click)
    // expect nằm ngay sau click Login → thuộc trailing window → kèm.
    const createdP = await req(baseUrl, "POST", "/api/automation-v3/workspaces", { source: "NEW", module: "Login", approvedTestCases: APPROVED });
    const widP = createdP.body.workspaceId;
    await req(baseUrl, "POST", `/api/automation-v3/workspaces/${widP}/testcases/TC001/select`);
    const recP = await paste(baseUrl, widP, SRC);
    const blkP = await makeBlock(baseUrl, widP, recP, 2, 4); // fill account → fill pass → click Login
    assert.equal(blkP.stepCount, 3, "C: partial 3 actions");
    assert.equal(blkP.recordedAssertionCount, 1, "C: expect ngay sau action cuối → kèm theo");
    // Chọn range xa expect (chỉ goto) → KHÔNG kèm
    const blkP2 = await makeBlock(baseUrl, widP, recP, 1, 1);
    assert.equal(blkP2.recordedAssertionCount, 0, "C: range xa expect → không kèm");

    // ===== G. Ignore candidate → không dùng âm thầm =====
    // (bỏ qua = không tạo assertion; testcase mới để chứng minh)
    const created2 = await req(baseUrl, "POST", "/api/automation-v3/workspaces", { source: "NEW", module: "Login", approvedTestCases: APPROVED });
    const wid2 = created2.body.workspaceId;
    await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid2}/testcases/TC001/select`);
    const rec2 = await paste(baseUrl, wid2, SRC);
    const blk2 = await makeBlock(baseUrl, wid2, rec2, 1, 4);
    await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid2}/testcases/TC001/binding/blocks`, { blockId: blk2.blockId });
    // KHÔNG confirm candidate → chỉ có assertion khác
    const d2 = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid2}/testcases/TC001/assertions`,
        { type: "TEXT_VISIBLE", target: "Khác", locator: "page.getByText('Khác')", expected: "Khác", matcher: "toBeVisible", source: "TESTER_INPUT", status: "TESTER_CONFIRMED" });
    const genG = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid2}/testcases/TC001/generate`, { confirmedTestData: {} });
    const codeG = fs.readFileSync(genG.body.outputPath, "utf8");
    assert.ok(!codeG.includes("adminButton"), "G: candidate bị bỏ qua → không vào spec");

    // ===== H. No expect → không candidate (workspace riêng để tránh nhiễm) =====
    const createdH = await req(baseUrl, "POST", "/api/automation-v3/workspaces", { source: "NEW", module: "Login", approvedTestCases: APPROVED });
    const widH = createdH.body.workspaceId;
    await req(baseUrl, "POST", `/api/automation-v3/workspaces/${widH}/testcases/TC001/select`);
    const rec3 = await paste(baseUrl, widH, SRC_NO_EXPECT);
    const blk3 = await makeBlock(baseUrl, widH, rec3, 1, 2);
    assert.equal(blk3.recordedAssertionCount, 0, "H: không recorded candidate");
    await req(baseUrl, "POST", `/api/automation-v3/workspaces/${widH}/testcases/TC001/binding/blocks`, { blockId: blk3.blockId });
    const sugH = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${widH}/testcases/TC001/assertions/suggest`);
    assert.equal(sugH.body.recordedCandidates.length, 0, "H: recordedCandidates=[] (fallback: Đề xuất / Tự bổ sung)");

    // ===== I. Multiple expect → tester chọn lọc (workspace riêng) =====
    const createdI = await req(baseUrl, "POST", "/api/automation-v3/workspaces", { source: "NEW", module: "Login", approvedTestCases: APPROVED });
    const widI = createdI.body.workspaceId;
    await req(baseUrl, "POST", `/api/automation-v3/workspaces/${widI}/testcases/TC001/select`);
    const rec4 = await paste(baseUrl, widI, SRC_MULTI);
    const blk4 = await makeBlock(baseUrl, widI, rec4, 1, 2);
    assert.equal(blk4.recordedAssertionCount, 2, "I: 2 recorded candidates");
    await req(baseUrl, "POST", `/api/automation-v3/workspaces/${widI}/testcases/TC001/binding/blocks`, { blockId: blk4.blockId });
    const sugI = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${widI}/testcases/TC001/assertions/suggest`);
    assert.equal(sugI.body.recordedCandidates.length, 2, "I: 2 candidates hiển thị riêng");
    // Confirm 1 trong 2 → chỉ 1 vào spec
    const c1 = sugI.body.recordedCandidates[0];
    await req(baseUrl, "POST", `/api/automation-v3/workspaces/${widI}/testcases/TC001/assertions`,
        { type: c1.type, target: c1.target, locator: c1.locator, expected: c1.expected, matcher: c1.matcher, source: "RECORDED", status: "TESTER_CONFIRMED" });
    // P0 TC001 — input 'Tìm kiếm' cần data (VALUE) trước Generate (không fallback recorded).
    const genI = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${widI}/testcases/TC001/generate`, { confirmedTestData: { "Tìm kiếm": "ABC" } });
    const codeI = fs.readFileSync(genI.body.outputPath, "utf8");
    const c2 = sugI.body.recordedCandidates[1];
    assert.ok(codeI.includes(c1.target), "I: candidate đã xác nhận vào spec");
    assert.ok(!codeI.includes(c2.target), "I: candidate bỏ qua không vào spec");

    await closeServer(server);
    fs.rmSync(tempRoot, { recursive: true, force: true });
    console.log("Automation V3 Recorded Assertion (6C.2) test: PASS");
}
main().catch(e => { console.error(e); process.exit(1); });
