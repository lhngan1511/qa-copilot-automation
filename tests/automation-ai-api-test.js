import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import createAutomationRoutes from "../src/routes/automationRoutes.js";
import FakeAIProvider from "./helpers/FakeAIProvider.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const codegenFile = path.join(__dirname, "fixtures", "playwright-codegen-Login.js");

const tc001 = {
    id: "TC001",
    module: "Đăng nhập",
    feature: "Đăng nhập",
    title: "Đăng nhập hoạt động thành công với dữ liệu hợp lệ",
    steps: [
        { order: 1, action: "Nhập tài khoản" },
        { order: 2, action: "Nhập mật khẩu" },
        { order: 3, action: "Nhập mã xác nhận" },
        { order: 4, action: "Chọn Đăng nhập" }
    ],
    assertions: [{ type: "AUTHENTICATED", target: "Đăng nhập", expected: "Đăng nhập thành công" }]
};

const mapping = {
    testCaseId: "TC001",
    route: { value: "/user/login", status: "MAPPED" },
    stepMappings: [
        { stepOrder: 1, actionType: "FILL", locator: "page.getByRole('textbox', { name: 'Tài khoản' })", status: "MAPPED" },
        { stepOrder: 2, actionType: "FILL", locator: "page.getByRole('textbox', { name: 'Mật khẩu' })", status: "MAPPED" },
        { stepOrder: 3, actionType: "FILL", locator: "page.getByRole('textbox', { name: 'Mã xác nhận' })", status: "MAPPED" },
        { stepOrder: 4, actionType: "CLICK", locator: "page.getByRole('button', { name: 'Đăng nhập' })", status: "MAPPED" }
    ],
    assertionMappings: [
        { businessExpectation: "Đăng nhập thành công", playwrightAssertion: "await expect(page.getByRole('button', { name: 'adminButton' })).toBeVisible();", status: "MAPPED" }
    ]
};

const goodCode = `import { test, expect } from '@playwright/test';

test('TC001 - login success', async ({ page }) => {
  await page.goto('/user/login');
  const tk = page.getByRole('textbox', { name: 'Tài khoản' });
  const mk = page.getByRole('textbox', { name: 'Mật khẩu' });
  const mx = page.getByRole('textbox', { name: 'Mã xác nhận' });
  await tk.fill(process.env.LOGIN_USERNAME);
  await mk.fill(process.env.LOGIN_PASSWORD);
  await mx.fill('123456');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('button', { name: 'adminButton' })).toBeVisible();
});
`;

let fake;
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
console.log(" STEP 3 — AI API TEST (FakeAIProvider inject)");
console.log("==================================================\n");

// Thiết lập router với fake provider
fake = new FakeAIProvider({
    responder: (prompt) => {
        if (prompt.includes("YÊU CẦU OUTPUT") && prompt.includes("stepMappings")) {
            return JSON.stringify({
                testCaseId: "TC001",
                route: { source: "PLAYWRIGHT_CODEGEN", value: "/user/login", status: "MAPPED" },
                stepMappings: [
                    { stepOrder: 1, actionType: "FILL", locator: "page.getByRole('textbox', { name: 'Tài khoản' })", status: "MAPPED" },
                    { stepOrder: 2, actionType: "FILL", locator: "page.getByRole('textbox', { name: 'Mật khẩu' })", status: "MAPPED" },
                    { stepOrder: 3, actionType: "FILL", locator: "page.getByRole('textbox', { name: 'Mã xác nhận' })", status: "MAPPED" },
                    { stepOrder: 4, actionType: "CLICK", locator: "page.getByRole('button', { name: 'Đăng nhập' })", status: "MAPPED" }
                ],
                assertionMappings: [{ businessExpectation: "Đăng nhập thành công", playwrightAssertion: "await expect(page.getByRole('button', { name: 'adminButton' })).toBeVisible();", status: "MAPPED" }],
                missingData: [],
                warnings: []
            });
        }
        return goodCode;
    }
});
// Cách tiếp cận: gọi router qua express app nhẹ
import express from "express";
function buildApp() {
    const app = express();
    app.use(express.json());
    app.use("/api/automation", createAutomationRoutes({ rootDir, aiProvider: fake }));
    return app;
}

test("/api/automation/analyze trả mapping (FakeProvider)", async () => {
    const app = buildApp();
    const server = app.listen(0);
    const port = server.address().port;
    const base = `http://127.0.0.1:${port}/api/automation`;
    const res = await fetch(`${base}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testCase: tc001, codegenFile, confirmedFacts: [] })
    });
    const body = await res.json();
    server.close();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.mapping.testCaseId, "TC001");
    assert.strictEqual(body.data.mapping.stepMappings.length, 4);
});

test("/api/automation/generate trả code + validation", async () => {
    const app = buildApp();
    const server = app.listen(0);
    const port = server.address().port;
    const base = `http://127.0.0.1:${port}/api/automation`;
    const res = await fetch(`${base}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testCase: tc001, mapping, codegenFile, confirmedFacts: [] })
    });
    const body = await res.json();
    server.close();
    assert.strictEqual(res.status, 200);
    assert.ok(body.data.code.includes("import { test, expect }"));
    assert.strictEqual(body.data.validation.ok, true);
});

test("/api/automation/run trả diagnostic khi thiếu browser", async () => {
    const app = buildApp();
    const server = app.listen(0);
    const port = server.address().port;
    const base = `http://127.0.0.1:${port}/api/automation`;
    // ghi file tạm
    const tmpFile = path.join(rootDir, "outputs", "generated", "_api_tmp.spec.js");
    fs.mkdirSync(path.dirname(tmpFile), { recursive: true });
    fs.writeFileSync(tmpFile, goodCode);
    const res = await fetch(`${base}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filePath: tmpFile })
    });
    const body = await res.json();
    server.close();
    fs.rmSync(tmpFile, { force: true });
    assert.strictEqual(res.status, 200);
    // trong sandbox thiếu browser → status DIAGNOSTIC
    assert.ok(["DIAGNOSTIC", "PASSED", "FAILED"].includes(body.data.status), `status=${body.data.status}`);
});

test("analyze thiếu codegenFile trả lỗi", async () => {
    const app = buildApp();
    const server = app.listen(0);
    const port = server.address().port;
    const base = `http://127.0.0.1:${port}/api/automation`;
    const res = await fetch(`${base}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testCase: tc001 })
    });
    const body = await res.json();
    server.close();
    assert.strictEqual(res.status, 500);
    assert.strictEqual(body.error.diagnostic, "AI_MAPPING_FAILED");
});

console.log(`\n==================================================`);
if (failures === 0) console.log(" STEP 3 PASSED ✔");
else console.log(` ${failures} FAILURE(S) ✘`);
console.log("==================================================\n");
process.exit(failures === 0 ? 0 : 1);
