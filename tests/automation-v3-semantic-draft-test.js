import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { semanticStepText, locatorControlType, urlPath } from "../web-ui/src/utils/semanticSteps.js";
import { removeStepFromSource } from "../web-ui/src/utils/draftSource.js";
import { parseRecording } from "../src/codegen/recordingParser.js";

/*
 P0 — RECORDING DRAFT REVIEW + SEMANTIC READABLE STEPS (CASE A–P).

 Semantic: parser đã lưu đủ field (locator/recordedValue/actionType) → formatter
 dùng CHUNG mọi nơi; không migration Library.
 Draft: paste → parse NHÁP (chưa setSteps) → [Nhập xong] mới commit canonical;
 xóa step draft = rewrite raw source an toàn (guard 1 statement/dòng).

 Sandbox không browser → logic thuần + static contract.
*/

const testDir = path.dirname(fileURLToPath(import.meta.url));
const panelSource = fs.readFileSync(path.join(testDir, "..", "web-ui", "src", "components", "automationV3", "V3RecordingPreparationPanel.jsx"), "utf8");
const clean = panelSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const SRC = `await page.goto('http://host/wasuco/login?x=1');
await page.getByRole('textbox', { name: 'Tài khoản' }).click();
await page.getByRole('textbox', { name: 'Tài khoản' }).fill('admin');
await page.getByRole('textbox', { name: 'Tài khoản' }).press('Tab');
await page.getByRole('textbox', { name: 'Mật khẩu' }).fill('123456@Aa');
await page.getByRole('button', { name: 'Đăng nhập' }).click();
await page.getByText('Chào mừng').hover();
await expect(page.getByText('Chào mừng')).toBeVisible();`;
const { steps, assertions } = parseRecording(SRC);

// ---- A — goto → readable path ----
assert.equal(urlPath("http://host/wasuco/login?x=1"), "/wasuco/login?x=1", "A: urlPath rút path+search");
assert.equal(semanticStepText(steps[0]), "Mở trang /wasuco/login?x=1", "A: goto → 'Mở trang <path>'");
assert.ok(!semanticStepText(steps[0]).includes("http://host"), "A: không lặp 'Mở trang · Mở trang'");

// ---- B — textbox click → Click vào ô ----
assert.equal(semanticStepText(steps[1]), "Click vào ô Tài khoản", "B: textbox click → 'Click vào ô Tài khoản'");

// ---- C — fill → Nhập giá trị vào ô (không expose value) ----
assert.equal(semanticStepText(steps[2]), "Nhập giá trị vào ô Tài khoản", "C: fill → 'Nhập giá trị vào ô Tài khoản'");
assert.ok(!semanticStepText(steps[2]).includes("admin"), "C: không expose value mặc định");

// ---- D — press Tab → Nhấn phím Tab tại ô ----
assert.equal(semanticStepText(steps[3]), "Nhấn phím Tab tại ô Tài khoản", "D: press Tab → 'Nhấn phím Tab tại ô Tài khoản'");

// ---- E — button click → Click nút ----
assert.equal(semanticStepText(steps[5]), "Click nút Đăng nhập", "E: button click → 'Click nút Đăng nhập'");

// ---- F — password không expose value ----
assert.equal(semanticStepText(steps[4]), "Nhập giá trị vào ô Mật khẩu", "F: password fill không expose value");
assert.ok(!semanticStepText(steps[4]).includes("123456"), "F: không chứa password");
assert.equal(steps[4].recordedValue, "REDACTED", "F: parser redact sensitive value");

// ---- G — unknown locator fallback an toàn (không invent control type) ----
assert.equal(locatorControlType("page.getByText('Chào mừng')"), null, "G: getByText → không đủ evidence control type");
assert.equal(semanticStepText(steps[6]), "Di chuột vào Chào mừng", "G: hover → 'Di chuột vào ...' (không invent 'ô')");

// ---- I — assertions vẫn riêng (không thành action) ----
assert.equal(assertions.length, 1, "I: expect tách riêng (1 assertion)");
assert.equal(steps.length, 7, "I: 7 action — expect không tính");
assert.ok(steps.every(s => s.actionType !== "ASSERT"), "I: không có action ASSERT trong steps");

