import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

/*
 P0-A — TEST DATA FIDELITY + TESTER OVERRIDE (CASE A–J).

 Data flow: approved testcase (testData.fields) → entry.approvedTestData → DTO (toItem)
 → UI editor (tester edit) → PATCH test-data → entry.confirmedTestData (persist workspace,
 KHÔNG sửa approved) → GenerateService → renderV3Spec → spec dùng `testData[...]`.

 Precedence (resolveTestValue): USER_CONFIRMED (edited) > APPROVED_JSON (testcase) > CODEGEN_RECORDED.
*/

const testDir = path.dirname(fileURLToPath(import.meta.url));
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "tdfid-"));
const dataDir = path.join(tempRoot, "d");
const v3Out = path.join(tempRoot, "out");

const APPROVED = [
    {
        id: "TC001", title: "Thêm mới đơn vị tính thành công", module: "Đơn vị tính", type: "POSITIVE",
        reviewStatus: "APPROVED",
        expectedResult: "Đơn vị tính được tạo thành công.",
        testData: {
            requirement: "Nhập thông tin đơn vị tính rồi lưu",
            fields: {
                "Mã đơn vị tính": { value: "DV01", purpose: "VALID", requiresTesterInput: false },
                "Tên đơn vị tính": { value: "Kilogram", purpose: "VALID", requiresTesterInput: false }
            }
        }
    },
    {
        id: "TC002", title: "Testcase không có data", module: "Đơn vị tính", type: "POSITIVE",
        reviewStatus: "APPROVED", expectedResult: "Thành công.", testData: null
    }
];

async function boot() {
    const { default: createApp } = await import("../src/server/createApp.js");
    const app = createApp({ repositoryType: "file", dataDir, outputDir: path.join(tempRoot, "o"), v3OutputDir: v3Out });
    const srv = await new Promise(r => { const s = app.listen(0, "127.0.0.1", () => r(s)); });
    const base = `http://127.0.0.1:${srv.address().port}`;
    async function req(m, p, b) {
        const r = await fetch(`${base}${p}`, { method: m, headers: b !== undefined ? { "content-type": "application/json" } : {}, body: b !== undefined ? JSON.stringify(b) : undefined });
        let d; try { d = await r.json(); } catch { d = null; }
        return { status: r.status, body: d };
    }
    return { srv, req };
}

const SRC = `await page.goto('http://x/login');
await page.getByLabel('Mã đơn vị tính').fill('REC-C');
await page.getByLabel('Tên đơn vị tính').fill('REC-C-NAME');
await page.getByRole('button', { name: 'Lưu' }).click();
await expect(page.getByText('Đơn vị tính được tạo thành công.')).toBeVisible();`;

let { srv, req } = await boot();

// ===== Setup: workspace + recording + Library action + bind + assertion =====
const ws = await req("POST", "/api/automation-v3/workspaces", { source: "NEW", module: "Đơn vị tính", approvedTestCases: APPROVED });
const wid = ws.body.workspaceId;
assert.ok(wid, "workspace tạo OK");
const start = await req("POST", "/api/codegen/start", { url: "about:blank", browser: "chrome", mode: "FULL_FLOW" });
const recId = start.body?.data?.recordingId ?? start.body?.recordingId;
await req("POST", `/api/codegen/recordings/${recId}/script`, { script: SRC });
const lib = await req("POST", "/api/codegen/library", { recordingId: recId, label: "Thêm đơn vị tính", kind: "ACTION", startStep: 1, endStep: 3 });
const libId = lib.body.data.blockId;
assert.ok(String(libId).startsWith("LIB-"), "LIB block tạo OK");
await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/select`);
await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/library/blocks`, { blockId: libId });
await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/assertions`, {
    type: "TEXT_VISIBLE", target: "Đơn vị tính được tạo thành công.", locator: "page.getByText('Đơn vị tính được tạo thành công.')",
    expected: "Đơn vị tính được tạo thành công.", matcher: "toBeVisible", source: "TESTER_INPUT", status: "TESTER_CONFIRMED"
});

// ===== CASE A — DTO trả testData approved =====
const wsGet = await req("GET", `/api/automation-v3/workspaces/${wid}`);
const item = wsGet.body.items.find(x => x.testCaseId === "TC001");
assert.ok(item.testData?.fields?.["Mã đơn vị tính"]?.value === "DV01", "A: DTO trả approved testData (Mã = DV01)");
assert.ok(item.testData.fields["Tên đơn vị tính"].value === "Kilogram", "A: DTO trả approved (Tên = Kilogram)");

// ===== CASE C/D — tester edit B → UI B + confirmed persist; approved vẫn A =====
const edited = { "Mã đơn vị tính": "DV02", "Tên đơn vị tính": "Gram" };
const patched = await req("PATCH", `/api/automation-v3/workspaces/${wid}/testcases/TC001/test-data`, { testData: edited });
assert.equal(patched.status, 200, "C: PATCH test-data 200");
assert.deepEqual(patched.body.confirmedTestData, edited, "C: DTO trả confirmedTestData = edited");
const wsGet2 = await req("GET", `/api/automation-v3/workspaces/${wid}`);
const item2 = wsGet2.body.items.find(x => x.testCaseId === "TC001");
assert.deepEqual(item2.confirmedTestData, edited, "C: UI thấy B (confirmed)");
assert.equal(item2.testData.fields["Mã đơn vị tính"].value, "DV01", "D: approved testcase vẫn A (DV01) — không ghi ngược");

// ===== CASE F — generate với edited B → spec dùng B (thắng approved A + recorded C) =====
const gen1 = await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/generate`, { confirmedTestData: edited });
assert.equal(gen1.status, 200, "F: generate 200");
const spec1 = gen1.body?.code ?? "";
assert.ok(spec1.includes("const testData = {"), "F: spec có const testData");
assert.ok(spec1.includes('"Mã đơn vị tính": "DV02"'), "F: testData chứa DV02 (edited B)");
assert.ok(spec1.includes('fill(testData["Mã đơn vị tính"])'), "F: input dùng testData[...] (không hardcode recorded REC-C)");
assert.ok(!spec1.includes("REC-C"), "F: recorded value không thắng");

