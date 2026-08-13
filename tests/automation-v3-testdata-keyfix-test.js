import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/*
 KEY-FIX — Test Data editor dùng key KHÔNG khớp step.target (locator accessible name)
 → giá trị tester sửa ("cai") không tới được FILL; renderer rơi xuống recorded value
 ("Bo" từ Playwright).

 Root cause: renderer FILL lookup theo step.target ('text search'); editor hiển thị
 theo key approved testcase ('Giá trị tìm kiếm') → confirmedTestData['text search']
 undefined → resolveTestValue fallback recordedCodeGenValue.

 Fix: toItem segment thêm inputs[{field: step.target, recordedValue}] → editor union
 approved + action inputs → tester sửa ĐÚNG key renderer đọc → fill dùng giá trị mới.
*/

const testDir = path.dirname(fileURLToPath(import.meta.url));
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "keyfix-"));
const dataDir = path.join(tempRoot, "d");
const APPROVED = [
    { id: "TC008", title: "Tìm kiếm đơn vị tính", module: "Đơn vị tính", type: "POSITIVE", reviewStatus: "APPROVED", expectedResult: "Tìm thấy", testData: { fields: { "Giá trị tìm kiếm": { value: "Bo", purpose: "VALID" } } } }
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

// Setup: recording có fill vào 'text search' (locator accessible name) value 'Bo' từ recording
const start = await req("POST", "/api/codegen/start", { url: "about:blank", browser: "chrome", mode: "FULL_FLOW" });
const recId = start.body?.data?.recordingId ?? start.body?.recordingId;
const SRC = `await page.goto('http://172.16.1.100:9230/danh-muc/don-vi-tinh?page=1');
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

// 1. DTO: segment.inputs chứa key CHÍNH XÁC 'text search' (step.target) + recorded 'Bộ'
const item = (await req("GET", `/api/automation-v3/workspaces/${wid}`)).body.items.find(x => x.testCaseId === "TC008");
const segInputs = item.segments.flatMap(s => s.inputs ?? []);
assert.ok(segInputs.some(i => i.field === "text search"), "1: segment.inputs chứa field 'text search' (key renderer lookup)");
assert.equal(segInputs.find(i => i.field === "text search").recordedValue, "Bộ", "1: recordedValue của FILL là 'Bộ'");

// 2. Test Data editor union: approved key 'Giá trị tìm kiếm' VÀ action input 'text search' đều hiển thị (static)
const drawerSource = fs.readFileSync(path.join(testDir, "..", "web-ui", "src", "components", "automationV3", "V3ReviewDrawer.jsx"), "utf8");
const dClean = drawerSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
assert.ok(dClean.includes("actionInputs()") && dClean.includes("seg.inputs"), "2: editor dùng actionInputs (union approved + action inputs)");
assert.ok(dClean.includes("giá trị trong bản ghi"), "2: editor hiển thị hint giá trị trong bản ghi");

// 3. Tester sửa ĐÚNG key 'text search' = 'cai' → save → generate → fill dùng 'cai' (KHÔNG 'Bộ')
const patched = await req("PATCH", `/api/automation-v3/workspaces/${wid}/testcases/TC008/test-data`, { testData: { "text search": "cai" } });
assert.equal(patched.status, 200, "3: PATCH test-data theo key 'text search' OK");
const gen = await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC008/generate`, {});
assert.equal(gen.status, 200, "3: generate 200");
const code = gen.body?.code ?? "";
assert.ok(code.includes('fill(testData["text search"])'), "3: spec fill qua testData[\"text search\"]");
assert.ok(code.includes('"text search": "cai"'), "3: const testData chứa \"text search\": \"cai\" (giá trị tester sửa đúng key)");
assert.ok(!code.includes('fill("Bộ")') && !code.includes('fill("Bo")'), "3: KHÔNG dùng recorded 'Bộ' nữa");

// 4. Không sửa 'text search' → approved key 'Giá trị tìm kiếm' không khớp target → recorded fallback (cũ) — nhưng editor hint đã cảnh báo.
const patched2 = await req("PATCH", `/api/automation-v3/workspaces/${wid}/testcases/TC008/test-data`, { testData: {} });
const gen2 = await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC008/generate`, {});
const code2 = gen2.body?.code ?? "";
assert.ok(code2.includes('fill("Bộ")'), "4: không sửa key khớp -> fallback recorded 'Bộ' (hành vi cũ, hint hiển thị)");

srv.close();
fs.rmSync(tempRoot, { recursive: true, force: true });

console.log("Automation V3 Test Data Key-Fix (step.target) test: PASS");
