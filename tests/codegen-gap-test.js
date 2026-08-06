import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import AutomationWorkspaceService from "../src/services/AutomationWorkspaceService.js";
import { validateGeneratedCode, syntaxCheck } from "../src/automation/ai/codegenGuard.js";
import { extractCodegenAssertion, isValidAssertionSource } from "../src/automation/ai/testDataBinding.js";

/* P0 BLOCKER — khoảng đứt CODEGEN_EXTRACTED → rule validation → CODEGEN_WRITE.
   Fallback ok=true nhưng trước đây bị validateCode (locator allowlist) reject thầm lặng, không ghi file. */

const mapping = {
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
    // KHÔNG có assertionMappings — assertion sẽ lấy từ CodeGen (giống log thật).
    assertionMappings: [],
    missingData: [], warnings: []
};

const CODEGEN = `const { test, expect } = require('@playwright/test');
test('Đăng nhập', async ({ page }) => {
  await page.goto(process.env.BASE_URL + '/wasuco/login');
  await page.getByLabel('Tài khoản').fill('admin');
  await page.getByLabel('Mật khẩu').fill('pw');
  await page.getByLabel('Mã xác nhận').fill('1234');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByText('Đăng nhập thành công')).toBeVisible();
});`;

const tc = {
    id: "TC001",
    title: "Đăng nhập thành công",
    module: "Đăng nhập",
    testData: { fields: { "Tài khoản": { value: "admin", purpose: "VALID" }, "Mật khẩu": { value: "pw", purpose: "VALID" }, "Mã xác nhận": { value: "1234", purpose: "VALID" } } },
    expectedResult: "Đăng nhập thành công"
};

async function main() {
    // 1. fallback ok + rule validation ok -> file được ghi (exists=true, node --check PASS).
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "gap-"));
    const provider = { async generate() { return "import { test } from '@playwright/test';\ntest('TC001 - x', async ({ page }) => {\n  // Navigation\n"; } };
    const svc = new AutomationWorkspaceService({ rootDir: tempRoot, aiProvider: provider });
    const gen = await svc.generate({ testCase: tc, mapping, codegenText: CODEGEN, confirmedFacts: [] });
    assert.equal(gen.written, true, `fallback + rule ok phải ghi file: ${gen.errorCode} ${JSON.stringify(gen.errors)}`);
    assert.equal(gen.source, "deterministic-fallback");
    assert.equal(gen.exists, true, "exists=true");
    assert.ok(gen.filePath && fs.existsSync(gen.filePath), "file tồn tại thật");
    const spec = fs.readFileSync(gen.filePath, "utf8");
    assert.ok(spec.trimEnd().endsWith("});"), "kết thúc });");
    assert.ok(syntaxCheck(spec).ok, "node --check PASS");
    assert.ok(/await expect\(/.test(spec), "có assertion thật");

    // 2. Assertion CodeGen thật được giữ nguyên (không ghép, không bịa).
    assert.ok(spec.includes("expect(page.getByText('Đăng nhập thành công')).toBeVisible()"), "assertion nguyên vẹn từ CodeGen");
    assert.ok(!spec.includes("Đăng nhập Mã xác nhận"), "không ghép label thành expected text");

    // 3. Fallback bị validator reject -> trả error rõ (không nuốt lỗi).
    //    Tạo codegen KHÔNG có assertion -> fallback trả ASSERTION_MAPPING_REQUIRED.
    const noAssertCg = "await page.getByRole('button', { name: 'Đăng nhập' }).click();\nawait page.getByRole('table');";
    const svc2 = new AutomationWorkspaceService({ rootDir: tempRoot, aiProvider: provider });
    const gen2 = await svc2.generate({ testCase: tc, mapping, codegenText: noAssertCg, confirmedFacts: [] });
    assert.equal(gen2.written, false, "thiếu assertion -> không ghi file");
    assert.equal(gen2.guard?.errorCode, "ASSERTION_MAPPING_REQUIRED", "báo rõ lỗi assertion");

    // 4. Internal key (adminButton/locatorKey) bị reject; thông báo lỗi hợp lệ (chứa nhiều field name) KHÔNG bị reject.
    assert.equal(isValidAssertionSource({ playwrightAssertion: "await expect(page.getByRole('button', { name: 'adminButton' })).toBeVisible()" }), false);
    assert.equal(isValidAssertionSource({ playwrightAssertion: "await expect(page.getByText('Tài khoản hoặc mật khẩu không')).toBeVisible()" }), true);
    assert.equal(isValidAssertionSource({ playwrightAssertion: "await expect(page.getByText('Đăng nhập thành công')).toBeVisible()" }), true);

    // 5. extractCodegenAssertion trích nguyên statement.
    const a = extractCodegenAssertion(CODEGEN);
    assert.equal(a, "expect(page.getByText('Đăng nhập thành công')).toBeVisible()");

    fs.rmSync(tempRoot, { recursive: true, force: true });
    console.log("Codegen Gap test: PASS");
}

main().catch(e => { console.error(e); process.exit(1); });
