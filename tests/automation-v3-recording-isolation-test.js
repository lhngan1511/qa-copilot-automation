import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { freshAnalysisWorkspace, initializeAnalysisFromSteps, isStepInRange } from "../web-ui/src/utils/recordingPrepState.js";

/*
 P0-1 — RECORDING CONTEXT ISOLATION (regression) + P0-3 recording-as-fixed-source.

 Yêu cầu P0-1: mỗi lần nội dung Playwright source đổi và parse thành recording MỚI:
   - reset TOÀN BỘ analysis workspace Phần II (start/end/range preview/assertions/name/AI proposals);
   - initialize LẠI hoàn toàn từ steps MỚI;
   - KHÔNG reset Library.
 Test: A → parse → B → parse WITHOUT F5 → Phần II chỉ chứa B.

 Yêu cầu P0-3: recording = NGUỒN CỐ ĐỊNH — confirm action KHÔNG reset/thay thế recording
 (steps/source/recordingId giữ nguyên); highlight range chỉ là visual (isStepInRange).

 Sandbox không có browser → test logic thuần qua helper (component dùng đúng helper — static contract dưới).
*/

const testDir = path.dirname(fileURLToPath(import.meta.url));
const panelSource = fs.readFileSync(path.join(testDir, "..", "web-ui", "src", "components", "automationV3", "V3RecordingPreparationPanel.jsx"), "utf8");

// ---- 1. Analysis workspace rỗng (dùng khi reset) ----
const fresh = freshAnalysisWorkspace();
assert.deepEqual(fresh, { startSel: null, endSel: null, name: "", proposals: [] }, "fresh analysis workspace rỗng toàn bộ");

// ---- 2. Initialize từ steps: start = order đầu, end = order cuối, mọi field khác rỗng ----
const stepsA = Array.from({ length: 19 }, (_, i) => ({ order: i + 1, actionType: "click", target: `Bước ${i + 1}` }));
const fromA = initializeAnalysisFromSteps(stepsA);
assert.deepEqual(fromA, { startSel: 1, endSel: 19, name: "", proposals: [] }, "init A: 1→19, không còn gì khác");

const stepsB = Array.from({ length: 5 }, (_, i) => ({ order: i + 1, actionType: "click", target: `Bước B${i + 1}` }));
const fromB = initializeAnalysisFromSteps(stepsB);
assert.deepEqual(fromB, { startSel: 1, endSel: 5, name: "", proposals: [] }, "init B: 1→5");

// Steps rỗng / không order → start/end null (không crash)
assert.deepEqual(initializeAnalysisFromSteps([]), { startSel: null, endSel: null, name: "", proposals: [] }, "steps rỗng → null/null");
assert.deepEqual(initializeAnalysisFromSteps([{ actionType: "click" }, { actionType: "fill" }]), { startSel: null, endSel: null, name: "", proposals: [] }, "không có order → null/null");

// ---- 3. A → parse → B → parse WITHOUT F5: Phần II chỉ chứa B ----
let ws = freshAnalysisWorkspace();          // chưa có gì
ws = initializeAnalysisFromSteps(stepsA);   // parse A xong
assert.equal(ws.startSel, 1); assert.equal(ws.endSel, 19);

// Tester đã làm việc trên A: đổi range, đặt tên, AI proposals (edit state = form fields).
ws = { startSel: 4, endSel: 7, name: "Đăng nhập", proposals: [{ suggestedName: "Đăng nhập", startStep: 1, endStep: 4 }] };

// Tester thay nội dung bằng B → RESET context cũ (mô phỏng resetRecordingContext).
ws = freshAnalysisWorkspace();
assert.deepEqual(ws, { startSel: null, endSel: null, name: "", proposals: [] }, "sau reset: Phần II rỗng — không còn dữ liệu A");

