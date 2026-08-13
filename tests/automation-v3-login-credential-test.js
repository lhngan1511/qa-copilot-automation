import assert from "node:assert/strict";
import { parseRecording } from "../src/codegen/recordingParser.js";
import { renderStep, envKeyFor } from "../src/codegen/rendererV3.js";

/*
 P0-C RUNTIME BUG — GENERATED LOGIN SCRIPT (credential + press redaction).

 Bug 1: envKeyFor sinh TESTDATA_PASSWORD nhưng shared runtime chỉ có LOGIN_PASSWORD
        -> fill(process.env.TESTDATA_PASSWORD ?? "") luôn rỗng. Fix: LOGIN_*.
 Bug 2: parser redact cả PRESS trên field nhạy cảm -> press("REDACTED") -> Unknown key.
        Fix: chỉ redact FILL (value thật); PRESS/SELECT giữ key command.
 Bug 3: parser không duplicate step (regex exec 1 match/step) — lặp = recording gốc lặp.
*/

// ---- Bug 1: envKeyFor dùng LOGIN_* (shared runtime config) ----
assert.equal(envKeyFor("Tài khoản"), "LOGIN_USERNAME", "1: username -> LOGIN_USERNAME");
assert.equal(envKeyFor("Mật khẩu"), "LOGIN_PASSWORD", "1: password -> LOGIN_PASSWORD");
assert.equal(envKeyFor("Mã xác nhận"), "LOGIN_CAPTCHA", "1: captcha -> LOGIN_CAPTCHA");
assert.ok(!envKeyFor("Mã đơn vị tính"), "1: business field không bị map sang LOGIN_*");

// ---- Bug 2: password FILL redact; PRESS Tab giữ "Tab" ----
const SRC = `await page.getByRole('textbox', { name: 'Mật khẩu' }).fill('Secret@123');
await page.getByRole('textbox', { name: 'Mật khẩu' }).press('Tab');`;
const { steps } = parseRecording(SRC);
const fillStep = steps.find(s => s.actionType === "FILL");
const pressStep = steps.find(s => s.actionType === "PRESS");
assert.equal(fillStep.recordedValue, "REDACTED", "2: FILL password redact value");
assert.equal(fillStep.sensitive, true, "2: FILL sensitive=true");
assert.equal(pressStep.recordedValue, "Tab", "2: PRESS Tab KHÔNG bị redact");
assert.equal(pressStep.sensitive, false, "2: PRESS sensitive=false");

// Generated lines:
const fillLine = renderStep(fillStep, { purposeMap: {}, confirmedTestData: {}, approvedTestData: {} }).line;
assert.ok(fillLine.includes('process.env.LOGIN_PASSWORD ?? ""'), "2: fill dùng process.env.LOGIN_PASSWORD (không TESTDATA_)");
assert.ok(!fillLine.includes("Secret@123"), "2: không expose password plaintext");
const pressLine = renderStep(pressStep, { purposeMap: {}, confirmedTestData: {}, approvedTestData: {} }).line;
assert.ok(pressLine.includes('press("Tab")'), "2: press('Tab') — KHÔNG press('REDACTED')");

// ---- Guard dữ liệu cũ: PRESS "REDACTED" (block persist trước fix) -> "Enter" an toàn ----
const legacyPress = renderStep({ actionType: "PRESS", locator: "page.getByRole('textbox', { name: 'Mật khẩu' })", recordedValue: "REDACTED" }, { purposeMap: {}, confirmedTestData: {}, approvedTestData: {} }).line;
assert.ok(legacyPress.includes('press("Enter")'), "2: legacy REDACTED -> press('Enter') (không crash)");

// ---- Bug 3: parser không duplicate (mỗi statement 1 step) ----
const dupSrc = `await page.getByRole('textbox', { name: 'Mật khẩu' }).fill('a');
await page.getByRole('textbox', { name: 'Mật khẩu' }).press('Tab');
await page.getByRole('textbox', { name: 'Mật khẩu' }).fill('b');
await page.getByRole('textbox', { name: 'Mật khẩu' }).press('Tab');`;
const dupSteps = parseRecording(dupSrc).steps;
assert.equal(dupSteps.length, 4, "3: parser giữ đúng 4 step (fill/press x2) — không tự thêm/bớt");
assert.deepEqual(dupSteps.map(s => s.actionType), ["FILL", "PRESS", "FILL", "PRESS"], "3: thứ tự khớp recording (lặp = recording gốc lặp — giữ)");

console.log("Automation V3 Login Credential + Press Redaction (P0-C runtime bug) test: PASS");
