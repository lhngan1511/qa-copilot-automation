import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ActionLibrary from "../src/codegen/ActionLibrary.js";

/*
 P0-4 DUPLICATE ANALYSIS + P1 LAYOUT (checkpoint V3 — grouping chờ duyệt).

 P0-4: hash = sha256(steps+assertions+range+label+kind) là detector duplicate
 semantic ĐÁNG TIN (đã trace runtime):
   - cùng label + cùng steps (recording khác) → SAME hash → duplicate thật.
   - cùng label + steps khác → khác hash → KHÔNG phải duplicate (chỉ trùng tên).
   - cùng steps + assertion khác → khác hash → semantic khác (giữ cả 2).
 KHÔNG tự dedupe — tester quyết định (badge đề xuất, chưa implement).

 P1: CodeGen desktop tận dụng content width (bỏ max-width 1000px co cụm);
 grid split 60/40 + media 1 cột giữ nguyên.
*/

const testDir = path.dirname(fileURLToPath(import.meta.url));

// ================= P0-4 =================
const libFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "dup-")), "lib.json");
const lib = new ActionLibrary({ metadataFile: libFile });
const stepsLogin = [
    { order: 1, actionType: "GOTO", target: "Mở trang", recordedValue: "http://host/login", sourceStart: 0, sourceEnd: 40, sourceLine: 1 },
    { order: 2, actionType: "CLICK", target: "Đăng nhập", recordedValue: null, sourceStart: 41, sourceEnd: 80, sourceLine: 2 }
];
// CASE 2 — cùng steps, recording khác → SAME hash (duplicate semantic thật)
const a = lib.addBlock({ label: "Đăng nhập", steps: stepsLogin, recordedAssertions: [], sourceRecordingId: "REC-1", sourceRange: { startStep: 1, endStep: 2 } });
const b = lib.addBlock({ label: "Đăng nhập", steps: stepsLogin.map(s => ({ ...s })), recordedAssertions: [], sourceRecordingId: "REC-2", sourceRange: { startStep: 1, endStep: 2 } });
assert.equal(a.hash, b.hash, "P0-4 CASE2: cùng steps (recording khác) → SAME hash = duplicate semantic thật");
// CASE 3 — cùng label, steps khác → khác hash (KHÔNG phải duplicate)
const stepsLogin3 = [...stepsLogin.map(s => ({ ...s })), { order: 3, actionType: "PRESS", target: "Mật khẩu", recordedValue: "Tab", sourceStart: 81, sourceEnd: 110, sourceLine: 3 }];
const c = lib.addBlock({ label: "Đăng nhập", steps: stepsLogin3, recordedAssertions: [], sourceRecordingId: "REC-3", sourceRange: { startStep: 1, endStep: 3 } });
assert.notEqual(a.hash, c.hash, "P0-4 CASE3: cùng label + steps khác → khác hash (chỉ trùng tên — không dedupe)");
// CASE 4 — cùng steps, assertion khác → khác hash (semantic khác, giữ cả 2)
const d = lib.addBlock({ label: "Đăng nhập", steps: stepsLogin.map(s => ({ ...s })), recordedAssertions: [{ matcher: "toBeVisible", expected: "Xin chào" }], sourceRecordingId: "REC-4", sourceRange: { startStep: 1, endStep: 2 } });
assert.notEqual(a.hash, d.hash, "P0-4 CASE4: cùng steps + assertion khác → khác hash (giữ cả 2)");
fs.rmSync(path.dirname(libFile), { recursive: true, force: true });

// ================= P1 layout (static) =================
const css = fs.readFileSync(path.join(testDir, "..", "web-ui", "src", "styles", "automation.css"), "utf8");
assert.ok(css.includes(".codegen-page") && css.includes("max-width: none;"), "P1: .codegen-page bỏ co cụm 1000px → tận dụng content width");
assert.ok(!/\.codegen-page \{[\s\S]*?max-width: 1000px/.test(css), "P1: không còn max-width 1000px cho codegen");
const v3css = fs.readFileSync(path.join(testDir, "..", "web-ui", "src", "styles", "automationV3.css"), "utf8");
assert.ok(v3css.includes("grid-template-columns: 3fr 2fr"), "P1: split 60/40 giữ nguyên");
assert.ok(/@media \(max-width: 860px\)[\s\S]*?grid-template-columns: 1fr/.test(v3css), "P1: responsive nhỏ → 1 cột");

// ================= Grouping CHƯA implement (chờ duyệt) =================
const panelSource = fs.readFileSync(path.join(testDir, "..", "web-ui", "src", "components", "automationV3", "V3RecordingPreparationPanel.jsx"), "utf8");
assert.ok(!panelSource.includes("Chưa phân loại") && !panelSource.includes("group.module"), "P0-3: grouping chưa implement trong panel (chờ duyệt schema)");
assert.ok(fs.existsSync(path.join(testDir, "..", "docs", "V3_ACTION_LIBRARY_GROUPING_DESIGN.md")), "P0-3: có design doc đề xuất schema");

console.log("Automation V3 Duplicate Analysis + Layout (P0-4/P1) test: PASS");