// ---- H — Recording & Library dùng chung formatter (static: renderSteps dùng semanticStepText) ----
assert.ok(clean.includes("semanticStepText(s)"), "H: renderSteps dùng semanticStepText (Recording + Library Xem + dropdown dùng chung)");
assert.ok(clean.includes("const STEP_LABEL = step => semanticStepText(step)"), "H: STEP_LABEL (dropdown) cũng dùng semantic — đồng nhất");

// ---- J/K/L — Draft: doParse KHÔNG setSteps (chưa commit canonical); [Nhập xong] mới commit ----
const doParseBody = clean.match(/const doParse = async \(src, gen\) => \{[\s\S]*?\n    \};/)?.[0] ?? "";
assert.ok(doParseBody.includes("setDraftSteps(") && doParseBody.includes("setDraftAssertions("), "J: doParse lưu DRAFT (không setSteps)");
assert.ok(!doParseBody.includes("setSteps("), "J: doParse KHÔNG setSteps → canonical chưa đổi trước [Nhập xong]");
const confirmBody = clean.match(/const confirmDraft = \(\) => \{[\s\S]*?\n    \};/)?.[0] ?? "";
assert.ok(confirmBody.includes("setSteps(draftSteps)") && confirmBody.includes("setRecordingId(draftRecordingId)"), "L: [Nhập xong] commit canonical (setSteps + recordingId)");
assert.ok(confirmBody.includes("applyAnalysisWorkspace(initializeAnalysisFromSteps(draftSteps))"), "L: init analysis workspace theo recording mới");
assert.ok(confirmBody.includes("setDraftSteps([])"), "L: xóa draft sau khi commit");
// AI chỉ gọi sau gate: renderActionSection (nút AI) nằm trong nhánh steps.length > 0.
// Draft branch (steps.length === 0 → đến ") : splitLayout") KHÔNG chứa nút AI (handleAnalyze chỉ trong renderActionSection).
const draftBranch = clean.slice(clean.indexOf("steps.length === 0 ? ("), clean.indexOf(") : splitLayout ? ("));
assert.ok(!draftBranch.includes("handleAnalyze") && !draftBranch.includes("renderActionSection"), "N: AI không được gọi trước [Nhập xong] (draft branch không có AI)");

// ---- M — thay Draft B: resetRecordingContext xóa draft + analysis (P0-1 isolation) ----
const resetBody = clean.match(/const resetRecordingContext = \(\) => \{[\s\S]*?\n    \};/)?.[0] ?? "";
assert.ok(resetBody.includes("setDraftSteps([])") && resetBody.includes("applyAnalysisWorkspace(freshAnalysisWorkspace())"), "M: reset xóa draft A + analysis A (không rò sang B)");
assert.ok(!resetBody.includes("setLibrary("), "O: reset draft KHÔNG đụng Library");

// ---- P — delete draft step: rewrite raw source an toàn + parse lại ----
const step3 = steps[3]; // press Tab — dòng riêng
const removed = removeStepFromSource(SRC, step3);
assert.ok(typeof removed === "string", "P: xóa được step (1 statement/dòng)");
assert.ok(!removed.includes("press('Tab')"), "P: raw source không còn dòng đã xóa");
const reparsed = parseRecording(removed);
assert.equal(reparsed.steps.length, steps.length - 1, "P: parse lại → giảm đúng 1 step");
assert.ok(!reparsed.steps.some(s => s.actionType === "PRESS"), "P: step bị xóa (press Tab) không còn trong preview (order được đánh lại)");
// Guard: dòng chứa 2 statement → null (không xóa).
const twoInLine = "await page.getByRole('button', { name: 'A' }).click(); await page.getByRole('button', { name: 'B' }).click();";
const parsed2 = parseRecording(twoInLine);
assert.equal(removeStepFromSource(twoInLine, parsed2.steps[0]), null, "P: guard — dòng 2 statement → không xóa (không invent rewrite)");
// UI đồng bộ: nút Xóa draft dùng removeStepFromSource + handleSourceChange reparse.
assert.ok(clean.includes("removeStepFromSource(source, step)") && clean.includes("handleSourceChange(next)"), "P: removeDraftStep → rewrite source → reparse (UI + raw đồng bộ)");

console.log("Automation V3 Semantic + Draft Review (P0) test: PASS");
