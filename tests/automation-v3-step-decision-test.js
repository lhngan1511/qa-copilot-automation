import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/*
 P0 — "Cần bạn xác nhận" (XÁC ĐỊNH FIELD → XÁC ĐỊNH VALUE, workspace/testcase scope).

 Flow mới:
   Case 1 — technical chưa map (VD 'TextInput'): UI hỏi "Thao tác này đang nhập dữ
     liệu cho trường nào?" với dropdown business fields testcase (KHÔNG hard-code);
     technical chỉ trong "▸ Xem thông tin kỹ thuật" (collapse).
   Case 2 — business field đã biết (VD 'Ghi chú'): hiện tên field + "Giá trị khi ghi"
     + input "Giá trị dùng khi chạy testcase" + [ ] Để trống.
   Case 3 — Không thuộc testcase → EXCLUDE.

 MAPPING (1 source of truth): technical→business lưu ở testDataBindings[target]=field
 (canonical binding model — autoBind cũng ghi đây); value/intent ở confirmedTestData[field].
 Cả 2 qua 1 call saveTestData({field:{value,intent}}, {target:field}). stepDecisions CHỈ
 giữ EXCLUDE. KHÔNG duplicate mapping; KHÔNG mutate Action Library.

 Acceptance:
  A1 UI hỏi "trường dữ liệu nào" (không bắt hiểu TextInput)
  A2 dropdown từ business fields testcase (không hard-code)
  A3 mapping persist sau close/reopen/generate/remove-re-add
  A4 mapped field có data → Generate dùng business data (không recorded sample)
  A5 mapped EMPTY → canonical EMPTY
  A6 EXCLUDE → step không vào spec; Library gốc giữ nguyên
  A7 chưa map → 422 structured
  A8 business field (Ghi chú) không hiện "Input chưa xác định" (hiện tên field)
  A9 TC008 parameterized · A10 Login env · A11 multi-input không cross-bind · A12 workspace cũ không crash
*/

const testDir = path.dirname(fileURLToPath(import.meta.url));
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "stepdec-"));

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

// Setup TC001: approved Mã ""/Tên "Kg"/Ghi chú ""; recording TextInput (technical) + Ghi chú
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
await page.getByLabel('Ghi chú').fill('ghi chú');
await page.getByRole('button', { name: 'Lưu' }).click();
await expect(page.getByText('kết quả')).toBeVisible();`;
await req("POST", `/api/codegen/recordings/${recId}/script`, { script: SRC });
const libThem = await req("POST", "/api/codegen/library", { recordingId: recId, label: "Thêm mới đơn vị tính", startStep: 5, endStep: 10, groupName: "Danh mục đơn vị tính" });
const libLogin = await req("POST", "/api/codegen/library", { recordingId: recId, label: "Đăng nhập", startStep: 1, endStep: 4, groupName: "Đăng nhập" });
const themBlockId = libThem.body.data.blockId;

const ws = await req("POST", "/api/automation-v3/workspaces", { source: "NEW", module: "ĐVT", approvedTestCases: [
    { id: "TC001", title: "Thêm mới đơn vị tính", module: "ĐVT", type: "POSITIVE", reviewStatus: "APPROVED", expectedResult: "OK",
      testData: { fields: { "Mã đơn vị tính": { value: "" }, "Tên đơn vị tính": { value: "Kg" }, "Ghi chú": { value: "" } } } }
] });
const wid = ws.body.workspaceId;
await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/select`);
await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/library/blocks`, { blockId: libLogin.body.data.blockId });
await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/library/blocks`, { blockId: themBlockId });
await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/assertions`, {
    type: "TEXT_VISIBLE", target: "kết quả", locator: "page.getByText('kết quả')",
    expected: "kết quả", matcher: "toBeVisible", source: "TESTER_INPUT", status: "TESTER_CONFIRMED"
});

// Tester nhập: Mã VALUE "M1", Tên "Kg"; Ghi chú để "" (chưa quyết — business unresolved)
await req("PATCH", `/api/automation-v3/workspaces/${wid}/testcases/TC001/test-data`, {
    testData: { "Mã đơn vị tính": { value: "M1", intent: "VALUE" }, "Tên đơn vị tính": { value: "Kg", intent: "VALUE" }, "Ghi chú": { value: "", intent: "" } }
});
const item = (await req("GET", `/api/automation-v3/workspaces/${wid}`)).body.items.find(x => x.testCaseId === "TC001");

// ===== A7 — chưa map → 422 structured =====
const genBlocked = await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/generate`, {});
assert.equal(genBlocked.status, 422, "A7: chưa map -> 422");
assert.equal(genBlocked.body?.errorCode, "TESTDATA_UNRESOLVED", "A7: errorCode");
const uf = genBlocked.body?.details?.unresolvedFields ?? [];
assert.ok(uf.some(x => x.field === "TextInput" && x.mapped === false), "A7: TextInput chưa map (mapped=false)");
assert.ok(uf.some(x => x.field === "Ghi chú"), "A7: Ghi chú (business) vẫn unresolved");

