import assert from "node:assert/strict";
import {
    classifyError,
    buildRunResponse,
    extractFailedLocator,
    extractLine,
    extractAssertionExpectedActual,
    ERROR_CODES,
    ERROR_MESSAGES
} from "../src/automation/diagnose.js";
import {
    isRunTabVisible,
    isRunEnabled,
    runDisplay,
    runBlocker,
    recommendationCode,
    failDetail,
    guidanceFor
} from "../web-ui/src/utils/runDiagnose.js";

/* P0 — Generate → Run → Diagnose. */

// 1. Tab "Chạy thử": chưa generate → ẩn; generate xong → hiện.
assert.equal(isRunTabVisible({ generated: false }), false, "chưa generate → không có tab Chạy thử");
assert.equal(isRunTabVisible({ generated: true }), true, "generate xong → tab xuất hiện");

// 2. Nút Run bật khi có spec + đủ dữ liệu + môi trường.
assert.equal(isRunEnabled({ generated: true, dataReady: true, environmentValid: true }), true);
assert.equal(isRunEnabled({ generated: false, dataReady: true, environmentValid: true }), false);
assert.equal(isRunEnabled({ generated: true, dataReady: false, environmentValid: true }), false);
assert.equal(isRunEnabled({ generated: true, dataReady: true, environmentValid: false }), false, "thiếu môi trường → tắt Run");

// 3. runDisplay: PASS/FAIL/Chưa chạy.
assert.equal(runDisplay({ status: "PASSED", passed: true }).label, "PASS");
assert.equal(runDisplay({ status: "FAILED" }).label, "FAIL");
assert.equal(runDisplay({ status: "DIAGNOSTIC" }).label, "FAIL");
assert.equal(runDisplay({}).label, "Chưa chạy");

// 4. Backend classify — PASSED → không lỗi.
assert.deepEqual(classifyError({ code: 0 }), { errorCode: null, errorMessage: null });

// 5. LOCATOR_NOT_FOUND
const loc = classifyError({
    code: 1,
    baseUrlPresent: true,
    log: "Error: locator.click: Timeout 30000ms exceeded\n  waiting for locator('page.getByRole(\\'button\\', { name: \\'Đăng nhập\\' })')\n    at file:///p/outputs/generated-tests/TC001.spec.js:12:28"
});
assert.equal(loc.errorCode, ERROR_CODES.LOCATOR_NOT_FOUND);
assert.match(loc.errorMessage, /Không tìm thấy phần tử/);
assert.equal(extractFailedLocator(loc.log || "waiting for locator('page.getByRole(\'button\')')"), "page.getByRole('button')");

// 6. ASSERTION_FAILED + expected/actual
const asrt = classifyError({
    code: 1,
    baseUrlPresent: true,
    log: "Error: expect(received).toBeVisible()\nExpected: true\nReceived: false\n  at TC001.spec.js:20:11"
});
assert.equal(asrt.errorCode, ERROR_CODES.ASSERTION_FAILED);
const ea = extractAssertionExpectedActual("Expected: true\nReceived: false");
assert.equal(ea.expected, "true");
assert.equal(ea.actual, "false");

// 7. BASE_URL_MISSING
const base = classifyError({ code: 1, baseUrlPresent: false, log: "goto failed" });
assert.equal(base.errorCode, ERROR_CODES.BASE_URL_MISSING);
assert.match(base.errorMessage, /BASE_URL/);

// 8. BROWSER_NOT_INSTALLED
const brow = classifyError({ code: 1, baseUrlPresent: true, browserDiagnostic: "BUNDLED_CHROMIUM_NOT_INSTALLED: ...", log: "" });
assert.equal(brow.errorCode, ERROR_CODES.BROWSER_NOT_INSTALLED);

// 9. SPEC_NOT_FOUND
const spec = classifyError({ code: 1, baseUrlPresent: true, log: "No tests found" });
assert.equal(spec.errorCode, ERROR_CODES.SPEC_NOT_FOUND);

// 10. TIMEOUT
const to = classifyError({ code: 1, baseUrlPresent: true, log: "Test timeout of 30000ms exceeded" });
assert.equal(to.errorCode, ERROR_CODES.TIMEOUT);

// 11. UNKNOWN_ERROR
const unk = classifyError({ code: 1, baseUrlPresent: true, log: "random crash" });
assert.equal(unk.errorCode, ERROR_CODES.UNKNOWN_ERROR);

// 12. buildRunResponse — cấu trúc đầy đủ.
const resp = buildRunResponse({ status: "FAILED", durationMs: 123, log: "Error: locator.click: Timeout\n  waiting for locator('page.getByRole(\'x\')')\n  at TC001.spec.js:12:3", baseUrlPresent: true, code: 1, filePath: "TC001.spec.js" });
assert.equal(resp.status, "FAILED");
assert.equal(resp.passed, false);
assert.equal(resp.durationMs, 123);
assert.equal(resp.errorCode, ERROR_CODES.LOCATOR_NOT_FOUND);
assert.equal(resp.failedLocator, "page.getByRole('x')");
assert.equal(resp.filePath, "TC001.spec.js");
assert.equal(resp.line, 12);
assert.ok(typeof resp.output === "string");

// 13. runBlocker
assert.match(runBlocker({ generated: false, dataReady: true, environmentValid: true }), /Chưa có spec/);
assert.match(runBlocker({ generated: true, dataReady: false, environmentValid: true }), /thiếu dữ liệu/);
assert.match(runBlocker({ generated: true, dataReady: true, environmentValid: false }), /môi trường chạy/);
assert.equal(runBlocker({ generated: true, dataReady: true, environmentValid: true }), null);

// 14. Khuyến nghị có nút Copy — recommendationCode trả đoạn mã.
assert.equal(recommendationCode({ recommendation: "expect(page).toHaveURL(...)" }), "expect(page).toHaveURL(...)");
assert.equal(recommendationCode({}), "");

// 15. failDetail + guidance
const fd = failDetail({ errorCode: "BASE_URL_MISSING", errorMessage: "x", output: "log" });
assert.equal(fd.errorCode, "BASE_URL_MISSING");
assert.equal(fd.output, "log");
assert.match(guidanceFor("BASE_URL_MISSING"), /BASE_URL/);

console.log("Automation Run Diagnose test: PASS");
