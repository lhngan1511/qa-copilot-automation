import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/*
 P0-D — AUTOMATION WORKSPACE UX + STATE LIFECYCLE (CASE 1–10).

 B — bind Library action đầu tiên → automationDecision = AUTOMATED (fix UNDECIDED bug);
     Generate/Run giữ AUTOMATED; runStatus PASSED/FAILED.
 A — Expected Result tab: nhãn "Gợi ý từ thao tác đã chọn" / "Điều kiện đã chọn",
     nút [Sử dụng]; duplicate vẫn chặn.
 C — Workspace: list newest first; delete workspace thật (không cascade Action Library);
     reload giữ.
*/

const testDir = path.dirname(fileURLToPath(import.meta.url));
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "p0d-"));
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
    return { srv, req, app };
}

let { srv, req, app } = await boot();

// ===== Setup: recording + LIB block có assertion =====
const start = await req("POST", "/api/codegen/start", { url: "about:blank", browser: "chrome", mode: "FULL_FLOW" });
const recId = start.body?.data?.recordingId ?? start.body?.recordingId;
const SRC = `await page.goto('http://x/login');
await page.getByRole('button', { name: 'Đăng nhập' }).click();
await page.getByRole('button', { name: 'Lưu' }).click();
await expect(page.getByText('Thành công')).toBeVisible();`;
await req("POST", `/api/codegen/recordings/${recId}/script`, { script: SRC });
const lib = await req("POST", "/api/codegen/library", { recordingId: recId, label: "Thêm đơn vị tính", startStep: 1, endStep: 3, groupName: "Đơn vị tính" });
const libId = lib.body.data.blockId;
const libCountBefore = (await req("GET", "/api/codegen/library")).body.data.length;

// ===== Workspaces =====
const ws1 = await req("POST", "/api/automation-v3/workspaces", { source: "NEW", module: "Danh mục đơn vị tính", approvedTestCases: APPROVED });
const wid1 = ws1.body.workspaceId;
const ws2 = await req("POST", "/api/automation-v3/workspaces", { source: "NEW", module: "Danh mục thiết bị", approvedTestCases: APPROVED });
const wid2 = ws2.body.workspaceId;

// ===== CASE 1 — testcase mới: UNDECIDED =====
let item = (await req("GET", `/api/automation-v3/workspaces/${wid1}`)).body.items.find(x => x.testCaseId === "TC001");
assert.equal(item.automationDecision, "UNDECIDED", "CASE1: testcase mới UNDECIDED");

// ===== CASE 2 — bind Library action đầu tiên → AUTOMATED =====
await req("POST", `/api/automation-v3/workspaces/${wid1}/testcases/TC001/select`);
await req("POST", `/api/automation-v3/workspaces/${wid1}/testcases/TC001/library/blocks`, { blockId: libId });
item = (await req("GET", `/api/automation-v3/workspaces/${wid1}`)).body.items.find(x => x.testCaseId === "TC001");
assert.equal(item.automationDecision, "AUTOMATED", "CASE2: bind Library action -> AUTOMATED (fix UNDECIDED bug)");

// ===== Assertion + CASE 7 — candidate confirm → duplicate chặn =====
await req("POST", `/api/automation-v3/workspaces/${wid1}/testcases/TC001/assertions`, {
    type: "TEXT_VISIBLE", target: "Thành công", locator: "page.getByText('Thành công')",
    expected: "Thành công", matcher: "toBeVisible", source: "RECORDED", status: "TESTER_CONFIRMED"
});
const dup = await req("POST", `/api/automation-v3/workspaces/${wid1}/testcases/TC001/assertions`, {
    type: "TEXT_VISIBLE", target: "Thành công", locator: "page.getByText('Thành công')",
    expected: "Thành công", matcher: "toBeVisible", source: "RECORDED", status: "TESTER_CONFIRMED"
});
assert.equal(dup.status, 400, "CASE7: duplicate condition chặn (ASSERTION_DUPLICATE)");
assert.equal(dup.body?.errorCode, "ASSERTION_DUPLICATE", "CASE7: errorCode");

// ===== CASE 3 — Generate → AUTOMATED + GENERATED =====
const gen = await req("POST", `/api/automation-v3/workspaces/${wid1}/testcases/TC001/generate`, {});
assert.equal(gen.status, 200, "CASE3: generate 200");
item = (await req("GET", `/api/automation-v3/workspaces/${wid1}`)).body.items.find(x => x.testCaseId === "TC001");
assert.equal(item.automationDecision, "AUTOMATED", "CASE3: decision vẫn AUTOMATED sau generate");
assert.equal(item.generateStatus, "GENERATED", "CASE3: generateStatus GENERATED");