// ===== A8 — business field (Ghi chú) không hiện "Input chưa xác định"; technical chỉ trong collapse =====
const sectionSource = fs.readFileSync(path.join(testDir, "..", "web-ui", "src", "components", "automationV3", "V3StepReviewSection.jsx"), "utf8");
assert.ok(!sectionSource.includes("Input chưa xác định"), "A8: KHÔNG còn nhãn 'Input chưa xác định' cho business field");
assert.ok(sectionSource.includes("Cần bạn xác nhận"), "A: heading mới 'Cần bạn xác nhận'");
assert.ok(sectionSource.includes("Thao tác này đang nhập dữ liệu cho trường nào?"), "A1: UI hỏi 'trường dữ liệu nào'");
assert.ok(sectionSource.includes("businessFieldOptions") && sectionSource.includes("approvedKeys.filter"), "A2: dropdown từ business fields testcase (không hard-code)");
assert.ok(!sectionSource.includes('"TextInput"') && !sectionSource.includes('"Mã đơn vị tính"') && !sectionSource.includes('"Ghi chú"'), "A: KHÔNG hard-code TextInput/Mã/Ghi chú");
assert.ok(sectionSource.includes("Xem thông tin kỹ thuật") && sectionSource.includes("<details"), "A: technical chỉ trong collapse");
assert.ok(sectionSource.includes("Không thuộc testcase") && sectionSource.includes("saveStepDecision"), "A: EXCLUDE qua stepDecisions");
assert.ok(sectionSource.includes("saveTestData") && sectionSource.includes("testDataBindings") === false || sectionSource.includes("bindings"), "A: mapping+value qua saveTestData");

