import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/*
 P0-B — AUTOMATION LIBRARY PICKER (GROUP-FIRST) + ASSERTION EVIDENCE FLOW.

 1. Picker: chọn Chức năng trước → render action trong group; multi-select + repeated giữ;
    KHÔNG render flat toàn bộ Library; không Library thứ hai.
 2. Bỏ "Tạo thao tác mới từ bản ghi" (không nhúng CodeGen) → link "Mở CodeGen".
 3. Assertion candidates CHỈ từ recordedAssertions của SELECTED actions (binding);
    hiển thị nguồn Action (actionLabel); refresh khi selected actions đổi.
 4/5. Không assertion → "Chưa có điều kiện xác nhận phù hợp." + nút bổ sung (có sẵn).
 6. Generate vẫn disabled khi chưa có TESTER_CONFIRMED.
*/

const testDir = path.dirname(fileURLToPath(import.meta.url));
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "p0b-"));
const dataDir = path.join(tempRoot, "d");

const APPROVED = [
    { id: "TC001", title: "Thêm mới đơn vị tính", module: "Đơn vị tính", type: "POSITIVE", reviewStatus: "APPROVED", expectedResult: "Thành công", testData: null },
    { id: "TC002", title: "Tìm kiếm", module: "Đơn vị tính", type: "POSITIVE", reviewStatus: "APPROVED", expectedResult: "Thấy", testData: null }
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

// ===== Setup: recording có assertion → 3 Library action (2 group + 1 null) =====
const start = await req("POST", "/api/codegen/start", { url: "about:blank", browser: "chrome", mode: "FULL_FLOW" });
const recId = start.body?.data?.recordingId ?? start.body?.recordingId;
const SRC = `await page.goto('http://x/login');
await page.getByRole('button', { name: 'Đăng nhập' }).click();
await page.getByRole('button', { name: 'Mở chức năng' }).click();
await page.getByRole('button', { name: 'Thêm' }).click();
await expect(page.getByText('Thêm thành công')).toBeVisible();`;
await req("POST", `/api/codegen/recordings/${recId}/script`, { script: SRC });
const detail = await req("GET", `/api/codegen/recordings/${recId}`);
const steps = (detail.body?.data ?? detail.body).steps;
// Login 1-2 (không assertion), Mở chức năng 3 (không), Thêm 4 + expect trailing
const libLogin = await req("POST", "/api/codegen/library", { recordingId: recId, label: "Đăng nhập", startStep: 1, endStep: 2, groupName: "Đăng nhập" });
const libAdd = await req("POST", "/api/codegen/library", { recordingId: recId, label: "Thêm đơn vị tính", startStep: 4, endStep: 4, groupName: "Đơn vị tính" });
assert.equal(libAdd.body.data.recordedAssertionCount, 1, "setup: block Thêm có 1 recorded assertion");
const ws = await req("POST", "/api/automation-v3/workspaces", { source: "NEW", module: "Đơn vị tính", approvedTestCases: APPROVED });
const wid = ws.body.workspaceId;
await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/select`);
await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/library/blocks`, { blockId: libLogin.body.data.blockId });
await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/library/blocks`, { blockId: libAdd.body.data.blockId });

// ===== 3 — candidates CHỈ từ selected actions, có actionLabel =====
const suggest = await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/assertions/suggest`, {});
const cands = suggest.body.recordedCandidates;
assert.equal(cands.length, 1, "3: chỉ 1 candidate (từ block Thêm đã bind — không lấy toàn bộ Library)");
assert.equal(cands[0].actionLabel, "Thêm đơn vị tính", "3: candidate hiển thị nguồn ACTION (label)");
assert.equal(cands[0].blockId, libAdd.body.data.blockId, "3: candidate thuộc đúng selected action");
// 4 — có candidate → tester xác nhận (không tự confirm)
const confirm = await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC001/assertions`, {
    type: "TEXT_VISIBLE", target: "Thêm thành công", locator: "page.getByText('Thêm thành công')",
    expected: "Thêm thành công", matcher: "toBeVisible", source: "RECORDED", status: "TESTER_CONFIRMED"
});
assert.equal(confirm.status, 200, "4: tester xác nhận candidate");
const wsGet = await req("GET", `/api/automation-v3/workspaces/${wid}`);
const item = wsGet.body.items.find(x => x.testCaseId === "TC001");
assert.equal(item.assertionStatus.confirmed, 1, "4: 1 assertion TESTER_CONFIRMED");

// ===== 5 — testcase chưa bind action có assertion → candidates rỗng + message =====
await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC002/select`);
await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC002/library/blocks`, { blockId: libLogin.body.data.blockId }); // Login không assertion
const sug2 = await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC002/assertions/suggest`, {});
assert.equal(sug2.body.recordedCandidates.length, 0, "5: không assertion trong selected action → rỗng");

