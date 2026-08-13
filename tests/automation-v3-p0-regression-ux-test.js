import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/*
 P0 REGRESSION — TEST DATA UX không lộ technical/login data trên UI THẬT.

 Tester bắt trên UI thật (b62495a):
   TAB THÔNG TIN  : "Từ khóa tìm kiếm = Bo" + "text search · giá trị trong bản ghi: Bộ" + input riêng "cai"
   TAB CHẠY THỬ   : "text search = cai", "Tài khoản = admin", "Mật khẩu = REDACTED", "Mã xác nhận = 125896"

 ROOT CAUSE (đã trace):
   1) autoBindTestData đưa confirmed keys kỹ thuật ('text search') vào fieldNames ->
      normalize khớp chính target -> SELF-BINDING 'text search'->'text search' -> info tab
      render row 'text search' (businessKeys push bindings[t]).
   2) Tab Chạy thử DỮ LIỆU TESTCASE merge confirmedTestData RAW (legacy chứa target +
      credential từ các phiên cũ) -> hiện 'text search'/'Tài khoản'/'Mật khẩu'/'Mã xác nhận'.
   3) Hint '· giá trị trong bản ghi: X' phơi recorded value kỹ thuật.
   4) Bundle public/ commit trong git là bản build CŨ (trước Test Data UI) -> pull branch
      vẫn serve UI cũ (server static public/).

 FIX:
   - Backend autoBindTestData: fieldNames business-only (bỏ setup + bỏ target); HEAL xóa
     self-binding; HEAL migrate confirmed target-key -> business field khi có binding thật.
   - Frontend testDataView (util thuần, render-level): info keys / run rows / prep status
     CHỈ business; không hint recorded.
   - Commit bundle build mới (public/) để checkout serve đúng UI.
*/

const testDir = path.dirname(fileURLToPath(import.meta.url));
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "p0reg-"));
const dataDir = path.join(tempRoot, "d");

// Dữ liệu THẬT tester mô tả: approved có business + credentials; legacy confirmed chứa
// technical target + credentials; self-binding 'text search'->'text search'.
const APPROVED = [
    {
        id: "TC008", title: "Tìm kiếm đơn vị tính", module: "Đơn vị tính", type: "POSITIVE",
        reviewStatus: "APPROVED", expectedResult: "Tìm thấy đơn vị tính",
        testData: { fields: {
            "Từ khóa tìm kiếm": { value: "Bo", purpose: "VALID" },
            "Tài khoản": { value: "admin", purpose: "VALID" },
            "Mật khẩu": { value: "secret", purpose: "VALID" },
            "Mã xác nhận": { value: "125896", purpose: "VALID" }
        } }
    }
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

// Setup: recording Login + Mở chức năng + Tìm kiếm (fill 'text search' 'Bộ')
const start = await req("POST", "/api/codegen/start", { url: "about:blank", browser: "chrome", mode: "FULL_FLOW" });
const recId = start.body?.data?.recordingId ?? start.body?.recordingId;
const SRC = `await page.goto('http://x/login');
await page.getByRole('textbox', { name: 'Tài khoản' }).fill('admin');
await page.getByRole('textbox', { name: 'Mật khẩu' }).fill('secret');
await page.getByRole('textbox', { name: 'Mã xác nhận' }).fill('125896');
await page.getByRole('button', { name: 'Đăng nhập' }).click();
await page.goto('http://x/danh-muc/don-vi-tinh');
await page.getByRole('textbox', { name: 'text search' }).fill('Bộ');
await page.getByRole('button', { name: 'Tìm kiếm' }).click();
await expect(page.getByText('trên tổng số 1 dòng dữ liệu')).toBeVisible();`;
await req("POST", `/api/codegen/recordings/${recId}/script`, { script: SRC });
const libLogin = await req("POST", "/api/codegen/library", { recordingId: recId, label: "Đăng nhập", startStep: 1, endStep: 5, groupName: "Đăng nhập" });
const libOpen = await req("POST", "/api/codegen/library", { recordingId: recId, label: "Mở chức năng", startStep: 6, endStep: 6, groupName: "Đơn vị tính" });
const libSearch = await req("POST", "/api/codegen/library", { recordingId: recId, label: "Tìm kiếm đơn vị tính", startStep: 7, endStep: 8, groupName: "Đơn vị tính" });
const ws = await req("POST", "/api/automation-v3/workspaces", { source: "NEW", module: "Đơn vị tính", approvedTestCases: APPROVED });
const wid = ws.body.workspaceId;
await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC008/select`);
await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC008/library/blocks`, { blockId: libLogin.body.data.blockId });
await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC008/library/blocks`, { blockId: libOpen.body.data.blockId });
await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC008/library/blocks`, { blockId: libSearch.body.data.blockId });
await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC008/assertions`, {
    type: "TEXT_VISIBLE", target: "trên tổng số 1 dòng dữ liệu", locator: "page.getByText('trên tổng số 1 dòng dữ liệu')",
    expected: "trên tổng số 1 dòng dữ liệu", matcher: "toBeVisible", source: "RECORDED", status: "TESTER_CONFIRMED"
});

// ===== A — tái hiện dữ liệu legacy: confirmed keyed theo target + credentials + self-binding =====
const legacy = await req("PATCH", `/api/automation-v3/workspaces/${wid}/testcases/TC008/test-data`, {
    testData: { "text search": "cai", "Tài khoản": "admin", "Mật khẩu": "REDACTED", "Mã xác nhận": "125896" },
    bindings: { "text search": "text search" } // self-binding (kỹ thuật — sinh ra từ auto-bind cũ)
});
assert.equal(legacy.status, 200, "A: PATCH legacy data 200");

// ===== B — HEAL sau load: bỏ self-binding + auto-bind business + migrate confirmed =====
const item = (await req("GET", `/api/automation-v3/workspaces/${wid}`)).body.items.find(x => x.testCaseId === "TC008");
assert.deepEqual(item.testDataBindings, { "text search": "Từ khóa tìm kiếm" }, "B1: self-binding 'text search'->'text search' bị xóa; auto-bind unique -> business field");
const conf = item.confirmedTestData ?? {};
assert.equal(conf["Từ khóa tìm kiếm"], "cai", "B2: confirmed legacy 'text search'='cai' được migrate sang business field 'Từ khóa tìm kiếm'");
assert.ok(!Object.prototype.hasOwnProperty.call(conf, "text search"), "B3: technical key 'text search' không còn trong confirmed");
// credentials vẫn ở confirmed (backend giữ — UI là nơi lọc); KHÔNG được tự xóa dữ liệu tester
assert.equal(conf["Tài khoản"], "admin", "B4: credential legacy không bị tự xóa (chỉ ẩn khỏi UI)");

// ===== C — generate: giá trị tester 'cai' tới được FILL (không fallback recorded 'Bộ') =====
const gen = await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC008/generate`, {});
assert.equal(gen.status, 200, "C1: generate 200");
const code = gen.body?.code ?? "";
assert.ok(code.includes('"Từ khóa tìm kiếm": "cai"'), "C2: testData key business + value cai (tester edit giữ qua migrate)");
assert.ok(code.includes('fill(testData["Từ khóa tìm kiếm"])'), "C3: fill theo businessField");
assert.ok(!code.includes('fill("Bộ")') && !code.includes('fill("Bo")'), "C4: không fallback recorded Bộ/approved Bo");
assert.ok(!code.includes('"text search"'), "C5: không technical key trong testData");

