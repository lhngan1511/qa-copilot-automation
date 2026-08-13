import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/*
 P0 TC001 — CANONICAL DATA SEMANTICS (VALUE / EMPTY / UNRESOLVED / RECORDED_SAMPLE).

 Model (đã duyệt):
   VALUE      — tester/business value xác nhận → fill.
   EMPTY      — tester xác nhận để trống (intent "EMPTY" | purpose "EMPTY") → SKIP fill, KHÔNG fallback recorded.
   UNRESOLVED — chưa xác định data source/intent → CHẶN Generate (recorded = RECORDED_SAMPLE, không âm thầm dùng).
   "" / null / missing KHÔNG explicit EMPTY → UNRESOLVED (backward compat: "" cũ không tự EMPTY).
   String cũ non-empty = VALUE (backward compat).

 9 regression bắt buộc:
   R1 multi-input không cross-bind (Mã→Kg, Tên→Kg, Ghi chú→Kg bị chặn).
   R2 explicit EMPTY → skip fill.
   R3 empty/null/missing không explicit EMPTY → không fallback recorded.
   R4 RECORDED_SAMPLE chưa confirm → không thành runtime value.
   R5 confirm recorded sample thành VALUE → generate được.
   R6 TC008 parameterization vẫn PASS.
   R7 Login env binding vẫn PASS.
   R8 workspace cũ backward-compatible (string VALUE; "" cũ UNRESOLVED; object {value,intent}).
   R9 Generate bị chặn khi còn UNRESOLVED input cần thiết.
*/

const testDir = path.dirname(fileURLToPath(import.meta.url));
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "tc001sem-"));

// TC001 THẬT: approved Mã/Ghi chú TRỐNG (business data null/trống), Tên có VALUE "Kg";
// recording literals: Mã="BBC", Tên="Tên mẫu", Ghi chú="ghi chú" (RECORDED_SAMPLE).
const APPROVED_TC001 = [{
    id: "TC001", title: "Thêm mới đơn vị tính thành công với dữ liệu hợp lệ", module: "Đơn vị tính",
    type: "POSITIVE", reviewStatus: "APPROVED", expectedResult: "Tạo thành công",
    testData: { fields: {
        "Mã đơn vị tính": { value: "", purpose: "VALID" },
        "Tên đơn vị tính": { value: "Kg", purpose: "VALID" },
        "Ghi chú": { value: "", purpose: "VALID" }
    } }
}];
const APPROVED_TC008 = [{
    id: "TC008", title: "Tìm kiếm đơn vị tính", module: "Đơn vị tính",
    type: "POSITIVE", reviewStatus: "APPROVED", expectedResult: "Tìm thấy",
    testData: { fields: { "Từ khóa tìm kiếm": { value: "Bản", purpose: "VALID" } } }
}];

const SRC_TC001 = `await page.goto('http://x/danh-muc/don-vi-tinh/them-moi');
await page.getByLabel('Mã đơn vị tính').fill('BBC');
await page.getByLabel('Tên đơn vị tính').fill('Tên mẫu');
await page.getByLabel('Ghi chú').fill('ghi chú');
await page.getByRole('button', { name: 'Lưu' }).click();
await expect(page.getByText('Đơn vị tính được tạo thành công.')).toBeVisible();`;
const SRC_TC008 = `await page.goto('http://x/danh-muc/don-vi-tinh');
await page.getByRole('textbox', { name: 'text search' }).fill('Bộ');
await page.getByRole('button', { name: 'Tìm kiếm' }).click();
await expect(page.getByText('trên tổng số 1 dòng dữ liệu')).toBeVisible();`;

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

