import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

import AIAutomationCodegen from "../src/automation/ai/AIAutomationCodegen.js";
import FakeAIProvider from "./helpers/FakeAIProvider.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const codegenFile = path.join(__dirname, "fixtures", "playwright-codegen-Login.js");
const codegenText = fs.readFileSync(codegenFile, "utf8");

const tc001 = {
    id: "TC001",
    module: "Đăng nhập",
    feature: "Đăng nhập",
    title: "Đăng nhập hoạt động thành công với dữ liệu hợp lệ",
    type: "POSITIVE",
    steps: [
        { order: 1, action: "Nhập tài khoản" },
        { order: 2, action: "Nhập mật khẩu" },
        { order: 3, action: "Nhập mã xác nhận" },
        { order: 4, action: "Chọn Đăng nhập" }
    ],
    assertions: [
        { type: "AUTHENTICATED", target: "Đăng nhập", expected: "Người dùng đăng nhập thành công khi tài khoản và mật khẩu hợp lệ." }
    ]
};

const mapping = {
    testCaseId: "TC001",
    route: { source: "PLAYWRIGHT_CODEGEN", value: "/user/login", status: "MAPPED" },
    stepMappings: [
        { stepOrder: 1, businessStep: "Nhập tài khoản", actionType: "FILL", locator: "page.getByRole('textbox', { name: 'Tài khoản' })", status: "MAPPED" },
        { stepOrder: 2, businessStep: "Nhập mật khẩu", actionType: "FILL", locator: "page.getByRole('textbox', { name: 'Mật khẩu' })", status: "MAPPED" },
        { stepOrder: 3, businessStep: "Nhập mã xác nhận", actionType: "FILL", locator: "page.getByRole('textbox', { name: 'Mã xác nhận' })", status: "MAPPED" },
        { stepOrder: 4, businessStep: "Chọn Đăng nhập", actionType: "CLICK", locator: "page.getByRole('button', { name: 'Đăng nhập' })", status: "MAPPED" }
    ],
    assertionMappings: [
        { businessExpectation: "Người dùng đăng nhập thành công", playwrightAssertion: "await expect(page.getByRole('button', { name: 'adminButton' })).toBeVisible();", status: "MAPPED" }
    ]
};

const goodCode = `import { test, expect } from '@playwright/test';

test('TC001 - Đăng nhập hoạt động thành công với dữ liệu hợp lệ', async ({ page }) => {
  await page.goto(process.env.BASE_URL + '/user/login');

  const taikhoan = page.getByRole('textbox', { name: 'Tài khoản' });
  const matkhau = page.getByRole('textbox', { name: 'Mật khẩu' });
  const maxacnhan = page.getByRole('textbox', { name: 'Mã xác nhận' });
  const dangnhap = page.getByRole('button', { name: 'Đăng nhập' });

  await taikhoan.fill(process.env.LOGIN_USERNAME);
  await matkhau.fill(process.env.LOGIN_PASSWORD);
  await maxacnhan.fill('999999');
  await dangnhap.click();

  await expect(page.getByRole('button', { name: 'adminButton' })).toBeVisible();
});
`;

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
console.log(" STEP 2 — AI AUTOMATION CODEGEN TEST (FakeAIProvider)");
console.log("==================================================\n");

test("AIAutomationCodegen sinh code và validate đúng", async () => {
    const fake = new FakeAIProvider({ defaultResponse: goodCode });
    const codegen = new AIAutomationCodegen(fake, { env: { LOGIN_USERNAME: "admin", LOGIN_PASSWORD: "pw123" } });
    const { code, validation } = await codegen.generate({ testCase: tc001, mapping, codegenFile });
    assert.strictEqual(validation.ok, true, JSON.stringify(validation.errors));
    assert.ok(code.includes("import { test, expect }"), "có import");
    assert.ok(code.includes("process.env.LOGIN_USERNAME"), "dùng env username");
    assert.ok(code.includes("process.env.LOGIN_PASSWORD"), "dùng env password");
});

test("Code có syntax JS hợp lệ", () => {
    const tmp = path.join(__dirname, "..", "outputs", "generated", "_tmp_syntax.js");
    fs.mkdirSync(path.dirname(tmp), { recursive: true });
    fs.writeFileSync(tmp, goodCode);
    execFileSync(process.execPath, ["--check", tmp], { stdio: "pipe" });
    fs.rmSync(tmp, { force: true });
});