// ===== D — segments (DỮ LIỆU CHUẨN BỊ input) — DTO giữ technical input (renderer cần) =====
const segInputs = item.segments.flatMap(s => s.inputs ?? []);
assert.ok(segInputs.some(i => i.field === "text search" && i.recordedValue === "Bộ"), "D: DTO giữ technical input cho backend/renderer (UI mới là nơi lọc)");

srv.close();
fs.rmSync(tempRoot, { recursive: true, force: true });

// ===== E — RENDER-LEVEL: util testDataView = ĐÚNG nguồn DOM render =====
const { infoBusinessKeys, runTestcaseDataRows, actionPrepStatus } = await import("../web-ui/src/utils/testDataView.js");

// Fixture = state LEGACY (chưa heal) — UI phải an toàn kể cả khi data cũ:
// approved: business + credentials; confirmed: target + credentials; self-binding.
const legacyFixture = {
    approvedBusinessKeys: ["Từ khóa tìm kiếm"],
    approvedBusinessValues: { "Từ khóa tìm kiếm": "Bo" },
    bindings: { "text search": "text search" }, // self-binding legacy
    actionInputs: { "text search": "Bộ" }, // technical target từ segments (Login inputs bị lọc ở businessActionInputs)
    confirmedTestData: { "text search": "cai", "Tài khoản": "admin", "Mật khẩu": "REDACTED", "Mã xác nhận": "125896" },
    loginTestCase: false
};

const infoKeys = infoBusinessKeys(legacyFixture);
assert.ok(infoKeys.includes("Từ khóa tìm kiếm"), "E1: info keys chứa business field 'Từ khóa tìm kiếm'");
assert.ok(!infoKeys.some(k => ["text search", "Tài khoản", "Mật khẩu", "Mã xác nhận"].includes(k)), "E2: info keys KHÔNG chứa technical/setup (kể cả self-binding legacy)");

