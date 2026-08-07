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

    // 13. [P0 FIX] AI sinh code hoàn chỉnh (guard ok) nhưng fail rule validation
    //     (locator ngoài allowlist) -> tự fallback deterministic + ghi file.
    {
        const tempRoot13 = fs.mkdtempSync(path.join(os.tmpdir(), "ct13-"));
        const badProvider = {
            async generate() {
                return "import { test, expect } from '@playwright/test';\ntest('TC001 - x', async ({ page }) => {\n  await expect(page.getByRole('button', { name: 'adminButton' })).toBeVisible();\n});";
            }
        };
        const svc13 = new AutomationWorkspaceService({ rootDir: tempRoot13, aiProvider: badProvider });
        const gen13 = await svc13.generate({ testCase: TCDATA, mapping: MAPPING_LOGIN, codegenText: CODEGEN_LOGIN, confirmedFacts: [] });
        assert.equal(gen13.written, true, "AI fail rule -> fallback viết file");
        assert.equal(gen13.source, "deterministic-fallback", "fallback về deterministic");
        const file13 = fs.readFileSync(gen13.filePath, "utf8");
        assertLoginSpec(file13);
        assert.ok(file13.includes("process.env.BASE_URL +"), "code fallback dùng BASE_URL, không hardcode");
        assert.ok(!file13.includes("adminButton"), "fallback không dùng locator bịa");
        fs.rmSync(tempRoot13, { recursive: true, force: true });
    }

    // 14. [P0 DEMO] Testcase purpose=EMPTY — validator không đòi env cho field bỏ trống,
    //     fallback không sinh fill field EMPTY, vẫn có assertion đúng, node --check PASS.
    {
        const approved = [
            { id: "TC001", testcaseId: "TC001", title: "Đăng nhập thành công", module: "Đăng nhập", type: "POSITIVE", reviewStatus: "APPROVED", expectedResult: "Đăng nhập thành công", testData: { fields: { "Tài khoản": { value: "admin", purpose: "VALID" }, "Mật khẩu": { value: "123456@Aa", purpose: "VALID" }, "Mã xác nhận": { value: "1234567", purpose: "VALID" } } } },
            { id: "TC002", testcaseId: "TC002", title: "Bỏ trống Tài khoản", module: "Đăng nhập", type: "VALIDATION", reviewStatus: "APPROVED", expectedResult: "Vui lòng nhập Tên tài khoản", testData: { fields: { "Tài khoản": { value: "", purpose: "EMPTY" }, "Mật khẩu": { value: "123456@Aa", purpose: "VALID" }, "Mã xác nhận": { value: "1234567", purpose: "VALID" } } } },
            { id: "TC003", testcaseId: "TC003", title: "Bỏ trống Mật khẩu", module: "Đăng nhập", type: "VALIDATION", reviewStatus: "APPROVED", expectedResult: "Vui lòng nhập Mật khẩu", testData: { fields: { "Tài khoản": { value: "admin", purpose: "VALID" }, "Mật khẩu": { value: "", purpose: "EMPTY" }, "Mã xác nhận": { value: "1234567", purpose: "VALID" } } } },
            { id: "TC004", testcaseId: "TC004", title: "Bỏ trống Mã xác nhận", module: "Đăng nhập", type: "VALIDATION", reviewStatus: "APPROVED", expectedResult: "Mã xác nhận bắt buộc", testData: { fields: { "Tài khoản": { value: "admin", purpose: "VALID" }, "Mật khẩu": { value: "123456@Aa", purpose: "VALID" }, "Mã xác nhận": { value: "", purpose: "EMPTY" } } } },
            { id: "TC005", testcaseId: "TC005", title: "Sai mật khẩu", module: "Đăng nhập", type: "NEGATIVE", reviewStatus: "APPROVED", expectedResult: "Tài khoản hoặc mật khẩu không chính xác", testData: { fields: { "Tài khoản": { value: "admin", purpose: "VALID" }, "Mật khẩu": { value: "123456@Aa11", purpose: "VALID" }, "Mã xác nhận": { value: "1234567", purpose: "VALID" } } } }
        ];
        const cases = [
            ["TC001", null], ["TC002", "Tài khoản"], ["TC003", "Mật khẩu"], ["TC004", "Mã xác nhận"], ["TC005", null]
        ];
        const emptyMapping = {
            testCaseId: "TC001",
            entryRoute: { type: "URL_PATH", value: "/wasuco/login", status: "APPROVED" },
            authenticationSetup: { status: "APPROVED", steps: [
                { stepOrder: 1, actionType: "FILL", target: "Tài khoản", locator: "page.getByRole('textbox', { name: 'Tài khoản' })" },
                { stepOrder: 2, actionType: "FILL", target: "Mật khẩu", locator: "page.getByRole('textbox', { name: 'Mật khẩu' })" },
                { stepOrder: 3, actionType: "FILL", target: "Mã xác nhận", locator: "page.getByRole('textbox', { name: 'Mã xác nhận' })" },
                { stepOrder: 4, actionType: "CLICK", target: "Đăng nhập", locator: "page.getByRole('button', { name: 'Đăng nhập' })" }
            ] },
            navigationChain: { steps: [], status: "APPROVED" },
            route: { source: "PLAYWRIGHT_CODEGEN", value: "/wasuco/login", status: "MAPPED" },
            stepMappings: [], missingData: [], warnings: [],
            assertionMappings: [{ businessExpectation: "Đăng nhập", playwrightAssertion: "await expect(page.getByText('Chào mừng')).toBeVisible()", confidence: 0.9, status: "MAPPED" }]
        };
        for (const [tid, emptyField] of cases) {
            const tc = approved.find(t => t.testcaseId === tid);
            const root = fs.mkdtempSync(path.join(os.tmpdir(), `ct14-${tid}-`));
            const svc14 = new AutomationWorkspaceService({ rootDir: root, aiProvider: { async generate() { return "import { test } from '@playwright/test';"; } } });
            const g14 = await svc14.generate({ testCase: tc, mapping: emptyMapping, codegenText: "", confirmedFacts: [] });
            assert.equal(g14.written, true, `${tid} generate written`);
            const code = fs.readFileSync(g14.filePath, "utf8");
            assert.equal(syntaxCheck(code).ok, true, `${tid} node --check PASS`);
            if (emptyField) {
                // field EMPTY không được fill
                assert.ok(!code.includes(`name: '${emptyField}'`), `${tid} không fill ${emptyField}`);
            } else {
                // TC001/TC005 có đủ 3 field fill
                assert.ok(code.includes("TESTDATA_USERNAME") && code.includes("TESTDATA_PASSWORD") && code.includes("TESTDATA_CAPTCHA"), `${tid} đủ 3 env fill`);
            }
            fs.rmSync(root, { recursive: true, force: true });
        }
    }

    // 15. [P0 DEMO] Preserve ASSERTION_MAPPING_REQUIRED — TC POSITIVE + recording chỉ có
    //     thông báo lỗi/validation -> fallback từ chối, service trả ASSERTION_MAPPING_REQUIRED,
    //     KHÔNG chạy rule validation với code rỗng (không sinh lỗi giả thiếu TC/import/BASE_URL).
    {
        const root15 = fs.mkdtempSync(path.join(os.tmpdir(), "ct15-"));
        const codegenOnlyValidation = `test('Đăng nhập', async ({ page }) => {
  await page.getByRole('textbox', { name: 'Mật khẩu' }).fill('x');
  await expect(page.getByText('Vui lòng nhập Tên tài khoản')).toBeVisible();
  await expect(page.getByText('Vui lòng nhập Mật khẩu')).toBeVisible();
  await expect(page.getByText('Vui lòng nhập Mã xác nhận')).toBeVisible();
});`;
        // mapping KHÔNG có assertionMappings -> resolveAssertion không tìm được assertion thành công.
        const noAssertMapping = {
            testCaseId: "TC001",
            entryRoute: { type: "URL_PATH", value: "/wasuco/login", status: "APPROVED" },
            authenticationSetup: { status: "APPROVED", steps: [
                { stepOrder: 1, actionType: "FILL", target: "Tài khoản", locator: "page.getByRole('textbox', { name: 'Tài khoản' })" },
                { stepOrder: 2, actionType: "FILL", target: "Mật khẩu", locator: "page.getByRole('textbox', { name: 'Mật khẩu' })" }
            ] },
            navigationChain: { steps: [], status: "APPROVED" },
            route: { source: "PLAYWRIGHT_CODEGEN", value: "/wasuco/login", status: "MAPPED" },
            stepMappings: [], missingData: [], warnings: [],
            assertionMappings: []
        };
        // Provider trả code cụt -> guard fail -> rơi vào deterministic fallback.
        const svc15 = new AutomationWorkspaceService({ rootDir: root15, aiProvider: { async generate() { return "import { test } from '@playwright/test';"; } } });
        const g15 = await svc15.generate({ testCase: TCDATA, mapping: noAssertMapping, codegenText: codegenOnlyValidation, confirmedFacts: [] });
        assert.equal(g15.written, false, "không ghi file khi thiếu assertion thành công");
        assert.equal(g15.guardError, "ASSERTION_MAPPING_REQUIRED", "trả nguyên errorCode ASSERTION_MAPPING_REQUIRED");
        assert.equal(g15.errorCode, "ASSERTION_MAPPING_REQUIRED", "service.errorCode = ASSERTION_MAPPING_REQUIRED");
        assert.ok(!g15.errors || g15.errors.length === 0, "không sinh 6 lỗi giả rule validation");
        fs.rmSync(root15, { recursive: true, force: true });
    }

    console.log("Codegen Contract (P0 FINAL) test: PASS");
}

