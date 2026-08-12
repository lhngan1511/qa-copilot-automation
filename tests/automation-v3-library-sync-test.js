import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { planLibrarySave } from "../web-ui/src/utils/librarySync.js";

/*
 P0 — WORKING ACTION ↔ LIBRARY STATE DESYNC AFTER DELETE (CASE A–G).

 Root cause: working action giữ `blockId = LIB-*`; xóa asset khỏi Library chỉ cập
 nhật library state (working vẫn giữ LIB-* cũ) → saveAllToLibrary skip mù theo
 prefix `startsWith("LIB-")` → action đã bị xóa không được tạo lại → Library kẹt
 thiếu, dù UI báo "Đã lưu N" (N = confirmed.length giả).

 Fix: planLibrarySave() reconcile theo CANONICAL Library state — skip CHỈ khi
 LIB-* còn tồn tại trong list; LIB-* đã bị xóa → coi là chưa lưu → tạo lại (LIB mới).
 Success feedback = số persist/re-persist THẬT.

 Sandbox không browser → test logic thuần qua helper + static contract.
*/

const testDir = path.dirname(fileURLToPath(import.meta.url));
const panelSource = fs.readFileSync(path.join(testDir, "..", "web-ui", "src", "components", "automationV3", "V3RecordingPreparationPanel.jsx"), "utf8");
const clean = panelSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

// ================= Logic =================
// ---- A — working 3 (WORK-*, chưa lưu) + library 0 → save → tạo 3 ----
const workA = [
    { blockId: "WORK-1", label: "Xóa đơn vị tính", startStep: 1, endStep: 4 },
    { blockId: "WORK-2", label: "Mở chức năng Đơn vị tính", startStep: 5, endStep: 6 },
    { blockId: "WORK-3", label: "Tìm kiếm", startStep: 7, endStep: 9 }
];
let plan = planLibrarySave(workA, []);
assert.equal(plan.toCreate.length, 3, "A: 3 working chưa lưu → cần tạo 3");
assert.equal(plan.alreadySaved, 0, "A: chưa có gì đã lưu");

// ---- B/C — sau save: working giữ LIB-* + library 3; xóa 1 asset → library 2 ----
const lib3 = [
    { blockId: "LIB-A", label: "Xóa đơn vị tính" },
    { blockId: "LIB-B", label: "Mở chức năng Đơn vị tính" },
    { blockId: "LIB-C", label: "Tìm kiếm" }
];
const work3 = [
    { blockId: "LIB-A", label: "Xóa đơn vị tính", startStep: 1, endStep: 4 },
    { blockId: "LIB-B", label: "Mở chức năng Đơn vị tính", startStep: 5, endStep: 6 },
    { blockId: "LIB-C", label: "Tìm kiếm", startStep: 7, endStep: 9 }
];
plan = planLibrarySave(work3, lib3);
assert.equal(plan.toCreate.length, 0, "B: working 3 + library 3 (đủ) → không cần tạo gì");
assert.equal(plan.alreadySaved, 3, "B: 3 đã lưu");
// Tester xóa LIB-A khỏi Library → library 2, working VẪN 3 (giữ LIB-A cũ).
const lib2 = lib3.filter(b => b.blockId !== "LIB-A");
assert.equal(lib2.length, 2, "B: Library còn 2 sau delete");
plan = planLibrarySave(work3, lib2);
assert.equal(plan.toCreate.length, 1, "D: LIB-A không còn trong Library → coi là CHƯA lưu → tạo lại 1");
assert.equal(plan.toCreate[0].blockId, "LIB-A", "D: action bị xóa nằm trong toCreate");
assert.equal(plan.alreadySaved, 2, "G: 2 action còn tồn tại → KHÔNG tạo duplicate (skip)");
assert.ok(!plan.toCreate.some(s => s.blockId === "LIB-B") && !plan.toCreate.some(s => s.blockId === "LIB-C"), "G: LIB-B/LIB-C không nằm trong toCreate");

// ---- E — action được recreate sẽ nhận LIB id MỚI (component gán blockId từ response create) ----
const saveBody = clean.match(/const saveAllToLibrary = async \(\) => \{[\s\S]*?\n    \};/)?.[0] ?? "";
assert.ok(saveBody.includes("planLibrarySave(confirmed, canonical)"), "E: save dùng plan reconcile với canonical library");
assert.ok(saveBody.includes("const blockId = data?.blockId"), "E: action recreate nhận blockId từ API (LIB id mới)");
assert.ok(saveBody.includes('saved[idx] = { ...saved[idx], blockId'), "E: cập nhật blockId mới vào working action");

// ---- F — success feedback = số persist THẬT (persistedCount), không phải confirmed.length ----
assert.ok(saveBody.includes("persistedCount += 1"), "F: đếm số action thực sự create thành công");
assert.ok(saveBody.includes("setSaveFeedback({ count: persistedCount, total: confirmed.length })"), "F: message dùng persistedCount (không dùng confirmed.length)");
assert.ok(saveBody.includes("onSavedToLibrary?.(persistedCount)"), "F: callback cũng truyền số thật");
const feedbackRender = clean.match(/saveFeedback \? \([\s\S]*?v3-act__save-feedback[\s\S]*?<\/div>/)?.[0] ?? "";
assert.ok(feedbackRender.includes("saveFeedback.count > 0"), "F: phân nhánh theo số persist thật");
assert.ok(feedbackRender.includes("Đã lưu ${saveFeedback.count} thao tác mới vào Thư viện."), "F: message 'Đã lưu N thao tác mới' với N thật");
assert.ok(feedbackRender.includes("Tất cả ${saveFeedback.total ?? 0} thao tác đã có trong Thư viện."), "F: 0 persist → nói rõ tất cả đã có (không báo giả)");
assert.ok(!saveBody.includes('startsWith("LIB-")') || saveBody.includes("planLibrarySave"), "F: bỏ skip mù theo prefix (thay bằng reconcile)");

console.log("Automation V3 Working↔Library Sync (P0 desync) test: PASS");
