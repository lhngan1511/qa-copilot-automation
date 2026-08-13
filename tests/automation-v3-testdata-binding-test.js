import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/*
 P0 — TEST DATA MAPPING (canonical binding businessField ↔ action input).

 Root cause: renderer lookup theo step.target ('text search'); tester sửa business
 field ('Từ khóa tìm kiếm') -> confirmedTestData['text search'] undefined -> fallback
 recorded 'Bộ'. Fix a7fa708 chỉ hiển thị đúng key, chưa có CANONICAL mapping.

 Fix: testDataBindings { stepTarget: businessField } (tester-owned/evidence; persist
 workspace). Renderer: businessField = bindings[target] ?? target -> lookup
 confirmed/approved theo businessField -> fill(testData["Từ khóa tìm kiếm"]).
*/

const testDir = path.dirname(fileURLToPath(import.meta.url));
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "map-"));
const dataDir = path.join(tempRoot, "d");
const APPROVED = [
    { id: "TC008", title: "Tìm kiếm đơn vị tính", module: "Đơn vị tính", type: "POSITIVE", reviewStatus: "APPROVED", expectedResult: "Tìm thấy", testData: { fields: { "Từ khóa tìm kiếm": { value: "abc", purpose: "VALID" } } } },
    { id: "TC009", title: "Không dữ liệu", module: "Đơn vị tính", type: "POSITIVE", reviewStatus: "APPROVED", expectedResult: "OK", testData: null }
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

// Setup: recording fill 'text search' value 'Bộ'
const start = await req("POST", "/api/codegen/start", { url: "about:blank", browser: "chrome", mode: "FULL_FLOW" });
const recId = start.body?.data?.recordingId ?? start.body?.recordingId;
const SRC = `await page.goto('http://x/danh-muc/don-vi-tinh');
await page.getByRole('textbox', { name: 'text search' }).fill('Bộ');
await page.getByRole('button', { name: 'Tìm kiếm' }).click();
await expect(page.getByText('trên tổng số 1 dòng dữ liệu')).toBeVisible();`;
await req("POST", `/api/codegen/recordings/${recId}/script`, { script: SRC });
const lib = await req("POST", "/api/codegen/library", { recordingId: recId, label: "Tìm kiếm đơn vị tính", startStep: 1, endStep: 3, groupName: "Đơn vị tính" });
const ws = await req("POST", "/api/automation-v3/workspaces", { source: "NEW", module: "Đơn vị tính", approvedTestCases: APPROVED });
const wid = ws.body.workspaceId;
await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC008/select`);
await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC008/library/blocks`, { blockId: lib.body.data.blockId });
await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC008/assertions`, {
    type: "TEXT_VISIBLE", target: "trên tổng số 1 dòng dữ liệu", locator: "page.getByText('trên tổng số 1 dòng dữ liệu')",
    expected: "trên tổng số 1 dòng dữ liệu", matcher: "toBeVisible", source: "RECORDED", status: "TESTER_CONFIRMED"
});

// AUTO-BIND — 1 business field + 1 action input (unique) -> binding tự động (không cần tester select).
const itemAuto = (await req("GET", `/api/automation-v3/workspaces/${wid}`)).body.items.find(x => x.testCaseId === "TC008");
assert.deepEqual(itemAuto.testDataBindings, { "text search": "Từ khóa tìm kiếm" }, "auto-bind unique: text search -> Từ khóa tìm kiếm");

// A — approved "Từ khóa tìm kiếm"="abc", recorded "Bộ", binding {"text search":"Từ khóa tìm kiếm"} -> dùng "abc"
const save1 = await req("PATCH", `/api/automation-v3/workspaces/${wid}/testcases/TC008/test-data`, {
    testData: {}, bindings: { "text search": "Từ khóa tìm kiếm" }
});
assert.equal(save1.status, 200, "A: save binding 200");
const genA = await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC008/generate`, {});
assert.equal(genA.status, 200, "A: generate 200");
const codeA = genA.body?.code ?? "";
assert.ok(codeA.includes('"Từ khóa tìm kiếm": "abc"'), "A: testData key = businessField, value = approved abc");
assert.ok(codeA.includes('fill(testData["Từ khóa tìm kiếm"])'), "A: fill(testData[\"Từ khóa tìm kiếm\"])");
assert.ok(!codeA.includes('fill("Bộ")') && !codeA.includes('"text search"'), "A: không dùng recorded Bộ / technical key");