test("Codegen phát hiện hardcode credential", async () => {
    const badCode = goodCode.replace(
        "process.env.LOGIN_USERNAME",
        "'admin'"
    ).replace("process.env.LOGIN_PASSWORD", "'123456@Aa'");
    const fake = new FakeAIProvider({ defaultResponse: badCode });
    const codegen = new AIAutomationCodegen(fake, { env: { LOGIN_USERNAME: "admin", LOGIN_PASSWORD: "123456@Aa" } });
    const { validation } = await codegen.generate({ testCase: tc001, mapping, codegenFile });
    assert.strictEqual(validation.ok, false);
    assert.ok(validation.errors.some((e) => e.includes("hardcode") || e.includes("LOGIN_PASSWORD")));
});

test("Codegen phát hiện locator ngoài mapping", async () => {
    const badCode = goodCode.replace(
        "page.getByRole('textbox', { name: 'Tài khoản' })",
        "page.getByRole('textbox', { name: 'Không tồn tại' })"
    );
    const fake = new FakeAIProvider({ defaultResponse: badCode });
    const codegen = new AIAutomationCodegen(fake, { env: { LOGIN_USERNAME: "admin", LOGIN_PASSWORD: "pw123" } });
    const { validation } = await codegen.generate({ testCase: tc001, mapping, codegenFile });
    assert.strictEqual(validation.ok, false);
    assert.ok(validation.errors.some((e) => e.includes("locator ngoài mapping")));
});

test("Codegen phát hiện sample credential từ codegen", async () => {
    const badCode = goodCode.replace("process.env.LOGIN_PASSWORD", "'123456@Aa'");
    const fake = new FakeAIProvider({ defaultResponse: badCode });
    const codegen = new AIAutomationCodegen(fake, { env: { LOGIN_USERNAME: "admin", LOGIN_PASSWORD: "pw123" } });
    const { validation } = await codegen.generate({ testCase: tc001, mapping, codegenFile });
    assert.strictEqual(validation.ok, false);
});

test("Codegen không dùng provider không có generate()", () => {
    assert.throws(() => new AIAutomationCodegen({}));
});

// ---- 4 lỗi cần sửa: BASE_URL, CAPTCHA, credential false-positive, title TC001 ----

test("Lỗi 1: page.goto hardcode URL bị chặn (phải dùng process.env.BASE_URL)", async () => {
    const bad = goodCode.replace("page.goto(process.env.BASE_URL + '/user/login')", "page.goto('http://172.16.1.100:9230/user/login')");
    const fake = new FakeAIProvider({ defaultResponse: bad });
    const codegen = new AIAutomationCodegen(fake, { env: { LOGIN_USERNAME: "admin", LOGIN_PASSWORD: "pw123" } });
    const { validation } = await codegen.generate({ testCase: tc001, mapping, codegenFile });
    assert.strictEqual(validation.ok, false, JSON.stringify(validation.errors));
    assert.ok(validation.errors.some((e) => e.includes("process.env.BASE_URL") || e.includes("hardcode URL")), "phải chặn URL hardcode");
});

test("Lỗi 2: CAPTCHA dùng sample 123456 từ Codegen bị chặn", async () => {
    const bad = goodCode.replace("maxacnhan.fill('999999')", "maxacnhan.fill('123456')");
    const fake = new FakeAIProvider({ defaultResponse: bad });
    const codegen = new AIAutomationCodegen(fake, { env: { LOGIN_USERNAME: "admin", LOGIN_PASSWORD: "pw123" } });
    const { validation } = await codegen.generate({ testCase: tc001, mapping, codegenFile });
    assert.strictEqual(validation.ok, false, JSON.stringify(validation.errors));
    assert.ok(validation.errors.some((e) => e.includes("sample CAPTCHA")), "phải chặn captcha sample");
});

test("Lỗi 3: process.env.LOGIN_USERNAME/PASSWORD KHÔNG bị coi là hardcode (không false-positive)", async () => {
    const fake = new FakeAIProvider({ defaultResponse: goodCode });
    const codegen = new AIAutomationCodegen(fake, { env: { LOGIN_USERNAME: "admin", LOGIN_PASSWORD: "pw123" } });
    const { validation } = await codegen.generate({ testCase: tc001, mapping, codegenFile });
    assert.strictEqual(validation.ok, true, JSON.stringify(validation.errors));
    // không có lỗi nào nhắc hardcode credential
    assert.ok(!validation.errors.some((e) => e.includes("hardcode giá trị credential")), "không false-positive credential");
});