// ===== CASE E — restore → confirmed rỗng → generate dùng A =====
const restored = await req("PATCH", `/api/automation-v3/workspaces/${wid}/testcases/TC001/test-data`, { testData: {} });
assert.equal(restored.status, 200, "E: restore 200");
assert.deepEqual(restored.body.confirmedTestData, {}, "E: confirmed rỗng sau restore");
const gen2 = await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/generate`, { confirmedTestData: {} });
const spec2 = gen2.body?.code ?? "";
assert.ok(spec2.includes('"Mã đơn vị tính": "DV01"'), "G: không edit → generate dùng A (DV01) thắng recorded C");
assert.ok(!spec2.includes("REC-C"), "G: recorded không thắng approved");

// ===== CASE J — restart/reload: confirmedTestData persist =====
const editAgain = await req("PATCH", `/api/automation-v3/workspaces/${wid}/testcases/TC001/test-data`, { testData: { "Mã đơn vị tính": "DV99" } });
assert.equal(editAgain.status, 200, "J: edit lại OK");
await new Promise(r => srv.close(r));
({ srv, req } = await boot());
const wsGet3 = await req("GET", `/api/automation-v3/workspaces/${wid}`);
const item3 = wsGet3.body.items.find(x => x.testCaseId === "TC001");
assert.deepEqual(item3.confirmedTestData, { "Mã đơn vị tính": "DV99" }, "J: restart → confirmedTestData giữ (persist workspace)");
assert.equal(item3.testData.fields["Mã đơn vị tính"].value, "DV01", "J: approved vẫn DV01 sau restart");

// ===== CASE H — testcase không Test Data → testData null; UI báo rõ (static) =====
const itemNoData = wsGet3.body.items.find(x => x.testCaseId === "TC002");
assert.equal(itemNoData.testData, null, "H: TC002 testData null");
assert.equal(itemNoData.confirmedTestData, null, "H: TC002 confirmed null (không invent)");
const drawerSource = fs.readFileSync(path.join(testDir, "..", "web-ui", "src", "components", "automationV3", "V3ReviewDrawer.jsx"), "utf8");
const drawerClean = drawerSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
assert.ok(drawerClean.includes("Testcase chưa có dữ liệu kiểm thử."), "H: UI có message 'Testcase chưa có dữ liệu kiểm thử.'");

// ===== CASE I — sensitive: UI dùng type=password + isSensitiveField (không lộ value) =====
assert.ok(drawerClean.includes('isSensitiveField(k) ? "password" : "text"'), "I: input sensitive dùng type=password");
assert.ok(drawerClean.includes("Khôi phục dữ liệu testcase"), "I: có nút Khôi phục dữ liệu testcase");
assert.ok(drawerClean.includes("persistTd") && drawerClean.includes("saveTestData(workspaceId, testCase.testCaseId"), "I: edit persist qua API (không sửa approved)");

srv.close();
fs.rmSync(tempRoot, { recursive: true, force: true });

console.log("Automation V3 Test Data Fidelity (P0-A) test: PASS");
