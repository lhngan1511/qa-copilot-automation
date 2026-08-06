import assert from "node:assert/strict";
import { selectSegmentAssertion, parseStatements, segmentIntoBlocks } from "../src/automation/ai/assertionSegment.js";
import { resolveAssertion } from "../src/automation/ai/testDataBinding.js";
import { buildSpecFromMapping } from "../src/automation/ai/codegenSkeleton.js";

/* P0 — Assertion phải được lấy theo đúng segment của testcase, không quét toàn file. */

// CodeGen gốc chứa NHIỀU testcase: TC001 login thành công + TC004 validation thiếu Mã xác nhận.
const CODEGEN = `const { test, expect } = require('@playwright/test');

test('TC001 - Đăng nhập thành công', async ({ page }) => {
  await page.goto(process.env.BASE_URL + '/wasuco/login');
  await page.getByLabel('Tài khoản').fill('admin');
  await page.getByLabel('Mật khẩu').fill('Admin@123');
  await page.getByLabel('Mã xác nhận').fill('1234');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByText('Chào mừng bạn đến với hệ thống')).toBeVisible();
});

test('TC004 - Bỏ trống Mã xác nhận', async ({ page }) => {
  await page.goto(process.env.BASE_URL + '/wasuco/login');
  await page.getByLabel('Tài khoản').fill('admin');
  await page.getByLabel('Mật khẩu').fill('Admin@123');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByText('Vui lòng nhập Mã xác nhận')).toBeVisible();
});`;

// Mapping TC001 (login thành công): main action = click Đăng nhập.
const MAPPING_TC001 = {
    testCaseId: "TC001",
    entryRoute: { type: "URL_PATH", value: "/wasuco/login", status: "APPROVED" },
    authenticationSetup: {
        steps: [
            { stepOrder: 1, actionType: "FILL", target: "Tài khoản", locator: "page.getByLabel('Tài khoản')" },
            { stepOrder: 2, actionType: "FILL", target: "Mật khẩu", locator: "page.getByLabel('Mật khẩu')" },
            { stepOrder: 3, actionType: "FILL", target: "Mã xác nhận", locator: "page.getByLabel('Mã xác nhận')" }
        ],
        status: "APPROVED"
    },
    navigationChain: { steps: [], status: "APPROVED" },
    route: { value: "/wasuco/login" },
    stepMappings: [
        { stepOrder: 4, actionType: "CLICK", target: "Đăng nhập", locator: "page.getByRole('button', { name: 'Đăng nhập' })" }
    ],
    assertionMappings: [],
    missingData: [], warnings: []
};

// Mapping TC004 (validation): main action cũng click Đăng nhập nhưng assertion khác.
const MAPPING_TC004 = {
    ...MAPPING_TC001,
    testCaseId: "TC004",
    stepMappings: [
        { stepOrder: 4, actionType: "CLICK", target: "Đăng nhập", locator: "page.getByRole('button', { name: 'Đăng nhập' })" }
    ],
    assertionMappings: []
};

