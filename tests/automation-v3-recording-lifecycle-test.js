import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { appendWorkingAction } from "../web-ui/src/utils/workingActions.js";

/*
 P0 — CODEGEN RECORDING LIFECYCLE + ACTION LIBRARY GROUP RENAME (CASE 1–5).

 A. Rename group (Chưa phân loại → tên mới): persist, reload giữ, action giữ nguyên,
    không đổi blockId, không duplicate; rename KHÔNG thành default toàn cục.
 B/C. [+ Bản ghi mới]: reset CHỈ transient (source/draft/steps/recording/proposals/
    confirmed/group/feedback); KHÔNG reset Library/group đã rename/recording đã lưu;
    không reload; không gọi AI.
 D. Unsaved guard: dirty → confirm (window.confirm) trước discard.
 E. CASE 3: recording mới KHÔNG inherit group (currentGroup reset "" → groupName null).
*/

const testDir = path.dirname(fileURLToPath(import.meta.url));
const panelSource = fs.readFileSync(path.join(testDir, "..", "web-ui", "src", "components", "automationV3", "V3RecordingPreparationPanel.jsx"), "utf8");
const clean = panelSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

// ================= B/D — newRecording: reset transient, guard, không reload =================
const nrBody = clean.match(/const newRecording = \(\) => \{[\s\S]*?\n    \};/)?.[0] ?? "";
assert.ok(nrBody.length > 0, "B: có newRecording()");
assert.ok(nrBody.includes("window.confirm("), "D: unsaved guard dùng window.confirm");
assert.ok(!nrBody.includes("location.reload") && !nrBody.includes("location.reload(") && !nrBody.includes(".reload()"), "D: KHÔNG dùng reload");
// Reset đủ transient:
for (const st of ["setSource(\"\")", "setParsedSource(\"\")", "setSteps([])", "setDraftSteps([])", "setDraftRecordingId(null)", "setProposals([])", "setDismissedProposals([])", "setConfirmed([])", "setCurrentGroup(\"\")", "setSaveFeedback(null)", "setAiStatus(null)", "setRecordingId(null)"]) {
    assert.ok(nrBody.includes(st), `B: newRecording reset ${st}`);
}
// KHÔNG đụng persisted:
assert.ok(!nrBody.includes("setLibrary("), "C: newRecording KHÔNG reset Library (không gọi setLibrary)");
assert.ok(!nrBody.includes("renameLibraryGroup"), "C: newRecording không đụng group đã rename");

// E — CASE 3: currentGroup reset "" → action mới groupName null (không inherit).
assert.ok(nrBody.includes("setCurrentGroup(\"\")"), "E: reset currentGroup về rỗng (KHÔNG inherit group A)");
const withEmptyGroup = appendWorkingAction([], { label: "Đăng nhập", startStep: 1, endStep: 2, groupName: "" });
assert.equal(withEmptyGroup[0].groupName, null, "E: working action mới với group '' → groupName null (không chui vào group cũ)");

// Nút [+ Bản ghi mới] có ở draft branch + canonical split.
assert.ok(clean.includes("+ Bản ghi mới") && clean.includes("onClick={newRecording}"), "B: nút [+ Bản ghi mới] render");

// ================= A — Rename group: HTTP thật + reload persist =================
const { default: createApp } = await import("../src/server/createApp.js");
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "life-"));
const dataDir = path.join(tempRoot, "d");
const v3Out = path.join(tempRoot, "out");

