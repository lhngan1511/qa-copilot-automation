import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/*
 P0 REGRESSION — AUTOMATION KHÔNG THẤY ACTION LIBRARY ĐÃ CÓ.

 Root cause (trace + reproduce): backend ĐÚNG (cùng 1 instance ActionLibrary, không
 filter; reload/bind vẫn đủ) — lỗi ở UI `V3ActionSetupPanel`: khi binding rỗng, effect
 tự mở Library nhưng `refreshLibrary()` async CHƯA xong → render "Chưa có thao tác nào
 được lưu để dùng lại." với library=[] (race), và không re-render khi data về.
 Fix: await refreshLibrary (trả list) trước khi mở; thêm `libraryLoading` (hiện "Đang
 tải thư viện…" thay vì flash rỗng); openLibrary cũng await.

 P0-A UX — Test Data: [Lưu dữ liệu] primary; [Khôi phục] secondary chỉ khi approved có
 value VÀ automation data đã khác approved; không auto-save onBlur.
*/

const testDir = path.dirname(fileURLToPath(import.meta.url));
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "libvis-"));
const dataDir = path.join(tempRoot, "d");

const APPROVED = [
    { id: "TC001", title: "Thêm mới đơn vị tính", module: "Đơn vị tính", type: "POSITIVE", reviewStatus: "APPROVED", expectedResult: "Thành công", testData: { fields: { "Mã đơn vị tính": { value: "DV01" } } } },
    { id: "TC002", title: "Tìm kiếm", module: "Đơn vị tính", type: "POSITIVE", reviewStatus: "APPROVED", expectedResult: "Thấy", testData: null }
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

// ===== A — Save action ở CodeGen → Automation thấy ngay =====
const start = await req("POST", "/api/codegen/start", { url: "about:blank", browser: "chrome", mode: "FULL_FLOW" });
const recId = start.body?.data?.recordingId ?? start.body?.recordingId;
const SRC = "await page.goto('http://x/login');\nawait page.getByRole('button', { name: 'Đăng nhập' }).click();";
await req("POST", `/api/codegen/recordings/${recId}/script`, { script: SRC });
const libBlocks = [];
for (const [label, group] of [["Đăng nhập", "Đăng nhập"], ["Mở chức năng", "Đơn vị tính"], ["Chưa nhóm", null]]) {
    const r = await req("POST", "/api/codegen/library", { recordingId: recId, label, startStep: 1, endStep: 1, groupName: group });
    assert.equal(r.status, 201, `A: save ${label}`);
    libBlocks.push(r.body.data.blockId);
}
const ws = await req("POST", "/api/automation-v3/workspaces", { source: "NEW", module: "Đơn vị tính", approvedTestCases: APPROVED });
const wid = ws.body.workspaceId;

// A — Automation thấy ngay (cùng shared Library)
const au = await req("GET", `/api/automation-v3/workspaces/${wid}/library`);
assert.equal(au.body.length, 3, "A: Automation thấy 3 action ngay");
assert.deepEqual(au.body.map(x => x.label), ["Đăng nhập", "Mở chức năng", "Chưa nhóm"], "A: đủ 3 action");
// C — groupName có/không → đều thấy
assert.ok(au.body.some(x => x.groupName === "Đơn vị tính"), "C: block có groupName vẫn thấy");
assert.ok(au.body.some(x => x.groupName === null), "D: block legacy/null group vẫn thấy");

// B — reload → vẫn thấy
await new Promise(r => srv.close(r));
({ srv, req } = await boot());
const au2 = await req("GET", `/api/automation-v3/workspaces/${wid}/library`);
assert.equal(au2.body.length, 3, "B: reload → vẫn thấy 3");

// E — bind vào TC001 → Library vẫn còn cho testcase khác
await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/select`);
await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/library/blocks`, { blockId: au2.body[0].blockId });
const au3 = await req("GET", `/api/automation-v3/workspaces/${wid}/library`);
assert.equal(au3.body.length, 3, "E: sau bind vẫn 3 action (không mất cho TC002)");
assert.equal(au3.body.find(x => x.blockId === au2.body[0].blockId).usedByTestCases, 1, "E: usage = 1 (metadata thêm, không clone/move)");
// F — không store mới: blockId giữ nguyên (cùng instance)
assert.deepEqual(au3.body.map(x => x.blockId).sort(), libBlocks.slice().sort(), "F: blockId không đổi (cùng shared Library)");

srv.close();
fs.rmSync(tempRoot, { recursive: true, force: true });

// ===== Static — UI fix: await refresh + loading state =====
const panelSource = fs.readFileSync(path.join(testDir, "..", "web-ui", "src", "components", "automationV3", "V3ActionSetupPanel.jsx"), "utf8");
const clean = panelSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
assert.ok(clean.includes("await refreshLibrary();"), "UI: openLibrary/effect await refreshLibrary (hết race rỗng)");
assert.ok(clean.includes("libraryLoading") && clean.includes("Đang tải thư viện…"), "UI: có loading state (không flash 'Chưa có thao tác...')");
assert.ok(clean.includes("return list"), "UI: refreshLibrary trả list");
// Chỉ hiện "Chưa có thao tác nào..." khi thật rỗng (sau loading)
const emptyIdx = clean.indexOf("Chưa có thao tác nào được lưu để dùng lại.");
const loadingIdx = clean.indexOf("Đang tải thư viện…");
assert.ok(loadingIdx < emptyIdx && emptyIdx > -1, "UI: loading render trước empty state");

// ===== Static — P0-A UX correction (drawer) =====
const drawerSource = fs.readFileSync(path.join(testDir, "..", "web-ui", "src", "components", "automationV3", "V3ReviewDrawer.jsx"), "utf8");
const dClean = drawerSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
assert.ok(dClean.includes("Lưu dữ liệu"), "UX: [Lưu dữ liệu] primary");
assert.ok(!dClean.includes("onBlur={() => persistTd()}"), "UX: bỏ auto-save onBlur (save qua nút)");
assert.ok(dClean.includes("tdHasEdited") && dClean.includes("Khôi phục dữ liệu testcase"), "UX: [Khôi phục] chỉ hiện khi approved có value + automation khác approved");
// Không tự thêm setup credentials — section chỉ render business fields CỦA TESTCASE
// (không hardcode username/password/captcha làm field mặc định).
assert.ok(!dClean.includes('value={"username"}') && !dClean.includes('value={"captcha"}'), "UX: không invent setup credentials vào Test Data section");
// Credentials thuộc testcase LOGIN mới hiển thị — bình thường section chỉ lấy từ testData.fields.
assert.ok(dClean.includes("tdApproved") && dClean.includes("testCase?.testData"), "UX: Test Data section chỉ đọc từ testcase (không tự thêm field)");

console.log("Automation V3 Library Visibility + Test Data UX (P0) test: PASS");
