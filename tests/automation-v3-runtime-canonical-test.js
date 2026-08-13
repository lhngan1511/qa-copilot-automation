import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/*
 P0 RUNTIME BUG — GENERATED TC008 VẪN HARDCODE RECORDED VALUE "Bộ".

 Tester báo: Test Data "Từ khóa tìm kiếm" = "Bản" nhưng generated script:
   await page.getByRole('textbox', { name: 'text search' }).fill("Bộ");

 ROOT CAUSE (trace):
   rendererV3 FILL KHÔNG binding → businessField = target = 'text search' →
   confirmedTestData['text search'] undefined (tester sửa key BUSINESS 'Từ khóa tìm kiếm')
   → approved['text search'] undefined → resolveTestValue rơi xuống CODEGEN_RECORDED
   'Bộ' → fill("Bộ"). Business data KHÔNG tới được fill vì không có binding và
   renderer chỉ lookup theo target.

   Binding thiếu vì autoBindTestData unique rule dùng `pending.length` KHÔNG dedupe:
   recording noise FILL CÙNG input 2 lần ('text search' 'Bộ' rồi 'text search'
   'cdsfcvdvxcbxcvbxfb xfb') → pending = ['text search','text search'] (length 2)
   → unique fail → KHÔNG binding → recorded thắng.

 FIX (canonical resolution — KHÔNG thay literal):
   1) rendererV3.resolveBusinessFieldForFill (dùng chung collectTestData + renderStep):
      setup env-bound > binding > target∈approved (business) > ĐÚNG 1 business field
      có data > legacy target-keyed confirmed > target (recorded fallback contract).
   2) autoBindTestData: dedupe pending targets + unique rule theo business field CÓ DATA.
   3) Frontend mirror canonicalBusinessFieldForInput (prep status khớp generate).
*/

const testDir = path.dirname(fileURLToPath(import.meta.url));
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rtcanon-"));
const dataDir = path.join(tempRoot, "d");

