import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/*
 P0 LEGACY-INCLUDE-FIX — stepDecisions INCLUDE không bao giờ là nguồn Test Data.

 Browser thật: UI hiện Mã="BBT" nhưng runtime fill "Test nhap" — root cause đã trace:
 legacy `stepDecisions["<block>:<order>"] = {status:"INCLUDE", value:"Test nhap"}` từ UI
 pre-6b76241; renderer cũ cho STEP_DECISION INCLUDE ưu tiên TRƯỚC USER_CONFIRMED và
 collectTestData skip step INCLUDE → testDataMap mất Mã → fill inline legacy.

 Fix (scope duyệt):
  1. resolveFillStatus BỎ precedence STEP_DECISION INCLUDE — canonical = confirmedTestData
     → approvedTestData (EMPTY tuyệt đối); legacy INCLUDE rơi tiếp xuống như không có.
  2. collectTestData KHÔNG skip step vì INCLUDE — mọi FILL step đóng góp canonical value.
  3. HEAL deterministic trong autoBindTestData (load/recompute): xóa MỌI stepDecisions
     status==="INCLUDE"; TUYỆT ĐỐI giữ EXCLUDE.
  4. KHÔNG fallback recordedValue; 422 đúng khi chưa map/canonical data.

 Regression:
  R1 legacy INCLUDE "Test nhap" + confirmed Mã="BBT" → generated dùng BBT (không "Test nhap").
  R2 HEAL: getWorkspace xóa INCLUDE, giữ EXCLUDE.
  R3 BBT → ABC (save, không remove/re-add/remap) → generate dùng ABC.
  R4 Mã=EMPTY (dù legacy INCLUDE từng chứa "Test nhap") → KHÔNG fill Mã.
  R5 Count semantics: số lần fill Mã = số FILL step resolve Mã (2: TextInput + Mã);
     EXCLUDE TextInput → đúng 1 lần fill Mã.
  R6 TC008 parameterized + Login env không đổi (suite cũ cover — assert nhanh).
*/

const testDir = path.dirname(fileURLToPath(import.meta.url));
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "legacy-inc-"));

async function boot() {
    const { default: createApp } = await import("../src/server/createApp.js");
    const app = createApp({ repositoryType: "file", dataDir: path.join(tempRoot, "d"), outputDir: path.join(tempRoot, "o"), v3OutputDir: path.join(tempRoot, "out") });
    const srv = await new Promise(r => { const s = app.listen(0, "127.0.0.1", () => r(s)); });
    const base = `http://127.0.0.1:${srv.address().port}`;
    async function req(m, p, b) {
        const r = await fetch(`${base}${p}`, { method: m, headers: b !== undefined ? { "content-type": "application/json" } : {}, body: b !== undefined ? JSON.stringify(b) : undefined });
        let d; try { d = await r.json(); } catch { d = null; }
        return { status: r.status, body: d };
    }
    return { srv, req };
}

const { srv, req } = await boot();

// Setup TC001: recording TextInput(6) + Mã(7) + Tên(8) + Lưu(9)
const start = await req("POST", "/api/codegen/start", { url: "about:blank", browser: "chrome", mode: "FULL_FLOW" });
const recId = start.body?.data?.recordingId ?? start.body?.recordingId;
const SRC = `await page.goto('http://x/login');
await page.getByRole('textbox', { name: 'Tài khoản' }).fill('admin');
await page.getByRole('textbox', { name: 'Mật khẩu' }).fill('123456@Aa');
await page.getByRole('button', { name: 'Đăng nhập' }).click();
await page.goto('http://x/them-moi');
await page.getByRole('textbox', { name: 'TextInput' }).fill('BBC');
await page.getByLabel('Mã đơn vị tính').fill('BBC');
await page.getByLabel('Tên đơn vị tính').fill('Tên mẫu');
await page.getByRole('button', { name: 'Lưu' }).click();
await expect(page.getByText('kết quả')).toBeVisible();`;
await req("POST", `/api/codegen/recordings/${recId}/script`, { script: SRC });
const libThem = await req("POST", "/api/codegen/library", { recordingId: recId, label: "Thêm mới đơn vị tính", startStep: 5, endStep: 9, groupName: "ĐVT" });
const libLogin = await req("POST", "/api/codegen/library", { recordingId: recId, label: "Đăng nhập", startStep: 1, endStep: 4, groupName: "Đăng nhập" });
const themBlockId = libThem.body.data.blockId;

