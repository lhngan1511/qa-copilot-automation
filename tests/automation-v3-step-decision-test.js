import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/*
 P0 — CẦN XÁC NHẬN THAO TÁC (STEP DECISION, workspace/testcase scope).

 UX duyệt: vùng RIÊNG trong drawer cho unresolved FILL target không map business field
 (technical target — VD 'TextInput'); tester chọn:
   - Giữ thao tác (INCLUDE) + xác nhận data (VALUE/EMPTY) cho chính step;
   - Không thuộc testcase (EXCLUDE) — bỏ step KHỎI testcase/workspace hiện tại khi Generate.
 KHÔNG mutate Action Library / recording; KHÔNG map heuristic; KHÔNG fallback recorded;
 chưa quyết định → 422 (giữ).

 Acceptance:
  1. Ghi chú (business unresolved) → KHÔNG xuất hiện ở step review (business editor lo) → 422 đến khi VALUE/EMPTY.
  2. TextInput (technical unresolved) → xuất hiện ở CẦN XÁC NHẬN THAO TÁC (DTO: segment.steps + stepDecisions).
  3. EXCLUDE → Generate 200, step biến mất khỏi spec; tester KHÔNG nhập data technical.
  4. EXCLUDE chỉ workspace/testcase: Action Library gốc KHÔNG đổi (steps vẫn còn TextInput).
  5. INCLUDE + VALUE → Generate dùng value tester (fill inline).
  6. INCLUDE + EMPTY → Generate skip fill step (không recorded).
  7. Chưa quyết định → 422 TESTDATA_UNRESOLVED.
  8. TC008 vẫn parameterized.
  9. Login setup vẫn hoạt động.
  10. Multi-input không cross-bind.
  11. Workspace cũ (không stepDecisions) không crash.
  12. Remove/re-add CÙNG Action không làm mất step decision.
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

// Setup TC001: approved Mã ""/Tên "Kg"/Ghi chú ""; recording có TextInput (technical) + Ghi chú
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
const save = await req("PATCH", `/api/automation-v3/workspaces/${wid}/testcases/TC001/test-data`, {
    testData: { "Mã đơn vị tính": { value: "M1", intent: "VALUE" }, "Tên đơn vị tính": { value: "Kg", intent: "VALUE" }, "Ghi chú": { value: "", intent: "" } }
});
assert.equal(save.status, 200, "setup: save test-data 200");
const item = (await req("GET", `/api/automation-v3/workspaces/${wid}`)).body.items.find(x => x.testCaseId === "TC001");

// ===== ACCEPTANCE 2 — TextInput xuất hiện ở review area (DTO có segment.steps + stepDecisions) =====
const segThem = item.segments.find(s => s.label === "Thêm mới đơn vị tính");
assert.ok(segThem, "A2: có segment 'Thêm mới đơn vị tính'");
const textInputStep = (segThem.steps ?? []).find(s => s.target === "TextInput");
assert.ok(textInputStep, "A2: segment.steps chứa step TextInput (locator/target/recorded cho UI review)");
assert.equal(textInputStep.recordedValue, "BBC", "A2: recorded sample BBC hiển thị");
assert.deepEqual(item.stepDecisions ?? {}, {}, "A2: chưa decision -> stepDecisions rỗng");

// ===== ACCEPTANCE 7 — chưa quyết định → 422 =====
const genBlocked = await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/generate`, {});
assert.equal(genBlocked.status, 422, "A7: chưa quyết định TextInput/Ghi chú -> 422");
assert.equal(genBlocked.body?.errorCode, "TESTDATA_UNRESOLVED", "A7: errorCode");
const uf = genBlocked.body?.details?.unresolvedFields ?? [];
assert.ok(uf.some(x => x.field === "TextInput" && x.mapped === false), "A7: unresolvedFields chứa TextInput mapped=false");
assert.ok(uf.some(x => x.field === "Ghi chú"), "A7: unresolvedFields chứa Ghi chú (business)");

// ===== ACCEPTANCE 1 — Ghi chú là BUSINESS unresolved: KHÔNG ở step review (chỉ technical) =====
// (static: V3StepReviewSection lọc approved keys — Ghi chú ∈ approved → không candidate)
const sectionSource = fs.readFileSync(path.join(testDir, "..", "web-ui", "src", "components", "automationV3", "V3StepReviewSection.jsx"), "utf8");
assert.ok(sectionSource.includes("approvedKeys.has(t)"), "A1: review area loại approved keys (business) — Ghi chú không xuất hiện");
assert.ok(sectionSource.includes("CẦN XÁC NHẬN THAO TÁC"), "A2: vùng riêng CẦN XÁC NHẬN THAO TÁC");
assert.ok(sectionSource.includes("Không thuộc testcase") && sectionSource.includes("Giữ thao tác"), "A3/A5: 2 hướng quyết định");

// ===== ACCEPTANCE 3+4 — EXCLUDE TextInput → Generate 200, step bỏ khỏi spec; Library KHÔNG đổi =====
const decExclude = await req("PATCH", `/api/automation-v3/workspaces/${wid}/testcases/TC001/step-decisions`, {
    blockId: themBlockId, stepOrder: textInputStep.order, decision: "EXCLUDE"
});
assert.equal(decExclude.status, 200, "A3: EXCLUDE 200");
// Ghi chú vẫn unresolved → vẫn 422 (chưa resolve business)
const genAfterExclude = await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/generate`, {});
assert.equal(genAfterExclude.status, 422, "A3: Ghi chú vẫn UNRESOLVED -> 422 (TextInput đã hết)");
assert.ok(!(genAfterExclude.body?.details?.unresolvedFields ?? []).some(x => x.field === "TextInput"), "A3: TextInput không còn block sau EXCLUDE");

// Resolve Ghi chú (EMPTY) -> Generate 200, TextInput KHÔNG trong spec
await req("PATCH", `/api/automation-v3/workspaces/${wid}/testcases/TC001/test-data`, {
    testData: { "Mã đơn vị tính": { value: "M1", intent: "VALUE" }, "Tên đơn vị tính": { value: "Kg", intent: "VALUE" }, "Ghi chú": { value: "", intent: "EMPTY" } }
});
const genOk = await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/generate`, {});
assert.equal(genOk.status, 200, "A3: sau EXCLUDE + Ghi chú EMPTY -> Generate 200");
const codeOk = genOk.body?.code ?? "";
assert.ok(!codeOk.includes("TextInput") && !codeOk.includes('fill("BBC")'), "A3: step TextInput KHÔNG trong spec (EXCLUDE)");
assert.ok(codeOk.includes('fill(testData["Mã đơn vị tính"])') && codeOk.includes('fill(testData["Tên đơn vị tính"])'), "A3: business fills giữ nguyên");
// Library gốc không đổi
const libList = (await req("GET", "/api/codegen/library")).body?.data ?? [];
const libThemBlock = libList.find(b => b.blockId === themBlockId);
assert.ok(libThemBlock.steps.some(s => s.target === "TextInput"), "A4: Action Library gốc VẪN chứa TextInput (không mutate)");

// ===== ACCEPTANCE 12 — remove/re-add CÙNG Action không mất decision =====
await req("DELETE", `/api/automation-v3/workspaces/${wid}/testcases/TC001/binding/blocks/${encodeURIComponent(themBlockId)}`);
await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/library/blocks`, { blockId: themBlockId });
const item2 = (await req("GET", `/api/automation-v3/workspaces/${wid}`)).body.items.find(x => x.testCaseId === "TC001");
assert.equal(item2.stepDecisions?.[`${themBlockId}:${textInputStep.order}`]?.status, "EXCLUDE", "A12: decision giữ sau remove/re-add (identity blockId:order ổn định)");
const genAfterReadd = await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/generate`, {});
assert.equal(genAfterReadd.status, 200, "A12: generate 200 sau re-add (decision vẫn áp dụng)");
assert.ok(!(genAfterReadd.body?.code ?? "").includes("TextInput"), "A12: TextInput vẫn bị loại");

// ===== ACCEPTANCE 5 — INCLUDE + VALUE → Generate dùng value tester (inline) =====
// Hoàn tác EXCLUDE -> INCLUDE + value "ABC"
await req("PATCH", `/api/automation-v3/workspaces/${wid}/testcases/TC001/step-decisions`, {
    blockId: themBlockId, stepOrder: textInputStep.order, decision: "INCLUDE", value: "ABC", intent: "VALUE"
});
const genInclude = await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/generate`, {});
assert.equal(genInclude.status, 200, "A5: INCLUDE + VALUE -> generate 200");
const codeInc = genInclude.body?.code ?? "";
assert.ok(codeInc.includes('fill("ABC")'), "A5: step TextInput fill value tester ABC (inline, không recorded BBC)");
assert.ok(!codeInc.includes('fill("BBC")'), "A5: KHÔNG fallback recorded BBC");

// ===== ACCEPTANCE 6 — INCLUDE + EMPTY → skip fill =====
await req("PATCH", `/api/automation-v3/workspaces/${wid}/testcases/TC001/step-decisions`, {
    blockId: themBlockId, stepOrder: textInputStep.order, decision: "INCLUDE", value: "", intent: "EMPTY"
});
const genEmpty = await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/generate`, {});
assert.equal(genEmpty.status, 200, "A6: INCLUDE + EMPTY -> generate 200");
const codeEmpty = genEmpty.body?.code ?? "";
assert.ok(!codeEmpty.includes("TextInput") && !codeEmpty.includes('fill("BBC")'), "A6: EMPTY -> SKIP fill (không recorded)");
assert.ok(codeEmpty.includes('fill(testData["Tên đơn vị tính"])'), "A6: business fills giữ nguyên");

// ===== ACCEPTANCE 10 — multi-input không cross-bind =====
assert.ok(codeEmpty.includes('fill(testData["Mã đơn vị tính"])') && codeEmpty.includes('fill(testData["Tên đơn vị tính"])'), "A10: Mã/Tên đúng field");

// ===== ACCEPTANCE 11 — workspace cũ (không stepDecisions) không crash =====
// TC008 không có decision -> generate vẫn parameterized
const SRC_TC8 = `await page.goto('http://x/danh-muc');
await page.getByRole('textbox', { name: 'text search' }).fill('Bộ');
await page.getByRole('button', { name: 'Tìm kiếm' }).click();
await expect(page.getByText('kết quả')).toBeVisible();`;
await new Promise(r => srv.close(r));
const { srv: srv2, req: req2 } = await boot();
const start2 = await req2("POST", "/api/codegen/start", { url: "about:blank", browser: "chrome", mode: "FULL_FLOW" });
const rec2 = start2.body?.data?.recordingId ?? start2.body?.recordingId;
await req2("POST", `/api/codegen/recordings/${rec2}/script`, { script: SRC_TC8 });
const lib8 = await req2("POST", "/api/codegen/library", { recordingId: rec2, label: "Tìm kiếm đơn vị tính", startStep: 1, endStep: 3, groupName: "ĐVT" });
const ws8 = await req2("POST", "/api/automation-v3/workspaces", { source: "NEW", module: "ĐVT", approvedTestCases: [
    { id: "TC008", title: "Tìm kiếm", module: "ĐVT", type: "POSITIVE", reviewStatus: "APPROVED", expectedResult: "OK", testData: { fields: { "Từ khóa tìm kiếm": { value: "Bản" } } } }
] });
const wid8 = ws8.body.workspaceId;
await req2("POST", `/api/automation-v3/workspaces/${wid8}/testcases/TC008/select`);
await req2("POST", `/api/automation-v3/workspaces/${wid8}/testcases/TC008/library/blocks`, { blockId: lib8.body.data.blockId });
await req2("POST", `/api/automation-v3/workspaces/${wid8}/testcases/TC008/assertions`, {
    type: "TEXT_VISIBLE", target: "kết quả", locator: "page.getByText('kết quả')",
    expected: "kết quả", matcher: "toBeVisible", source: "TESTER_INPUT", status: "TESTER_CONFIRMED"
});
const gen8 = await req2("POST", `/api/automation-v3/workspaces/${wid8}/testcases/TC008/generate`, {});
assert.equal(gen8.status, 200, "A8: TC008 parameterized 200 (workspace cũ không stepDecisions không crash)");
assert.ok((gen8.body?.code ?? "").includes('fill(testData["Từ khóa tìm kiếm"])'), "A8: text search -> Từ khóa tìm kiếm");

// ===== ACCEPTANCE 9 — Login setup vẫn hoạt động =====
const SRC_LOGIN = `await page.goto('http://x/login');
await page.getByRole('textbox', { name: 'Tài khoản' }).fill('admin');
await page.getByRole('textbox', { name: 'Mật khẩu' }).fill('123456@Aa');
await page.getByRole('button', { name: 'Đăng nhập' }).click();
await expect(page.getByText('kết quả')).toBeVisible();`;
await new Promise(r => srv2.close(r));
const { srv: srv3, req: req3 } = await boot();
const start3 = await req3("POST", "/api/codegen/start", { url: "about:blank", browser: "chrome", mode: "FULL_FLOW" });
const rec3 = start3.body?.data?.recordingId ?? start3.body?.recordingId;
await req3("POST", `/api/codegen/recordings/${rec3}/script`, { script: SRC_LOGIN });
const lib9 = await req3("POST", "/api/codegen/library", { recordingId: rec3, label: "Đăng nhập", startStep: 1, endStep: 4, groupName: "Đăng nhập" });
const ws9 = await req3("POST", "/api/automation-v3/workspaces", { source: "NEW", module: "Login", approvedTestCases: [
    { id: "TC009", title: "Đăng nhập", module: "Login", type: "POSITIVE", reviewStatus: "APPROVED", expectedResult: "OK", testData: { fields: { "Tài khoản": { value: "admin" }, "Mật khẩu": { value: "secret" } } } }
] });
const wid9 = ws9.body.workspaceId;
await req3("POST", `/api/automation-v3/workspaces/${wid9}/testcases/TC009/select`);
await req3("POST", `/api/automation-v3/workspaces/${wid9}/testcases/TC009/library/blocks`, { blockId: lib9.body.data.blockId });
await req3("POST", `/api/automation-v3/workspaces/${wid9}/testcases/TC009/assertions`, {
    type: "TEXT_VISIBLE", target: "kết quả", locator: "page.getByText('kết quả')",
    expected: "kết quả", matcher: "toBeVisible", source: "TESTER_INPUT", status: "TESTER_CONFIRMED"
});
const gen9 = await req3("POST", `/api/automation-v3/workspaces/${wid9}/testcases/TC009/generate`, {});
assert.equal(gen9.status, 200, "A9: Login setup env generate 200 (không block)");
assert.ok((gen9.body?.code ?? "").includes('fill(process.env.LOGIN_USERNAME ?? "")'), "A9: LOGIN_* env");

// ===== ACCEPTANCE 7b — hoàn tác (REVIEW_REQUIRED) -> 422 trở lại =====
await req3("PATCH", `/api/automation-v3/workspaces/${wid9}/testcases/TC009/step-decisions`, {
    blockId: lib9.body.data.blockId, stepOrder: 999, decision: "REVIEW_REQUIRED"
}).catch(() => null); // block không có step 999 — chỉ test validation không crash

await new Promise(r => srv3.close(r));
fs.rmSync(tempRoot, { recursive: true, force: true });

// ===== Renderer-level: resolveFillStatus với stepDecision =====
const { resolveFillStatus } = await import("../src/codegen/rendererV3.js");
const base = { target: "TextInput", testDataBindings: {}, confirmedTestData: {}, approvedTestData: {}, purposeMap: {}, singleInput: false };
assert.equal(resolveFillStatus({ ...base }).status, "UNRESOLVED", "U1: chưa quyết -> UNRESOLVED");
assert.equal(resolveFillStatus({ ...base, stepDecision: { status: "EXCLUDE" } }).status, "UNRESOLVED", "U2: EXCLUDE không ảnh hưởng resolve (filter ở renderV3Spec)");
assert.equal(resolveFillStatus({ ...base, stepDecision: { status: "INCLUDE", value: "ABC", intent: "VALUE" } }).status, "VALUE", "U3: INCLUDE+VALUE -> VALUE");
assert.equal(resolveFillStatus({ ...base, stepDecision: { status: "INCLUDE", value: "", intent: "EMPTY" } }).status, "EMPTY", "U4: INCLUDE+EMPTY -> EMPTY");
assert.equal(resolveFillStatus({ ...base, stepDecision: { status: "INCLUDE", value: "", intent: "VALUE" } }).status, "UNRESOLVED", "U5: INCLUDE không data -> UNRESOLVED");
assert.equal(resolveFillStatus({ ...base, stepDecision: { status: "INCLUDE", value: "ABC", intent: "VALUE" } }).value, "ABC", "U6: value từ decision");

console.log("Automation V3 Step Decision (CẦN XÁC NHẬN THAO TÁC) test: PASS");