const runRows = runTestcaseDataRows(legacyFixture);
const rowKeys = runRows.map(r => r.key);
const rowVals = runRows.map(r => r.value);
assert.ok(rowKeys.includes("Từ khóa tìm kiếm") && rowVals.includes("Bo"), "E3: run rows chứa business field 'Từ khóa tìm kiếm' (approved 'Bo'; legacy target chưa binding thật thì không chiếu — an toàn)");
assert.ok(!rowKeys.some(k => ["text search", "Tài khoản", "Mật khẩu", "Mã xác nhận"].includes(k)), "E4: run rows KHÔNG chứa technical/setup (credential ẩn, target ẩn)");

// Fixture binding THẬT (sau heal) — confirmed legacy vẫn phải ra business row
const healedRows = runTestcaseDataRows({ ...legacyFixture, bindings: { "text search": "Từ khóa tìm kiếm" } });
assert.deepEqual(healedRows, [{ key: "Từ khóa tìm kiếm", value: "cai", state: "VALUE" }], "E5: binding thật + confirmed legacy -> đúng 1 row business 'Từ khóa tìm kiếm'='cai' (VALUE)");

// Fixture login testcase — credentials LÀ business (nghiệp vụ test Login)
const loginRows = runTestcaseDataRows({ ...legacyFixture, loginTestCase: true, approvedBusinessValues: { "Tài khoản": "admin", "Mật khẩu": "secret" } });
assert.ok(loginRows.some(r => r.key === "Tài khoản" && r.value === "admin"), "E6: testcase Login vẫn hiện credentials (business)");

// DỮ LIỆU CHUẨN BỊ — per action: Đăng nhập env / Mở chức năng sẵn sàng / Tìm kiếm sẵn sàng
const prepLogin = actionPrepStatus({ inputs: [{ field: "Tài khoản", recordedValue: "REDACTED" }, { field: "Mật khẩu", recordedValue: "REDACTED" }], bindings: {}, confirmedTestData: null, approvedFields: null });
assert.deepEqual(prepLogin, { status: "env", text: "✓ Cấu hình môi trường" }, "E7: Đăng nhập -> ✓ Cấu hình môi trường (LOGIN_*)");
const prepOpen = actionPrepStatus({ inputs: [], bindings: {}, confirmedTestData: null, approvedFields: null });
assert.deepEqual(prepOpen, { status: "ok", text: "✓ Sẵn sàng" }, "E8: Mở chức năng (không input) -> ✓ Sẵn sàng");
const prepSearch = actionPrepStatus({ inputs: [{ field: "text search", recordedValue: "Bộ" }], bindings: { "text search": "Từ khóa tìm kiếm" }, confirmedTestData: { "Từ khóa tìm kiếm": "cai" }, approvedFields: null });
assert.deepEqual(prepSearch, { status: "ok", text: "✓ Sẵn sàng" }, "E9: Tìm kiếm có data -> ✓ Sẵn sàng");
const prepSearchMissing = actionPrepStatus({ inputs: [{ field: "text search", recordedValue: "" }], bindings: { "text search": "Từ khóa tìm kiếm" }, confirmedTestData: {}, approvedFields: null });
assert.deepEqual(prepSearchMissing, { status: "missing", text: "⚠ Cần review trước khi sinh" }, "E10: Tìm kiếm UNRESOLVED -> ⚠ Cần review trước khi sinh");

// ===== F — STATIC render source: không còn chuỗi cũ / có chuỗi P0 =====
const drawerSource = fs.readFileSync(path.join(testDir, "..", "web-ui", "src", "components", "automationV3", "V3ReviewDrawer.jsx"), "utf8");
const dClean = drawerSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
assert.ok(!dClean.includes("Test Data hiện tại"), "F1: không còn header 'Test Data hiện tại'");
assert.ok(!dClean.includes("giá trị trong bản ghi") && !dClean.includes("chọn input của thao tác") && !dClean.includes("kỹ thuật (chưa map business field)"), "F2: không hint recorded / select / technical label");
assert.ok(dClean.includes("DỮ LIỆU KIỂM THỬ") && dClean.includes("DỮ LIỆU TESTCASE") && dClean.includes("DỮ LIỆU CHUẨN BỊ"), "F3: header P0 có đủ (DỮ LIỆU KIỂM THỬ / TESTCASE / CHUẨN BỊ)");
assert.ok(dClean.includes("infoBusinessKeys") && dClean.includes("runTestcaseDataRows") && dClean.includes("actionPrepStatus"), "F4: JSX render TỪ util testDataView (render-level source)");
const viewSource = fs.readFileSync(path.join(testDir, "..", "web-ui", "src", "utils", "testDataView.js"), "utf8");
assert.ok(viewSource.includes("isSetupField") && viewSource.includes("targets.has"), "F5: util lọc setup + technical target");

console.log("Automation V3 P0 Regression (Test Data UX không lộ technical/login) test: PASS");
