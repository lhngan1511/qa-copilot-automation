import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { removeStepFromSource } from "../web-ui/src/utils/draftSource.js";
import { parseRecording } from "../src/codegen/recordingParser.js";

/*
 H — Xóa step trong bản nháp: FIX CÀ GIẬT (optimistic, không API/reload).

 Root cause cũ: removeDraftStep → handleSourceChange → resetRecordingContext (draft
 BIẾN MẤT) → debounce 500ms → doParse → createRecording (API, recording MỚI mỗi lần
 xóa) + setScript + getRecording → setDraftSteps → render lại toàn bộ → cảm giác reload.

 Fix: removeDraftStep = removeStepFromSource (rewrite source) + parseRecording CỤC BỘ
 (thuần, đồng bộ — không API/không recording mới/không AI/không reset workspace) →
 setSource + setDraftSteps trong cùng handler → React render 1 lần, không flash/blank.

 Regression: draft 20 steps → xóa liên tiếp step 3, 7, 10 → mỗi lần source giảm đúng
 1 statement; [Nhập xong] commit khớp draft cuối; không gọi AI/backend.
*/

const testDir = path.dirname(fileURLToPath(import.meta.url));
const panelSource = fs.readFileSync(path.join(testDir, "..", "web-ui", "src", "components", "automationV3", "V3RecordingPreparationPanel.jsx"), "utf8");
const clean = panelSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

// ---- Draft 20 steps (mỗi step 1 dòng) ----
const lines = [];
lines.push("await page.goto('http://x/login');");
for (let i = 1; i <= 19; i++) {
    lines.push(`await page.getByRole('button', { name: 'Bước ${i}' }).click();`);
}
const SRC = lines.join("\n");
let parsed = parseRecording(SRC);
assert.equal(parsed.steps.length, 20, "H: 20 steps ban đầu");

// ---- Xóa liên tiếp step 3, 7, 10 (index 0-based; order 1 = GOTO, order 2 = Bước 1, ...) ----
const removedTargets = [];
function deleteStepAt(src, idx) {
    const p = parseRecording(src);
    const step = p.steps[idx];
    const target = step.target;
    const next = removeStepFromSource(src, step);
    assert.ok(typeof next === "string", "H: xóa an toàn (1 statement/dòng)");
    removedTargets.push(target);
    return next;
}
let src = SRC;
src = deleteStepAt(src, 2); // step hiển thị 3
let p2 = parseRecording(src);
assert.equal(p2.steps.length, 19, "H: sau xóa 1 → 19 steps");
src = deleteStepAt(src, 6); // step hiển thị 7
p2 = parseRecording(src);
assert.equal(p2.steps.length, 18, "H: sau xóa 2 → 18 steps");
src = deleteStepAt(src, 9); // step hiển thị 10
p2 = parseRecording(src);
assert.equal(p2.steps.length, 17, "H: sau xóa 3 → 17 steps");
// Mỗi target đã xóa không còn trong source cuối.
for (const t of removedTargets) {
    assert.ok(!src.includes(t), `H: source không còn statement '${t}' (đã xóa)`);
}

// ---- [Nhập xong] commit khớp draft cuối (17 steps, thứ tự đánh lại) ----
assert.deepEqual(p2.steps.map(s => s.order), Array.from({ length: 17 }, (_, i) => i + 1), "H: order đánh lại 1..17");
assert.ok(p2.steps.every(s => s.order === p2.steps.indexOf(s) + 1), "H: order liên tục");
assert.equal(p2.steps[0].actionType, "GOTO", "H: step 1 = Mở trang");
assert.equal(p2.steps[1].target, "Bước 1", "H: step 2 = Bước 1 (giữ nguyên)");
assert.ok(p2.steps.every(s => !removedTargets.includes(s.target)), "H: draft cuối không còn 3 step đã xóa");

// ---- Static: removeDraftStep KHÔNG API / KHÔNG reset / KHÔNG reload ----
const rmBody = clean.match(/const removeDraftStep = step => \{[\s\S]*?\n    \};/)?.[0] ?? "";
assert.ok(rmBody.includes("parseRecording(next)") && rmBody.includes("setSource(next)") && rmBody.includes("setDraftSteps("), "H: removeDraftStep = rewrite + parse cục bộ + set state cùng handler");
assert.ok(!rmBody.includes("createRecording") && !rmBody.includes("setRecordingScript") && !rmBody.includes("getRecording"), "H: KHÔNG gọi API/backend");
assert.ok(!rmBody.includes("handleSourceChange") && !rmBody.includes("resetRecordingContext"), "H: KHÔNG reset draft workspace (list không biến mất)");
assert.ok(!rmBody.includes("analyzeRecording") && !rmBody.includes("handleAnalyze"), "H: KHÔNG gọi AI");
assert.ok(!rmBody.includes("reload") && !rmBody.includes("setTimeout"), "H: không reload / không debounce (phản hồi tức thì)");
// Key draft ổn định theo vị trí nguồn (không remount các row phía trước vị trí xóa).
assert.ok(clean.includes('key={`${s.actionType}:${s.target}:${s.sourceStart}`}') || clean.includes('key={`${s.sourceStart}`}'), "H: key draft ổn định (không phụ thuộc index/order duy nhất)");

console.log("Automation V3 Draft Delete Optimistic (H) test: PASS");
