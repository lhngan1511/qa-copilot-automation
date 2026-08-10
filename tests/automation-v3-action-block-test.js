import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import createApp from "../src/server/createApp.js";

/*
 Checkpoint 6B — DATA MODEL: RecordingSession → ActionBlock (SNAPSHOT) → TestCaseAutomationBinding.

 Test bắt buộc A–G:
   A. PRIVATE BLOCK: tạo private block từ recording → binding TC001 → Generate PASS.
   B. SNAPSHOT: confirmed block → đổi/xóa raw recording → block snapshot giữ nguyên → generated actions không đổi.
   C. REUSE: REUSABLE block → bind TC001 + TC002 → reverse dependency trả [TC001, TC002]; không tự bind.
   D. DIFFERENT ASSERTIONS: cùng block, TC001/TC002 assertion khác → spec tương ứng.
   E. ORDER: sequence [B, A] dù recording [A, B] → spec B → A (không phụ thuộc recording order).
   F. LEGACY: dữ liệu Segment 5C → migrate → workflow vẫn chạy.
   G. NESTED COMPOSITION: sequence StockIn-P1 → AddUnitType → StockIn-P2 → AddCustomer → StockIn-Finish → spec giữ đúng thứ tự.
*/

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "v3-6b-"));

const APPROVED = [
    { id: "TC001", title: "Thao tác 1", module: "M", type: "POSITIVE", reviewStatus: "APPROVED", testData: { fields: {} } },
    { id: "TC002", title: "Thao tác 2", module: "M", type: "POSITIVE", reviewStatus: "APPROVED", testData: { fields: {} } }
];

