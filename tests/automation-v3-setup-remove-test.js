import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/*
 P0 — AUTOMATION DATA BINDING + SETUP DATA + REMOVE TESTCASE (CASE 1–12).

 A — binding canonical: có binding target->businessField thì renderer ĐỌC businessField;
     business value thiếu + có binding -> KHÔNG fallback recorded (lỗi TESTDATA_BINDING_REQUIRED).
 C — setup fields (Login env-bound LOGIN_*) không vào business Test Data.
 D/E — Loại khỏi workspace + [+ Thêm testcase] (approved/library/recording không đổi;
     thêm lại ở trạng thái mới).
*/

const testDir = path.dirname(fileURLToPath(import.meta.url));
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "setup-"));
const dataDir = path.join(tempRoot, "d");
const APPROVED = [
    { id: "TC008", title: "Tìm kiếm đơn vị tính", module: "Đơn vị tính", type: "POSITIVE", reviewStatus: "APPROVED", expectedResult: "Tìm thấy", testData: { fields: { "Từ khóa tìm kiếm": { value: "abc", purpose: "VALID" } } } },
    { id: "TC009", title: "Đăng nhập thành công", module: "Đăng nhập", type: "POSITIVE", reviewStatus: "APPROVED", expectedResult: "Vào hệ thống", testData: { fields: { "Tài khoản": { value: "admin", purpose: "VALID" }, "Mật khẩu": { value: "secret", purpose: "VALID" } } } }
];

async function boot() {
    const { default: createApp } = await import("../src/server/createApp.js");
    const app = createApp({ repositoryType: "file", dataDir, outputDir: path.join(tempRoot, "o"), v3OutputDir: path.join(tempRoot, "out") });
    const srv = await new Promise(r => { const s = app.listen(0, "127.0.0.1", () => r(s)); });
    const base = `http://127.0.0.1:${srv.address().port}`;
    async function req(m, p, b) {
        const r = await fetch(`${base}${p}`, { method: m, headers: b !== undefined ? { "content-type": "application/json" } : {}, body: b !== undefined ? JSON.stringify(b) : undefined });
        let d; try { d = await r.json(); } catch { d = null; }
        return { status: r.status, body: d };
    }
    return { srv, req };
}

let { srv, req } = await boot();

// Setup: recording: login steps + search step (fill 'text search' 'Bộ')
const start = await req("POST", "/api/codegen/start", { url: "about:blank", browser: "chrome", mode: "FULL_FLOW" });
const recId = start.body?.data?.recordingId ?? start.body?.recordingId;
const SRC = `await page.goto('http://x/login');
await page.getByRole('textbox', { name: 'Tài khoản' }).fill('admin');
await page.getByRole('textbox', { name: 'Mật khẩu' }).fill('secret');
await page.getByRole('button', { name: 'Đăng nhập' }).click();
await page.goto('http://x/danh-muc/don-vi-tinh');
await page.getByRole('textbox', { name: 'text search' }).fill('Bộ');
await page.getByRole('button', { name: 'Tìm kiếm' }).click();
await expect(page.getByText('trên tổng số 1 dòng dữ liệu')).toBeVisible();`;
await req("POST", `/api/codegen/recordings/${recId}/script`, { script: SRC });
const libLogin = await req("POST", "/api/codegen/library", { recordingId: recId, label: "Đăng nhập", startStep: 1, endStep: 3, groupName: "Đăng nhập" });
const libSearch = await req("POST", "/api/codegen/library", { recordingId: recId, label: "Tìm kiếm đơn vị tính", startStep: 4, endStep: 7, groupName: "Đơn vị tính" });
const ws = await req("POST", "/api/automation-v3/workspaces", { source: "NEW", module: "Đơn vị tính", approvedTestCases: APPROVED });
const wid = ws.body.workspaceId;
assert.equal(ws.body.approvedCount, 2, "setup: workspace có 2 approved");
const wsGet = await req("GET", `/api/automation-v3/workspaces/${wid}`);
assert.equal(wsGet.body.approvedTotal, 2, "setup: approvedTotal=2");
await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC008/select`);
await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC008/library/blocks`, { blockId: libLogin.body.data.blockId });
await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC008/library/blocks`, { blockId: libSearch.body.data.blockId });
await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC008/assertions`, {
    type: "TEXT_VISIBLE", target: "trên tổng số 1 dòng dữ liệu", locator: "page.getByText('trên tổng số 1 dòng dữ liệu')",
    expected: "trên tổng số 1 dòng dữ liệu", matcher: "toBeVisible", source: "RECORDED", status: "TESTER_CONFIRMED"
});