function main() {
    // 1. Parse statements + block segmentation.
    const stmts = parseStatements(CODEGEN);
    const blocks = segmentIntoBlocks(stmts, CODEGEN);
    assert.ok(blocks.length >= 2, `có >=2 test block: ${blocks.length}`);
    assert.match(blocks[0].title, /TC001/);
    assert.match(blocks[1].title, /TC004/);

    // 2. TC001 không lấy assertion của TC004 ("Vui lòng nhập Mã xác nhận").
    const seg001 = selectSegmentAssertion({ mapping: MAPPING_TC001, codegenText: CODEGEN });
    assert.equal(seg001.ok, true, `TC001 có assertion: ${seg001.reason}`);
    assert.match(seg001.assertion, /Chào mừng bạn đến với hệ thống/, "TC001 dùng assertion của mình");
    assert.ok(!seg001.assertion.includes("Vui lòng nhập Mã xác nhận"), "KHÔNG lấy assertion TC004");
    assert.ok(seg001.segment.start < blocks[1].start, "segment TC001 trước block TC004");

    // 3. TC004 lấy assertion của chính nó.
    const seg004 = selectSegmentAssertion({ mapping: MAPPING_TC004, codegenText: CODEGEN });
    assert.equal(seg004.ok, true);
    assert.match(seg004.assertion, /Vui lòng nhập Mã xác nhận/, "TC004 dùng assertion của mình");
    assert.ok(!seg004.assertion.includes("Chào mừng"), "TC004 không lấy assertion TC001");

    // 4. resolveAssertion truyền đúng source CODEGEN_SEGMENT + mapping.
    const r001 = resolveAssertion({ assertionMappings: [], expectedResult: "Đăng nhập thành công", codegenText: CODEGEN, mapping: MAPPING_TC001, testCaseId: "TC001" });
    assert.equal(r001.ok, true);
    assert.equal(r001.source, "CODEGEN_SEGMENT", `source=${r001.source}`);
    assert.match(r001.playwrightAssertion, /Chào mừng/);

    // 5. Không có assertion đúng segment -> không tự đoán (ASSERTION_MAPPING_REQUIRED).
    const noAssertCodegen = `test('TC001 - x', async ({ page }) => {
  await page.goto(process.env.BASE_URL + '/x');
  await page.getByRole('button', { name: 'Lưu' }).click();
});`;
    const segNo = selectSegmentAssertion({ mapping: MAPPING_TC001, codegenText: noAssertCodegen });
    assert.equal(segNo.ok, false, "không assertion sau main action -> không tự đoán");
    assert.equal(segNo.assertion, null);
    const rNo = resolveAssertion({ assertionMappings: [], expectedResult: "x", codegenText: noAssertCodegen, mapping: MAPPING_TC001, testCaseId: "TC001" });
    assert.equal(rNo.ok, false);
    assert.equal(rNo.errorCode, "ASSERTION_MAPPING_REQUIRED");

    // 6. TC001 generated spec chạy tới assertion đúng (end-to-end qua buildSpecFromMapping).
    const tc001 = {
        id: "TC001", title: "Đăng nhập thành công", module: "Đăng nhập", expectedResult: "Đăng nhập thành công",
        testData: { fields: { "Tài khoản": { value: "admin", purpose: "VALID" }, "Mật khẩu": { value: "Admin@123", purpose: "VALID" }, "Mã xác nhận": { value: "1234", purpose: "VALID" } } }
    };
    const built = buildSpecFromMapping({ testCase: tc001, mapping: MAPPING_TC001, codegenText: CODEGEN });
    assert.equal(built.ok, true, `build ok: ${built.reason}`);
    assert.match(built.code, /Chào mừng bạn đến với hệ thống/, "spec dùng assertion đúng segment");
    assert.ok(!built.code.includes("Vui lòng nhập Mã xác nhận"), "spec KHÔNG chứa assertion TC004");
    assert.match(built.code, /page\.getByRole\('button', \{ name: 'Đăng nhập' \}\)\.click\(\)/);
    assert.ok(built.code.trimEnd().endsWith("});"));

    // 7. Success testcase, segment CHỈ có assertion lỗi -> KHÔNG tự chọn assertion lỗi (ASSERTION_MAPPING_REQUIRED).
    const errCodegen = `test('TC001 - Đăng nhập thành công', async ({ page }) => {
  await page.goto(process.env.BASE_URL + '/wasuco/login');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByText('Vui lòng nhập Mã xác nhận')).toBeVisible();
});`;
    const rErr = resolveAssertion({ assertionMappings: [], expectedResult: "Đăng nhập thành công", codegenText: errCodegen, mapping: MAPPING_TC001, testCaseId: "TC001", testCaseType: "POSITIVE" });
    assert.equal(rErr.ok, false, "success + error-only assertion -> không tự chọn assertion lỗi");
    assert.equal(rErr.errorCode, "ASSERTION_MAPPING_REQUIRED");

    // 8. NEGATIVE testcase, assertion lỗi trong segment là hợp lệ -> OK.
    const rNeg = resolveAssertion({ assertionMappings: [], expectedResult: "Hiển thị thông báo lỗi", codegenText: errCodegen, mapping: MAPPING_TC001, testCaseId: "TC001", testCaseType: "NEGATIVE" });
    assert.equal(rNeg.ok, true, "negative + error assertion -> dùng được");
    assert.match(rNeg.playwrightAssertion, /Vui lòng nhập Mã xác nhận/);

    console.log("Assertion Segment test: PASS");
}

main();