test("Lỗi 4: code thiếu testcase ID TC001 trong tiêu đề bị chặn", async () => {
    const bad = goodCode.replace("TC001 - Đăng nhập", "Đăng nhập");
    const fake = new FakeAIProvider({ defaultResponse: bad });
    const codegen = new AIAutomationCodegen(fake, { env: { LOGIN_USERNAME: "admin", LOGIN_PASSWORD: "pw123" } });
    const { validation } = await codegen.generate({ testCase: tc001, mapping, codegenFile });
    assert.strictEqual(validation.ok, false, JSON.stringify(validation.errors));
    assert.ok(validation.errors.some((e) => e.includes("TC001")), "phải báo thiếu TC001");
});

// ---- Local Acceptance: 2 false-positive từ máy local ----

test("Không false-positive URL khi goto dùng process.env.BASE_URL + route (kể cả có query)", async () => {
    // Trường hợp local thực tế: route chứa returnUrl (host nằm trong query, không phải đối số goto hardcode)
    const codeWithQuery = goodCode.replace(
        "page.goto(process.env.BASE_URL + '/user/login')",
        "page.goto(process.env.BASE_URL + '/user/login?returnUrl=http%3A%2F%2F172.16.1.100%3A9230%2F')"
    );
    const fake = new FakeAIProvider({ defaultResponse: codeWithQuery });
    const codegen = new AIAutomationCodegen(fake, { env: { LOGIN_USERNAME: "admin", LOGIN_PASSWORD: "pw123" } });
    const { validation } = await codegen.generate({ testCase: tc001, mapping, codegenFile });
    assert.ok(!validation.errors.some((e) => e.includes("hardcode URL")), JSON.stringify(validation.errors));
    assert.ok(!validation.errors.some((e) => e.includes("BASE_URL")), JSON.stringify(validation.errors));
});

test("Không false-positive credential khi code chỉ dùng process.env (giá trị env không phải string literal)", async () => {
    // env value giống substring của tên biến (từng gây false-positive do code.includes)
    const fake = new FakeAIProvider({ defaultResponse: goodCode });
    const codegen = new AIAutomationCodegen(fake, {
        env: { LOGIN_USERNAME: "LOGIN", LOGIN_PASSWORD: "PASSWORD" } // substring của tên biến process.env.LOGIN_USERNAME
    });
    const { validation } = await codegen.generate({ testCase: tc001, mapping, codegenFile });
    assert.strictEqual(validation.ok, true, JSON.stringify(validation.errors));
    assert.ok(!validation.errors.some((e) => e.includes("hardcode giá trị credential")), "không false-positive credential");
});

test("Vẫn chặn credential hardcode khi dùng string literal thật (fill('admin'))", async () => {
    const bad = goodCode.replace("process.env.LOGIN_USERNAME", "'admin'");
    const fake = new FakeAIProvider({ defaultResponse: bad });
    const codegen = new AIAutomationCodegen(fake, { env: { LOGIN_USERNAME: "admin", LOGIN_PASSWORD: "pw123" } });
    const { validation } = await codegen.generate({ testCase: tc001, mapping, codegenFile });
    assert.strictEqual(validation.ok, false, JSON.stringify(validation.errors));
    assert.ok(validation.errors.some((e) => e.includes("hardcode giá trị credential")), "chặn literal credential");
});

// ---- JS thuần, không TypeScript ----
test("Chặn TypeScript: non-null assertion process.env.X! (sinh JS không phải TS)", async () => {
    const tsCode = goodCode.replace("process.env.LOGIN_USERNAME", "process.env.LOGIN_USERNAME!");
    const fake = new FakeAIProvider({ defaultResponse: tsCode });
    const codegen = new AIAutomationCodegen(fake, { env: { LOGIN_USERNAME: "admin", LOGIN_PASSWORD: "pw123" } });
    const { validation } = await codegen.generate({ testCase: tc001, mapping, codegenFile });
    assert.strictEqual(validation.ok, false, JSON.stringify(validation.errors));
    assert.ok(validation.errors.some((e) => e.includes("non-null assertion") || e.includes("TypeScript")), "phải chặn TS");
});

test("Chặn TypeScript: type annotation ': string'", async () => {
    const tsCode = goodCode.replace("const taikhoan =", "const taikhoan: string =");
    const fake = new FakeAIProvider({ defaultResponse: tsCode });
    const codegen = new AIAutomationCodegen(fake, { env: { LOGIN_USERNAME: "admin", LOGIN_PASSWORD: "pw123" } });
    const { validation } = await codegen.generate({ testCase: tc001, mapping, codegenFile });
    assert.strictEqual(validation.ok, false, JSON.stringify(validation.errors));
    assert.ok(validation.errors.some((e) => e.includes("type annotation") || e.includes("TypeScript")), "phải chặn TS annotation");
});

