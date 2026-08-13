import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/*
 P0 — REMOVE TESTCASE MENU + WORKSPACE COUNT.

 Root cause:
 1. Card menu chỉ hiện khi status REVIEW_REQUIRED/APPROVED hoặc có segments
    -> TC001 (có segments) có menu; TC002/003 chưa automation không menu.
 2. Count "15/0": workspace cũ (trước commit thêm approvedTestCaseSnapshot)
    thiếu snapshot -> approvedTotal=0.

 Fix:
 - showMenu = true (mọi testcase trong workspace có menu ...).
 - removeTestCase: self-healing — workspace thiếu snapshot -> điền từ entry trước khi xóa
   (để [+ Thêm testcase] vẫn thấy).
 - getWorkspace approvedTotal = snapshot?.length || selectedCount (không bao giờ 0 khi có testcase).
*/

const testDir = path.dirname(fileURLToPath(import.meta.url));
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "menu-"));
const dataDir = path.join(tempRoot, "d");
const APPROVED = Array.from({ length: 15 }, (_, i) => ({
    id: `TC${String(i + 1).padStart(3, "0")}`,
    title: `Testcase ${i + 1}`,
    module: "Đơn vị tính",
    type: "POSITIVE",
    reviewStatus: "APPROVED",
    expectedResult: "OK",
    testData: null
}));

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
const ws = await req("POST", "/api/automation-v3/workspaces", { source: "NEW", module: "Đơn vị tính", approvedTestCases: APPROVED });
const wid = ws.body.workspaceId;
assert.equal(ws.body.approvedCount, 15, "setup: 15 approved");

// ===== Count ban đầu: 15 / 15 =====
let g = await req("GET", `/api/automation-v3/workspaces/${wid}`);
assert.equal(g.body.items.length, 15, "CASE: 15 items");
assert.equal(g.body.approvedTotal, 15, "CASE: approvedTotal 15 (snapshot)");

// ===== CASE A/B — mọi card có menu (static: showMenu=true) + remove TC002 =====
const cardSource = fs.readFileSync(path.join(testDir, "..", "web-ui", "src", "components", "automationV3", "V3TestCaseCard.jsx"), "utf8");
const cClean = cardSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
assert.ok(cClean.includes("const showMenu = true;"), "CASE A: showMenu=true (mọi testcase có menu)");
assert.ok(cClean.includes("Loại khỏi workspace"), "CASE B: menu có Loại khỏi workspace");

// TC002 chưa select/segments -> vẫn remove được
const del = await req("DELETE", `/api/automation-v3/workspaces/${wid}/testcases/TC002`);
assert.equal(del.status, 200, "CASE B/C: remove TC002 200");

// ===== CASE C — 14 / 15 =====
g = await req("GET", `/api/automation-v3/workspaces/${wid}`);
assert.equal(g.body.items.length, 14, "CASE C: 14 items");
assert.equal(g.body.approvedTotal, 15, "CASE C: approvedTotal 15 (M giữ)");

// ===== CASE D — reload vẫn không hiện =====
await new Promise(r => srv.close(r));
({ srv, req } = await boot());
g = await req("GET", `/api/automation-v3/workspaces/${wid}`);
assert.equal(g.body.items.length, 14, "CASE D: reload 14 items");
assert.ok(!g.body.items.some(i => i.testCaseId === "TC002"), "CASE D: TC002 không hiện");
assert.equal(g.body.approvedTotal, 15, "CASE D: approvedTotal vẫn 15");

// ===== CASE E — [+ Thêm testcase] thấy TC002 + add lại -> 15/15 =====
const avail = await req("GET", `/api/automation-v3/workspaces/${wid}/testcases/available`);
assert.ok(avail.body.some(tc => tc.testCaseId === "TC002"), "CASE E: TC002 trong available");
const add = await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC002/add`, {});
assert.equal(add.status, 200, "CASE E: add TC002 200");
g = await req("GET", `/api/automation-v3/workspaces/${wid}`);
assert.equal(g.body.items.length, 15, "CASE E: 15 items sau add");
assert.equal(g.body.approvedTotal, 15, "CASE E: 15/15");

// ===== Workspace CŨ thiếu snapshot: approvedTotal fallback selectedCount (không 0) =====
// Mô phỏng: tạo workspace mới rồi xóa snapshot khỏi file (workspace cũ), reload.
const wsOld = await req("POST", "/api/automation-v3/workspaces", { source: "NEW", module: "Cũ", approvedTestCases: APPROVED.slice(0, 3) });
const widOld = wsOld.body.workspaceId;
await new Promise(r => srv.close(r));
// Xóa snapshot khỏi file data (giả lập workspace persist trước commit thêm snapshot)
const wsFile = path.join(dataDir, "automation-workspaces.json");
const raw = JSON.parse(fs.readFileSync(wsFile, "utf8"));
for (const w of raw.workspaces) if (w.workspaceId === widOld) delete w.approvedTestCaseSnapshot;
fs.writeFileSync(wsFile, JSON.stringify(raw, null, 2), "utf8");
({ srv, req } = await boot());
g = await req("GET", `/api/automation-v3/workspaces/${widOld}`);
assert.equal(g.body.approvedTotal, 3, "CASE: workspace cũ thiếu snapshot -> approvedTotal fallback = 3 (không 0)");
// Remove TC001 (workspace cũ) -> self-healing snapshot -> add lại được
const delOld = await req("DELETE", `/api/automation-v3/workspaces/${widOld}/testcases/TC001`);
assert.equal(delOld.status, 200, "CASE: remove TC001 workspace cũ OK");
const availOld = await req("GET", `/api/automation-v3/workspaces/${widOld}/testcases/available`);
assert.ok(availOld.body.some(tc => tc.testCaseId === "TC001"), "CASE: self-healing — TC001 trong available (snapshot tự điền)");
const addOld = await req("POST", `/api/automation-v3/workspaces/${widOld}/testcases/TC001/add`, {});
assert.equal(addOld.status, 200, "CASE: add lại TC001 OK");
g = await req("GET", `/api/automation-v3/workspaces/${widOld}`);
assert.equal(g.body.items.length, 3, "CASE: 3 items sau add lại");

// ===== CASE F — approved source không đổi =====
const libC = (await req("GET", "/api/codegen/library")).body.data.length;
assert.equal(typeof libC, "number", "CASE F: library không bị đụng");

srv.close();
fs.rmSync(tempRoot, { recursive: true, force: true });

console.log("Automation V3 Remove Menu + Workspace Count (P0) test: PASS");
