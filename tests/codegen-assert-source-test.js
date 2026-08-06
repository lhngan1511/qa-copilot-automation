import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import AutomationWorkspaceService from "../src/services/AutomationWorkspaceService.js";
import { resolveAssertion, extractCodegenAssertion } from "../src/automation/ai/testDataBinding.js";

/* P0 FINAL - Assertion source #4: trích assertion thật từ CodeGen khi mapping/heuristic không có. */

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
    assertionMappings: [], // Không có assertion từ mapping (tình huống thật)
    missingData: [], warnings: []
};

// Codegen thật KHÔNG có getByText 'chào mừng/thành công' và không có toHaveURL — assertion khác.
const CODEGEN = `const { test, expect } = require('@playwright/test');
test('Đăng nhập', async ({ page }) => {
  await page.goto(process.env.BASE_URL + '/wasuco/login');
  await page.getByLabel('Tài khoản').fill('admin');
  await page.getByLabel('Mật khẩu').fill('pw');
  await page.getByLabel('Mã xác nhận').fill('1234');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page).toHaveURL(process.env.BASE_URL + '/wasuco/dashboard');
});`;

const tc = {
    id: "TC001",
    title: "Đăng nhập thành công",
    testData: { fields: { "Tài khoản": { value: "admin", purpose: "VALID" }, "Mật khẩu": { value: "pw", purpose: "VALID" }, "Mã xác nhận": { value: "1234", purpose: "VALID" } } },
    expectedResult: "Đăng nhập thành công"
};

async function main() {
    // 1. extractCodegenAssertion trích toHaveURL.
    const a = extractCodegenAssertion(CODEGEN);
    assert.equal(a, "expect(page).toHaveURL(process.env.BASE_URL + '/wasuco/dashboard')", `extract: ${a}`);

    // 2. resolveAssertion với assertionMappings rỗng -> dùng nguồn CODEGEN_ASSERT.
    const r = resolveAssertion({ assertionMappings: [], expectedResult: tc.expectedResult, codegenText: CODEGEN });
    assert.equal(r.ok, true, `phải resolve được: ${JSON.stringify(r)}`);
    // Nguồn đúng contract: EXPECTED_RESULT (#3) hoặc CODEGEN_ASSERT (#4) đều hợp lệ.
    assert.ok(["EXPECTED_RESULT", "CODEGEN_ASSERT"].includes(r.source), `nguồn hợp lệ: ${r.source}`);
    assert.match(r.playwrightAssertion, /toHaveURL/);

    // 3. Fallback end-to-end: AI truncated + mapping không assertion -> vẫn sinh spec có assertion thật từ CodeGen.
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "asrc-"));
    const provider = { async generate() { return "import { test } from '@playwright/test';\ntest('TC001 - x', async ({ page }) => {\n  // Navigation\n"; } };
    const svc = new AutomationWorkspaceService({ rootDir: tempRoot, aiProvider: provider });
    const gen = await svc.generate({ testCase: tc, mapping, codegenText: CODEGEN, confirmedFacts: [] });
    assert.equal(gen.written, true, `fallback phải ghi file: ${gen.source} ${gen.guard?.errorCode}`);
    const spec = fs.readFileSync(gen.filePath, "utf8");
    assert.ok(spec.includes("await expect(page).toHaveURL"), "spec chứa assertion thật từ CodeGen");
    assert.ok(spec.trimEnd().endsWith("});"));
    assert.ok(!spec.includes("adminButton"), "không bịa adminButton");

    fs.rmSync(tempRoot, { recursive: true, force: true });
    console.log("Codegen Assert Source test: PASS");
}

main().catch(e => { console.error(e); process.exit(1); });