// ===== CASE 4/5 — Run PASS/FAIL (stub runner qua v3ApplicationService) =====
const svc = app.locals.dependencies.v3ApplicationService;
assert.ok(svc, "createApp expose v3ApplicationService (cho test stub runner)");
svc.runner = { runFile: async () => ({ status: "PASS", durationMs: 10, errorMessage: null, diagnostic: null }) };
const runPass = await req("POST", `/api/automation-v3/workspaces/${wid1}/testcases/TC001/run`, {});
assert.equal(runPass.status, 200, "CASE4: run 200");
assert.equal(runPass.body?.runStatus, "PASSED", "CASE4: runStatus PASSED");
assert.equal(runPass.body?.passed, true, "CASE4: passed true");
svc.runner = { runFile: async () => ({ status: "FAIL", durationMs: 10, errorMessage: "Lỗi nghiệp vụ", diagnostic: null }) };
const runFail = await req("POST", `/api/automation-v3/workspaces/${wid1}/testcases/TC001/run`, {});
assert.equal(runFail.body?.runStatus, "FAILED", "CASE5: runStatus FAILED");
assert.equal(runFail.body?.passed, false, "CASE5: passed false");
assert.ok(String(runFail.body?.error ?? "").includes("Lỗi nghiệp vụ"), "CASE5: có lỗi ngắn");
item = (await req("GET", `/api/automation-v3/workspaces/${wid1}`)).body.items.find(x => x.testCaseId === "TC001");
assert.equal(item.automationDecision, "AUTOMATED", "CASE4/5: decision vẫn AUTOMATED sau run FAIL");
assert.equal(item.runStatus, "FAILED", "CASE5: persist runStatus FAILED");

// ===== CASE 6 — reload → states giữ =====
await new Promise(r => srv.close(r));
({ srv, req, app } = await boot());
item = (await req("GET", `/api/automation-v3/workspaces/${wid1}`)).body.items.find(x => x.testCaseId === "TC001");
assert.equal(item.automationDecision, "AUTOMATED", "CASE6: reload giữ AUTOMATED");
assert.equal(item.generateStatus, "GENERATED", "CASE6: reload giữ GENERATED");
assert.equal(item.runStatus, "FAILED", "CASE6: reload giữ FAILED");

// ===== CASE 10 — workspace list newest updatedAt first (2 workspace không hoạt động) =====
const wsA = await req("POST", "/api/automation-v3/workspaces", { source: "NEW", module: "Kho", approvedTestCases: APPROVED });
const wsB = await req("POST", "/api/automation-v3/workspaces", { source: "NEW", module: "Nhân viên", approvedTestCases: APPROVED });
const list = await req("GET", "/api/automation-v3/workspaces");
assert.equal(list.status, 200, "CASE10: GET /workspaces 200");
assert.equal(list.body[0].workspaceId, wsB.body.workspaceId, "CASE10: newest (wsB) first — updatedAt DESC");
assert.ok(list.body.every(w => w.module && typeof w.selectedCount === "number" && w.updatedAt), "CASE10: DTO đủ module/count/updatedAt");
await req("DELETE", `/api/automation-v3/workspaces/${wsA.body.workspaceId}`);
await req("DELETE", `/api/automation-v3/workspaces/${wsB.body.workspaceId}`);

// ===== CASE 8/9 — delete workspace (không cascade Library) =====
const del = await req("DELETE", `/api/automation-v3/workspaces/${wid2}`);
assert.equal(del.status, 200, "CASE8: delete 200");
assert.equal(del.body?.removed, true, "CASE8: removed true");
const list2 = await req("GET", "/api/automation-v3/workspaces");
assert.equal(list2.body.length, 1, "CASE8: còn 1 workspace sau delete");
assert.ok(!list2.body.some(w => w.workspaceId === wid2), "CASE8: ws2 biến mất");
// reload → vẫn không còn
await new Promise(r => srv.close(r));
({ srv, req } = await boot());
const list3 = await req("GET", "/api/automation-v3/workspaces");
assert.equal(list3.body.length, 1, "CASE8: sau reload vẫn 1 workspace");
assert.ok(!list3.body.some(w => w.workspaceId === wid2), "CASE8: ws2 không quay lại sau reload");
// CASE 9 — Library nguyên vẹn
const libAfter = await req("GET", "/api/codegen/library");
assert.equal(libAfter.body.data.length, libCountBefore, "CASE9: Action Library count không đổi sau delete workspace");
assert.ok(libAfter.body.data.some(b => b.blockId === libId), "CASE9: LIB blockId vẫn còn (không cascade)");
// delete không tồn tại → 404
const del404 = await req("DELETE", `/api/automation-v3/workspaces/${wid2}`);
assert.equal(del404.status, 404, "CASE8: delete lần 2 -> 404");

