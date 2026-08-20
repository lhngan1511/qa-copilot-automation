import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { groupLibraryActions, groupDisplayName, UNGROUPED_LABEL } from "../web-ui/src/utils/libraryGroups.js";
import { applyGroupToWorkingActions } from "../web-ui/src/utils/workingActions.js";

/*
 P0 — ACTION LIBRARY GROUPING V1 (CASE A–H).

 Data model: ActionLibrary block thêm `groupName: string|null` (AI đề xuất, tester xác nhận/sửa).
 Existing block không groupName → presentation "Chưa phân loại" (KHÔNG migration theo label).
 Backend: createLibraryAction nhận/persist groupName; listLibrary trả groupName.
 UI: THƯ VIỆN nhóm theo group (collapsed mặc định; mở 1 group); KHÔNG pagination phẳng.
 Không hardcode label → group và không tự persist nếu tester chưa xác nhận.
*/

const testDir = path.dirname(fileURLToPath(import.meta.url));
const panelSource = fs.readFileSync(path.join(testDir, "..", "web-ui", "src", "components", "automationV3", "V3RecordingPreparationPanel.jsx"), "utf8");
const clean = panelSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const apiSource = fs.readFileSync(path.join(testDir, "..", "web-ui", "src", "api", "codeGenApi.js"), "utf8");

// ================= Helper grouping (presentation) =================
// ---- D — 2 action "Đơn vị tính" + 3 "Kho" → 2 groups đúng count ----
const lib = [
    { blockId: "LIB-1", label: "Thêm mới", groupName: "Đơn vị tính" },
    { blockId: "LIB-2", label: "Tìm kiếm", groupName: "Đơn vị tính" },
    { blockId: "LIB-3", label: "Mở kho", groupName: "Kho" },
    { blockId: "LIB-4", label: "Nhập kho", groupName: "Kho" },
    { blockId: "LIB-5", label: "Xuất kho", groupName: "Kho" }
];
const groups = groupLibraryActions(lib);
assert.equal(groups.length, 2, "D: 2 groups");
assert.deepEqual(groups.map(g => g.groupName), ["Đơn vị tính", "Kho"], "D: tên group đúng thứ tự xuất hiện");
assert.deepEqual(groups.map(g => g.count), [2, 3], "D: count đúng (2 và 3)");

// ---- C — existing block không groupName → "Chưa phân loại" (cuối), không mất block ----
const libMixed = [
    { blockId: "LIB-1", label: "A", groupName: "Đơn vị tính" },
    { blockId: "LIB-2", label: "B", groupName: null },
    { blockId: "LIB-3", label: "C" } // thiếu field
];
const g2 = groupLibraryActions(libMixed);
assert.equal(g2.length, 2, "C: 2 groups (Đơn vị tính + Chưa phân loại)");
assert.equal(g2[1].groupName, UNGROUPED_LABEL, "C: Chưa phân loại ở cuối");
assert.equal(g2[1].count, 2, "C: 2 block không group không mất");
assert.equal(groupDisplayName(null), "Chưa phân loại", "C: display name null → Chưa phân loại");
assert.equal(groupDisplayName("  Kho  "), "Kho", "C: trim groupName");

// ---- Bulk rename chỉ tác động working set của bản ghi hiện tại ----
const currentRecordingActions = [
    { blockId: "WORK-1", label: "Mở danh mục", groupName: "Chưa phân loại", startStep: 1, endStep: 2 },
    { blockId: "WORK-2", label: "Thêm thiết bị", groupName: "Thiết bị cũ", startStep: 3, endStep: 6 }
];
const renamedWorkingActions = applyGroupToWorkingActions(currentRecordingActions, "Quản lý thiết bị");
assert.deepEqual(renamedWorkingActions.map(item => item.groupName), ["Quản lý thiết bị", "Quản lý thiết bị"],
    "Bulk: mọi thao tác vừa tạo nhận cùng Chức năng");
assert.deepEqual(currentRecordingActions.map(item => item.groupName), ["Chưa phân loại", "Thiết bị cũ"],
    "Bulk: không mutate working set cũ");

// ---- E — delete last action trong group → group biến mất (derive) ----
const libAfterDelete = libMixed.filter(b => b.blockId !== "LIB-1"); // xóa hết "Đơn vị tính"
const g3 = groupLibraryActions(libAfterDelete);
assert.equal(g3.length, 1, "E: group rỗng biến mất (chỉ còn Chưa phân loại)");
assert.equal(g3[0].groupName, UNGROUPED_LABEL, "E: group còn lại đúng");