const ws = await req("POST", "/api/automation-v3/workspaces", { source: "NEW", module: "ĐVT", approvedTestCases: [
    { id: "TC001", title: "Thêm mới", module: "ĐVT", type: "POSITIVE", reviewStatus: "APPROVED", expectedResult: "OK",
      testData: { fields: { "Mã đơn vị tính": { value: "" }, "Tên đơn vị tính": { value: "Bộ trống" }, "Ghi chú": { value: "" } } } }
] });
const wid = ws.body.workspaceId;
await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/select`);
await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/library/blocks`, { blockId: libLogin.body.data.blockId });
await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/library/blocks`, { blockId: themBlockId });
await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/assertions`, {
    type: "TEXT_VISIBLE", target: "kết quả", locator: "page.getByText('kết quả')",
    expected: "kết quả", matcher: "toBeVisible", source: "TESTER_INPUT", status: "TESTER_CONFIRMED"
});

// ===== Inject LEGACY INCLUDE trực tiếp vào workspace entry (mô phỏng data pre-6b76241) =====
const svc = (await import("../src/server/createApp.js")).default; // noop — dùng app qua boot? cần app
// Lấy app qua req không được — dùng file workspace trực tiếp
const wsFile = path.join(tempRoot, "d", "automation-workspaces.json");
const wsJson = JSON.parse(fs.readFileSync(wsFile, "utf8"));
const wsObj = Array.isArray(wsJson) ? wsJson.find(w => w.workspaceId === wid) : (wsJson.workspaces ?? []).find(w => w.workspaceId === wid);
const entry = (wsObj.selectedTestCases ?? []).find(tc => tc.testCaseId === "TC001");
entry.stepDecisions = {
    [`${themBlockId}:6`]: { status: "INCLUDE", value: "Test nhap", intent: "VALUE", locator: "getByRole('textbox', { name: 'TextInput' }).", actionType: "FILL" },
    [`${themBlockId}:7`]: { status: "INCLUDE", value: "Test nhap", intent: "VALUE", locator: "getByLabel('Mã đơn vị tính').", actionType: "FILL" }
};
fs.writeFileSync(wsFile, JSON.stringify(wsJson, null, 2), "utf8");
console.log("injected legacy INCLUDE:", JSON.stringify(entry.stepDecisions));

// Tester canonical: Mã=BBT, Tên="Bộ trống", Ghi chú=EMPTY + mapping TextInput->Mã
const save = await req("PATCH", `/api/automation-v3/workspaces/${wid}/testcases/TC001/test-data`, {
    testData: { "Mã đơn vị tính": { value: "BBT", intent: "VALUE" }, "Tên đơn vị tính": { value: "Bộ trống", intent: "VALUE" }, "Ghi chú": { value: "", intent: "EMPTY" } },
    bindings: { "TextInput": "Mã đơn vị tính" }
});
assert.equal(save.status, 200, "R1: save 200");

// ===== R2 — HEAL: getWorkspace xóa INCLUDE, giữ EXCLUDE =====
// Thêm 1 EXCLUDE để kiểm tra giữ nguyên
const item0 = (await req("GET", `/api/automation-v3/workspaces/${wid}`)).body.items.find(x => x.testCaseId === "TC001");
assert.ok(!Object.values(item0.stepDecisions ?? {}).some(d => d?.status === "INCLUDE"), "R2: HEAL xóa MỌI INCLUDE khi load");
// giờ thêm EXCLUDE + INCLUDE rồi reload để kiểm tra giữ EXCLUDE
await req("PATCH", `/api/automation-v3/workspaces/${wid}/testcases/TC001/step-decisions`, { blockId: themBlockId, stepOrder: 6, decision: "EXCLUDE" });
const item1 = (await req("GET", `/api/automation-v3/workspaces/${wid}`)).body.items.find(x => x.testCaseId === "TC001");
assert.equal(item1.stepDecisions?.[`${themBlockId}:6`]?.status, "EXCLUDE", "R2: EXCLUDE giữ nguyên sau heal");

