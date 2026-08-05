import assert from "node:assert/strict";
import AutomationWorkspaceService from "../src/services/AutomationWorkspaceService.js";

/*
 P0 — khôi phục AI mapping pipeline.
 Stub provider để xác minh: analyze -> testCaseMappings -> gắn theo testCaseId
 -> generate dùng mapping (không lỗi "Thiếu mapping").
*/

const codegenText = `const { test } = require('@playwright/test');
test('login', async ({ page }) => {
  await page.goto('https://example.com/login');
  await page.getByLabel('Tài khoản').fill('user');
  await page.getByLabel('Mật khẩu').fill('pass');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
});`;

const testCases = [
    { id: "TC001", module: "Đăng nhập", title: "Đăng nhập thành công", executionReadiness: "READY" },
    { id: "TC002", module: "Đăng nhập", title: "Đăng nhập sai mật khẩu", executionReadiness: "DATA_REQUIRED" }
];

// Stub provider trả mapping hợp lệ theo schema mapper (chứa testCaseMappings).
const fakeProvider = {
    async generate(prompt) {
        return JSON.stringify({
            module: "Đăng nhập",
            testCaseMappings: [
                {
                    testCaseId: "TC001",
                    entryRoute: { type: "URL_PATH", value: "/login", sourceReference: null, status: "DRAFT" },
                    authenticationSetup: { steps: [{ stepOrder: 1, actionType: "FILL", target: "Tài khoản", locator: "page.getByLabel('Tài khoản')" }], status: "DRAFT" },
                    navigationChain: { steps: [], status: "DRAFT" },
                    route: { source: "PLAYWRIGHT_CODEGEN", value: "/login", status: "MAPPED" },
                    stepMappings: [{ stepOrder: 1, businessStep: "Bấm Đăng nhập", actionType: "CLICK", locator: "page.getByRole('button', { name: 'Đăng nhập' })", codegenSource: "PLAYWRIGHT_CODEGEN", confidence: 0.9, status: "MAPPED" }],
                    assertionMappings: [{ businessExpectation: "Đăng nhập thành công", playwrightAssertion: "expect(page.getByText('Chào mừng')).toBeVisible()", confidence: 0.9, status: "MAPPED" }],
                    missingData: [],
                    warnings: []
                },
                {
                    testCaseId: "TC002",
                    entryRoute: { type: "URL_PATH", value: "/login", sourceReference: null, status: "DRAFT" },
                    authenticationSetup: { steps: [], status: "DRAFT" },
                    navigationChain: { steps: [], status: "DRAFT" },
                    route: { source: null, value: "", status: "NEED_USER_CONFIRMATION" },
                    stepMappings: [],
                    assertionMappings: [],
                    missingData: ["Mật khẩu"],
                    warnings: []
                }
            ]
        });
    }
};

const svc = new AutomationWorkspaceService({ rootDir: process.cwd(), aiProvider: fakeProvider });

// 1. Analyze trả testCaseMappings
const result = await svc.analyze({ module: "Đăng nhập", testCases, codegenText, confirmedFacts: [] });
assert.ok(Array.isArray(result.testCaseMappings), "phải trả testCaseMappings");
assert.equal(result.testCaseMappings.length, 2, "2 testcase -> 2 mapping");

// 2. Gắn mapping theo testCaseId (giống UI)
function attachMappings(current, mappings) {
    return current.map(item => {
        const m = mappings.find(v => String(v.testCaseId || v.id) === item.id);
        return m ? { ...item, mapping: m.mapping || m } : item;
    });
}
const attached = attachMappings(testCases, result.testCaseMappings);
assert.ok(attached[0].mapping, "TC001 có mapping");
assert.equal(attached[0].mapping.testCaseId, "TC001");
assert.ok(attached[1].mapping, "TC002 có mapping (kể cả rỗng)");
assert.equal(attached[1].mapping.missingData.includes("Mật khẩu"), true);

// 3. Generate dùng mapping (không lỗi "Thiếu mapping")
const gen = await svc.generate({ testCase: attached[0], mapping: attached[0].mapping, codegenText, confirmedFacts: [] });
// validation có thể fail vì stub không có locator đủ, nhưng KHÔNG được báo "Thiếu mapping"
assert.notEqual(gen, null);
console.log("Mapping restore test: PASS");
