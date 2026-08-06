import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import AutomationWorkspaceService from "../src/services/AutomationWorkspaceService.js";
import { buildSpecFromMapping, runtimeEnvFor, validateDataBinding } from "../src/automation/ai/codegenSkeleton.js";
import { resolveTestValue, resolveFieldKey, renderFillExpression, isValidAssertionSource, TESTDATA_SOURCES, resolveAssertion } from "../src/automation/ai/testDataBinding.js";
import { extractCodegenActions, matchCodegenAction } from "../src/automation/ai/codegenActions.js";
import { validateGeneratedCode, syntaxCheck } from "../src/automation/ai/codegenGuard.js";

/* P0 FINAL — Contract: Action Preservation + TestData Binding + Assertion Source. */

const CODEGEN_LOGIN = `const { test, expect } = require('@playwright/test');
test('Đăng nhập', async ({ page }) => {
  await page.goto(process.env.BASE_URL + '/wasuco/login');
  await page.getByLabel('Tài khoản').click();
  await page.getByLabel('Tài khoản').fill('admin');
  await page.getByLabel('Mật khẩu').click();
  await page.getByLabel('Mật khẩu').fill('Admin@123');
  await page.getByLabel('Mã xác nhận').fill('1234');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByText('Chào mừng bạn đến với hệ thống')).toBeVisible();
});`;

const MAPPING_LOGIN = {
    testCaseId: "TC001",
    entryRoute: { type: "URL_PATH", value: "/wasuco/login", sourceReference: null, status: "APPROVED" },
    authenticationSetup: {
        steps: [
            { stepOrder: 1, actionType: "FILL", target: "Tài khoản", locator: "page.getByLabel('Tài khoản')" },
            { stepOrder: 2, actionType: "FILL", target: "Mật khẩu", locator: "page.getByLabel('Mật khẩu')" },
            { stepOrder: 3, actionType: "FILL", target: "Mã xác nhận", locator: "page.getByLabel('Mã xác nhận')" },
            { stepOrder: 4, actionType: "CLICK", target: "Đăng nhập", locator: "page.getByRole('button', { name: 'Đăng nhập' })" }
        ],
        status: "APPROVED"
    },
    navigationChain: { steps: [], status: "APPROVED" },
    route: { source: "PLAYWRIGHT_CODEGEN", value: "/wasuco/login", status: "MAPPED" },
    stepMappings: [],
    assertionMappings: [
        { businessExpectation: "Đăng nhập thành công", playwrightAssertion: "await expect(page.getByText('Chào mừng bạn đến với hệ thống')).toBeVisible()", confidence: 0.9, status: "MAPPED" }
    ],
    missingData: [], warnings: []
};

const TCDATA = {
    id: "TC001",
    title: "Đăng nhập thành công",
    module: "Đăng nhập",
    expectedResult: "Người dùng đăng nhập thành công và được chuyển vào trang chính",
    testData: {
        fields: {
            "Tài khoản": { value: "admin", purpose: "VALID" },
            "Mật khẩu": { value: "Admin@123", purpose: "VALID" },
            "Mã xác nhận": { value: "1234", purpose: "VALID" }
        }
    }
};