// ===== R1 — generated dùng BBT, không "Test nhap" (với legacy INCLUDE đã bị heal) =====
// Lưu ý: vì HEAL xóa INCLUDE ngay khi load, kịch bản "legacy vẫn còn lúc generate" chỉ xảy ra
// nếu workspace được nạp trước fix. Renderer-level test dưới đây mô phỏng legacy CHƯA heal.
const gen = await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/generate`, {});
assert.equal(gen.status, 200, "R1: generate 200");
const code = gen.body?.code ?? "";
assert.ok(!code.includes("Test nhap") && !code.includes('fill("BBC")'), "R1: KHÔNG còn 'Test nhap'/'BBC'");
assert.ok(code.includes('fill(testData["Mã đơn vị tính"])'), "R1: fill Mã qua testData (canonical)");
assert.ok(code.includes('"Mã đơn vị tính": "BBT"'), "R1: testData Mã = BBT");
// Count semantics: TextInput (order 6) EXCLUDE + Mã (order 7) -> ĐÚNG 1 lần fill Mã
const fillMaCount = (code.match(/fill\(testData\["Mã đơn vị tính"\]\)/g) ?? []).length;
assert.equal(fillMaCount, 1, "R1/R5: Mã EXCLUDE TextInput -> đúng 1 lần fill Mã (semantics Action)");

// ===== R3 — BBT -> ABC (save, không remove/re-add/remap) =====
await req("PATCH", `/api/automation-v3/workspaces/${wid}/testcases/TC001/test-data`, {
    testData: { "Mã đơn vị tính": { value: "ABC", intent: "VALUE" }, "Tên đơn vị tính": { value: "Bộ trống", intent: "VALUE" }, "Ghi chú": { value: "", intent: "EMPTY" } }
});
const genABC = await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/generate`, {});
assert.equal(genABC.status, 200, "R3: generate 200");
const codeABC = genABC.body?.code ?? "";
assert.ok(codeABC.includes('"Mã đơn vị tính": "ABC"') && !codeABC.includes('"Mã đơn vị tính": "BBT"'), "R3: đổi BBT->ABC -> dùng ABC (không remove/re-add)");
assert.ok(!codeABC.includes("Test nhap"), "R3: không legacy");