// Approved TC008 THẬT theo báo cáo: business + credentials (setup).
const APPROVED = [
    {
        id: "TC008", title: "Tìm kiếm đơn vị tính", module: "Đơn vị tính", type: "POSITIVE",
        reviewStatus: "APPROVED", expectedResult: "Tìm thấy đơn vị tính",
        testData: { fields: {
            "Từ khóa tìm kiếm": { value: "Bản", purpose: "VALID" },
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

// Recording THẬT (có NOISE như tester log): fill 'text search' 'Bộ' (6) rồi click 'Xóa bộ lọc'
// (7), fill LẠI 'text search' 'cdsfcvdvxcbxcvbxfb xfb' (8), goto page=1 (9) — noise nằm TRONG
// action đã chọn (spec cũ chứa chúng); steps 11-13 noise KHÔNG thuộc action (để chứng minh
// generator không ghép sai).
const start = await req("POST", "/api/codegen/start", { url: "about:blank", browser: "chrome", mode: "FULL_FLOW" });
const recId = start.body?.data?.recordingId ?? start.body?.recordingId;
const SRC = `await page.goto('http://x/login');
await page.getByRole('textbox', { name: 'Tài khoản' }).fill('admin');
await page.getByRole('textbox', { name: 'Mật khẩu' }).fill('secret');
await page.getByRole('button', { name: 'Đăng nhập' }).click();
await page.goto('http://x/danh-muc/don-vi-tinh');
await page.getByRole('textbox', { name: 'text search' }).fill('Bộ');
await page.getByRole('button', { name: 'Xóa bộ lọc' }).click();
await page.getByRole('textbox', { name: 'text search' }).fill('cdsfcvdvxcbxcvbxfb xfb');
await page.goto('http://x/danh-muc/don-vi-tinh?page=1');
await page.getByRole('button', { name: 'Tìm kiếm' }).click();
await expect(page.getByText('trên tổng số 1 dòng dữ liệu')).toBeVisible();
await page.getByRole('textbox', { name: 'noise-input' }).fill('x');
await page.goto('http://x/danh-muc/don-vi-tinh?page=2');`;
await req("POST", `/api/codegen/recordings/${recId}/script`, { script: SRC });
const libLogin = await req("POST", "/api/codegen/library", { recordingId: recId, label: "Đăng nhập", startStep: 1, endStep: 4, groupName: "Đăng nhập" });
const libOpen = await req("POST", "/api/codegen/library", { recordingId: recId, label: "Mở chức năng", startStep: 5, endStep: 5, groupName: "Đơn vị tính" });
// Action Tìm kiếm: 6-10 — CÓ noise (đúng như spec cũ tester log); 11-13 KHÔNG thuộc action.
const libSearch = await req("POST", "/api/codegen/library", { recordingId: recId, label: "Tìm kiếm đơn vị tính", startStep: 6, endStep: 10, groupName: "Đơn vị tính" });
const ws = await req("POST", "/api/automation-v3/workspaces", { source: "NEW", module: "Đơn vị tính", approvedTestCases: APPROVED });
const wid = ws.body.workspaceId;
await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC008/select`);
await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC008/library/blocks`, { blockId: libLogin.body.data.blockId });
await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC008/library/blocks`, { blockId: libOpen.body.data.blockId });
await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC008/library/blocks`, { blockId: libSearch.body.data.blockId });
const a1 = await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC008/assertions`, {
    type: "TEXT_VISIBLE", target: "trên tổng số 1 dòng dữ liệu", locator: "page.getByText('trên tổng số 1 dòng dữ liệu')",
    expected: "trên tổng số 1 dòng dữ liệu", matcher: "toBeVisible", source: "RECORDED", status: "TESTER_CONFIRMED"
});
// Assertion DRAFT — KHÔNG được render vào spec (chỉ TESTER_CONFIRMED = "Kết quả đã chọn").
const a2 = await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC008/assertions`, {
    type: "TEXT_VISIBLE", target: "Kết quả stale cũ", locator: "page.getByText('Kết quả stale cũ')",
    expected: "Kết quả stale cũ", matcher: "toBeVisible", source: "RECORDED"
});
assert.equal(a2.body.status, "DRAFT", "setup: assertion thứ 2 ở trạng thái DRAFT");

// ===== CASE 1 — user repro: Test Data "Từ khóa tìm kiếm"="Bản" + noise double-fill =====
const save = await req("PATCH", `/api/automation-v3/workspaces/${wid}/testcases/TC008/test-data`, {
    testData: { "Từ khóa tìm kiếm": "Bản" }, bindings: {}
});
assert.equal(save.status, 200, "CASE1: save test-data 200");
const item = (await req("GET", `/api/automation-v3/workspaces/${wid}`)).body.items.find(x => x.testCaseId === "TC008");
// DEDUPE fix: noise fill CÙNG input 2 lần không phá unique rule → binding canonical tồn tại.
assert.deepEqual(item.testDataBindings, { "text search": "Từ khóa tìm kiếm" }, "CASE1a: auto-bind dedupe -> binding 'text search'->'Từ khóa tìm kiếm'");
const gen = await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC008/generate`, {});
assert.equal(gen.status, 200, "CASE1b: generate 200");
const code = gen.body?.code ?? "";
assert.ok(code.includes('"Từ khóa tìm kiếm": "Bản"'), "CASE1c: const testData chứa business field = Bản");
assert.ok(code.includes('fill(testData["Từ khóa tìm kiếm"])'), "CASE1d: fill qua testData[\"Từ khóa tìm kiếm\"]");
assert.ok(!code.includes('fill("Bộ")') && !code.includes('fill("Bản")') && !code.includes('fill("cdsfcvdvxcbxcvbxfb xfb")'), "CASE1e: KHÔNG literal recorded/noise — mọi fill đi qua testData business");
assert.ok(code.includes('fill(process.env.LOGIN_USERNAME ?? "")') && code.includes('fill(process.env.LOGIN_PASSWORD ?? "")'), "CASE1f: Login vẫn LOGIN_* env");
assert.ok(!code.includes('"text search"'), "CASE1g: không technical key trong testData");

// ===== CASE 2 — noise KHÔNG thuộc action: generator không ghép sai =====
assert.ok(!code.includes("noise-input") && !code.includes("page=2"), "CASE2: step noise ngoài selected action KHÔNG vào spec");
// noise TRONG action (7/8/9) vẫn nằm trong spec — đúng block snapshot; báo tester cleanup.
assert.ok(code.includes("Xóa bộ lọc") && code.includes("page=1"), "CASE2b: noise TRONG action được render (content action — tester cần cleanup)");

// ===== CASE 3 — assertion source: chỉ TESTER_CONFIRMED ("Kết quả đã chọn") =====
assert.ok(code.includes("trên tổng số 1 dòng dữ liệu"), "CASE3a: assertion TESTER_CONFIRMED được render");
assert.ok(!code.includes("Kết quả stale cũ"), "CASE3b: assertion DRAFT/stale KHÔNG được render");

srv.close();
fs.rmSync(tempRoot, { recursive: true, force: true });

// ===== CASE 4 — RENDERER-LEVEL canonical resolution (không binding — recorded KHÔNG thắng) =====
const { renderV3Spec, resolveBusinessFieldForFill } = await import("../src/codegen/rendererV3.js");
const approvedData = APPROVED[0].testData;
const confirmedAssertionsArr = [{
    status: "TESTER_CONFIRMED", matcher: "toBeVisible", expected: "trên tổng số 1 dòng dữ liệu",
    locator: "page.getByText('trên tổng số 1 dòng dữ liệu')"
}];
const rec = recObj => ({ status: "APPROVED", recordingId: "R1", recordingVersion: 1, steps: recObj });
const FILL_SEARCH = { actionType: "FILL", target: "text search", locator: "getByRole('textbox', { name: 'text search' }).", recordedValue: "Bộ" };
const CLICK = { actionType: "CLICK", target: "Tìm kiếm", locator: "getByRole('button', { name: 'Tìm kiếm' })." };

// 4a — KHÔNG binding + confirmed business "Bản" → canonical fallback dùng business data.
const r4a = renderV3Spec({
    testCase: { id: "TC008", title: "Tìm kiếm đơn vị tính" },
    testcaseRecording: rec([FILL_SEARCH, CLICK]),
    confirmedTestData: { "Từ khóa tìm kiếm": "Bản" },
    approvedTestData: approvedData,
    testDataBindings: {},
    confirmedAssertions: confirmedAssertionsArr
});
assert.equal(r4a.ok, true, "CASE4a: render ok");
assert.ok(r4a.code.includes('"Từ khóa tìm kiếm": "Bản"') && r4a.code.includes('fill(testData["Từ khóa tìm kiếm"])'), "CASE4a: business data thắng recorded kể cả khi KHÔNG binding");
assert.ok(!r4a.code.includes('fill("Bộ")'), "CASE4a: không fallback recorded Bộ");

// 4b — legacy target-keyed confirmed + approved business → business thắng (UI hiện business).
const r4b = renderV3Spec({
    testCase: { id: "TC008", title: "Tìm kiếm đơn vị tính" },
    testcaseRecording: rec([FILL_SEARCH, CLICK]),
    confirmedTestData: { "text search": "cai" },
    approvedTestData: approvedData,
    testDataBindings: {},
    confirmedAssertions: confirmedAssertionsArr
});
assert.ok(r4b.code.includes('"Từ khóa tìm kiếm": "Bản"') && !r4b.code.includes('"text search"'), "CASE4b: legacy target-keyed KHÔNG thắng business data");

// 4c — legacy ONLY (không business field) → keyfix: dùng confirmed theo target.
const r4c = renderV3Spec({
    testCase: { id: "TC008", title: "Tìm kiếm đơn vị tính" },
    testcaseRecording: rec([FILL_SEARCH, CLICK]),
    confirmedTestData: { "text search": "cai" },
    approvedTestData: null,
    testDataBindings: {},
    confirmedAssertions: confirmedAssertionsArr
});
assert.ok(r4c.code.includes('"text search": "cai"') && r4c.code.includes('fill(testData["text search"])'), "CASE4c: legacy target-keyed vẫn chạy (không business field)");

// 4d — P0 TC001: KHÔNG data (null/empty/missing, không explicit EMPTY) → UNRESOLVED → CHẶN Generate
// (recorded literal chỉ là RECORDED_SAMPLE — không fallback âm thầm).
const r4d = renderV3Spec({
    testCase: { id: "TC009", title: "Không dữ liệu" },
    testcaseRecording: rec([FILL_SEARCH, CLICK]),
    confirmedTestData: {},
    approvedTestData: null,
    testDataBindings: {},
    confirmedAssertions: confirmedAssertionsArr
});
assert.equal(r4d.ok, false, "CASE4d: không data -> generate bị chặn");
assert.equal(r4d.errorCode, "TESTDATA_UNRESOLVED", "CASE4d: errorCode TESTDATA_UNRESOLVED");
assert.ok(String(r4d.reason ?? "").includes("Chưa xác định dữ liệu"), "CASE4d: message yêu cầu review");
// 4d2 — explicit EMPTY (tester xác nhận để trống) → SKIP fill, không BBC, không block.
const r4d2 = renderV3Spec({
    testCase: { id: "TC009", title: "Để trống" },
    testcaseRecording: rec([FILL_SEARCH, CLICK]),
    confirmedTestData: { "text search": { value: "", intent: "EMPTY" } },
    approvedTestData: null,
    testDataBindings: {},
    confirmedAssertions: confirmedAssertionsArr
});
assert.equal(r4d2.ok, true, "CASE4d2: EMPTY intent -> generate OK");
assert.ok(!r4d2.code.includes("fill(\"Bộ\")") && !r4d2.code.includes(".fill("), "CASE4d2: KHÔNG fill recorded — SKIP fill");

// 4e — target LÀ business field (approved định nghĩa) — dùng thẳng, không đoán sang field khác.
const r4e = renderV3Spec({
    testCase: { id: "TC001", title: "Thêm mới đơn vị tính" },
    testcaseRecording: rec([{ actionType: "FILL", target: "Mã đơn vị tính", locator: "getByLabel('Mã đơn vị tính').", recordedValue: "REC" }, CLICK]),
    confirmedTestData: {},
    approvedTestData: { fields: { "Mã đơn vị tính": { value: "DVT001", purpose: "VALID" }, "Tên đơn vị tính": { value: "Kg", purpose: "VALID" } } },
    testDataBindings: {},
    confirmedAssertions: confirmedAssertionsArr
});
assert.ok(r4e.code.includes('"Mã đơn vị tính": "DVT001"') && r4e.code.includes('fill(testData["Mã đơn vị tính"])'), "CASE4e: target là business field -> dùng thẳng (không map sang Tên đơn vị tính)");

// 4f — P0 TC001: mơ hồ (2 business field có data, không binding, target không ∈ approved)
// → KHÔNG đoán (cấm heuristic multi-input) → UNRESOLVED → chặn Generate (không recorded).
const r4f = renderV3Spec({
    testCase: { id: "TC008", title: "Tìm kiếm" },
    testcaseRecording: rec([FILL_SEARCH, CLICK]),
    confirmedTestData: {},
    approvedTestData: { fields: { "Từ khóa tìm kiếm": { value: "Bản", purpose: "VALID" }, "Mã đơn vị tính": { value: "DVT001", purpose: "VALID" } } },
    testDataBindings: {},
    confirmedAssertions: confirmedAssertionsArr
});
assert.equal(r4f.ok, false, "CASE4f: mơ hồ -> không đoán -> chặn");
assert.equal(r4f.errorCode, "TESTDATA_UNRESOLVED", "CASE4f: UNRESOLVED (không fallback recorded Bộ)");

// 4g — resolveBusinessFieldForFill unit (6 rule). P0 TC001: rule 4 (unique business field)
// CHỈ áp dụng khi singleInput=true (testcase ĐÚNG 1 non-setup FILL target).
const ctx = (over = {}) => ({ testDataBindings: {}, confirmedTestData: {}, approvedTestData: {}, ...over });
assert.equal(resolveBusinessFieldForFill("Tài khoản", ctx()), "Tài khoản", "4g1: setup env-bound giữ target");
assert.equal(resolveBusinessFieldForFill("text search", ctx({ testDataBindings: { "text search": "Từ khóa tìm kiếm" } })), "Từ khóa tìm kiếm", "4g2: binding thắng");
assert.equal(resolveBusinessFieldForFill("Mã đơn vị tính", ctx({ approvedTestData: { fields: { "Mã đơn vị tính": { value: "DVT001" } } } })), "Mã đơn vị tính", "4g3: target ∈ approved -> target");
assert.equal(resolveBusinessFieldForFill("text search", ctx({ confirmedTestData: { "Từ khóa tìm kiếm": "Bản" }, approvedTestData: approvedData }), true), "Từ khóa tìm kiếm", "4g4: single-input + unique business field -> business");
assert.equal(resolveBusinessFieldForFill("text search", ctx({ confirmedTestData: { "Từ khóa tìm kiếm": "Bản" }, approvedTestData: approvedData })), "text search", "4g4b: multi-input (default) -> KHÔNG heuristic -> target");
assert.equal(resolveBusinessFieldForFill("text search", ctx({ confirmedTestData: { "text search": "cai" } })), "text search", "4g5: legacy target-keyed (không business field) -> target");
assert.equal(resolveBusinessFieldForFill("text search", ctx({ approvedTestData: { fields: { A: { value: "1" }, B: { value: "2" } } } })), "text search", "4g6: mơ hồ -> target (không đoán)");
assert.equal(resolveBusinessFieldForFill("text search", ctx()), "text search", "4g7: không data -> target (sẽ thành UNRESOLVED ở renderV3Spec)");

// ===== CASE 5 — frontend mirror (render-level): prep status dùng canonical, khớp generate =====
const { canonicalBusinessFieldForInput, actionPrepStatus } = await import("../web-ui/src/utils/testDataView.js");
const fctx = (over = {}) => ({ bindings: {}, confirmedTestData: null, approvedFields: null, ...over });
assert.equal(canonicalBusinessFieldForInput("Tài khoản", fctx()), "Tài khoản", "CASE5a: setup giữ target");
assert.equal(canonicalBusinessFieldForInput("text search", fctx({ bindings: { "text search": "Từ khóa tìm kiếm" } })), "Từ khóa tìm kiếm", "CASE5b: binding thắng");
assert.equal(canonicalBusinessFieldForInput("text search", fctx({ confirmedTestData: { "Từ khóa tìm kiếm": "Bản" }, approvedFields: { "Từ khóa tìm kiếm": { value: "Bản" } }, singleInput: true })), "Từ khóa tìm kiếm", "CASE5c: single-input + unique business data -> business (mirror)");
assert.equal(canonicalBusinessFieldForInput("text search", fctx({ confirmedTestData: { "Từ khóa tìm kiếm": "Bản" }, approvedFields: { "Từ khóa tìm kiếm": { value: "Bản" } } })), "text search", "CASE5c2: multi-input -> KHÔNG heuristic (mirror)");
const prep = actionPrepStatus({
    inputs: [{ field: "text search", recordedValue: "Bộ" }],
    bindings: {},
    confirmedTestData: { "Từ khóa tìm kiếm": "Bản" },
    approvedFields: { "Từ khóa tìm kiếm": { value: "Bản" } },
    singleInput: true
});
assert.deepEqual(prep, { status: "ok", text: "✓ Sẵn sàng" }, "CASE5d: prep status Sẵn sàng (single-input, business data tồn tại — không lệch generate)");

console.log("Automation V3 Runtime Canonical (recorded không thắng business data) test: PASS");
