import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import createApp from "../src/server/createApp.js";

/*
 Checkpoint 6C.1 — Workflow thật TC001 + ADD/REPLACE + state consistency.

 Verify (mục 16):
   - Fresh: paste 8 steps → select all → confirm → binding 1 item CONFIRMED → reload → vẫn CONFIRMED
     → card 1/1 → expected còn nguyên → assertion confirm → Generate PASS (không cần approve recording).
   A. Confirm action không tự tạo duplicate binding (replaceAll).
   B. ADD chỉ append khi dùng [+ Thêm thao tác].
   C. REPLACE chỉ replace item được chọn.
   D. DRAFT action không Generate âm thầm (409 + message tên thao tác).
   E. Không success+error đồng thời (drawer không nút Duyệt; page clear notice).
   F. Raw recording vẫn trace được (listRecordings qua binding).
   G. Snapshot không bị phá khi raw recording xóa (contract 6B).
   H. Legacy migration không tạo duplicate ActionBlock/binding sau reload.
*/

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "v3-6c1-"));
const APPROVED = [{
    id: "TC001", title: "Đăng nhập hoạt động thành công với dữ liệu hợp lệ", module: "Login", type: "POSITIVE",
    reviewStatus: "APPROVED", expectedResult: "Người dùng đăng nhập thành công", testData: { fields: {} }
}];
const SRC8 = Array.from({ length: 8 }, (_, i) => `await page.getByRole('button', { name: 'B${i + 1}' }).click();`).join("\n");

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
async function addAssertion(baseUrl, wid, tcId) {
    const d = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/testcases/${tcId}/assertions`,
        { type: "TEXT_VISIBLE", target: "Thành công", locator: "page.getByText('Thành công')", expected: "Thành công", matcher: "toBeVisible", source: "TESTER_INPUT", status: "DRAFT" });
    await req(baseUrl, "PATCH", `/api/automation-v3/workspaces/${wid}/testcases/${tcId}/assertions/${d.body.id}/confirm`);
}
async function pasteRecording(baseUrl, wid, src) {
    const st = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/recordings/start`, { type: "TESTCASE" });
    const stop = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/recordings/stop`, { recordingId: st.body.recordingId, source: src });
    return stop.body.recordingId ?? st.body.recordingId;
}
async function confirmAction(baseUrl, wid, tcId, recId, startStep, endStep) {
    const blk = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/blocks`, { recordingId: recId, startStep, endStep });
    await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/blocks/${blk.body.blockId}/confirm`);
    return blk.body.blockId;
}

async function main() {
    const dataDir = path.join(tempRoot, "data");
    const v3Out = path.join(tempRoot, "out");
    let { server, baseUrl } = await startServer(dataDir, v3Out);

    const created = await req(baseUrl, "POST", "/api/automation-v3/workspaces", { source: "NEW", module: "Login", approvedTestCases: APPROVED });
    const wid = created.body.workspaceId;
    await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/select`);

    // ===== Workflow TC001 fresh (UI: create+confirm+bind = composition đầu tiên) =====
    const recId = await pasteRecording(baseUrl, wid, SRC8);
    const blockId = await confirmAction(baseUrl, wid, "TC001", recId, 1, 8);
    await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/binding/blocks`, { blockId });
    let binding = await req(baseUrl, "GET", `/api/automation-v3/workspaces/${wid}/testcases/TC001/binding`);
    assert.equal(binding.body.sequence.length, 1, "fresh confirm → 1 item");
    assert.equal(binding.body.sequence[0].status, "CONFIRMED", "item CONFIRMED");
    assert.equal(binding.body.sequence[0].blockId, blockId, "đúng block");

    // Reload → vẫn CONFIRMED (state consistency card/drawer cùng canonical)
    let ws = await req(baseUrl, "GET", `/api/automation-v3/workspaces/${wid}`);
    let tc = ws.body.items.find(i => i.testCaseId === "TC001");
    assert.equal(tc.segmentSummary.confirmed, 1, "reload: card 1/1 confirmed");
    assert.equal(tc.segments[0].status, "CONFIRMED", "reload: segment CONFIRMED");
    assert.equal(tc.expectedResult, "Người dùng đăng nhập thành công", "expected còn nguyên");

    // ===== A. Confirm lần 2 (replaceAll: unbind hết → bind mới) → KHÔNG duplicate =====
    const blockId2 = await confirmAction(baseUrl, wid, "TC001", recId, 2, 3);
    await req(baseUrl, "DELETE", `/api/automation-v3/workspaces/${wid}/testcases/TC001/binding/blocks/${blockId}`);
    await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/binding/blocks`, { blockId: blockId2 });
    binding = await req(baseUrl, "GET", `/api/automation-v3/workspaces/${wid}/testcases/TC001/binding`);
    assert.equal(binding.body.sequence.length, 1, "A: replaceAll không duplicate");
    assert.equal(binding.body.sequence[0].blockId, blockId2, "A: binding là block mới");

    // ===== B. ADD chỉ append khi dùng [+ Thêm thao tác] =====
    const blockB = await confirmAction(baseUrl, wid, "TC001", recId, 4, 5);
    const bindB = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/binding/blocks`, { blockId: blockB });
    assert.equal(bindB.body.sequence.length, 2, "B: append → 2 items");
    assert.deepEqual(bindB.body.sequence.map(s => s.blockId), [blockId2, blockB], "B: giữ item cũ + thêm mới");

    // ===== C. REPLACE chỉ replace item được chọn =====
    const blockC = await confirmAction(baseUrl, wid, "TC001", recId, 6, 6);
    const oldIndex = 0; // vị trí của blockId2 trong binding [blockId2, blockB]
    await req(baseUrl, "DELETE", `/api/automation-v3/workspaces/${wid}/testcases/TC001/binding/blocks/${blockId2}`);
    await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/binding/blocks`, { blockId: blockC });
    // UI giữ vị trí cũ: reorder đưa block mới về vị trí của item bị thay thế
    const cur = await req(baseUrl, "GET", `/api/automation-v3/workspaces/${wid}/testcases/TC001/binding`);
    const seqArr = cur.body.sequence.map(i => i.blockId); // [blockB, blockC]
    const moved = seqArr.pop();
    seqArr.splice(oldIndex, 0, moved); // [blockC, blockB]
    const bindC = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/binding/reorder`, { blockIds: seqArr });
    assert.equal(bindC.body.sequence.length, 2, "C: replace 1 item → vẫn 2");
    assert.deepEqual(bindC.body.sequence.map(s => s.blockId), [blockC, blockB], "C: đúng item thay thế tại vị trí cũ");

    // ===== D. DRAFT không Generate âm thầm =====
    const blkDraft = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/blocks`, { recordingId: recId, startStep: 7, endStep: 8, scope: "REUSABLE", label: "Hoàn tất" });
    await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/binding/blocks`, { blockId: blkDraft.body.blockId });
    await addAssertion(baseUrl, wid, "TC001");
    const genD = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/generate`, { confirmedTestData: {} });
    assert.equal(genD.status, 409, "D: DRAFT chặn generate");
    assert.equal(genD.body.errorCode, "SEGMENT_NOT_CONFIRMED", "D: errorCode");
    assert.equal(genD.body.message, "Thao tác 'Hoàn tất' chưa được xác nhận.", "D: message tên thao tác");

    // Confirm DRAFT → generate PASS (workflow hoàn tất)
    await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/blocks/${blkDraft.body.blockId}/confirm`);
    const genOk = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/generate`, { confirmedTestData: {} });
    assert.equal(genOk.status, 200, "generate PASS sau khi confirm hết");
    const code = fs.readFileSync(genOk.body.outputPath, "utf8");
    assert.ok(code.includes("toBeVisible"), "spec chứa assertion");

    // ===== F. Raw recording trace được (qua binding) =====
    const recs = await req(baseUrl, "GET", `/api/automation-v3/workspaces/${wid}/testcases/TC001/recordings`);
    assert.ok(recs.body.some(r => r.recordingId === recId), "F: recording trace được qua binding");

    // ===== G. Snapshot không phá khi xóa raw recording =====
    await req(baseUrl, "DELETE", `/api/automation-v3/workspaces/${wid}/recordings/${recId}`);
    const genG = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/generate`, { confirmedTestData: {} });
    assert.equal(genG.status, 200, "G: generate vẫn chạy sau khi xóa recording (snapshot)");

    // ===== H. Legacy migration không duplicate sau reload =====
    const wsH1 = await req(baseUrl, "GET", `/api/automation-v3/workspaces/${wid}`);
    const blocksH1 = wsH1.body.items.find(i => i.testCaseId === "TC001").segments.length;
    const wsH2 = await req(baseUrl, "GET", `/api/automation-v3/workspaces/${wid}`);
    const blocksH2 = wsH2.body.items.find(i => i.testCaseId === "TC001").segments.length;
    assert.equal(blocksH1, blocksH2, "H: reload không duplicate (cùng số item)");

    // ===== E (static): drawer không nút Duyệt; page clear notice =====
    const drawerSrc = fs.readFileSync(path.join("web-ui/src/components/automationV3/V3ReviewDrawer.jsx"), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    assert.ok(!drawerSrc.includes("Duyệt recording"), "E: drawer không còn Duyệt recording");
    const pageSrc = fs.readFileSync(path.join("web-ui/src/pages/AutomationV3Page.jsx"), "utf8");
    assert.ok(pageSrc.includes('setNotice("")'), "E: page clear notice trước khi approve (không success+error đồng thời)");

    await closeServer(server);
    fs.rmSync(tempRoot, { recursive: true, force: true });
    console.log("Automation V3 Workflow (6C.1) test: PASS");
}
main().catch(e => { console.error(e); process.exit(1); });