test("JavaScript thuần (không TS) được chấp nhận", async () => {
    const fake = new FakeAIProvider({ defaultResponse: goodCode });
    const codegen = new AIAutomationCodegen(fake, { env: { LOGIN_USERNAME: "admin", LOGIN_PASSWORD: "pw123" } });
    const { validation } = await codegen.generate({ testCase: tc001, mapping, codegenFile });
    assert.strictEqual(validation.ok, true, JSON.stringify(validation.errors));
});

// ---- ES module, cấm require ----
test("Chặn require('@playwright/test') (CommonJS) — dự án ESM", async () => {
    const cjsCode = goodCode.replace(
        "import { test, expect } from '@playwright/test';",
        "const { test, expect } = require('@playwright/test');"
    );
    const fake = new FakeAIProvider({ defaultResponse: cjsCode });
    const codegen = new AIAutomationCodegen(fake, { env: { LOGIN_USERNAME: "admin", LOGIN_PASSWORD: "pw123" } });
    const { validation } = await codegen.generate({ testCase: tc001, mapping, codegenFile });
    assert.strictEqual(validation.ok, false, JSON.stringify(validation.errors));
    assert.ok(validation.errors.some((e) => e.includes("require") || e.includes("import")), "phải chặn require");
});

test("Code dùng import ES module được chấp nhận", async () => {
    const fake = new FakeAIProvider({ defaultResponse: goodCode });
    const codegen = new AIAutomationCodegen(fake, { env: { LOGIN_USERNAME: "admin", LOGIN_PASSWORD: "pw123" } });
    const { validation } = await codegen.generate({ testCase: tc001, mapping, codegenFile });
    assert.strictEqual(validation.ok, true, JSON.stringify(validation.errors));
    assert.ok(goodCode.includes("import { test, expect }"), "goodCode dùng import");
});

// ---- Validation testcase: chỉ yêu cầu env credential khi thực sự điền field ----
function makeMapping(stepTargets) {
    return {
        testCaseId: "TCX",
        route: { value: "/user/login", status: "APPROVED" },
        stepMappings: stepTargets.map((t, i) => ({
            stepOrder: i + 1,
            businessStep: `Bước ${i + 1}`,
            actionType: "FILL",
            target: t,
            locator: `page.getByRole('textbox', { name: '${t}' })`,
            status: "APPROVED"
        })),
        assertionMappings: []
    };
}

test("TC002 (bỏ trống Tài khoản): chỉ cần LOGIN_PASSWORD, không bắt buộc LOGIN_USERNAME", async () => {
    // Mapping: bỏ trống tài khoản (không điền) + nhập mật khẩu + nhập mã xác nhận
    const m = makeMapping(["Mã xác nhận", "Mật khẩu"]);
    // code chỉ dùng LOGIN_PASSWORD (không dùng LOGIN_USERNAME) — đúng cho TC002
    const code = goodCode.replace("process.env.LOGIN_USERNAME", "'không cần'");
    const fake = new FakeAIProvider({ defaultResponse: code });
    const codegen = new AIAutomationCodegen(fake, { env: { LOGIN_USERNAME: "admin", LOGIN_PASSWORD: "pw123" } });
    const { validation } = await codegen.generate({ testCase: tc001, mapping: m, codegenFile });
    assert.ok(!validation.errors.some((e) => e.includes("LOGIN_USERNAME")), "không yêu cầu LOGIN_USERNAME");
});

test("TC003 (bỏ trống Mật khẩu): chỉ cần LOGIN_USERNAME, không bắt buộc LOGIN_PASSWORD", async () => {
    const m = makeMapping(["Tài khoản", "Mã xác nhận"]);
    const code = goodCode.replace("process.env.LOGIN_PASSWORD", "'không cần'");
    const fake = new FakeAIProvider({ defaultResponse: code });
    const codegen = new AIAutomationCodegen(fake, { env: { LOGIN_USERNAME: "admin", LOGIN_PASSWORD: "pw123" } });
    const { validation } = await codegen.generate({ testCase: tc001, mapping: m, codegenFile });
    assert.ok(!validation.errors.some((e) => e.includes("LOGIN_PASSWORD")), "không yêu cầu LOGIN_PASSWORD");
});

