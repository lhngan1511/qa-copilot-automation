import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildRecordingFileName } from "../web-ui/src/utils/recordingFile.js";

/*
 P0 — SAVE CURRENT PLAYWRIGHT RECORDING (CASE 1–4).

 Canonical: state `source` trong V3RecordingPreparationPanel = raw Playwright duy nhất
 (record/paste đều đổ vào đây; "Xem mã Playwright" / "Sao chép mã" / "Lưu bản ghi Playwright"
 đều đọc CHÍNH source này). KHÔNG tạo state thứ hai; KHÔNG đụng Action Library.

 Sandbox không browser → test logic thuần (filename) + static contract (component).
*/

const testDir = path.dirname(fileURLToPath(import.meta.url));
const panelSource = fs.readFileSync(path.join(testDir, "..", "web-ui", "src", "components", "automationV3", "V3RecordingPreparationPanel.jsx"), "utf8");
const clean = panelSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

// ---- CASE 4a — filename: playwright-recording-<timestamp>.js ----
const fn = buildRecordingFileName(new Date(2026, 7, 12, 9, 5, 7)); // 2026-08-12 09:05:07
assert.match(fn, /^playwright-recording-\d{8}-\d{6}\.js$/, "filename đúng pattern playwright-recording-<timestamp>.js");
assert.equal(fn, "playwright-recording-20260812-090507.js", "filename cụ thể đúng (pad 2 số)");

// ---- CASE 1 — copy/save đọc CHÍNH canonical `source` ----
const copyBody = clean.match(/const handleCopyRecording = async \(\) => \{[\s\S]*?\n    \};/)?.[0] ?? "";
const saveBody = clean.match(/const handleSaveRecording = \(\) => \{[\s\S]*?\n    \};/)?.[0] ?? "";
assert.ok(copyBody.includes("navigator.clipboard.writeText(source)"), "CASE 1: Sao chép mã đọc `source` (canonical)");
assert.ok(saveBody.includes("downloadScript(source,"), "CASE 1: Lưu bản ghi đọc `source` (canonical)");
assert.ok(!copyBody.includes("scriptContent") && !saveBody.includes("scriptContent"), "CASE 1: không đọc legacy scriptContent từ list recordings");
assert.ok(!copyBody.includes("createLibraryAction") && !saveBody.includes("createLibraryAction") && !copyBody.includes("listLibrary") && !saveBody.includes("listLibrary"),
    "CASE 3: copy/save KHÔNG đụng Action Library");

// ---- CASE 2 — canonical DUY NHẤT: không có source thứ hai trong panel ----
assert.ok(!clean.includes("scriptText"), "CASE 2: panel không có state scriptText thứ hai (chỉ `source`)");
assert.ok((clean.match(/value=\{source\}/g) ?? []).length >= 2, "CASE 2: textarea paste + Xem mã Playwright đều bound `source`");
// P0-1 isolation đã đảm bảo: đổi nội dung → reset + parse lại → `source` = bản mới (B).
assert.ok(clean.includes("handleSourceChange") && clean.includes("resetRecordingContext"), "CASE 2: A→B vẫn qua handleSourceChange (isolation giữ)");

// ---- CASE 4 — empty state: utility actions chỉ render khi recording tồn tại ----
assert.ok(clean.includes("v3-rec-utils"), "CASE 4: có khối utility recording");
assert.ok(clean.includes("steps.length > 0"), "CASE 4: utility render có điều kiện recording tồn tại");
assert.ok(!clean.includes("Chưa có script trong bản ghi hiện tại."), "CASE 4: bỏ thông báo gây hiểu lầm 'Chưa có script…'");
// Trong nhánh split: utilities nằm trong col rec (chỉ khi có recording). Tìm render có guard.
const splitBranch = clean.match(/v3-rec-utils[\s\S]*?Lưu bản ghi Playwright/)?.[0] ?? "";
assert.ok(splitBranch.length > 0, "CASE 4: có nút Lưu bản ghi Playwright trong utility row");

// ---- CodeGenPage: bỏ card Công cụ kỹ thuật (chức năng chuyển vào panel) ----
const pageSource = fs.readFileSync(path.join(testDir, "..", "web-ui", "src", "pages", "CodeGenPage.jsx"), "utf8");
const pageClean = pageSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
assert.ok(!pageClean.includes("Công cụ kỹ thuật"), "CodeGenPage: bỏ card Công cụ kỹ thuật cuối trang");
assert.ok(!pageClean.includes("Tải/Lưu script"), "CodeGenPage: bỏ nút Tải/Lưu script cũ (sai canonical)");
assert.ok(!pageClean.includes("Chưa có script trong bản ghi hiện tại"), "CodeGenPage: không còn message sai");
assert.ok(!pageClean.includes("scriptContent"), "CodeGenPage: không còn đọc active.scriptContent từ list recordings");
assert.ok(pageClean.includes("V3RecordingPreparationPanel"), "CodeGenPage: vẫn dùng panel (utilities nằm trong panel)");

console.log("Automation V3 Save Recording (P0) test: PASS");