// B — tester edit thành "cai" (business field) -> dùng "cai"
const save2 = await req("PATCH", `/api/automation-v3/workspaces/${wid}/testcases/TC008/test-data`, {
    testData: { "Từ khóa tìm kiếm": "cai" }, bindings: { "text search": "Từ khóa tìm kiếm" }
});
assert.equal(save2.status, 200, "B: save edit 200");
const genB = await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC008/generate`, {});
const codeB = genB.body?.code ?? "";
assert.ok(codeB.includes('"Từ khóa tìm kiếm": "cai"'), "B: value cai (tester edit)");
assert.ok(!codeB.includes('"Bộ"'), "B: không còn Bộ");

// C — reload -> binding persist
await new Promise(r => srv.close(r));
({ srv, req } = await boot());
const item = (await req("GET", `/api/automation-v3/workspaces/${wid}`)).body.items.find(x => x.testCaseId === "TC008");
assert.deepEqual(item.testDataBindings, { "text search": "Từ khóa tìm kiếm" }, "C: binding persist sau reload");

// D — KHÔNG có business field (testData null) -> không auto-bind -> fallback recorded theo contract
await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC009/select`);
await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC009/library/blocks`, { blockId: lib.body.data.blockId });
await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC009/assertions`, {
    type: "TEXT_VISIBLE", target: "trên tổng số 1 dòng dữ liệu", locator: "page.getByText('trên tổng số 1 dòng dữ liệu')",
    expected: "trên tổng số 1 dòng dữ liệu", matcher: "toBeVisible", source: "RECORDED", status: "TESTER_CONFIRMED"
});
const itemD = (await req("GET", `/api/automation-v3/workspaces/${wid}`)).body.items.find(x => x.testCaseId === "TC009");
assert.deepEqual(itemD.testDataBindings, {}, "D: không business field -> không auto-bind (không đoán)");
const genD = await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC009/generate`, {});
const codeD = genD.body?.code ?? "";
assert.ok(codeD.includes('fill("Bộ")'), "D: không binding -> fallback recorded Bộ (contract, không đoán)");

// E — Login env: binding không ảnh hưởng LOGIN_* (target username không binding -> envKeyFor)
const { envKeyFor } = await import("../src/codegen/rendererV3.js");
assert.equal(envKeyFor("Tài khoản"), "LOGIN_USERNAME", "E: login env giữ nguyên");

// F — UI không duplicate field (static): editor ẩn action input đã map; select binding có
const drawerSource = fs.readFileSync(path.join(testDir, "..", "web-ui", "src", "components", "automationV3", "V3ReviewDrawer.jsx"), "utf8");
const dClean = drawerSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
assert.ok(dClean.includes("tdBindings"), "F: binding state giữ (backend)");
assert.ok(!dClean.includes("chọn input của thao tác") && !dClean.includes("kỹ thuật (chưa map business field)"), "F: KHÔNG lộ select/technical cho tester");
assert.ok(dClean.includes("DỮ LIỆU TESTCASE") && dClean.includes("DỮ LIỆU CHUẨN BỊ"), "P0: run tab chia DỮ LIỆU TESTCASE / DỮ LIỆU CHUẨN BỊ");
assert.ok(dClean.includes("Cấu hình môi trường") && dClean.includes("Thiếu dữ liệu chạy"), "P0: prep status env/missing");
assert.ok(dClean.includes("testCase?.testDataBindings"), "F: dùng canonical binding từ DTO");

srv.close();
fs.rmSync(tempRoot, { recursive: true, force: true });

console.log("Automation V3 Test Data Mapping (canonical binding) test: PASS");
