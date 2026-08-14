import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import createApp from "../src/server/createApp.js";

/*
 BOUNDARY MVP — ACTION LIBRARY (shared asset).

 Case Đơn vị tính (kiểm chứng):
   - 1 recording dài → cắt nhiều block (Login/Open/Search/Edit).
   - Tester chủ động LƯU vào Thư viện (label bắt buộc; không tự lưu).
   - TC Sửa compose: Login → Open → Search → Edit → Search (repeated Search).
   - reload / workspace KHÁC vẫn dùng lại được asset từ Library (shared, không nằm trong workspace).
   - usage derive từ bindings (KHÔNG lưu usedByTestCases).
*/

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "lib-"));
const APPROVED = [
    { id: "TC001", title: "Sửa đơn vị tính thành công", module: "Đơn vị tính", type: "POSITIVE", reviewStatus: "APPROVED", expectedResult: "Sửa thành công", testData: { fields: {} } },
    { id: "TC002", title: "Tìm kiếm đơn vị tính", module: "Đơn vị tính", type: "POSITIVE", reviewStatus: "APPROVED", expectedResult: "Tìm thấy kết quả", testData: { fields: {} } }
];
// 1 recording dài: Login(1-4) → Open(5-6) → Add(7-10) → Search(11-12) → Edit(13-16) → Search(17-18)
const SRC = `await page.goto('http://x/login');
await page.getByRole('textbox', { name: 'Tài khoản' }).fill('admin');
await page.getByRole('textbox', { name: 'Mật khẩu' }).fill('123456@Aa');
await page.getByRole('button', { name: 'Đăng nhập' }).click();
await page.getByRole('button', { name: 'Danh mục' }).click();
await page.getByRole('button', { name: 'Đơn vị tính' }).click();
await page.getByRole('button', { name: 'Thêm' }).click();
await page.getByLabel('Mã').fill('KG');
await page.getByLabel('Tên').fill('Kilôgam');
await page.getByRole('button', { name: 'Lưu' }).click();
await page.getByRole('textbox', { name: 'Tìm kiếm' }).fill('KG');
await page.getByRole('button', { name: 'Tìm kiếm' }).click();
await page.getByRole('button', { name: 'Sửa' }).click();
await page.getByLabel('Tên').fill('Kilôgam mới');
await page.getByRole('button', { name: 'Lưu' }).click();
await page.getByRole('textbox', { name: 'Tìm kiếm' }).fill('KG');
await page.getByRole('button', { name: 'Tìm kiếm' }).click();`;

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
async function pasteRecording(baseUrl, wid, src) {
    const st = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/recordings/start`, { type: "TESTCASE" });
    const stop = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/recordings/stop`, { recordingId: st.body.recordingId, source: src });
    return stop.body.recordingId ?? st.body.recordingId;
}
async function cutBlock(baseUrl, wid, recId, startStep, endStep, label = null) {
    const blk = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/blocks`, { recordingId: recId, startStep, endStep, label });
    await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/blocks/${blk.body.blockId}/confirm`);
    return blk.body.blockId;
}
async function addAssertion(baseUrl, wid, tcId) {
    const d = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid}/testcases/${tcId}/assertions`,
        { type: "TEXT_VISIBLE", target: "Thành công", locator: "page.getByText('Thành công')", expected: "Thành công", matcher: "toBeVisible", source: "TESTER_INPUT", status: "TESTER_CONFIRMED" });
    return d.body.id;
}

async function main() {
    const dataDir = path.join(tempRoot, "data");
    const v3Out = path.join(tempRoot, "out");
    let { server, baseUrl } = await startServer(dataDir, v3Out);

    // ===== WS1: paste 1 recording dài → cắt nhiều block =====
    const c1 = await req(baseUrl, "POST", "/api/automation-v3/workspaces", { source: "NEW", module: "Đơn vị tính", approvedTestCases: APPROVED });
    const wid1 = c1.body.workspaceId;
    await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid1}/testcases/TC001/select`);
    const recId = await pasteRecording(baseUrl, wid1, SRC);
    const blkLogin = await cutBlock(baseUrl, wid1, recId, 1, 4);
    const blkOpen = await cutBlock(baseUrl, wid1, recId, 5, 6);
    const blkSearch = await cutBlock(baseUrl, wid1, recId, 11, 12);
    const blkEdit = await cutBlock(baseUrl, wid1, recId, 13, 16);

    // ===== Lưu vào Thư viện (chủ động — KHÔNG tự lưu) =====
    // Trước khi lưu: library rỗng
    let lib = await req(baseUrl, "GET", `/api/automation-v3/workspaces/${wid1}/library`);
    assert.equal(lib.body.length, 0, "library rỗng trước khi lưu (không tự lưu)");
    // Lưu thiếu label → 400
    const noLabel = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid1}/library`, { blockId: blkLogin });
    assert.equal(noLabel.status, 400, "lưu thư viện thiếu label → 400");
    // Lưu 4 thao tác
    for (const [blk, label] of [[blkLogin, "Đăng nhập"], [blkOpen, "Mở Đơn vị tính"], [blkSearch, "Tìm kiếm"], [blkEdit, "Sửa đơn vị tính"]]) {
        const r = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid1}/library`, { blockId: blk, label });
        assert.equal(r.status, 200, `lưu ${label}`);
        assert.ok(r.body.blockId.startsWith("LIB-"), "blockId dạng LIB-");
    }
    lib = await req(baseUrl, "GET", `/api/automation-v3/workspaces/${wid1}/library`);
    assert.equal(lib.body.length, 4, "library có 4 thao tác");
    assert.equal(lib.body.every(b => b.label), true, "mọi block library có label");
    assert.equal(lib.body.every(b => b.usedByTestCases === 0), true, "usage ban đầu = 0 (derive)");

    // ===== TC Sửa compose từ Library: Login → Open → Search → Edit → Search =====
    const libMap = Object.fromEntries(lib.body.map(b => [b.label, b.blockId]));
    await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid1}/testcases/TC001/library/blocks`, { blockId: libMap["Đăng nhập"] });
    await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid1}/testcases/TC001/library/blocks`, { blockId: libMap["Mở Đơn vị tính"] });
    await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid1}/testcases/TC001/library/blocks`, { blockId: libMap["Tìm kiếm"] });
    await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid1}/testcases/TC001/library/blocks`, { blockId: libMap["Sửa đơn vị tính"] });
    await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid1}/testcases/TC001/library/blocks`, { blockId: libMap["Tìm kiếm"] }); // repeated Search
    let bind = await req(baseUrl, "GET", `/api/automation-v3/workspaces/${wid1}/testcases/TC001/binding`);
    assert.equal(bind.body.sequence.length, 5, "TC Sửa: 5 thao tác");
    assert.deepEqual(bind.body.sequence.map(x => x.blockId), [libMap["Đăng nhập"], libMap["Mở Đơn vị tính"], libMap["Tìm kiếm"], libMap["Sửa đơn vị tính"], libMap["Tìm kiếm"]],
        "sequence đúng Login→Open→Search→Edit→Search (Search lặp)");

    // usage derive: Search dùng 2 lần trong binding TC001
    lib = await req(baseUrl, "GET", `/api/automation-v3/workspaces/${wid1}/library`);
    const usageSearch = lib.body.find(b => b.label === "Tìm kiếm").usedByTestCases;
    assert.equal(usageSearch, 2, "usage derive: Tìm kiếm xuất hiện 2 lần trong binding");

    // ===== Generate TC Sửa =====
    await addAssertion(baseUrl, wid1, "TC001");
    const gen = await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid1}/testcases/TC001/generate`, { confirmedTestData: { "Mã": "KG", "Tên": "Kilôgam", "Tìm kiếm": "KG" } });
    assert.equal(gen.status, 200, "generate TC Sửa PASS");
    const code = fs.readFileSync(gen.body.outputPath, "utf8");
    assert.ok(code.indexOf("name: 'Sửa'") > code.indexOf("name: 'Tìm kiếm'"), "spec: Search trước Edit");
    assert.ok(code.indexOf("name: 'Tìm kiếm'", code.indexOf("name: 'Sửa'")) > -1, "spec: Search sau Edit (repeated)");

    // ===== RELOAD / WORKSPACE KHÁC vẫn dùng lại asset từ Library =====
    const c2 = await req(baseUrl, "POST", "/api/automation-v3/workspaces", { source: "NEW", module: "Đơn vị tính", approvedTestCases: APPROVED });
    const wid2 = c2.body.workspaceId;
    await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid2}/testcases/TC002/select`);
    // WS2 (không paste gì) vẫn thấy Library
    const lib2 = await req(baseUrl, "GET", `/api/automation-v3/workspaces/${wid2}/library`);
    assert.equal(lib2.body.length, 4, "workspace khác vẫn dùng được Library (shared)");
    // TC002 dùng block Tìm kiếm từ Library
    await req(baseUrl, "POST", `/api/automation-v3/workspaces/${wid2}/testcases/TC002/library/blocks`, { blockId: libMap["Tìm kiếm"] });
    const bind2 = await req(baseUrl, "GET", `/api/automation-v3/workspaces/${wid2}/testcases/TC002/binding`);
    assert.equal(bind2.body.sequence.length, 1, "WS2 TC002: dùng Tìm kiếm từ Library");
    // reload = tạo app mới cùng dataDir (persisted) — library vẫn còn
    await closeServer(server);
    const { server: srv2, baseUrl: base2 } = await startServer(dataDir, v3Out);
    const libAfterReload = await req(base2, "GET", `/api/automation-v3/workspaces/${wid2}/library`);
    assert.equal(libAfterReload.body.length, 4, "reload: Library vẫn còn (persisted)");
    const bindAfterReload = await req(base2, "GET", `/api/automation-v3/workspaces/${wid2}/testcases/TC002/binding`);
    assert.equal(bindAfterReload.body.sequence[0].blockId, libMap["Tìm kiếm"], "reload: binding trỏ Library block còn dùng được");

    // ===== P0 — Xóa khỏi Library (UI confirm; backend xóa qua codegen DELETE) =====
    // P0 EDIT/DELETE guard — đang được testcase dùng → BLOCK 409 (không phá workspace).
    const delUsed = await req(base2, "DELETE", `/api/codegen/library/${libMap["Tìm kiếm"]}`);
    assert.equal(delUsed.status, 409, "delete khi đang dùng → 409 LIBRARY_IN_USE");
    assert.equal(delUsed.body?.error?.code ?? delUsed.body?.errorCode, "LIBRARY_IN_USE", "errorCode LIBRARY_IN_USE");
    // Unbind trước (TC001 dùng 2 lần + TC002) → xóa được.
    await req(base2, "DELETE", `/api/automation-v3/workspaces/${wid1}/testcases/TC001/binding/blocks/${encodeURIComponent(libMap["Tìm kiếm"])}`);
    await req(base2, "DELETE", `/api/automation-v3/workspaces/${wid2}/testcases/TC002/binding/blocks/${encodeURIComponent(libMap["Tìm kiếm"])}`);
    const del = await req(base2, "DELETE", `/api/codegen/library/${libMap["Tìm kiếm"]}`);
    assert.equal(del.status, 200, "delete library block 200 (sau unbind)");
    const libAfterDelete = await req(base2, "GET", `/api/automation-v3/workspaces/${wid2}/library`);
    assert.equal(libAfterDelete.body.length, 3, "library còn 3 sau khi xóa Tìm kiếm");
    const del404 = await req(base2, "DELETE", `/api/codegen/library/${libMap["Tìm kiếm"]}`);
    assert.equal(del404.status, 404, "xóa lần 2 → 404 (LIBRARY_BLOCK_NOT_FOUND)");
    // Binding trỏ block đã xóa → resolveBlock null → sequence lọc item (không crash).
    const bindAfterDelete = await req(base2, "GET", `/api/automation-v3/workspaces/${wid2}/testcases/TC002/binding`);
    assert.ok(!bindAfterDelete.body.sequence.some(x => x.blockId === libMap["Tìm kiếm"]), "binding không còn item đã xóa (unresolved bị lọc)");
    // P0 EDIT/DELETE guard — block không xóa được khi còn binding (409), nên trường hợp
    // "binding trỏ block đã xóa" không xảy ra qua API; data file thủ công vẫn bị chặn ở
    // generate (resolveBlock null → SEGMENT_MAPPING_INVALID) — không crash.
    await closeServer(srv2);

    fs.rmSync(tempRoot, { recursive: true, force: true });
    console.log("Automation V3 Action Library (Boundary) test: PASS");
}
main().catch(e => { console.error(e); process.exit(1); });