test("Bước 'để trống Tài khoản' không bị coi là cần LOGIN_USERNAME", () => {
    const codegen = new AIAutomationCodegen(new FakeAIProvider({}), { env: {} });
    const m = {
        stepMappings: [
            { stepOrder: 1, businessStep: "Để trống Tài khoản", actionType: "FILL", target: "Tài khoản" },
            { stepOrder: 2, businessStep: "Nhập Mật khẩu hợp lệ", actionType: "FILL", target: "Mật khẩu" }
        ]
    };
    const env = codegen.requiredCredentialEnv(m);
    assert.ok(!env.has("LOGIN_USERNAME"), "để trống tài khoản -> không cần username");
    assert.ok(env.has("LOGIN_PASSWORD"), "nhập mật khẩu -> cần password");
});

// ---- Allowlist tuyệt đối: reject locator không thuộc approved mapping ----
test("REJECT: mapping có getByRole textbox Tài khoản, Gemini trả getByLabel('Username') -> reject", async () => {
    // approved mapping có locator getByRole('textbox', { name: 'Tài khoản' })
    const approvedMapping = {
        testCaseId: "TC001",
        route: { value: "/user/login", status: "APPROVED" },
        stepMappings: [
            { stepOrder: 1, actionType: "FILL", locator: "page.getByRole('textbox', { name: 'Tài khoản' })", status: "APPROVED" }
        ],
        assertionMappings: []
    };
    // Gemini trả code dùng getByLabel('Username') — KHÔNG có trong approved mapping
    const bad = goodCode.replace(
        "page.getByRole('textbox', { name: 'Tài khoản' })",
        "page.getByLabel('Username')"
    );
    const fake = new FakeAIProvider({ defaultResponse: bad });
    const codegen = new AIAutomationCodegen(fake, { env: { LOGIN_USERNAME: "admin", LOGIN_PASSWORD: "pw123" } });
    const { validation } = await codegen.generate({ testCase: tc001, mapping: approvedMapping, codegenFile });
    assert.strictEqual(validation.ok, false, JSON.stringify(validation.errors));
    assert.ok(validation.errors.some((e) => e.includes("KHÔNG thuộc approved mapping")), "phải reject getByLabel('Username')");
});

test("ACCEPT: code dùng đúng locator getByRole('textbox', { name: 'Tài khoản' }) trong approved mapping", async () => {
    const approvedMapping = {
        testCaseId: "TC001",
        route: { value: "/user/login", status: "APPROVED" },
        stepMappings: [
            { stepOrder: 1, actionType: "FILL", locator: "page.getByRole('textbox', { name: 'Tài khoản' })", status: "APPROVED" }
        ],
        assertionMappings: []
    };
    // code dùng đúng locator approved
    const ok = `import { test, expect } from '@playwright/test';\ntest('TC001 - login', async ({ page }) => {\n  await page.goto(process.env.BASE_URL + '/user/login');\n  await page.getByRole('textbox', { name: 'Tài khoản' }).fill(process.env.LOGIN_USERNAME);\n});\n`;
    const fake = new FakeAIProvider({ defaultResponse: ok });
    const codegen = new AIAutomationCodegen(fake, { env: { LOGIN_USERNAME: "admin", LOGIN_PASSWORD: "pw123" } });
    const { validation } = await codegen.generate({ testCase: tc001, mapping: approvedMapping, codegenFile });
    assert.strictEqual(validation.ok, true, JSON.stringify(validation.errors));
});

test("REJECT: mapping không có locator cho step -> code không nên tự thêm locator ngoài allowlist", async () => {
    const approvedMapping = {
        testCaseId: "TC001",
        route: { value: "/user/login", status: "APPROVED" },
        stepMappings: [
            // step này KHÔNG có locator approved
            { stepOrder: 1, actionType: "FILL", locator: null, status: "APPROVED" }
        ],
        assertionMappings: []
    };
    // Gemini tự đoán locator
    const bad = `import { test, expect } from '@playwright/test';\ntest('TC001 - x', async ({ page }) => {\n  await page.goto(process.env.BASE_URL + '/user/login');\n  await page.getByLabel('Mật khẩu').fill('123');\n});\n`;
    const fake = new FakeAIProvider({ defaultResponse: bad });
    const codegen = new AIAutomationCodegen(fake, { env: { LOGIN_USERNAME: "admin", LOGIN_PASSWORD: "pw123" } });
    const { validation } = await codegen.generate({ testCase: tc001, mapping: approvedMapping, codegenFile });
    assert.strictEqual(validation.ok, false, JSON.stringify(validation.errors));
    assert.ok(validation.errors.some((e) => e.includes("KHÔNG thuộc approved mapping")), "phải reject locator tự đoán");
});

console.log(`\n==================================================`);
if (failures === 0) console.log(" STEP 2 PASSED ✔");
else console.log(` ${failures} FAILURE(S) ✘`);
console.log("==================================================\n");
process.exit(failures === 0 ? 0 : 1);
