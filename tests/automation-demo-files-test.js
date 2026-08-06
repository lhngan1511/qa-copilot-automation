import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import AutomationWorkspaceService from "../src/services/AutomationWorkspaceService.js";
import { extractCodegenLocators } from "../src/automation/ai/locatorValidation.js";

/*
 Kiểm tra 2 bộ file demo (Đăng nhập, Đơn vị tính) có thể đi trọn pipeline
 Upload → AI Mapping → Generate → Export (stub provider).
 Mục đích: đảm bảo file mẫu mà tester tải lên ở bước ① không bị lỗi schema
 và locator trong CodeGen.js thực sự được mapper nhận diện.
*/

const demos = {
    "dang-nhap": {
        module: "Đăng nhập",
        expectedTitles: ["Đăng nhập thành công", "Đăng nhập thất bại"]
    },
    "don-vi-tinh": {
        module: "Danh mục đơn vị tính",
        expectedTitles: ["Thêm mới đơn vị tính", "Tìm kiếm đơn vị tính"]
    }
};

function buildStubProvider(codegenText) {
    // Dùng locator thật từ codegen để mapping có codegenSource = PLAYWRIGHT_CODEGEN
    const locators = extractCodegenLocators(codegenText);
    // Sinh code hợp lệ: ES module, dùng đúng locator thuộc allowlist (locators[0]),
    // goto dùng process.env.BASE_URL, không hardcode credential/URL.
    const first = locators[0];
    const compliantCode = `import { test, expect } from '@playwright/test';
test('TC001 - demo', async ({ page }) => {
  await page.goto(process.env.BASE_URL + '/wasuco/login');
  await ${first}.fill('demo_value');
  await expect(page).toHaveURL(process.env.BASE_URL + '/wasuco/home');
});`;
    return {
        locators,
        async generate(prompt) {
            if (String(prompt).includes("testCaseMappings")) {
                return JSON.stringify({
                    module: "DEMO",
                    testCaseMappings: [
                        {
                            testCaseId: "TC001",
                            entryRoute: { type: "URL_PATH", value: "/wasuco/login", sourceReference: null, status: "APPROVED" },
                            authenticationSetup: { steps: [], status: "APPROVED" },
                            navigationChain: { steps: [], status: "APPROVED" },
                            route: { source: "PLAYWRIGHT_CODEGEN", value: "/wasuco/login", status: "MAPPED" },
                            stepMappings: locators.slice(0, 1).map((locator, i) => ({
                                stepOrder: i + 1,
                                businessStep: `Thao tác ${i + 1}`,
                                actionType: "FILL",
                                locator,
                                confidence: 0.9,
                                status: "MAPPED"
                            })),
                            assertionMappings: [
                                { businessExpectation: "Thành công", playwrightAssertion: "await expect(page).toHaveURL(process.env.BASE_URL + '/wasuco/home')", confidence: 0.9, status: "MAPPED" }
                            ],
                            missingData: [],
                            warnings: []
                        }
                    ]
                });
            }
            return compliantCode;
        }
    };
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "demo-"));
let allPassed = true;

for (const [key, meta] of Object.entries(demos)) {
    const dir = path.join("data/demo", key);
    const testCases = JSON.parse(fs.readFileSync(path.join(dir, "approved-testcases.json"), "utf8"));
    const codegenText = fs.readFileSync(path.join(dir, "codegen.js"), "utf8");

    // 1. Schema: mảng + mọi testcase có id
    assert.ok(Array.isArray(testCases), `${key}: file phải là mảng`);
    assert.ok(testCases.length >= 2, `${key}: nên có >= 2 testcase`);
    testCases.forEach((tc, i) => {
        assert.ok(String(tc.id ?? tc.testcaseId ?? "").trim(), `${key}: testcase ${i} thiếu ID`);
    });

    // 2. CodeGen.js phải có locator mapper nhận diện được
    const locators = extractCodegenLocators(codegenText);
    assert.ok(locators.length > 0, `${key}: CodeGen.js không có locator nào mapper nhận diện`);

    // 3. Trọn pipeline: analyze → generate → export
    const svc = new AutomationWorkspaceService({ rootDir: tempRoot, aiProvider: buildStubProvider(codegenText) });
    const analyzeResult = await svc.analyze({ module: meta.module, testCases, codegenText, confirmedFacts: [] });
    assert.ok(Array.isArray(analyzeResult.testCaseMappings), `${key}: analyze trả testCaseMappings`);
    const mapping = analyzeResult.testCaseMappings.find(m => m.testCaseId === "TC001");
    assert.ok(mapping, `${key}: có mapping TC001`);
    assert.equal(mapping.stepMappings[0].codegenSource, "PLAYWRIGHT_CODEGEN", `${key}: locator phải thuộc codegen`);

    const gen = await svc.generate({ testCase: testCases[0], mapping, codegenText, confirmedFacts: [] });
    assert.equal(gen.validation?.ok, true, `${key}: generate phải ok`);
    assert.ok(gen.filePath && fs.existsSync(gen.filePath), `${key}: spec.js được sinh`);

    const exp = await svc.exportSelected({ module: meta.module, testCases });
    assert.equal(exp.count, testCases.length, `${key}: export đủ testcase`);

    console.log(`Demo [${key}] OK: ${testCases.length} testcase, ${locators.length} locator nhận diện, pipeline pass`);
}

fs.rmSync(tempRoot, { recursive: true, force: true });
assert.ok(allPassed);
console.log("Automation Demo Files test: PASS");