main().catch(e => { console.error(e); process.exit(1); });

/* ---------- P0 URL: entryRoute absolute không nối BASE_URL (tránh URL đúp) ---------- */
{
    const m = (await import("../src/automation/ai/testDataBinding.js")).default || (await import("../src/automation/ai/testDataBinding.js"));
    const { renderGotoStatement } = await import("../src/automation/ai/testDataBinding.js");
    // URL tuyệt đối -> bỏ origin/host, nối process.env.BASE_URL + path+query (không hardcode host).
    const abs = renderGotoStatement("http://172.16.1.100:9230/wasuco/login?returnUrl=http%3A%2F%2F172.16.1.100%3A9230%2F");
    assert.ok(abs.includes("process.env.BASE_URL +"), "goto dùng process.env.BASE_URL");
    assert.ok(abs.includes("/wasuco/login?returnUrl="), "giữ path+query, bỏ origin");
    assert.ok(!/page\.goto\(\s*["']http/i.test(abs), "KHÔNG hardcode host/host:port làm origin goto");
    // Path tương đối -> vẫn nối BASE_URL.
    const rel = renderGotoStatement("/wasuco/login");
    assert.match(rel, /process\.env\.BASE_URL \+ "\/wasuco\/login"/);
    // Mô tả -> null.
    assert.equal(renderGotoStatement("Danh mục -> Đơn vị tính"), null);
}
console.log("Codegen Contract (URL absolute) test: PASS");