// ===== 6 — Generate disabled khi chưa confirm (gate giữ) =====
const gen = await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC002/generate`, {});
assert.equal(gen.status, 409, "6: generate chặn khi chưa có TESTER_CONFIRMED");
assert.equal(gen.body.errorCode, "ASSERTION_CONFIRMATION_REQUIRED", "6: gate ASSERTION_CONFIRMATION_REQUIRED giữ");
assert.ok(String(gen.body.message).includes("Chưa có điều kiện xác nhận phù hợp"), "6: message giữ nguyên");

srv.close();
fs.rmSync(tempRoot, { recursive: true, force: true });

// ===== Static — picker group-first + bỏ paste =====
const panelSource = fs.readFileSync(path.join(testDir, "..", "web-ui", "src", "components", "automationV3", "V3ActionSetupPanel.jsx"), "utf8");
const clean = panelSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
assert.ok(!clean.includes("V3RecordingPreparationPanel"), "2: Automation KHÔNG nhúng CodeGen panel");
assert.ok(!clean.includes("Tạo thao tác mới từ bản ghi"), "2: bỏ nút 'Tạo thao tác mới từ bản ghi'");
assert.ok(clean.includes('to="/codegen"') && clean.includes("Mở CodeGen"), "2: link 'Mở CodeGen'");
assert.ok(clean.includes("pickerGroup") && clean.includes("groupLibraryActions(library)"), "1: picker group-first (chọn Chức năng trước)");
assert.ok(clean.includes("← Tất cả chức năng"), "1: có quay lại danh sách chức năng");
assert.ok(clean.includes("toggleLib") && clean.includes("selectedLib"), "1: multi-select giữ");
// Không flat render toàn bộ Library trong picker màn đầu (chỉ render group).
const groupScreen = clean.slice(clean.indexOf("pickerGroup === null"), clean.indexOf("pickerGroup === null") + 600);
assert.ok(!groupScreen.includes("b.stepCount"), "1: màn chọn group KHÔNG render action flat (chỉ render khi vào group)");

// ===== Static — assertion evidence UI =====
const expSource = fs.readFileSync(path.join(testDir, "..", "web-ui", "src", "components", "automationV3", "V3ExpectedResultTab.jsx"), "utf8");
const expClean = expSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
assert.ok(expClean.includes("c.actionLabel"), "3: UI hiển thị nguồn Action (actionLabel)");
assert.ok(expClean.includes("Chưa có điều kiện kiểm tra phù hợp."), "5: message không assertion (P0-D nhãn mới)");
assert.ok(expClean.includes("+ Thêm điều kiện kiểm tra"), "5: có [+ Thêm điều kiện kiểm tra] (P0-D)");
assert.ok(expClean.includes("segmentSummary?.total"), "3: candidates refresh khi selected actions đổi (dep segmentSummary.total)");

console.log("Automation V3 P0-B Library Picker + Assertion Evidence test: PASS");