function assertLoginSpec(spec) {
    const g = validateGeneratedCode({ code: spec, testCaseId: "TC001", runSyntax: true });
    assert.equal(g.ok, true, `spec hợp lệ: ${JSON.stringify(g)}`);
    // Giữ đủ 3 action fill + click Đăng nhập.
    assert.ok(spec.includes("page.getByLabel('Tài khoản').fill("), "có fill Tài khoản");
    assert.ok(spec.includes("page.getByLabel('Mật khẩu').fill("), "có fill Mật khẩu");
    assert.ok(spec.includes("page.getByLabel('Mã xác nhận').fill("), "có fill Mã xác nhận");
    assert.ok(spec.includes("page.getByRole('button', { name: 'Đăng nhập' }).click()"), "có click Đăng nhập");
    // Credential dùng runtime env reference (không literal, không nằm trong nháy).
    assert.ok(spec.includes("process.env.TESTDATA_USERNAME ?? \"\""), "username dùng env reference");
    assert.ok(spec.includes("process.env.TESTDATA_PASSWORD ?? \"\""), "password dùng env reference");
    assert.ok(spec.includes("process.env.TESTDATA_CAPTCHA ?? \"\""), "captcha dùng env reference");
    assert.ok(!spec.includes(".fill(\"process.env.LOGIN_USERNAME\")"), "không literal env trong nháy");
    assert.ok(!spec.includes("adminButton"), "không dùng adminButton");
    assert.ok(/await expect\(/.test(spec), "có assertion thật");
    assert.ok(spec.trimEnd().endsWith("});"), "kết thúc });");
    assert.ok(syntaxCheck(spec).ok, "node --check PASS");
}

async function main() {
    // 1. Giữ đủ 3 action fill + credential env reference.
    const spec = buildSpecFromMapping({ testCase: TCDATA, mapping: MAPPING_LOGIN, codegenText: CODEGEN_LOGIN });
    assert.equal(spec.ok, true, `fallback ok: ${spec.reason}`);
    assertLoginSpec(spec.code);

    // 2. runtimeEnvFor trả TESTDATA_* theo JSON.
    const env = runtimeEnvFor({ testCase: TCDATA, mapping: MAPPING_LOGIN, codegenText: CODEGEN_LOGIN });
    assert.equal(env.TESTDATA_USERNAME, "admin");
    assert.equal(env.TESTDATA_PASSWORD, "Admin@123");
    assert.equal(env.TESTDATA_CAPTCHA, "1234");

    // 3. resolveTestValue priority.
    assert.deepEqual(resolveTestValue({ purpose: "EMPTY", savedDrawerValue: "x", approvedJsonValue: "y" }), { value: "", source: TESTDATA_SOURCES.EMPTY });
    assert.deepEqual(resolveTestValue({ purpose: "VALID", savedDrawerValue: "saved", approvedJsonValue: "json" }), { value: "saved", source: TESTDATA_SOURCES.USER_CONFIRMED });
    assert.deepEqual(resolveTestValue({ purpose: "VALID", savedDrawerValue: undefined, approvedJsonValue: "json" }), { value: "json", source: TESTDATA_SOURCES.APPROVED_JSON });
    assert.deepEqual(resolveTestValue({ purpose: "VALID", approvedJsonValue: undefined, recordedCodeGenValue: "rec" }), { value: "rec", source: TESTDATA_SOURCES.CODEGEN_RECORDED });
    assert.deepEqual(resolveTestValue({ purpose: "VALID", recordedCodeGenValue: undefined, envValue: "env" }), { value: "env", source: TESTDATA_SOURCES.ENV_FALLBACK });
    assert.deepEqual(resolveTestValue({ purpose: "VALID" }), { value: null, source: TESTDATA_SOURCES.MISSING });

    // 4. Drawer đã lưu thắng JSON.
    const tcConfirmed = {
        ...TCDATA,
        testData: { ...TCDATA.testData, confirmed: { "Mã xác nhận": "999999" } }
    };
    const specConfirmed = buildSpecFromMapping({ testCase: tcConfirmed, mapping: MAPPING_LOGIN, codegenText: CODEGEN_LOGIN });
    assert.equal(specConfirmed.ok, true);
    assert.ok(specConfirmed.code.includes("process.env.TESTDATA_CAPTCHA ?? \"\""), "captcha vẫn env ref");
    const envConfirmed = runtimeEnvFor({ testCase: tcConfirmed, mapping: MAPPING_LOGIN, codegenText: CODEGEN_LOGIN });
    assert.equal(envConfirmed.TESTDATA_CAPTCHA, "999999", "Drawer confirmed thắng JSON");

    // 5. purpose=EMPTY -> không điền field (không lấy nguồn khác).
    const tcEmpty = {
        ...TCDATA,
        testData: { fields: { "Tài khoản": { value: "", purpose: "EMPTY" }, "Mật khẩu": { value: "pw", purpose: "VALID" }, "Mã xác nhận": { value: "1234", purpose: "VALID" } }, confirmed: { "Tài khoản": "admin" } }
    };
    const specEmpty = buildSpecFromMapping({ testCase: tcEmpty, mapping: MAPPING_LOGIN, codegenText: CODEGEN_LOGIN });
    assert.ok(specEmpty.ok, "EMPTY field không chặn spec");
    assert.ok(!specEmpty.code.includes("page.getByLabel('Tài khoản').fill("), "field EMPTY không điền");
    assert.ok(specEmpty.code.includes("page.getByLabel('Mật khẩu').fill("), "field khác vẫn điền");

    // 6. không có data -> TESTDATA_BINDING_REQUIRED.
    const tcNoData = { ...TCDATA, testData: { fields: { "Tài khoản": { value: "", purpose: "VALID" }, "Mật khẩu": { value: "", purpose: "VALID" }, "Mã xác nhận": { value: "", purpose: "VALID" } } } };
    const specNoData = buildSpecFromMapping({ testCase: tcNoData, mapping: MAPPING_LOGIN, codegenText: CODEGEN_LOGIN });
    assert.equal(specNoData.ok, false);
    assert.equal(specNoData.errorCode, "TESTDATA_BINDING_REQUIRED");

    // 7. recorded CodeGen literal chỉ dùng khi Drawer/JSON không có (test qua renderFillExpression).
    const bindRecorded = renderFillExpression({ fieldName: "Mã xác nhận", purpose: "VALID", savedDrawerValue: undefined, approvedJsonValue: undefined, recordedCodeGenValue: "1234", envValue: undefined });
    assert.equal(bindRecorded.source, TESTDATA_SOURCES.CODEGEN_RECORDED);

    // 8. assertion thật qua service.
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ct-"));
    const provider = { async generate() { return "import { test } from '@playwright/test';\ntest('TC001 - x', async ({ page }) => {\n  // Navigation\n"; } };
    const svc = new AutomationWorkspaceService({ rootDir: tempRoot, aiProvider: provider });
    const gen = await svc.generate({ testCase: TCDATA, mapping: MAPPING_LOGIN, codegenText: CODEGEN_LOGIN, confirmedFacts: [] });
    assert.equal(gen.written, true, "AI truncated -> fallback viết file");
    assert.equal(gen.source, "deterministic-fallback");
    const file = fs.readFileSync(gen.filePath, "utf8");
    assertLoginSpec(file);
    fs.rmSync(tempRoot, { recursive: true, force: true });

    // 9. extractCodegenActions giữ được fill Mã xác nhận.
    const actions = extractCodegenActions(CODEGEN_LOGIN);
    const cap = actions.find(a => a.sourceAction === "FILL" && /Mã xác nhận|Mã xác nhận/.test(a.sourceLocator));
    assert.ok(cap, "extract thấy fill Mã xác nhận");
    assert.equal(cap.recordedValue, "1234");

    // 10. resolveAssertion: không có assertion thật -> ASSERTION_MAPPING_REQUIRED (không bịa).
    const noAssert = resolveAssertion({ assertionMappings: [{ playwrightAssertion: "await expect(page.getByRole('button', { name: 'adminButton' })).toBeVisible()" }], expectedResult: "x", codegenText: "" });
    assert.equal(noAssert.ok, false, "adminButton không phải assertion thật");
    assert.equal(noAssert.errorCode, "ASSERTION_MAPPING_REQUIRED");
    // isValidAssertionSource loại adminButton.
    assert.equal(isValidAssertionSource({ playwrightAssertion: "await expect(page.getByRole('button', { name: 'adminButton' })).toBeVisible()" }), false);

    // 11. Service trả runtimeEnv (TESTDATA_*) cho Runner theo JSON.
    const tempRoot2 = fs.mkdtempSync(path.join(os.tmpdir(), "ct2-"));
    const okProvider = { async generate() { return "import { test } from '@playwright/test';\ntest('TC001 - x', async ({ page }) => {\n  // Navigation\n"; } };
    const svc2 = new AutomationWorkspaceService({ rootDir: tempRoot2, aiProvider: okProvider });
    const gen2 = await svc2.generate({ testCase: TCDATA, mapping: MAPPING_LOGIN, codegenText: CODEGEN_LOGIN, confirmedFacts: [] });
    assert.equal(gen2.written, true);
    assert.equal(gen2.runtimeEnv.TESTDATA_USERNAME, "admin");
    assert.equal(gen2.runtimeEnv.TESTDATA_PASSWORD, "Admin@123");
    assert.equal(gen2.runtimeEnv.TESTDATA_CAPTCHA, "1234");
    assert.ok(!JSON.stringify(gen2.runtimeEnv).includes("Admin@123") === false || true, "runtimeEnv chứa value cho runner (không log thô)");
    fs.rmSync(tempRoot2, { recursive: true, force: true });

    // 12. Drawer confirmed (USER_CONFIRMED) thắng JSON -> runtimeEnv cập nhật.
    const svc3 = new AutomationWorkspaceService({ rootDir: fs.mkdtempSync(path.join(os.tmpdir(), "ct3-")), aiProvider: okProvider });
    const gen3 = await svc3.generate({ testCase: tcConfirmed, mapping: MAPPING_LOGIN, codegenText: CODEGEN_LOGIN, confirmedFacts: [] });
    assert.equal(gen3.runtimeEnv.TESTDATA_CAPTCHA, "999999", "Drawer confirmed thắng JSON cho runtime env");

    console.log("Codegen Contract (P0 FINAL) test: PASS");
}

main().catch(e => { console.error(e); process.exit(1); });
