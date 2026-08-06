import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import AutomationWorkspaceService from "../src/services/AutomationWorkspaceService.js";

/*
 Sprint 2 — Pipeline end-to-end (stub provider): analyze → generate → export.
 - analyze: provider trả module mapping JSON đúng schema mapper.
 - generate: provider trả mã Playwright.
 - export: ghi selected-testcases.json.
 KHÔNG cần Gemini/browser thật.
*/

const codegenText = `const { test, expect } = require('@playwright/test');
test('Đăng nhập', async ({ page }) => {
  await page.goto(process.env.BASE_URL + '/login');
  await page.getByLabel('Tài khoản').fill('admin');
  await page.getByLabel('Mật khẩu').fill('secret');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByText('Chào mừng')).toBeVisible();
});`;

const fakeProvider = {
    async generate(prompt) {
        if (String(prompt).includes("testCaseMappings")) {
            // Phản hồi module mapping cho analyze
            return JSON.stringify({
                module: "Đăng nhập",
                testCaseMappings: [
                    {
                        testCaseId: "TC001",
                        entryRoute: { type: "URL_PATH", value: "/login", sourceReference: null, status: "APPROVED" },
                        authenticationSetup: {
                            steps: [
                                { stepOrder: 1, actionType: "FILL", target: "Tài khoản", locator: "page.getByLabel('Tài khoản')", sourceReference: null },
                                { stepOrder: 2, actionType: "FILL", target: "Mật khẩu", locator: "page.getByLabel('Mật khẩu')", sourceReference: null }
                            ],
                            status: "APPROVED"
                        },
                        navigationChain: { steps: [], status: "BLOCKED" },
                        route: { source: "PLAYWRIGHT_CODEGEN", value: "/login", status: "MAPPED" },
                        stepMappings: [
                            { stepOrder: 3, businessStep: "Bấm Đăng nhập", actionType: "CLICK", locator: "page.getByRole('button', { name: 'Đăng nhập' })", confidence: 0.92, status: "MAPPED" }
                        ],
                        assertionMappings: [
                            { businessExpectation: "Đăng nhập thành công", playwrightAssertion: "await expect(page.getByText('Chào mừng')).toBeVisible()", confidence: 0.9, status: "MAPPED" }
                        ],
                        missingData: [],
                        warnings: []
                    },
                    {
                        testCaseId: "TC002",
                        entryRoute: { type: "URL_PATH", value: "/login", sourceReference: null, status: "DRAFT" },
                        authenticationSetup: { steps: [], status: "BLOCKED" },
                        navigationChain: { steps: [], status: "BLOCKED" },
                        route: { source: null, value: "", status: "NEED_USER_CONFIRMATION" },
                        stepMappings: [],
                        assertionMappings: [],
                        missingData: [],
                        warnings: ["Không có mapping trả về cho TC002 — cần review."]
                    }
                ]
            });
        }
        return `import { test, expect } from '@playwright/test';
test('TC001 - Đăng nhập', async ({ page }) => {
  await page.goto(process.env.BASE_URL + '/login');
  await page.getByLabel('Tài khoản').fill('admin');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByText('Chào mừng')).toBeVisible();
});`;
    }
};

const testCases = [
    { id: "TC001", testcaseId: "TC001", module: "Đăng nhập", feature: "Đăng nhập", title: "Đăng nhập thành công", type: "POSITIVE", testData: { fields: { "Tài khoản": { value: "admin" }, "Mật khẩu": { value: "secret" } } } },
    { id: "TC002", testcaseId: "TC002", module: "Đăng nhập", feature: "Đăng nhập", title: "Sai mật khẩu", type: "NEGATIVE", testData: {} }
];

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "s2-"));
const svc = new AutomationWorkspaceService({ rootDir: tempRoot, aiProvider: fakeProvider });

const analyzeResult = await svc.analyze({ module: "Đăng nhập", testCases, codegenText, confirmedFacts: [] });
assert.ok(Array.isArray(analyzeResult.testCaseMappings), "analyze phải trả testCaseMappings");
assert.equal(analyzeResult.testCaseMappings.length, 2, "có mapping cho cả 2 testcase (TC002 rỗng + cảnh báo)");

const tc1Mapping = analyzeResult.testCaseMappings.find(m => m.testCaseId === "TC001");
assert.equal(tc1Mapping.stepMappings[0].businessStep, "Bấm Đăng nhập");
assert.equal(tc1Mapping.stepMappings[0].codegenSource, "PLAYWRIGHT_CODEGEN");

// Generate TC001
const gen = await svc.generate({ testCase: testCases[0], mapping: tc1Mapping, codegenText, confirmedFacts: [] });
assert.equal(gen.validation?.ok, true);
assert.ok(gen.filePath && fs.existsSync(gen.filePath), "spec.js được sinh");

// Export TC001 + TC002 (đã chọn)
const exp = await svc.exportSelected({ module: "Đăng nhập", testCases: [testCases[0], testCases[1]] });
assert.equal(exp.count, 2);
assert.ok(fs.existsSync(path.join(tempRoot, "outputs", "automation-export", "selected-testcases.json")));

fs.rmSync(tempRoot, { recursive: true, force: true });
console.log("Automation Pipeline (Sprint 2, stub) test: PASS");