async function setupWorkspace(approved, src, blocks) {
    const start = await req("POST", "/api/codegen/start", { url: "about:blank", browser: "chrome", mode: "FULL_FLOW" });
    const recId = start.body?.data?.recordingId ?? start.body?.recordingId;
    await req("POST", `/api/codegen/recordings/${recId}/script`, { script: src });
    const libMap = {};
    for (const b of blocks) {
        const lib = await req("POST", "/api/codegen/library", { recordingId: recId, label: b.label, startStep: b.from, endStep: b.to, groupName: "Đơn vị tính" });
        libMap[b.label] = lib.body.data.blockId;
    }
    const ws = await req("POST", "/api/automation-v3/workspaces", { source: "NEW", module: "Đơn vị tính", approvedTestCases: approved });
    const wid = ws.body.workspaceId;
    const tcId = approved[0].id;
    await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/${tcId}/select`);
    for (const label of Object.keys(libMap)) {
        await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/${tcId}/library/blocks`, { blockId: libMap[label] });
    }
    await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/${tcId}/assertions`, {
        type: "TEXT_VISIBLE", target: "kết quả", locator: "page.getByText('kết quả')",
        expected: "kết quả", matcher: "toBeVisible", source: "TESTER_INPUT", status: "TESTER_CONFIRMED"
    });
    return { wid, tcId };
}

// ===== TC001 setup =====
let { srv, req } = await boot();
const ws1 = await setupWorkspace(APPROVED_TC001, SRC_TC001, [
    { label: "Thêm đơn vị tính", from: 1, to: 5 }
]);
const save0 = await req("PATCH", `/api/automation-v3/workspaces/${ws1.wid}/testcases/${ws1.tcId}/test-data`, { testData: {}, bindings: {} });
assert.equal(save0.status, 200, "setup: clear confirmed");

// ===== R1 + R9 — multi-input không cross-bind; UNRESOLVED chặn Generate =====
const genR1 = await req("POST", `/api/automation-v3/workspaces/${ws1.wid}/testcases/${ws1.tcId}/generate`, {});
assert.equal(genR1.status, 422, "R1: còn UNRESOLVED -> Generate bị chặn (422)");
assert.equal(genR1.body?.errorCode, "TESTDATA_UNRESOLVED", "R1: errorCode TESTDATA_UNRESOLVED");
const msgR1 = String(genR1.body?.message ?? "");
assert.ok(msgR1.includes("Mã đơn vị tính") && msgR1.includes("Ghi chú"), "R1: message liệt kê field UNRESOLVED (Mã + Ghi chú)");
assert.ok(!msgR1.includes("Tên đơn vị tính"), "R1: Tên có VALUE (approved Kg) — không nằm trong danh sách chặn");
assert.ok(!msgR1.includes("fill(") && genR1.body?.code === undefined, "R1: không sinh code (chặn trước render) — KHÔNG cross-bind Mã→Kg/Tên→Kg/Ghi chú→Kg");

// ===== R4 — RECORDED_SAMPLE chưa confirm không thành runtime value =====
// (R1 đã chứng minh: recorded BBC/ghi chú không được dùng; đây là assert tường minh)
assert.ok(!msgR1.includes("BBC") || !genR1.body?.code, "R4: recorded 'BBC' không thành runtime value khi chưa confirm");

// ===== R2 — explicit EMPTY → SKIP fill =====
const saveR2 = await req("PATCH", `/api/automation-v3/workspaces/${ws1.wid}/testcases/${ws1.tcId}/test-data`, {
    testData: { "Mã đơn vị tính": { value: "", intent: "EMPTY" }, "Ghi chú": { value: "", intent: "EMPTY" } }
});
assert.equal(saveR2.status, 200, "R2: lưu EMPTY intent");
const genR2 = await req("POST", `/api/automation-v3/workspaces/${ws1.wid}/testcases/${ws1.tcId}/generate`, {});
assert.equal(genR2.status, 200, "R2: EMPTY -> generate 200");
const codeR2 = genR2.body?.code ?? "";
assert.ok(codeR2.includes('"Tên đơn vị tính": "Kg"') && codeR2.includes('fill(testData["Tên đơn vị tính"])'), "R2: Tên VALUE vẫn fill");
assert.ok(!codeR2.includes('fill("BBC")') && !codeR2.includes('fill("ghi chú")') && !codeR2.includes('fill("Tên mẫu")'), "R2: KHÔNG literal recorded (BBC/ghi chú/Tên mẫu)");
assert.ok(!codeR2.includes('fill(testData["Mã đơn vị tính"])') && !codeR2.includes('fill(testData["Ghi chú"])'), "R2: EMPTY -> SKIP fill (không điền Mã/Ghi chú)");

// ===== R3 — "" cũ (legacy string, không explicit EMPTY) → UNRESOLVED (không fallback BBC, không tự EMPTY) =====
const saveR3 = await req("PATCH", `/api/automation-v3/workspaces/${ws1.wid}/testcases/${ws1.tcId}/test-data`, {
    testData: { "Mã đơn vị tính": "", "Ghi chú": "" }
});
assert.equal(saveR3.status, 200, "R3: lưu string rỗng cũ");
const genR3 = await req("POST", `/api/automation-v3/workspaces/${ws1.wid}/testcases/${ws1.tcId}/generate`, {});
assert.equal(genR3.status, 422, "R3: \"\" cũ không explicit EMPTY -> UNRESOLVED chặn");
assert.equal(genR3.body?.errorCode, "TESTDATA_UNRESOLVED", "R3: errorCode");
assert.ok(!(genR3.body?.code ?? "").includes('fill("BBC")'), "R3: KHÔNG fallback recorded BBC");

// ===== R5 — confirm recorded sample thành VALUE → generate được =====
const saveR5 = await req("PATCH", `/api/automation-v3/workspaces/${ws1.wid}/testcases/${ws1.tcId}/test-data`, {
    testData: { "Mã đơn vị tính": "BBC", "Ghi chú": "ghi chú" } // string cũ = VALUE
});
assert.equal(saveR5.status, 200, "R5: confirm recorded sample thành VALUE");
const genR5 = await req("POST", `/api/automation-v3/workspaces/${ws1.wid}/testcases/${ws1.tcId}/generate`, {});
assert.equal(genR5.status, 200, "R5: generate 200");
const codeR5 = genR5.body?.code ?? "";
assert.ok(codeR5.includes('"Mã đơn vị tính": "BBC"') && codeR5.includes('fill(testData["Mã đơn vị tính"])'), "R5: Mã VALUE = BBC (tester confirm)");
assert.ok(codeR5.includes('"Ghi chú": "ghi chú"') && codeR5.includes('fill(testData["Ghi chú"])'), "R5: Ghi chú VALUE = ghi chú (tester confirm)");
assert.ok(codeR5.includes('"Tên đơn vị tính": "Kg"'), "R5: Tên approved VALUE giữ nguyên");

// ===== R8 — backward compat: object {value,intent} + target-keyed legacy =====
const saveR8 = await req("PATCH", `/api/automation-v3/workspaces/${ws1.wid}/testcases/${ws1.tcId}/test-data`, {
    testData: { "Mã đơn vị tính": { value: "M1", intent: "VALUE" }, "Ghi chú": { value: "", intent: "EMPTY" } }
});
assert.equal(saveR8.status, 200, "R8: lưu object {value,intent}");
const genR8 = await req("POST", `/api/automation-v3/workspaces/${ws1.wid}/testcases/${ws1.tcId}/generate`, {});
assert.equal(genR8.status, 200, "R8: object VALUE + EMPTY -> generate 200");
const codeR8 = genR8.body?.code ?? "";
assert.ok(codeR8.includes('"Mã đơn vị tính": "M1"'), "R8: object {value,intent:VALUE} hoạt động");
assert.ok(!codeR8.includes('fill(testData["Ghi chú"])'), "R8: object {intent:EMPTY} -> skip");
// legacy target-keyed confirmed (keyfix) — string non-empty vẫn VALUE
await new Promise(r => srv.close(r));
({ srv, req } = await boot());
const wsLegacy = await setupWorkspace(APPROVED_TC001, SRC_TC001, [{ label: "Thêm đơn vị tính", from: 1, to: 5 }]);
const saveR8b = await req("PATCH", `/api/automation-v3/workspaces/${wsLegacy.wid}/testcases/${wsLegacy.tcId}/test-data`, {
    testData: { "Mã đơn vị tính": { value: "", intent: "EMPTY" }, "Ghi chú": { value: "", intent: "EMPTY" }, "text search": "legacy-cai" }
});
const genR8b = await req("POST", `/api/automation-v3/workspaces/${wsLegacy.wid}/testcases/${wsLegacy.tcId}/generate`, {});
assert.equal(genR8b.status, 200, "R8b: legacy target-keyed (không business field tương ứng) không chặn — key không thuộc fill nào");

// ===== R6 — TC008 parameterization vẫn PASS =====
await new Promise(r => srv.close(r));
({ srv, req } = await boot());
const ws8 = await setupWorkspace(APPROVED_TC008, SRC_TC008, [{ label: "Tìm kiếm đơn vị tính", from: 1, to: 3 }]);
const item8 = (await req("GET", `/api/automation-v3/workspaces/${ws8.wid}`)).body.items.find(x => x.testCaseId === "TC008");
assert.deepEqual(item8.testDataBindings, { "text search": "Từ khóa tìm kiếm" }, "R6: TC008 auto-bind vẫn tạo binding");
const genR6 = await req("POST", `/api/automation-v3/workspaces/${ws8.wid}/testcases/TC008/generate`, {});
assert.equal(genR6.status, 200, "R6: TC008 generate 200");
const codeR6 = genR6.body?.code ?? "";
assert.ok(codeR6.includes('"Từ khóa tìm kiếm": "Bản"') && codeR6.includes('fill(testData["Từ khóa tìm kiếm"])'), "R6: TC008 parameterization giữ nguyên");
assert.ok(!codeR6.includes('fill("Bộ")'), "R6: không fallback recorded Bộ");

// ===== R7 — Login env binding vẫn PASS =====
const SRC_LOGIN = `await page.goto('http://x/login');
await page.getByRole('textbox', { name: 'Tài khoản' }).fill('admin');
await page.getByRole('textbox', { name: 'Mật khẩu' }).fill('123456@Aa');
await page.getByRole('button', { name: 'Đăng nhập' }).click();
await expect(page.getByText('Vào hệ thống')).toBeVisible();`;
const APPROVED_LOGIN = [{
    id: "TC009", title: "Đăng nhập thành công", module: "Đăng nhập", type: "POSITIVE",
    reviewStatus: "APPROVED", expectedResult: "Vào hệ thống",
    testData: { fields: { "Tài khoản": { value: "admin", purpose: "VALID" }, "Mật khẩu": { value: "secret", purpose: "VALID" } } }
}];
await new Promise(r => srv.close(r));
({ srv, req } = await boot());
const ws9 = await setupWorkspace(APPROVED_LOGIN, SRC_LOGIN, [{ label: "Đăng nhập", from: 1, to: 4 }]);
const genR7 = await req("POST", `/api/automation-v3/workspaces/${ws9.wid}/testcases/TC009/generate`, {});
assert.equal(genR7.status, 200, "R7: Login (setup env) generate 200 — không bị UNRESOLVED");
const codeR7 = genR7.body?.code ?? "";
assert.ok(codeR7.includes('fill(process.env.LOGIN_USERNAME ?? "")') && codeR7.includes('fill(process.env.LOGIN_PASSWORD ?? "")'), "R7: Login vẫn LOGIN_* env");
assert.ok(!codeR7.includes('fill("admin")') && !codeR7.includes('fill("secret")'), "R7: không hardcode credential");

await new Promise(r => srv.close(r));
fs.rmSync(tempRoot, { recursive: true, force: true });

// ===== Renderer-level: resolveFillStatus unit (6 trạng thái) =====
const { resolveFillStatus } = await import("../src/codegen/rendererV3.js");
const stCtx = (over = {}) => ({ target: "Mã đơn vị tính", testDataBindings: {}, confirmedTestData: {}, approvedTestData: {}, purposeMap: {}, singleInput: false, ...over });
const approvedTC001 = APPROVED_TC001[0].testData;
assert.equal(resolveFillStatus(stCtx()).status, "UNRESOLVED", "U1: missing -> UNRESOLVED");
assert.equal(resolveFillStatus(stCtx({ approvedTestData: approvedTC001 })).status, "UNRESOLVED", "U2: approved '' -> UNRESOLVED (không tự EMPTY)");
assert.equal(resolveFillStatus(stCtx({ confirmedTestData: { "Mã đơn vị tính": "" } })).status, "UNRESOLVED", "U3: confirmed '' cũ -> UNRESOLVED");
assert.equal(resolveFillStatus(stCtx({ confirmedTestData: { "Mã đơn vị tính": { value: "", intent: "EMPTY" } } })).status, "EMPTY", "U4: intent EMPTY -> EMPTY (skip)");
assert.equal(resolveFillStatus(stCtx({ purposeMap: { "Mã đơn vị tính": "EMPTY" }, approvedTestData: { fields: { "Mã đơn vị tính": { value: "BBC", purpose: "EMPTY" } } } })).status, "EMPTY", "U5: purpose EMPTY -> EMPTY");
assert.equal(resolveFillStatus(stCtx({ confirmedTestData: { "Mã đơn vị tính": "BBC" } })).status, "VALUE", "U6: string VALUE -> VALUE");
assert.equal(resolveFillStatus(stCtx({ confirmedTestData: { "Mã đơn vị tính": { value: "M1", intent: "VALUE" } } })).status, "VALUE", "U7: object VALUE -> VALUE");
assert.equal(resolveFillStatus(stCtx({ approvedTestData: { fields: { "Mã đơn vị tính": { value: "Kg", purpose: "VALID" } } } })).status, "VALUE", "U8: approved VALUE -> VALUE");
assert.equal(resolveFillStatus(stCtx({ target: "Tài khoản" })).status, "SETUP", "U9: setup env-bound -> SETUP (không chặn)");
assert.equal(resolveFillStatus(stCtx({ testDataBindings: { "Mã đơn vị tính": "Mã đơn vị tính" }, confirmedTestData: { "Mã đơn vị tính": "X" } })).businessField, "Mã đơn vị tính", "U10: binding giữ businessField");
assert.equal(resolveFillStatus(stCtx({ target: "Tên đơn vị tính", approvedTestData: approvedTC001 })).status, "VALUE", "U11: approved VALUE (Tên='Kg') -> VALUE");

console.log("Automation V3 TC001 Semantics (VALUE/EMPTY/UNRESOLVED/RECORDED_SAMPLE) test: PASS");
