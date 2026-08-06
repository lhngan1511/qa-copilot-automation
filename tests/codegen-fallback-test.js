import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import AutomationWorkspaceService from "../src/services/AutomationWorkspaceService.js";
import { buildSpecFromMapping, setupPrefixLines, renderStepLine } from "../src/automation/ai/codegenSkeleton.js";
import { extractCodegenActions } from "../src/automation/ai/codegenActions.js";
import { validateGeneratedCode, syntaxCheck } from "../src/automation/ai/codegenGuard.js";

/* P0 BLOCKER — deterministic fallback + retry tối đa 1 lần khi AI truncated. */

const CODEGEN = `const { test, expect } = require('@playwright/test');
test('don vi tinh', async ({ page }) => {
  await page.getByLabel('Tài khoản').fill('admin');
  await page.getByLabel('Mật khẩu').fill('pw');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.getByLabel('Tên đơn vị tính').fill('Chiếc');
  await page.getByRole('button', { name: 'Lưu' }).click();
  await expect(page.getByText('Thêm mới thành công')).toBeVisible();
});`;

const mapping = {
    testCaseId: "TC001",
    entryRoute: { type: "URL_PATH", value: "/wasuco/danh-muc/don-vi-tinh", sourceReference: null, status: "APPROVED" },
    authenticationSetup: {
        steps: [
            { stepOrder: 1, actionType: "FILL", target: "Tài khoản", locator: "page.getByLabel('Tài khoản')" },
            { stepOrder: 2, actionType: "FILL", target: "Mật khẩu", locator: "page.getByLabel('Mật khẩu')" },
            { stepOrder: 3, actionType: "CLICK", target: "Đăng nhập", locator: "page.getByRole('button', { name: 'Đăng nhập' })" }
        ],
        status: "APPROVED"
    },
    navigationChain: { steps: [], status: "APPROVED" },
    route: { source: "PLAYWRIGHT_CODEGEN", value: "/wasuco/danh-muc/don-vi-tinh", status: "MAPPED" },
    stepMappings: [
        { stepOrder: 1, businessStep: "Nhập tên đơn vị tính", actionType: "FILL", target: "Tên đơn vị tính", locator: "page.getByLabel('Tên đơn vị tính')", confidence: 0.9, status: "MAPPED" },
        { stepOrder: 2, businessStep: "Bấm Lưu", actionType: "CLICK", target: "Lưu", locator: "page.getByRole('button', { name: 'Lưu' })", confidence: 0.9, status: "MAPPED" }
    ],
    assertionMappings: [
        { businessExpectation: "Thêm mới thành công", playwrightAssertion: "await expect(page.getByText('Thêm mới thành công')).toBeVisible()", confidence: 0.9, status: "MAPPED" }
    ],
    missingData: [], warnings: []
};

const testCase = {
    id: "TC001",
    title: "Thêm mới đơn vị tính thành công",
    module: "Danh mục đơn vị tính",
    testData: { fields: { "Tên đơn vị tính": { value: "Chiếc" }, "Mã đơn vị tính": { value: "DVT001" } } },
    expectedResult: "Đơn vị tính được tạo thành công"
};

async function main() {
    // Auth login creds qua runtime env (Runner sẽ set TESTDATA_*; ở đây giả lập .env).
    const oldU = process.env.TESTDATA_USERNAME, oldP = process.env.TESTDATA_PASSWORD;
    process.env.TESTDATA_USERNAME = "admin";
    process.env.TESTDATA_PASSWORD = "pw";

    // 1. buildSpecFromMapping sinh spec hợp lệ tổng quát (không hardcode Đăng nhập).
    const res = buildSpecFromMapping({ testCase, mapping, codegenText: CODEGEN });
    assert.equal(res.ok, true, `fallback ok: ${res.reason}`);
    const spec = res.code;
    const g = validateGeneratedCode({ code: spec, testCaseId: "TC001", runSyntax: true });
    assert.equal(g.ok, true, `fallback spec phải hợp lệ: ${JSON.stringify(g)}`);
    assert.ok(spec.includes("import { test, expect } from '@playwright/test';"));
    assert.ok(spec.includes("test(\"TC001 - Thêm mới đơn vị tính thành công\""));
    assert.ok(spec.includes("process.env.BASE_URL + \"/wasuco/danh-muc/don-vi-tinh\""));
    assert.ok(spec.includes("process.env.TESTDATA_USERNAME ?? \"\""), "Tài khoản -> runtime env (không literal)");
    assert.ok(spec.includes("page.getByLabel('Tên đơn vị tính').fill(\"Chiếc\")"), "business fill dùng testData");
    assert.ok(spec.includes("page.getByRole('button', { name: 'Lưu' }).click()"));
    assert.ok(spec.includes("await expect(page.getByText('Thêm mới thành công')).toBeVisible();"), "có assertion");
    assert.ok(spec.trimEnd().endsWith("});"), "kết thúc });");
    assert.ok(syntaxCheck(spec).ok, "node --check PASS");

    // 2. renderStepLine / setupPrefixLines.
    const stepTest = { ...testCase, testData: { fields: { "Tài khoản": { value: "admin" }, "Mật khẩu": { value: "pw" } } } };
    assert.equal(
        renderStepLine({ actionType: "FILL", target: "Tài khoản", locator: "page.getByLabel('Tài khoản')" }, { testCase: stepTest }),
        "  await page.getByLabel('Tài khoản').fill(process.env.TESTDATA_USERNAME ?? \"\");"
    );
    const setup = setupPrefixLines(mapping, { testCase: stepTest, codegenActions: extractCodegenActions(CODEGEN) });
    assert.ok(setup.length >= 3, "setup có goto + auth steps");

    // 3. Service: AI luôn truncated (cắt tại comment) -> retry đúng 1 lần -> fallback sinh file hợp lệ.
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cgf-"));
    let aiCalls = 0;
    const truncProvider = { async generate() {
        aiCalls += 1;
        return `import { test, expect } from '@playwright/test';\ntest('TC001 - x', async ({ page }) => {\n  await page.getByLabel('Tên đơn vị tính').fill('Chiếc');\n  // Navigation\n`;
    } };
    const svc = new AutomationWorkspaceService({ rootDir: tempRoot, aiProvider: truncProvider });
    const gen = await svc.generate({ testCase, mapping, codegenText: CODEGEN, confirmedFacts: [] });
    assert.equal(aiCalls, 2, "AI bị gọi tối đa 2 lần (1 + 1 retry), KHÔNG gọi lần 3");
    assert.equal(gen.source, "deterministic-fallback", "sau 2 lần truncated -> deterministic fallback");
    assert.equal(gen.written, true);
    assert.ok(gen.filePath && fs.existsSync(gen.filePath), "file được ghi");
    assert.deepEqual(gen.finishReasons, ["?", "?"], "ghi finishReasons cả 2 lần");
    const written = fs.readFileSync(gen.filePath, "utf8");
    assert.ok(written.trimEnd().endsWith("});"), "fallback file kết thúc });");
    assert.ok(written.includes("await expect"), "có assertion");
    assert.ok(syntaxCheck(written).ok, "node --check PASS");
    assert.equal(gen.guard?.ok, true, "guard PASS");

    fs.rmSync(tempRoot, { recursive: true, force: true });
    process.env.TESTDATA_USERNAME = oldU;
    process.env.TESTDATA_PASSWORD = oldP;
    console.log("Codegen Fallback test: PASS");
}

main().catch(e => { console.error(e); process.exit(1); });
