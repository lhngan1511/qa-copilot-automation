import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import AIAutomationMapper, { extractJson } from "../src/automation/ai/AIAutomationMapper.js";
import FakeAIProvider from "./helpers/FakeAIProvider.js";
import { extractCodegenLocators, buildCodegenLocatorSet, isLocatorInCodegen } from "../src/automation/ai/locatorValidation.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const codegenFile = path.join(__dirname, "fixtures", "playwright-codegen-Login.js");
const codegenText = fs.readFileSync(codegenFile, "utf8");
const loginFile = path.join(__dirname, "fixtures", "dang-nhap-approved-testcases.json");
const loginData = JSON.parse(fs.readFileSync(loginFile, "utf8"));
const testCases = Array.isArray(loginData) ? loginData : loginData.testCases.map((x) => x.originalTestCase ?? x);
const tc001 = testCases.find((t) => t.id === "TC001");
const confirmedFacts = [
    {
        factId: "CF-LOGIN-CAPTCHA-001",
        target: "Mã xác nhận",
        value: "ARBITRARY_NON_EMPTY_TEXT",
        sourceType: "TESTER_INPUT",
        status: "CONFIRMED"
    }
];

let failures = 0;
function test(name, fn) {
    try {
        fn();
        console.log(`  ✔ ${name}`);
    } catch (e) {
        failures++;
        console.error(`  ✘ ${name}`);
        console.error(`    ${e.message}`);
    }
}

console.log("\n==================================================");
console.log(" STEP 1 — AI AUTOMATION MAPPER TEST (FakeAIProvider)");
console.log("==================================================\n");

// locatorValidation
test("extractCodegenLocators trích được locator từ codegen thật", () => {
    const locs = extractCodegenLocators(codegenText);
    assert.ok(locs.some((l) => l.includes("getByRole") && l.includes("Tài khoản")), "có locator Tài khoản");
    assert.ok(locs.some((l) => l.includes("getByRole") && l.includes("Đăng nhập")), "có locator Đăng nhập");
});

test("isLocatorInCodegen nhận diện locator có trong codegen", () => {
    const set = buildCodegenLocatorSet(codegenText);
    assert.ok(isLocatorInCodegen("page.getByRole('textbox', { name: 'Tài khoản' })", set), "Tài khoản nằm trong codegen");
    assert.ok(isLocatorInCodegen("page.getByRole('button', { name: 'Đăng nhập' })", set), "Đăng nhập nằm trong codegen");
    assert.ok(!isLocatorInCodegen("page.getByRole('button', { name: 'Nút không tồn tại' })", set), "locator giả không nằm trong codegen");
});

// extractJson
test("extractJson parse JSON có code fence", () => {
    const r = extractJson('```json\n{"a":1}\n```');
    assert.deepStrictEqual(r, { a: 1 });
});

// Mapper with Fake provider
test("AIAutomationMapper map TC001 và validate locator trong codegen", async () => {
    const fake = new FakeAIProvider({
        responder: (prompt) => {
            // assert prompt chứa testcase + codegen + confirmed facts
            assert.ok(prompt.includes("TC001"), "prompt chứa testcase");
            assert.ok(prompt.includes("getByRole"), "prompt chứa codegen");
            assert.ok(prompt.includes("CF-LOGIN-CAPTCHA-001"), "prompt chứa confirmed fact");
            return JSON.stringify({
                testCaseId: "TC001",
                route: { source: "PLAYWRIGHT_CODEGEN", value: "/user/login", status: "MAPPED" },
                stepMappings: [
                    { stepOrder: 1, businessStep: "Nhập tài khoản", actionType: "FILL", locator: "page.getByRole('textbox', { name: 'Tài khoản' })", codegenSource: "PLAYWRIGHT_CODEGEN", confidence: 0.98, status: "MAPPED", reason: "" },
                    { stepOrder: 2, businessStep: "Nhập mật khẩu", actionType: "FILL", locator: "page.getByRole('textbox', { name: 'Mật khẩu' })", codegenSource: "PLAYWRIGHT_CODEGEN", confidence: 0.98, status: "MAPPED", reason: "" },
                    { stepOrder: 3, businessStep: "Nhập mã xác nhận", actionType: "FILL", locator: "page.getByRole('textbox', { name: 'Mã xác nhận' })", codegenSource: "PLAYWRIGHT_CODEGEN", confidence: 0.9, status: "MAPPED", reason: "" },
                    { stepOrder: 4, businessStep: "Chọn Đăng nhập", actionType: "CLICK", locator: "page.getByRole('button', { name: 'Đăng nhập' })", codegenSource: "PLAYWRIGHT_CODEGEN", confidence: 0.98, status: "MAPPED", reason: "" }
                ],
                assertionMappings: [
                    { businessExpectation: "Người dùng đăng nhập thành công", playwrightAssertion: "expect(page.getByRole('button', { name: 'adminButton' })).toBeVisible()", codegenSource: "PLAYWRIGHT_CODEGEN", confidence: 0.9, status: "MAPPED" }
                ],
                missingData: [],
                warnings: []
            });
        }
    });
    const mapper = new AIAutomationMapper(fake, { codegenFile });
    const mapping = await mapper.map({ testCase: tc001, codegenFile, confirmedFacts });
    assert.strictEqual(mapping.testCaseId, "TC001");
    assert.strictEqual(mapping.stepMappings.length, 4);
    assert.strictEqual(mapping.stepMappings[0].locator.includes("Tài khoản"), true);
    assert.strictEqual(mapping.stepMappings.every((s) => s.codegenSource === "PLAYWRIGHT_CODEGEN"), true);
});

test("AIAutomationMapper loại locator không có trong codegen (fake locator)", async () => {
    const fake = new FakeAIProvider({
        defaultResponse: JSON.stringify({
            testCaseId: "TC001",
            route: { source: "CONFIRMED_FACT", value: "/user/login", status: "MAPPED" },
            stepMappings: [
                { stepOrder: 1, businessStep: "Nhập tài khoản", actionType: "FILL", locator: "page.getByRole('textbox', { name: 'Không tồn tại' })", confidence: 0.5, status: "MAPPED", reason: "" }
            ],
            assertionMappings: [],
            missingData: [],
            warnings: []
        })
    });
    const mapper = new AIAutomationMapper(fake, { codegenFile });
    const mapping = await mapper.map({ testCase: tc001, codegenFile, confirmedFacts });
    assert.strictEqual(mapping.stepMappings[0].status, "NEED_USER_CONFIRMATION");
    assert.strictEqual(mapping.stepMappings[0].codegenSource, "NOT_IN_CODEGEN");
    assert.ok(mapping.warnings.some((w) => w.includes("KHÔNG có trong Codegen")));
});

test("Mapper không dùng provider không có generate()", () => {
    assert.throws(() => new AIAutomationMapper({}));
});

console.log(`\n==================================================`);
if (failures === 0) console.log(" STEP 1 PASSED ✔");
else console.log(` ${failures} FAILURE(S) ✘`);
console.log("==================================================\n");
process.exit(failures === 0 ? 0 : 1);