// ===== R4 — Mã=EMPTY (dù legacy INCLUDE từng chứa "Test nhap") -> KHÔNG fill Mã =====
await req("PATCH", `/api/automation-v3/workspaces/${wid}/testcases/TC001/test-data`, {
    testData: { "Mã đơn vị tính": { value: "", intent: "EMPTY" }, "Tên đơn vị tính": { value: "Bộ trống", intent: "VALUE" }, "Ghi chú": { value: "", intent: "EMPTY" } }
});
const genEmpty = await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/generate`, {});
assert.equal(genEmpty.status, 200, "R4: generate 200");
const codeEmpty = genEmpty.body?.code ?? "";
assert.ok(!codeEmpty.includes('fill(testData["Mã đơn vị tính"])') && !codeEmpty.includes('fill("BBC")') && !codeEmpty.includes("Test nhap"), "R4: Mã EMPTY -> KHÔNG fill Mã (dù legacy từng có 'Test nhap')");
assert.ok(codeEmpty.includes('fill(testData["Tên đơn vị tính"])'), "R4: Tên vẫn fill");

await new Promise(r => srv.close(r));
fs.rmSync(tempRoot, { recursive: true, force: true });

// ===== Renderer-level: legacy INCLUDE CHƯA heal + confirmed BBT -> BBT thắng, không "Test nhap" =====
const { renderV3Spec, resolveFillStatus } = await import("../src/codegen/rendererV3.js");
const steps = [
    { actionType: "FILL", target: "TextInput", locator: "getByRole('textbox', { name: 'TextInput' }).", recordedValue: "BBC", _blockId: "LIB-1", order: 6 },
    { actionType: "FILL", target: "Mã đơn vị tính", locator: "getByLabel('Mã đơn vị tính').", recordedValue: "BBC", _blockId: "LIB-1", order: 7 },
    { actionType: "CLICK", target: "Lưu", locator: "getByRole('button', { name: 'Lưu' }).", _blockId: "LIB-1", order: 8 }
];
const legacy = {
    "LIB-1:6": { status: "INCLUDE", value: "Test nhap", intent: "VALUE", locator: "getByRole('textbox', { name: 'TextInput' }).", actionType: "FILL" },
    "LIB-1:7": { status: "INCLUDE", value: "Test nhap", intent: "VALUE", locator: "getByLabel('Mã đơn vị tính').", actionType: "FILL" }
};
const confirmed = { "Mã đơn vị tính": { value: "BBT", intent: "VALUE" }, "Tên đơn vị tính": { value: "Bộ trống", intent: "VALUE" }, "Ghi chú": { value: "", intent: "EMPTY" } };
const approved = { fields: { "Mã đơn vị tính": { value: "" }, "Tên đơn vị tính": { value: "Bộ trống" }, "Ghi chú": { value: "" } } };
const assertions = [{ status: "TESTER_CONFIRMED", matcher: "toBeVisible", expected: "kết quả", locator: "page.getByText('kết quả')" }];

// Precedence: legacy INCLUDE KHÔNG còn thắng
const fsTI = resolveFillStatus({ target: "TextInput", testDataBindings: { "TextInput": "Mã đơn vị tính" }, confirmedTestData: confirmed, approvedTestData: approved, purposeMap: {}, singleInput: false, stepDecision: legacy["LIB-1:6"] });
assert.equal(fsTI.status, "VALUE", "R1r: legacy INCLUDE không thắng — status VALUE từ confirmed");
assert.equal(fsTI.source, "USER_CONFIRMED", "R1r: source = USER_CONFIRMED (canonical), KHÔNG STEP_DECISION");
assert.equal(fsTI.value, "BBT", "R1r: value = BBT (không 'Test nhap')");

// Render: legacy INCLUDE chưa heal — cả 2 step fill BBT (count = 2, semantics: 2 FILL steps)
const r = renderV3Spec({ testCase: { id: "TC001", title: "x" }, testcaseRecording: { status: "APPROVED", recordingId: "R1", recordingVersion: 1, steps }, confirmedTestData: confirmed, approvedTestData: approved, testDataBindings: { "TextInput": "Mã đơn vị tính" }, stepDecisions: legacy, confirmedAssertions: assertions });
assert.equal(r.ok, true, "R1r: render ok");
const rCode = r.code ?? "";
assert.ok(!rCode.includes("Test nhap") && !rCode.includes('fill("BBC")'), "R1r: không legacy/recorded");
assert.ok(rCode.includes('"Mã đơn vị tính": "BBT"'), "R1r: testData Mã = BBT");
const fillCount = (rCode.match(/fill\(testData\["Mã đơn vị tính"\]\)/g) ?? []).length;
assert.equal(fillCount, 2, "R5r: 2 FILL steps (TextInput + Mã) cùng resolve Mã -> 2 lần fill BBT (mỗi step 1 lần — semantics Action; KHÔNG dedupe step)");
// EXCLUDE step 6 -> còn 1 lần
const rEx = renderV3Spec({ testCase: { id: "TC001", title: "x" }, testcaseRecording: { status: "APPROVED", recordingId: "R1", recordingVersion: 1, steps }, confirmedTestData: confirmed, approvedTestData: approved, testDataBindings: { "TextInput": "Mã đơn vị tính" }, stepDecisions: { ...legacy, "LIB-1:6": { status: "EXCLUDE", locator: "getByRole('textbox', { name: 'TextInput' }).", actionType: "FILL" } }, confirmedAssertions: assertions });
const fillCountEx = ((rEx.code ?? "").match(/fill\(testData\["Mã đơn vị tính"\]\)/g) ?? []).length;
assert.equal(fillCountEx, 1, "R5r: EXCLUDE TextInput -> đúng 1 lần fill Mã");

console.log("Automation V3 Legacy INCLUDE fix (canonical wins, no legacy source) test: PASS");
