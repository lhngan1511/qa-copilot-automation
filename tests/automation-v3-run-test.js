import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/*
 P0-C — AUTOMATION RESULT + CHECK CONDITION + TEST RUN.

 - Duplicate condition: saveDraftAssertion chặn trùng matcher|locator|expected
   (KHÔNG dedupe theo label); UI candidate "Đã thêm"/disabled.
 - Generate result: nằm trong testcase đang mở (drawer) — code + fileName (không banner toàn workspace).
 - Run: dùng ĐÚNG generated artifact (không generate ngầm); stale (testcase/action/data/assertion
   đổi sau Generate) → chặn yêu cầu Generate lại; PASS/FAIL + lỗi ngắn.
 - Terminology: "Điều kiện kiểm tra" thay "Điều kiện xác nhận".
*/

const testDir = path.dirname(fileURLToPath(import.meta.url));
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "p0c-"));
const dataDir = path.join(tempRoot, "d");

const APPROVED = [
    { id: "TC001", title: "Thêm mới đơn vị tính", module: "Đơn vị tính", type: "POSITIVE", reviewStatus: "APPROVED", expectedResult: "Thành công", testData: { fields: { "Mã đơn vị tính": { value: "DV01" } } } }
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
    return { srv, req, app };
}

let { srv, req, app } = await boot();
const spawned = [];
// Capture the exact artifact handed to the runner.  This tests the production
// Run boundary without launching a real browser in this HTTP regression test.
app.locals.dependencies.v3ApplicationService.runner = {
    async runFile(filePath, options) {
        spawned.push({ filePath, options, code: fs.readFileSync(filePath, "utf8") });
        return { status: "PASSED", durationMs: 1 };
    }
};

// ===== Setup =====
const start = await req("POST", "/api/codegen/start", { url: "about:blank", browser: "chrome", mode: "FULL_FLOW" });
const recId = start.body?.data?.recordingId ?? start.body?.recordingId;
const SRC = `await page.goto('http://x/login');
await page.getByRole('button', { name: 'Đăng nhập' }).click();
await page.getByLabel('Mã đơn vị tính').fill('DV01');
await page.getByRole('button', { name: 'Lưu' }).click();
await expect(page.getByText('Thành công')).toBeVisible();`;
await req("POST", `/api/codegen/recordings/${recId}/script`, { script: SRC });
const lib = await req("POST", "/api/codegen/library", { recordingId: recId, label: "Thêm đơn vị tính", startStep: 1, endStep: 4, groupName: "Đơn vị tính" });
assert.equal(lib.body.data.recordedAssertionCount, 1, "setup: block có 1 recorded assertion");
const ws = await req("POST", "/api/automation-v3/workspaces", { source: "NEW", module: "Đơn vị tính", approvedTestCases: APPROVED });
const wid = ws.body.workspaceId;
await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/select`);
await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/library/blocks`, { blockId: lib.body.data.blockId });
await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/assertions`, {
    type: "TEXT_VISIBLE", target: "Thành công", locator: "page.getByText('Thành công')",
    expected: "Thành công", matcher: "toBeVisible", source: "RECORDED", status: "TESTER_CONFIRMED"
});

// ===== 2 — Duplicate condition: thêm lại cùng matcher|locator|expected → 400 =====
const dup = await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/assertions`, {
    type: "TEXT_VISIBLE", target: "Thành công", locator: "page.getByText('Thành công')",
    expected: "Thành công", matcher: "toBeVisible", source: "RECORDED", status: "TESTER_CONFIRMED"
});
assert.equal(dup.status, 400, "2: duplicate condition bị chặn");
assert.equal(dup.body?.errorCode, "ASSERTION_DUPLICATE", "2: errorCode ASSERTION_DUPLICATE");
assert.ok(String(dup.body?.message).includes("Điều kiện kiểm tra này đã được thêm."), "2: message rõ");

