import assert from "node:assert/strict";
import {
    assertionMethod,
    assertionObject,
    interpretAssertion,
    analyzeExpectedCoverage,
    codegenStatus,
    automationStatus
} from "../web-ui/src/utils/assertionIntelligence.js";

/* Sprint 2 P0 — Drawer "Chi tiết testcase": AI diễn giải assertion + độ bao phủ. */

// 1. assertionMethod / assertionObject
assert.equal(assertionMethod("await expect(page.getByText('Lỗi')).toBeVisible();"), "toBeVisible");
assert.equal(assertionMethod("await expect(page).toHaveURL('https://app/dashboard');"), "toHaveURL");
assert.equal(assertionMethod("no assertion"), null);
assert.equal(assertionObject("page.getByText('Tài khoản hoặc mật khẩu không chính xác')"), "Tài khoản hoặc mật khẩu không chính xác");
assert.equal(assertionObject("page.getByRole('button', { name: 'Lưu' })"), 'button "Lưu"');

// 2. interpretAssertion
const vis = interpretAssertion({ playwrightAssertion: "await expect(page.getByText('Tài khoản hoặc mật khẩu không chính xác')).toBeVisible()" });
assert.equal(vis.kind, "Hiển thị");
assert.equal(vis.status, "MAPPED");
assert.match(vis.meaning, /hiển thị/);

const url = interpretAssertion({ playwrightAssertion: "await expect(page).toHaveURL('https://app/dashboard')" });
assert.equal(url.kind, "Xác nhận URL");
assert.match(url.meaning, /URL thay đổi/);

// 3. Coverage: expected "không cho phép đăng nhập" chỉ có assertion hiển thị thông báo
const cov1 = analyzeExpectedCoverage({
    expectedResult: "Hệ thống hiển thị thông báo lỗi và không cho phép đăng nhập",
    assertionMappings: [
        { playwrightAssertion: "await expect(page.getByText('Tài khoản hoặc mật khẩu không chính xác')).toBeVisible()" }
    ]
});
assert.ok(cov1.coverage > 0 && cov1.coverage < 100, "độ bao phủ không đầy đủ (message nhưng thiếu URL)");
assert.ok(cov1.missingChecks.some(c => c.dimension === "URL"), "thiếu kiểm tra URL");
assert.match(cov1.verdict, /chưa được assertion chứng minh/);

// 4. Coverage đầy đủ: expected thành công + toHaveURL
const cov2 = analyzeExpectedCoverage({
    expectedResult: "Người dùng đăng nhập thành công và được chuyển vào trang chính",
    assertionMappings: [
        { playwrightAssertion: "await expect(page).toHaveURL('https://app/dashboard')" },
        { playwrightAssertion: "await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()" }
    ]
});
assert.equal(cov2.coverage, 100, "URL + message chứng minh đủ");
assert.equal(cov2.missingChecks.length, 0);
assert.match(cov2.verdict, /đã chứng minh đủ/);

// 5. Không assertion
const cov0 = analyzeExpectedCoverage({ expectedResult: "X", assertionMappings: [] });
assert.equal(cov0.proved, false);
assert.equal(cov0.coverage, 0);

// 6. codegenStatus / automationStatus
assert.deepEqual(codegenStatus({ stepMappings: [{ codegenSource: "PLAYWRIGHT_CODEGEN" }], assertionMappings: [{}] }), { mapped: true, locatorFound: true, assertionFound: true });
assert.deepEqual(codegenStatus({ stepMappings: [{ codegenSource: "NOT_IN_CODEGEN" }] }), { mapped: true, locatorFound: false, assertionFound: false });
assert.deepEqual(codegenStatus(null), { mapped: false, locatorFound: false, assertionFound: false });
assert.equal(automationStatus({ generatedCode: "x", generatedFile: "a.spec.js" }).generated, true);
assert.equal(automationStatus({}).generated, false);

console.log("Assertion Intelligence test: PASS");