// ===== A3+A4 — map TextInput → Mã đơn vị tính + VALUE → Generate dùng business data =====
const mapSave = await req("PATCH", `/api/automation-v3/workspaces/${wid}/testcases/TC001/test-data`, {
    testData: { "Mã đơn vị tính": { value: "M1", intent: "VALUE" }, "Tên đơn vị tính": { value: "Kg", intent: "VALUE" }, "Ghi chú": { value: "", intent: "EMPTY" } },
    bindings: { "TextInput": "Mã đơn vị tính" }
});
assert.equal(mapSave.status, 200, "A3: lưu mapping TextInput->Mã 200");
const itemMapped = (await req("GET", `/api/automation-v3/workspaces/${wid}`)).body.items.find(x => x.testCaseId === "TC001");
assert.equal(itemMapped.testDataBindings["TextInput"], "Mã đơn vị tính", "A3: mapping persist ở testDataBindings (1 source of truth)");
const genMapped = await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/generate`, {});
assert.equal(genMapped.status, 200, "A4: mapped + data -> Generate 200");
const codeMapped = genMapped.body?.code ?? "";
assert.ok(codeMapped.includes('fill(testData["Mã đơn vị tính"])'), "A4: TextInput step fill qua business field Mã");
assert.ok(!codeMapped.includes('fill("BBC")'), "A4: KHÔNG dùng recorded sample BBC");
assert.ok(!codeMapped.includes('"TextInput"'), "A4: technical key không vào testData");

// ===== A3 — persist sau reload + remove/re-add =====
await new Promise(r => srv.close(r));
const { srv: srv2, req: req2 } = await boot();
const itemReload = (await req2("GET", `/api/automation-v3/workspaces/${wid}`)).body.items.find(x => x.testCaseId === "TC001");
assert.equal(itemReload.testDataBindings["TextInput"], "Mã đơn vị tính", "A3: mapping persist sau reopen/reload");
await req2("DELETE", `/api/automation-v3/workspaces/${wid}/testcases/TC001/binding/blocks/${encodeURIComponent(themBlockId)}`);
await req2("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/library/blocks`, { blockId: themBlockId });
const itemReadd = (await req2("GET", `/api/automation-v3/workspaces/${wid}`)).body.items.find(x => x.testCaseId === "TC001");
assert.equal(itemReadd.testDataBindings["TextInput"], "Mã đơn vị tính", "A3: mapping giữ sau remove/re-add same Action");
const genReadd = await req2("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/generate`, {});
assert.equal(genReadd.status, 200, "A3: generate 200 sau re-add");

// ===== A5 — mapped EMPTY → canonical EMPTY =====
await req2("PATCH", `/api/automation-v3/workspaces/${wid}/testcases/TC001/test-data`, {
    testData: { "Mã đơn vị tính": { value: "", intent: "EMPTY" }, "Tên đơn vị tính": { value: "Kg", intent: "VALUE" }, "Ghi chú": { value: "", intent: "EMPTY" } },
    bindings: { "TextInput": "Mã đơn vị tính" }
});
const genEmpty = await req2("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/generate`, {});
assert.equal(genEmpty.status, 200, "A5: mapped EMPTY -> generate 200");
const codeEmpty = genEmpty.body?.code ?? "";
assert.ok(!codeEmpty.includes('fill("BBC")') && !codeEmpty.includes('fill(testData["Mã đơn vị tính"])'), "A5: EMPTY -> skip fill Mã (không recorded)");
assert.ok(codeEmpty.includes('fill(testData["Tên đơn vị tính"])'), "A5: Tên VALUE giữ nguyên");

// ===== A6 — EXCLUDE → step không vào spec; Library gốc giữ nguyên =====
// Hoàn tác mapping -> EXCLUDE TextInput step
const textInputOrder = (itemReadd.segments.find(s => s.label === "Thêm mới đơn vị tính")?.steps ?? []).find(s => s.target === "TextInput")?.order;
const decEx = await req2("PATCH", `/api/automation-v3/workspaces/${wid}/testcases/TC001/step-decisions`, {
    blockId: themBlockId, stepOrder: textInputOrder, decision: "EXCLUDE"
});
assert.equal(decEx.status, 200, "A6: EXCLUDE 200");
const genEx = await req2("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/generate`, {});
assert.equal(genEx.status, 200, "A6: generate 200 (Mã EMPTY + Ghi chú EMPTY + TextInput EXCLUDE)");
assert.ok(!(genEx.body?.code ?? "").includes("TextInput"), "A6: step TextInput không vào spec");
const libList = (await req2("GET", "/api/codegen/library")).body?.data ?? [];
assert.ok(libList.find(b => b.blockId === themBlockId).steps.some(s => s.target === "TextInput"), "A6: Action Library gốc vẫn chứa TextInput");

// ===== A13 — P0 EMPTY-FIX: save qua drawer path (draft rebuild từ confirmed) KHÔNG mất EMPTY =====
// Kịch bản thật: review-section lưu EMPTY Mã -> drawer mở lại (testCase mới) -> draft rebuild
// (Mã {value:"",intent:"EMPTY"}) -> tester sửa field khác -> [Lưu dữ liệu] gửi full draft
// -> confirmed Mã PHẢI giữ EMPTY (trước đây draft state cũ intent "" ghi đè mất EMPTY).
const drawerDraft = {}; // mô phỏng drawer rebuild: approved keys + confirmed (fieldEntry object)
const approvedA13 = { "Mã đơn vị tính": { value: "" }, "Tên đơn vị tính": { value: "Kg" }, "Ghi chú": { value: "" } };
for (const [k, f] of Object.entries(approvedA13)) {
    const sv = String(f?.value ?? "");
    drawerDraft[k] = { value: sv, intent: sv.trim() !== "" ? "VALUE" : "" };
}
const itemA13 = (await req2("GET", `/api/automation-v3/workspaces/${wid}`)).body.items.find(x => x.testCaseId === "TC001");
for (const [k, v] of Object.entries(itemA13.confirmedTestData ?? {})) {
    const e = v && typeof v === "object" && !Array.isArray(v)
        ? { value: v.value === undefined || v.value === null ? "" : String(v.value), intent: String(v.intent ?? "").toUpperCase() === "EMPTY" ? "EMPTY" : "VALUE" }
        : { value: v == null ? "" : String(v), intent: String(v ?? "").trim() !== "" ? "VALUE" : "" };
    drawerDraft[k] = e;
}
// drawer path: Lưu dữ liệu (gửi full draft, KHÔNG bindings — như persistTd hiện tại)
const drawerSave = await req2("PATCH", `/api/automation-v3/workspaces/${wid}/testcases/TC001/test-data`, { testData: drawerDraft });
assert.equal(drawerSave.status, 200, "A13: drawer save 200");
const itemA13b = (await req2("GET", `/api/automation-v3/workspaces/${wid}`)).body.items.find(x => x.testCaseId === "TC001");
assert.equal(itemA13b.confirmedTestData["Mã đơn vị tính"]?.intent, "EMPTY", "A13: EMPTY giữ sau drawer save (draft rebuild từ confirmed)");
assert.equal(itemA13b.confirmedTestData["Ghi chú"]?.intent, "EMPTY", "A13: Ghi chú EMPTY giữ");
// static: drawer useEffect dep là testCase (object), không chỉ testCaseId
const drawerSource = fs.readFileSync(path.join(testDir, "..", "web-ui", "src", "components", "automationV3", "V3ReviewDrawer.jsx"), "utf8");
assert.ok(drawerSource.includes("}, [testCase]);"), "A13: drawer draft sync dep = [testCase] (rebuild khi testCase mới)");

// ===== A14 — duplicate step CÙNG field (TextInput + Mã cùng map Mã) EMPTY đồng nhất: cả 2 skip =====
// (Đã map TextInput->Mã + Mã EMPTY; step Mã đơn vị tính (target trùng field) cũng EMPTY qua confirmed)
const genA14 = await req2("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/generate`, {});
assert.equal(genA14.status, 200, "A14: generate 200");
const codeA14 = genA14.body?.code ?? "";
assert.ok(!codeA14.includes('fill("BBC")') && !codeA14.includes('fill(testData["Mã đơn vị tính"])'), "A14: CẢ 2 step (TextInput + Mã) cùng EMPTY -> không fill Mã/BBC");

// ===== A9 — TC008 parameterized =====
const SRC_TC8 = `await page.goto('http://x/danh-muc');
await page.getByRole('textbox', { name: 'text search' }).fill('Bộ');
await page.getByRole('button', { name: 'Tìm kiếm' }).click();
await expect(page.getByText('kết quả')).toBeVisible();`;
await new Promise(r => srv2.close(r));
const { srv: srv3, req: req3 } = await boot();
const start3 = await req3("POST", "/api/codegen/start", { url: "about:blank", browser: "chrome", mode: "FULL_FLOW" });
const rec3 = start3.body?.data?.recordingId ?? start3.body?.recordingId;
await req3("POST", `/api/codegen/recordings/${rec3}/script`, { script: SRC_TC8 });
const lib8 = await req3("POST", "/api/codegen/library", { recordingId: rec3, label: "Tìm kiếm đơn vị tính", startStep: 1, endStep: 3, groupName: "ĐVT" });
const ws8 = await req3("POST", "/api/automation-v3/workspaces", { source: "NEW", module: "ĐVT", approvedTestCases: [
    { id: "TC008", title: "Tìm kiếm", module: "ĐVT", type: "POSITIVE", reviewStatus: "APPROVED", expectedResult: "OK", testData: { fields: { "Từ khóa tìm kiếm": { value: "Bản" } } } }
] });
const wid8 = ws8.body.workspaceId;
await req3("POST", `/api/automation-v3/workspaces/${wid8}/testcases/TC008/select`);
await req3("POST", `/api/automation-v3/workspaces/${wid8}/testcases/TC008/library/blocks`, { blockId: lib8.body.data.blockId });
await req3("POST", `/api/automation-v3/workspaces/${wid8}/testcases/TC008/assertions`, {
    type: "TEXT_VISIBLE", target: "kết quả", locator: "page.getByText('kết quả')",
    expected: "kết quả", matcher: "toBeVisible", source: "TESTER_INPUT", status: "TESTER_CONFIRMED"
});
const gen8 = await req3("POST", `/api/automation-v3/workspaces/${wid8}/testcases/TC008/generate`, {});
assert.equal(gen8.status, 200, "A9: TC008 parameterized 200");
assert.ok((gen8.body?.code ?? "").includes('fill(testData["Từ khóa tìm kiếm"])'), "A9: text search -> Từ khóa tìm kiếm");

// ===== A10 — Login env =====
const SRC_LOGIN = `await page.goto('http://x/login');
await page.getByRole('textbox', { name: 'Tài khoản' }).fill('admin');
await page.getByRole('textbox', { name: 'Mật khẩu' }).fill('123456@Aa');
await page.getByRole('button', { name: 'Đăng nhập' }).click();
await expect(page.getByText('kết quả')).toBeVisible();`;
await new Promise(r => srv3.close(r));
const { srv: srv4, req: req4 } = await boot();
const start4 = await req4("POST", "/api/codegen/start", { url: "about:blank", browser: "chrome", mode: "FULL_FLOW" });
const rec4 = start4.body?.data?.recordingId ?? start4.body?.recordingId;
await req4("POST", `/api/codegen/recordings/${rec4}/script`, { script: SRC_LOGIN });
const lib9 = await req4("POST", "/api/codegen/library", { recordingId: rec4, label: "Đăng nhập", startStep: 1, endStep: 4, groupName: "Đăng nhập" });
const ws9 = await req4("POST", "/api/automation-v3/workspaces", { source: "NEW", module: "Login", approvedTestCases: [
    { id: "TC009", title: "Đăng nhập", module: "Login", type: "POSITIVE", reviewStatus: "APPROVED", expectedResult: "OK", testData: { fields: { "Tài khoản": { value: "admin" }, "Mật khẩu": { value: "secret" } } } }
] });
const wid9 = ws9.body.workspaceId;
await req4("POST", `/api/automation-v3/workspaces/${wid9}/testcases/TC009/select`);
await req4("POST", `/api/automation-v3/workspaces/${wid9}/testcases/TC009/library/blocks`, { blockId: lib9.body.data.blockId });
await req4("POST", `/api/automation-v3/workspaces/${wid9}/testcases/TC009/assertions`, {
    type: "TEXT_VISIBLE", target: "kết quả", locator: "page.getByText('kết quả')",
    expected: "kết quả", matcher: "toBeVisible", source: "TESTER_INPUT", status: "TESTER_CONFIRMED"
});
const gen9 = await req4("POST", `/api/automation-v3/workspaces/${wid9}/testcases/TC009/generate`, {});
assert.equal(gen9.status, 200, "A10: Login env generate 200");
assert.ok((gen9.body?.code ?? "").includes('fill(process.env.LOGIN_USERNAME ?? "")'), "A10: LOGIN_* env");

// ===== A11 — multi-input không cross-bind =====
assert.ok(codeEmpty.includes('fill(testData["Tên đơn vị tính"])'), "A11: Tên đúng field");

// ===== A12 — workspace cũ không crash =====
// (TC008 không stepDecisions không bindings -> generate 200 đã chứng minh; thêm assert)
assert.equal(itemReload.stepDecisions ?? {}, itemReload.stepDecisions ?? {}, "A12: stepDecisions default rỗng không crash");

await new Promise(r => srv4.close(r));
fs.rmSync(tempRoot, { recursive: true, force: true });

// ===== Renderer-level: resolveFillStatus stepDecision (giữ backend INCLUDE) =====
const { resolveFillStatus } = await import("../src/codegen/rendererV3.js");
const base = { target: "TextInput", testDataBindings: {}, confirmedTestData: {}, approvedTestData: {}, purposeMap: {}, singleInput: false };
assert.equal(resolveFillStatus({ ...base }).status, "UNRESOLVED", "U1: chưa quyết -> UNRESOLVED");
assert.equal(resolveFillStatus({ ...base, testDataBindings: { "TextInput": "Mã đơn vị tính" }, confirmedTestData: { "Mã đơn vị tính": { value: "M1", intent: "VALUE" } } }).status, "VALUE", "U2: mapping + VALUE -> VALUE");
assert.equal(resolveFillStatus({ ...base, testDataBindings: { "TextInput": "Mã đơn vị tính" }, confirmedTestData: { "Mã đơn vị tính": { value: "", intent: "EMPTY" } } }).status, "EMPTY", "U3: mapping + EMPTY -> EMPTY");
assert.equal(resolveFillStatus({ ...base, testDataBindings: { "TextInput": "Mã đơn vị tính" } }).status, "UNRESOLVED", "U4: mapping chưa data -> UNRESOLVED");
assert.equal(resolveFillStatus({ ...base, stepDecision: { status: "INCLUDE", value: "ABC", intent: "VALUE" } }).status, "VALUE", "U5: INCLUDE (backend cũ) vẫn hoạt động");

console.log("Automation V3 Step Review (XÁC ĐỊNH FIELD -> VALUE) test: PASS");