// ================= Static contract — panel dùng grouping =================
assert.ok(clean.includes("groupLibraryActions(library)"), "UI: Library render qua groupLibraryActions");
assert.ok(clean.includes("v3-lib-group__head") && clean.includes("expandedGroup === g.groupName ? \"▾\" : \"▸\""), "UI: group collapsed mặc định + toggle ▸/▾");
assert.ok(clean.includes("{g.count} thao tác"), "UI: group hiển thị count");
assert.ok(!clean.includes("libPage") && !clean.includes("setLibPage") && !clean.includes("Trang {libPaged"), "UI: bỏ pagination phẳng Library");
assert.ok(clean.includes("setExpandedGroup(expandedGroup === g.groupName ? null : g.groupName)"), "UI: tester mở/đóng group chức năng rõ ràng");

// ---- Chức năng field: AI đề xuất, tester vẫn chỉnh sửa được ----
assert.ok(clean.includes("Chức năng") && clean.includes("v3-group-options") && clean.includes("datalist"), "UI: field Chức năng (select/nhập mới qua datalist)");
assert.ok(clean.includes("currentGroup"), "UI: currentGroup giữ default qua các action");
assert.ok(clean.includes("proposal?.suggestedGroupName ?? currentGroup"),
    "AI: proposal mang Chức năng đề xuất và fallback currentGroup do tester nhập");
assert.ok(clean.includes("groupName: seg.groupName ?? null"), "UI: save Library gửi groupName từ working action");
assert.match(apiSource, /createLibraryAction\(\{[^}]*groupName\s*=\s*null[^}]*\}\)/s,
    "API adapter: createLibraryAction phải nhận groupName từ working action");
assert.match(apiSource, /JSON\.stringify\(\{\s*recordingId,\s*label,\s*kind,\s*startStep,\s*endStep,\s*groupName\s*\}\)/,
    "API adapter: request lưu Library phải gửi groupName xuống backend");
assert.ok(clean.includes("applyCurrentGroupToWorkingSet") && clean.includes("Áp dụng cho {confirmed.length} thao tác vừa tạo"),
    "UI: có hành động đổi Chức năng đồng loạt cho nhóm thao tác của bản ghi hiện tại");
assert.ok(clean.includes("updateLibraryAction(item.blockId, { groupName })"),
    "UI: Action đã lưu được cập nhật từng block, không rename nhầm cả group Library cũ");

// ================= Backend (HTTP thật) =================
const { default: createApp } = await import("../src/server/createApp.js");
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "grp-"));
const app = createApp({ repositoryType: "file", dataDir: path.join(tempRoot, "d"), outputDir: path.join(tempRoot, "o"), v3OutputDir: path.join(tempRoot, "out") });
const srv = await new Promise(r => { const s = app.listen(0, "127.0.0.1", () => r(s)); });
const base = `http://127.0.0.1:${srv.address().port}`;
async function req(m, p, b) {
    const r = await fetch(`${base}${p}`, { method: m, headers: b ? { "content-type": "application/json" } : {}, body: b ? JSON.stringify(b) : undefined });
    return { status: r.status, body: await r.json() };
}
const SRC = "await page.goto('http://x/login');\nawait page.getByRole('button', { name: 'Đăng nhập' }).click();";
const start = await req("POST", "/api/codegen/start", { url: "about:blank", browser: "chrome", mode: "FULL_FLOW" });
const recId = start.body?.data?.recordingId ?? start.body?.recordingId;
await req("POST", `/api/codegen/recordings/${recId}/script`, { script: SRC });

// ---- A — create với groupName → persisted giữ groupName ----
const created = await req("POST", "/api/codegen/library", { recordingId: recId, label: "Đăng nhập", kind: "ACTION", startStep: 1, endStep: 2, groupName: "Đăng nhập" });
assert.equal(created.status, 201, "A: create 201");
assert.equal(created.body?.data?.groupName, "Đăng nhập", "A: response trả groupName");
// ---- B — list trả groupName; create không groupName → null ----
await req("POST", "/api/codegen/library", { recordingId: recId, label: "Thêm mới", kind: "ACTION", startStep: 1, endStep: 2 });
const list = await req("GET", "/api/codegen/library");
assert.equal(list.status, 200, "B: list 200");
const withGrp = list.body.data.find(x => x.label === "Đăng nhập");
const noGrp = list.body.data.find(x => x.label === "Thêm mới");
assert.equal(withGrp.groupName, "Đăng nhập", "B: list trả groupName");
assert.equal(noGrp.groupName, null, "B: block không groupName → null (presentation Chưa phân loại)");
// ---- F — blockId không đổi chỉ vì groupName (không regenerate ID) ----
assert.ok(String(withGrp.blockId).startsWith("LIB-"), "F: blockId LIB-* giữ nguyên dạng; không đổi khi thêm groupName");

srv.close();
fs.rmSync(tempRoot, { recursive: true, force: true });

console.log("Automation V3 Action Library Grouping (P0) test: PASS");