// ===== CASE 1 — binding text search->Từ khóa tìm kiếm, approved 'abc', recorded 'Bộ' -> dùng 'abc' =====
const save1 = await req("PATCH", `/api/automation-v3/workspaces/${wid}/testcases/TC008/test-data`, {
    testData: {}, bindings: { "text search": "Từ khóa tìm kiếm" }
});
assert.equal(save1.status, 200, "CASE1: save binding 200");
const gen1 = await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC008/generate`, {});
assert.equal(gen1.status, 200, "CASE1: generate 200");
const c1 = gen1.body?.code ?? "";
assert.ok(c1.includes('"Từ khóa tìm kiếm": "abc"'), "CASE1: testData businessField = abc");
assert.ok(c1.includes('fill(testData["Từ khóa tìm kiếm"])'), "CASE1: fill theo businessField");
assert.ok(!c1.includes('fill("Bộ")') && !c1.includes('fill("abc")') && !c1.includes('"text search"'), "CASE1: không dùng recorded/technical");

// ===== CASE 2 — edit 'abc' -> 'cai' -> generate dùng 'cai' =====
const save2 = await req("PATCH", `/api/automation-v3/workspaces/${wid}/testcases/TC008/test-data`, {
    testData: { "Từ khóa tìm kiếm": "cai" }, bindings: { "text search": "Từ khóa tìm kiếm" }
});
const gen2 = await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC008/generate`, {});
assert.ok((gen2.body?.code ?? "").includes('"Từ khóa tìm kiếm": "cai"'), "CASE2: edit cai -> dùng cai");

// ===== CASE 3 — binding tồn tại nhưng business value thiếu -> KHÔNG fallback recorded =====
// Binding tới businessField KHÔNG có trong approved/confirmed -> thiếu value -> KHÔNG fallback recorded.
const save3 = await req("PATCH", `/api/automation-v3/workspaces/${wid}/testcases/TC008/test-data`, {
    testData: {}, bindings: { "text search": "Thuật ngữ khác" }
});
const gen3 = await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC008/generate`, {});
assert.equal(gen3.status, 422, "CASE3: binding tồn tại + business value thiếu -> 422 (không fallback recorded Bộ)");
assert.ok(String(gen3.body?.message ?? "").includes("Thiếu dữ liệu"), "CASE3: message 'Thiếu dữ liệu: Thuật ngữ khác'");
assert.ok(!(gen3.body?.code ?? "").includes('"Bộ"'), "CASE3: không âm thầm dùng recorded Bộ");

// ===== CASE 6 — Login script vẫn dùng LOGIN_* (dù binding login) =====
// Login inputs KHÔNG binding (setup env-bound) — script vẫn dùng LOGIN_*.
const saveLogin = await req("PATCH", `/api/automation-v3/workspaces/${wid}/testcases/TC008/test-data`, {
    testData: { "Từ khóa tìm kiếm": "cai" }, bindings: { "text search": "Từ khóa tìm kiếm" }
});
const genLogin = await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC008/generate`, {});
const cLogin = genLogin.body?.code ?? "";
assert.ok(cLogin.includes('process.env.LOGIN_USERNAME ?? ""'), "CASE6: login fill LOGIN_USERNAME");
assert.ok(cLogin.includes('process.env.LOGIN_PASSWORD ?? ""'), "CASE6: login fill LOGIN_PASSWORD");
assert.ok(!cLogin.includes('fill("admin")') && !cLogin.includes('fill("secret")'), "CASE6: không hardcode credential");