// B parse xong → initialize LẠI hoàn toàn từ steps của B.
ws = initializeAnalysisFromSteps(stepsB);
assert.deepEqual(ws, { startSel: 1, endSel: 5, name: "", proposals: [] }, "sau parse B: Phần II CHỈ chứa B");
assert.equal(ws.endSel, 5, "endSel của B (5) — KHÔNG phải của A (19)");
assert.equal(ws.proposals.length, 0, "AI proposals của A không rò rỉ sang B");
assert.equal(ws.name, "", "name draft của A không rò rỉ sang B");

// ---- 3b. P0-3 — isStepInRange: highlight visual theo Start/End (đảo thứ tự cũng đúng) ----
assert.equal(isStepInRange(13, 13, 15), true, "13 trong [13,15]");
assert.equal(isStepInRange(14, 13, 15), true, "14 trong [13,15]");
assert.equal(isStepInRange(15, 13, 15), true, "15 trong [13,15]");
assert.equal(isStepInRange(12, 13, 15), false, "12 ngoài [13,15]");
assert.equal(isStepInRange(16, 13, 15), false, "16 ngoài [13,15]");
assert.equal(isStepInRange(14, 15, 13), true, "start/end đảo thứ tự vẫn đúng (15→13)");
assert.equal(isStepInRange(13, null, 15), false, "chưa chọn Start → không highlight");
assert.equal(isStepInRange(13, 13, null), false, "chưa chọn End → không highlight");
assert.equal(isStepInRange(null, 13, 15), false, "step không có order → không highlight");

// ---- 4. Component dùng đúng helper (static contract) ----
const clean = panelSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
assert.ok(clean.includes('applyAnalysisWorkspace(freshAnalysisWorkspace())'), "reset dùng freshAnalysisWorkspace (toàn bộ Phần II)");
assert.ok(clean.includes('applyAnalysisWorkspace(initializeAnalysisFromSteps(draftSteps))'), "Nhập xong init LẠI từ steps mới (draft→canonical) — parse draft không init workspace");
assert.ok(clean.includes("handleSourceChange") && clean.includes("setTimeout"), "đổi nội dung → tự parse lại (debounce, KHÔNG F5)");
assert.ok(clean.includes("parseGen.current"), "gen guard chống async cũ (AI/confirm) đổ vào bản mới");

// Reset KHÔNG đụng Library: thân hàm resetRecordingContext không chứa setLibrary.
const resetBody = clean.match(/const resetRecordingContext = \(\) => \{[\s\S]*?\n    \};/)?.[0] ?? "";
assert.ok(resetBody.length > 0, "tìm thấy thân resetRecordingContext");
assert.ok(!resetBody.includes("setLibrary("), "reset KHÔNG gọi setLibrary (Library không bị reset)");
assert.ok(clean.includes("setAnalyzing(false)"), "reset cả trạng thái analyzing (AI đang chạy của bản cũ)");

// P0-3 — CONFIRM KHÔNG reset/thay thế recording: thân createConfirmedAction không gọi
// setSteps/setSource/setRecordingId (recording là nguồn cố định — cắt tiếp từ CÙNG recording).
const confirmBody = clean.match(/const createConfirmedAction = async \(s, e, label\) => \{[\s\S]*?\n    \};/)?.[0] ?? "";
assert.ok(confirmBody.length > 0, "tìm thấy thân createConfirmedAction");
assert.ok(!confirmBody.includes("setSteps(") && !confirmBody.includes("setSource(") && !confirmBody.includes("setRecordingId("),
    "confirm KHÔNG reset steps/source/recordingId — recording giữ nguyên để tạo thao tác tiếp");

// ---- 5. Backend: parse recording KHÔNG đụng Library (đã có ở codegen-consolidation-test — nhắc lại contract) ----
const apiPanel = clean.includes("createRecording(") && clean.includes("setRecordingScript(") && clean.includes("getRecording(");
assert.ok(apiPanel, "parse = createRecording + setScript + getRecording — chỉ đọc/write recording, không library");

console.log("Automation V3 Recording Isolation (P0-1) test: PASS");