// ===== Run trước Generate → NOT_GENERATED =====
const runBefore = await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/run`, {});
assert.equal(runBefore.status, 409, "run trước generate chặn");
assert.equal(runBefore.body?.errorCode, "NOT_GENERATED", "run trước generate: NOT_GENERATED");

// ===== Generate → code + fileName trong response =====
const gen = await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/generate`, {});
assert.equal(gen.status, 200, "generate 200");
assert.ok(gen.body?.code?.includes("import { test, expect }"), "3: response có code (Playwright source)");
assert.ok(gen.body?.outputPath?.endsWith(".spec.js"), "3: outputPath là .spec.js");
const wsGet = await req("GET", `/api/automation-v3/workspaces/${wid}`);
const item = wsGet.body.items.find(x => x.testCaseId === "TC001");
assert.equal(item.generateStatus, "GENERATED", "3: generateStatus GENERATED");
assert.ok(item.generatedFingerprint, "3: có fingerprint");
const generatedA = fs.readFileSync(gen.body.outputPath, "utf8");
assert.ok(generatedA.includes("DV01"), "3: spec ban đầu dùng dữ liệu A");

// ===== Run sau khi stale (data đổi sau Generate) → chặn =====
await req("PATCH", `/api/automation-v3/workspaces/${wid}/testcases/TC001/test-data`, { testData: { "Mã đơn vị tính": "DV99" } });
const runStale = await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/run`, {});
assert.equal(runStale.status, 409, "6: run stale chặn");
assert.equal(runStale.body?.errorCode, "STALE_GENERATED", "6: STALE_GENERATED");
assert.ok(String(runStale.body?.message).includes("Sinh lại"), "6: message yêu cầu Generate lại");
// Generate lại → fingerprint mới → run không stale (runner có thể báo DIAGNOSTIC thiếu BASE_URL — KHÔNG phải stale)
const gen2 = await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/generate`, {});
assert.equal(gen2.status, 200, "generate lại OK");
const generatedB = fs.readFileSync(gen2.body.outputPath, "utf8");
assert.ok(generatedB.includes("DV99"), "6: regenerate phải dùng dữ liệu tester vừa sửa (B)");
assert.ok(!generatedB.includes("DV01"), "6: generated spec mới không được còn dữ liệu cũ (A)");
const runOk = await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/run`, {});
assert.notEqual(runOk.body?.errorCode, "STALE_GENERATED", "6: sau generate lại không còn stale");
assert.ok(["PASSED", "FAILED", "DIAGNOSTIC", "ERROR"].includes(runOk.body?.runStatus) || runOk.status === 200 || runOk.body?.errorCode, "6: run trả kết quả (PASSED/FAILED hoặc diagnostic rõ)");
assert.equal(spawned.length, 1, "6: chỉ script mới được đưa sang runner");
assert.ok(spawned[0].code.includes("DV99"), "6: Run nhận script chứa B");
assert.ok(!spawned[0].code.includes("DV01"), "6: Run không nhận script cũ chứa A");
assert.ok(spawned[0].options.generation.hash, "6: Run nhận generation hash để audit");
assert.equal(spawned[0].options.generation.effectiveDataBindings[0].value, "DV99", "6: Run log context chứa effective binding B");

srv.close();
fs.rmSync(tempRoot, { recursive: true, force: true });

// ===== Static — terminology + tab Chạy thử + duplicate UI =====
const dir = testDir;
const drawer = fs.readFileSync(path.join(dir, "..", "web-ui", "src", "components", "automationV3", "V3ReviewDrawer.jsx"), "utf8");
const dClean = drawer.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
assert.ok(dClean.includes("Chạy thử") && dClean.includes("onRun?.(testCase)"), "4/5: tab Chạy thử + nút [Chạy thử]");
assert.ok(dClean.includes("Xem script") && dClean.includes("Lưu file .spec.js"), "3: [Xem script] [Lưu file] trong drawer");
assert.ok(dClean.includes("Sinh lại Playwright") || dClean.includes("Sinh Playwright"), "6: yêu cầu Generate lại khi chưa/stale");
const exp = fs.readFileSync(path.join(dir, "..", "web-ui", "src", "components", "automationV3", "V3ExpectedResultTab.jsx"), "utf8");
assert.ok(!exp.includes("Điều kiện xác nhận"), "1: terminology 'Điều kiện kiểm tra' thay 'Điều kiện xác nhận'");
assert.ok(exp.includes("Điều kiện kiểm tra"), "1: có 'Điều kiện kiểm tra'");
const api = fs.readFileSync(path.join(dir, "..", "web-ui", "src", "api", "automationV3Api.js"), "utf8");
assert.ok(api.includes("runTestcase"), "5: api client có runTestcase");

console.log("Automation V3 Run + Condition Duplicate (P0-C) test: PASS");