// Recording 5 steps: A → B → C → D → E (order trong recording).
const SRC = `await page.goto('http://x/app');
await page.getByRole('button', { name: 'A' }).click();
await page.getByRole('button', { name: 'B' }).click();
await page.getByRole('button', { name: 'C' }).click();
await page.getByRole('button', { name: 'D' }).click();
await page.getByRole('button', { name: 'E' }).click();`;

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
async function addAssertion(baseUrl, wid, tcId, text) {
    const draft = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/testcases/${tcId}/assertions`,
        { type: "TEXT_VISIBLE", target: text, locator: `page.getByText('${text}')`, expected: text, matcher: "toBeVisible", source: "TESTER_INPUT", status: "DRAFT" });
    await req(baseUrl, "PATCH", `/api/automation-v3/workspaces/${wid}/testcases/${tcId}/assertions/${draft.body.id}/confirm`);
}

async function main() {
    const dataDir = path.join(tempRoot, "data");
    const v3Out = path.join(tempRoot, "out");
    let { server, baseUrl } = await startServer(dataDir, v3Out);

    const created = await req(baseUrl, "POST", "/api/automation-v3/workspaces", { source: "NEW", module: "M", approvedTestCases: APPROVED });
    const wid = created.body.workspaceId;
    await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/select`);
    await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/testcases/TC002/select`);

    // 1 recording (không gắn testcase) + 5 steps
    const st = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/recordings/start`, { type: "TESTCASE" });
    const recId = st.body.recordingId;
    await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/recordings/stop`, { recordingId: recId, source: SRC });

    // ===== A. PRIVATE BLOCK → binding → Generate PASS =====
    const blkA = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/blocks`,
        { recordingId: recId, startStep: 2, endStep: 2, scope: "PRIVATE" }); // step 2 = click A
    assert.equal(blkA.status, 200, "create private block 200");
    assert.equal(blkA.body.scope, "PRIVATE", "scope private");
    assert.equal(blkA.body.stepCount, 1, "snapshot 1 step");
    assert.equal(blkA.body.status, "DRAFT", "block mới DRAFT");
    await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/blocks/${blkA.body.blockId}/confirm`);
    const bindA = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/binding/blocks`, { blockId: blkA.body.blockId });
    assert.equal(bindA.status, 200, "bind 200");
    assert.equal(bindA.body.sequence.length, 1, "sequence 1 block");
    await addAssertion(baseUrl, wid, "TC001", "Kết quả A");
    const genA = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/generate`, { confirmedTestData: {} });
    assert.equal(genA.status, 200, "A: generate PASS");
    const codeA = fs.readFileSync(genA.body.outputPath, "utf8");
    assert.ok(codeA.includes("name: 'A'"), "A: spec chứa block A");

    // ===== B. SNAPSHOT: xóa raw recording → block snapshot giữ nguyên → generated actions không đổi =====
    const blkB = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/blocks`,
        { recordingId: recId, startStep: 3, endStep: 3 }); // step 3 = click B
    await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/blocks/${blkB.body.blockId}/confirm`);
    // Xóa RAW RECORDING (bằng chứng mạnh nhất: recording biến mất hoàn toàn)
    await req(baseUrl, "DELETE", `/api/automation-v3/workspaces/${wid}/recordings/${recId}`);
    await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/testcases/TC002/binding/blocks`, { blockId: blkB.body.blockId });
    await addAssertion(baseUrl, wid, "TC002", "Kết quả B");
    const genB = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/testcases/TC002/generate`, { confirmedTestData: {} });
    assert.equal(genB.status, 200, "B: generate PASS dù recording đã xóa (snapshot)");
    const codeB = fs.readFileSync(genB.body.outputPath, "utf8");
    assert.ok(codeB.includes("name: 'B'"), "B: spec vẫn chứa block B (snapshot giữ nguyên)");

    // ===== C. REUSE + reverse dependency; không tự bind =====
    // Recording mới (recId đã bị xóa ở test B) — steps 1=click C, 2=click D
    const stC = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/recordings/start`, { type: "TESTCASE" });
    const recC = stC.body.recordingId;
    await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/recordings/stop`,
        { recordingId: recC, source: "await page.getByRole('button', { name: 'C' }).click();\nawait page.getByRole('button', { name: 'D' }).click();" });
    const blkC = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/blocks`,
        { recordingId: recC, startStep: 1, endStep: 1, scope: "REUSABLE", label: "Thêm đơn vị tính" });
    assert.equal(blkC.status, 200, "create reusable 200");
    assert.equal(blkC.body.label, "Thêm đơn vị tính", "label bắt buộc đã có");
    // Không tự bind: sau createBlock, binding TC001/TC002 không chứa block mới
    const b1 = await req(baseUrl, "GET", `/api/automation-v3/workspaces/${wid}/testcases/TC001/binding`);
    const b2 = await req(baseUrl, "GET", `/api/automation-v3/workspaces/${wid}/testcases/TC002/binding`);
    assert.ok(!b1.body.sequence.some(s => s.blockId === blkC.body.blockId), "C: không tự bind TC001");
    assert.ok(!b2.body.sequence.some(s => s.blockId === blkC.body.blockId), "C: không tự bind TC002");
    // REUSABLE không label → 400
    const noLabel = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/blocks`,
        { recordingId: recC, startStep: 2, endStep: 2, scope: "REUSABLE" });
    assert.equal(noLabel.status, 400, "REUSABLE thiếu label → 400");

    await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/blocks/${blkC.body.blockId}/confirm`);
    await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/binding/blocks`, { blockId: blkC.body.blockId });
    await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/testcases/TC002/binding/blocks`, { blockId: blkC.body.blockId });
    const usage = await req(baseUrl, "GET", `/api/automation-v3/workspaces/${wid}/blocks/${blkC.body.blockId}/usage`);
    assert.deepEqual([...usage.body.testCaseIds].sort(), ["TC001", "TC002"], "C: reverse dependency trả TC001+TC002");

    // ===== D. DIFFERENT ASSERTIONS: cùng block nhưng assertion khác nhau =====
    // TC001 đã có assertion "Kết quả A"; TC002 đã có "Kết quả B". Cùng block C trong cả 2 binding.
    const genD1 = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/generate`, { confirmedTestData: {} });
    const genD2 = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/testcases/TC002/generate`, { confirmedTestData: {} });
    const codeD1 = fs.readFileSync(genD1.body.outputPath, "utf8");
    const codeD2 = fs.readFileSync(genD2.body.outputPath, "utf8");
    assert.ok(codeD1.includes("Kết quả A") && !codeD1.includes("Kết quả B"), "D: TC001 spec assertion riêng");
    assert.ok(codeD2.includes("Kết quả B") && !codeD2.includes("Kết quả A"), "D: TC002 spec assertion riêng");

    // ===== E. ORDER: sequence [B, A] dù recording [A, B] → spec B → A =====
    // Tạo workspace mới, recording steps A(1) B(2); block1=A, block2=B; binding TC001: [block2, block1]
    const created2 = await req(baseUrl, "POST", "/api/automation-v3/workspaces", { source: "NEW", module: "M2", approvedTestCases: APPROVED });
    const wid2 = created2.body.workspaceId;
    await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid2}/testcases/TC001/select`);
    const st2 = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid2}/recordings/start`, { type: "TESTCASE" });
    const rec2 = st2.body.recordingId;
    await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid2}/recordings/stop`,
        { recordingId: rec2, source: "await page.getByRole('button', { name: 'A' }).click();\nawait page.getByRole('button', { name: 'B' }).click();" });
    const blkE1 = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid2}/blocks`, { recordingId: rec2, startStep: 1, endStep: 1 });
    const blkE2 = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid2}/blocks`, { recordingId: rec2, startStep: 2, endStep: 2 });
    await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid2}/blocks/${blkE1.body.blockId}/confirm`);
    await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid2}/blocks/${blkE2.body.blockId}/confirm`);
    // Binding: B trước A (ngược recording)
    await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid2}/testcases/TC001/binding/blocks`, { blockId: blkE2.body.blockId });
    await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid2}/testcases/TC001/binding/blocks`, { blockId: blkE1.body.blockId });
    await addAssertion(baseUrl, wid2, "TC001", "Kết quả E");
    const genE = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid2}/testcases/TC001/generate`, { confirmedTestData: {} });
    const codeE = fs.readFileSync(genE.body.outputPath, "utf8");
    assert.ok(codeE.indexOf("name: 'B'") < codeE.indexOf("name: 'A'"), "E: spec B trước A (tester-owned order)");

    // ===== F. LEGACY: Segment 5C → migrate → workflow vẫn chạy =====
    const stF = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid2}/recordings/start`, { type: "TESTCASE" });
    const recF = stF.body.recordingId;
    await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid2}/recordings/stop`,
        { recordingId: recF, source: "await page.getByRole('button', { name: 'F1' }).click();\nawait page.getByRole('button', { name: 'F2' }).click();" });
    // Tạo segment kiểu 5C-0 (gắn testCaseId TC002)
    const segF = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid2}/recordings/${recF}/segments`,
        { startStep: 1, endStep: 2, type: "TESTCASE", testCaseId: "TC002" });
    await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid2}/recordings/${recF}/segments/${segF.body.segmentId}/confirm`);
    await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid2}/testcases/TC002/select`);
    await addAssertion(baseUrl, wid2, "TC002", "Kết quả F");
    const genF = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid2}/testcases/TC002/generate`, { confirmedTestData: {} });
    assert.equal(genF.status, 200, "F: legacy segment → migrate → generate PASS");
    const codeF = fs.readFileSync(genF.body.outputPath, "utf8");
    assert.ok(codeF.includes("name: 'F1'") && codeF.includes("name: 'F2'"), "F: spec từ segment migrated");
    // Sau migrate: binding đã tồn tại (canonical)
    const bindF = await req(baseUrl, "GET", `/api/automation-v3/workspaces/${wid2}/testcases/TC002/binding`);
    assert.ok(bindF.body.sequence.length >= 1, "F: binding tồn tại sau migrate");

    // ===== G. NESTED COMPOSITION: Main → Sub → Main → Sub → Finish =====
    const created3 = await req(baseUrl, "POST", "/api/automation-v3/workspaces", { source: "NEW", module: "M3", approvedTestCases: APPROVED });
    const wid3 = created3.body.workspaceId;
    await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid3}/testcases/TC001/select`);
    const stG = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid3}/recordings/start`, { type: "TESTCASE" });
    const recG = stG.body.recordingId;
    await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid3}/recordings/stop`,
        { recordingId: recG, source: [
            "await page.getByRole('button', { name: 'StockIn-Part1' }).click();",
            "await page.getByRole('button', { name: 'AddUnitType' }).click();",
            "await page.getByRole('button', { name: 'StockIn-Part2' }).click();",
            "await page.getByRole('button', { name: 'AddCustomer' }).click();",
            "await page.getByRole('button', { name: 'StockIn-Finish' }).click();"
        ].join("\n") });
    const blockOrder = ["StockIn-Part1", "AddUnitType", "StockIn-Part2", "AddCustomer", "StockIn-Finish"];
    const blocks = {};
    for (let i = 0; i < 5; i++) {
        const b = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid3}/blocks`,
            { recordingId: recG, startStep: i + 1, endStep: i + 1, scope: "REUSABLE", label: blockOrder[i] });
        await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid3}/blocks/${b.body.blockId}/confirm`);
        blocks[blockOrder[i]] = b.body.blockId;
    }
    // Sequence đúng nested: P1 → AddUnitType → P2 → AddCustomer → Finish
    for (const name of blockOrder) {
        await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid3}/testcases/TC001/binding/blocks`, { blockId: blocks[name] });
    }
    await addAssertion(baseUrl, wid3, "TC001", "Kết quả G");
    const genG = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid3}/testcases/TC001/generate`, { confirmedTestData: {} });
    assert.equal(genG.status, 200, "G: nested generate PASS");
    const codeG = fs.readFileSync(genG.body.outputPath, "utf8");
    let prev = -1;
    for (const name of blockOrder) {
        const idx = codeG.indexOf(`name: '${name}'`);
        assert.ok(idx > prev, `G: thứ tự đúng — ${name} sau các block trước`);
        prev = idx;
    }
    assert.ok(Array.isArray(genG.body.metadata?.segments) && genG.body.metadata.segments.length === 5, "G: trace 5 block");

    await closeServer(server);
    fs.rmSync(tempRoot, { recursive: true, force: true });
    console.log("Automation V3 ActionBlock (6B) test: PASS");
}
main().catch(e => { console.error(e); process.exit(1); });