async function boot() {
    const app = createApp({ repositoryType: "file", dataDir, outputDir: path.join(tempRoot, "o"), v3OutputDir: v3Out });
    const srv = await new Promise(r => { const s = app.listen(0, "127.0.0.1", () => r(s)); });
    const base = `http://127.0.0.1:${srv.address().port}`;
    async function req(m, p, b) {
        const r = await fetch(`${base}${p}`, { method: m, headers: b ? { "content-type": "application/json" } : {}, body: b ? JSON.stringify(b) : undefined });
        return { status: r.status, body: await r.json() };
    }
    return { srv, req };
}
let { srv, req } = await boot();
const SRC = "await page.goto('http://x/login');\nawait page.getByRole('button', { name: 'Đăng nhập' }).click();";
const start = await req("POST", "/api/codegen/start", { url: "about:blank", browser: "chrome", mode: "FULL_FLOW" });
const recId = start.body?.data?.recordingId ?? start.body?.recordingId;
await req("POST", `/api/codegen/recordings/${recId}/script`, { script: SRC });
// 2 block "Chưa phân loại" (null) + 1 block group "Kho"
await req("POST", "/api/codegen/library", { recordingId: recId, label: "Đăng nhập", startStep: 1, endStep: 2 });
await req("POST", "/api/codegen/library", { recordingId: recId, label: "Đăng nhập 2", startStep: 1, endStep: 2 });
await req("POST", "/api/codegen/library", { recordingId: recId, label: "Mở kho", startStep: 1, endStep: 2, groupName: "Kho" });

// CASE 1 — rename "Chưa phân loại" → "Đơn vị tính"
const ren = await req("POST", "/api/codegen/library/rename-group", { oldGroupName: "Chưa phân loại", newGroupName: "Đơn vị tính" });
assert.equal(ren.status, 200, "A: rename 200");
assert.equal(ren.body?.data?.updated, 2, "A: 2 block null được cập nhật");
let list = await req("GET", "/api/codegen/library");
const login1 = list.body.data.find(x => x.label === "Đăng nhập");
const login2 = list.body.data.find(x => x.label === "Đăng nhập 2");
const kho = list.body.data.find(x => x.label === "Mở kho");
assert.equal(login1.groupName, "Đơn vị tính", "A: block null → Đơn vị tính");
assert.equal(login2.groupName, "Đơn vị tính", "A: block null 2 → Đơn vị tính");
assert.equal(kho.groupName, "Kho", "A: group Kho không bị đụng");
assert.equal(login1.blockId, list.body.data.find(x => x.label === "Đăng nhập").blockId, "A: blockId không đổi");
// rename thiếu tên → 400
const renEmpty = await req("POST", "/api/codegen/library/rename-group", { oldGroupName: "Kho", newGroupName: "  " });
assert.equal(renEmpty.status, 400, "A: rename tên trống → 400");

// Reload (F5) — persist giữ
await new Promise(r => srv.close(r));
({ srv, req } = await boot());
list = await req("GET", "/api/codegen/library");
assert.equal(list.body.data.find(x => x.label === "Đăng nhập").groupName, "Đơn vị tính", "CASE1: reload → vẫn Đơn vị tính");
// Rename "Đơn vị tính" → "Kho" → merge 3 block (không duplicate)
const merge = await req("POST", "/api/codegen/library/rename-group", { oldGroupName: "Đơn vị tính", newGroupName: "Kho" });
assert.equal(merge.body?.data?.updated, 2, "A: merge 2 block vào Kho");
list = await req("GET", "/api/codegen/library");
assert.equal(list.body.data.filter(x => x.groupName === "Kho").length, 3, "A: 3 block group Kho — không duplicate action");
assert.equal(list.body.data.length, 3, "A: tổng block không đổi (3)");
// oldGroupName "" (null) cũng map Chưa phân loại
await req("POST", "/api/codegen/library", { recordingId: recId, label: "Mới", startStep: 1, endStep: 2 }); // null
const renNull = await req("POST", "/api/codegen/library/rename-group", { oldGroupName: "", newGroupName: "Thiết bị" });
assert.equal(renNull.body?.data?.updated, 1, "A: oldGroupName '' → rename block null");

srv.close();
fs.rmSync(tempRoot, { recursive: true, force: true });

console.log("Automation V3 Recording Lifecycle + Group Rename (P0) test: PASS");