// ===== CASE 8/9/10 — Loại TC008 khỏi workspace =====
const libCountBefore = (await req("GET", "/api/codegen/library")).body.data.length;
const libBlockIdsBefore = (await req("GET", "/api/codegen/library")).body.data.map(b => b.blockId).sort();
const del = await req("DELETE", `/api/automation-v3/workspaces/${wid}/testcases/TC008`);
assert.equal(del.status, 200, "CASE8: remove 200");
const itemsAfter = (await req("GET", `/api/automation-v3/workspaces/${wid}`)).body.items;
assert.ok(!itemsAfter.some(i => i.testCaseId === "TC008"), "CASE8: TC008 biến mất khỏi workspace");
await new Promise(r => srv.close(r));
({ srv, req } = await boot());
const itemsReload = (await req("GET", `/api/automation-v3/workspaces/${wid}`)).body.items;
assert.ok(!itemsReload.some(i => i.testCaseId === "TC008"), "CASE8: sau reload vẫn không có TC008");
const libAfter = await req("GET", "/api/codegen/library");
assert.equal(libAfter.body.data.length, libCountBefore, "CASE10: Library count không đổi");
assert.deepEqual(libAfter.body.data.map(b => b.blockId).sort(), libBlockIdsBefore, "CASE10: blockId không đổi");

// ===== CASE 11/12 — [+ Thêm testcase]: thấy TC008 + thêm lại (trạng thái mới) =====
const avail = await req("GET", `/api/automation-v3/workspaces/${wid}/testcases/available`);
assert.ok(avail.body.some(tc => tc.testCaseId === "TC008"), "CASE9/11: TC008 còn trong approved snapshot (available)");
const add = await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC008/add`, {});
assert.equal(add.status, 200, "CASE11: add lại 200");
assert.equal(add.body.testCaseId, "TC008", "CASE11: testCaseId");
assert.equal(add.body.automationDecision, "UNDECIDED", "CASE12: thêm lại ở trạng thái mới UNDECIDED");
assert.equal(add.body.generateStatus, "NOT_GENERATED", "CASE12: chưa sinh");
assert.equal((add.body.segments ?? []).length, 0, "CASE12: không phục hồi binding/action cũ");
const itemsAfterAdd = (await req("GET", `/api/automation-v3/workspaces/${wid}`)).body.items;
assert.ok(itemsAfterAdd.some(i => i.testCaseId === "TC008"), "CASE11: TC008 có lại trong workspace");

srv.close();
fs.rmSync(tempRoot, { recursive: true, force: true });

// ===== Static — C/B: setup fields ẩn khỏi business Test Data; technical đã map ẩn =====
const drawerSource = fs.readFileSync(path.join(testDir, "..", "web-ui", "src", "components", "automationV3", "V3ReviewDrawer.jsx"), "utf8");
const dClean = drawerSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
assert.ok(dClean.includes("businessActionInputs()") && dClean.includes("isSetupField(k)"), "CASE5: setup inputs bị lọc khỏi business Test Data");
assert.ok(dClean.includes("approvedBusinessValues()") && dClean.includes("isLoginTestCase"), "CASE7: approved credentials ẩn trừ testcase Login (isLoginTestCase)");
assert.ok(!dClean.includes("chọn input của thao tác") && !dClean.includes("kỹ thuật (chưa map business field)"), "CASE4: bỏ select/technical khỏi tester UI");
assert.ok(dClean.includes("DỮ LIỆU CHUẨN BỊ"), "P0: run tab DỮ LIỆU CHUẨN BỊ");
const viewSource = fs.readFileSync(path.join(testDir, "..", "web-ui", "src", "utils", "testDataView.js"), "utf8");
assert.ok(viewSource.includes("Cấu hình môi trường") && viewSource.includes("Cần review trước khi sinh"), "P0: prep status env/review (util render-level)");
const pageSource = fs.readFileSync(path.join(testDir, "..", "web-ui", "src", "pages", "AutomationV3Page.jsx"), "utf8");
assert.ok(pageSource.includes("Loại khỏi workspace") === false || pageSource.includes("removeTestCaseFromWorkspace"), "CASE8: page dùng API remove");
assert.ok(pageSource.includes("+ Thêm testcase") && pageSource.includes("listAvailableTestcases"), "CASE11: UI có [+ Thêm testcase] + available list");
const cardSource = fs.readFileSync(path.join(testDir, "..", "web-ui", "src", "components", "automationV3", "V3TestCaseCard.jsx"), "utf8");
assert.ok(cardSource.includes("Loại khỏi workspace"), "CASE8: card menu có 'Loại khỏi workspace'");
assert.ok(!cardSource.includes("Xóa testcase đã duyệt"), "D: không dùng chữ 'Xóa testcase đã duyệt'");

console.log("Automation V3 Setup Data + Remove/Re-add Testcase (P0) test: PASS");