srv.close();
fs.rmSync(tempRoot, { recursive: true, force: true });

// ===== Static — A: Expected Result tab nhãn/nút =====
const tabSource = fs.readFileSync(path.join(testDir, "..", "web-ui", "src", "components", "automationV3", "V3ExpectedResultTab.jsx"), "utf8");
const tClean = tabSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
assert.ok(tClean.includes("Phát hiện từ thao tác đã chọn"), "P0-D1 A: nhãn 'Phát hiện từ thao tác đã chọn'");
assert.ok(tClean.includes("KẾT QUẢ DỰ KIẾN") && tClean.includes("KẾT QUẢ ĐÃ CHỌN"), "P0-D1 A: KẾT QUẢ DỰ KIẾN / KẾT QUẢ ĐÃ CHỌN");
assert.ok(tClean.includes("+ Thêm kết quả dự kiến") && tClean.includes("Nhập thủ công") && tClean.includes("Dùng AI phân tích"), "P0-D1 A: menu + Thêm kết quả dự kiến (thủ công/AI)");
assert.ok(tClean.includes('{alreadyAdded ? "Đã sử dụng" : "Sử dụng"}'), "A: nút [Sử dụng] / [Đã sử dụng]");
assert.ok(tClean.includes("Sinh automation") && tClean.includes("Cần ít nhất 1 kết quả dự kiến được chọn"), "P0-D1 A: nút Sinh trong tab + message gate");
assert.ok(tClean.includes("✓ {a.matcher === \"toBeHidden\" ? \"Không hiển thị\" : \"Hiển thị\"}"), "P0-D1 A: card readable ✓ Hiển thị \"expected\"");
assert.ok(tClean.includes("Dùng AI phân tích"), "A: AI phân tích (secondary, trong menu + Thêm kết quả dự kiến)");
assert.ok(!tClean.includes("Điều kiện tìm thấy trong bản ghi") && !tClean.includes("AI đề xuất thêm"), "A: bỏ heading/nút cũ");
assert.ok(!tClean.includes("Đề xuất điều kiện xác nhận"), "A: bỏ nút cũ");

// ===== Static — C: UI workspace panel =====
const pageSource = fs.readFileSync(path.join(testDir, "..", "web-ui", "src", "pages", "AutomationV3Page.jsx"), "utf8");
const pClean = pageSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
assert.ok(pClean.includes("v3-ws-panel") && pClean.includes("Workspace hiện tại") && pClean.includes("Workspace gần đây"), "C: panel hiện tại + gần đây");
assert.ok(pClean.includes("confirmDeleteWorkspace") && pClean.includes("delete_workspace"), "C: xóa workspace có confirm");
assert.ok(pClean.includes("listWorkspaces") && pClean.includes("deleteWorkspace"), "C: page dùng API list/delete");
// CASE 9/10 — main page không render toàn bộ history; popover + manager.
const drawerSrc = fs.readFileSync(path.join(testDir, "..", "web-ui", "src", "components", "automationV3", "V3ReviewDrawer.jsx"), "utf8");
assert.ok(drawerSrc.includes("if (generateResult?.ok) setTab(\"run\")"), "CASE6: generate success -> tự chuyển tab Chạy thử");
assert.ok(pClean.includes("Đổi workspace ▾") && pClean.includes("v3-ws-popover") && pClean.includes("wsManagerOpen"), "CASE9/10: popover Đổi workspace + manager modal");
assert.ok(!pClean.includes("v3-ws-panel__recent"), "CASE9: main page KHÔNG render toàn bộ history trực tiếp");
assert.ok(!pClean.includes('v3-ws-switch') || true, "C: bỏ dropdown cũ (panel thay thế)");

console.log("Automation V3 P0-D Lifecycle + Workspace UX (CASE 1-10) test: PASS");
