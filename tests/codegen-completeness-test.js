import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import AIAutomationCodegen from "../src/automation/ai/AIAutomationCodegen.js";
import AutomationWorkspaceService from "../src/services/AutomationWorkspaceService.js";
import {
    extractFencedCode,
    validateGeneratedCode,
    hasMojibake,
    isBalanced,
    hasTestDeclaration,
    hasClosedTestBlock,
    syntaxCheck
} from "../src/automation/ai/codegenGuard.js";

/* P0 — Generated spec không bị cắt cụt / hỏng UTF-8. */

const mapping = {
    testCaseId: "TC001",
    entryRoute: { type: "URL_PATH", value: "/wasuco/login", sourceReference: null, status: "APPROVED" },
    authenticationSetup: { steps: [], status: "APPROVED" },
    navigationChain: { steps: [], status: "APPROVED" },
    route: { source: "PLAYWRIGHT_CODEGEN", value: "/wasuco/login", status: "MAPPED" },
    stepMappings: [
        { stepOrder: 1, businessStep: "Nhập tài khoản", actionType: "FILL", locator: "page.getByLabel('Tài khoản')", confidence: 0.9, status: "MAPPED" },
        { stepOrder: 2, businessStep: "Bấm Đăng nhập", actionType: "CLICK", locator: "page.getByRole('button', { name: 'Đăng nhập' })", confidence: 0.9, status: "MAPPED" }
    ],
    assertionMappings: [
        { businessExpectation: "Đăng nhập thành công", playwrightAssertion: "await expect(page.getByText('Chào mừng')).toBeVisible()", confidence: 0.9, status: "MAPPED" }
    ],
    missingData: [], warnings: []
};

const VALID_CODE = `import { test, expect } from '@playwright/test';
test('TC001 - Đăng nhập thành công', async ({ page }) => {
  await page.goto(process.env.BASE_URL + '/wasuco/login');
  await page.getByLabel('Tài khoản').fill('admin');
  await page.getByLabel('Mật khẩu').fill('secret');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByText('Chào mừng')).toBeVisible();
});`;

// Mapping tối giản để validateCode (allowlist/credential) PASS, chỉ qua guard.
const SIMPLE_MAPPING = {
    testCaseId: "TC001",
    entryRoute: { type: "URL_PATH", value: "/wasuco/login", sourceReference: null, status: "APPROVED" },
    authenticationSetup: { steps: [], status: "APPROVED" },
    navigationChain: { steps: [], status: "APPROVED" },
    route: { source: "PLAYWRIGHT_CODEGEN", value: "/wasuco/login", status: "MAPPED" },
    stepMappings: [],
    assertionMappings: [
        { businessExpectation: "Đăng nhập thành công", playwrightAssertion: "await expect(page.getByText('Chào mừng')).toBeVisible()", confidence: 0.9, status: "MAPPED" }
    ],
    missingData: [], warnings: []
};

const VALID_SIMPLE_CODE = `import { test, expect } from '@playwright/test';
test('TC001 - Đăng nhập thành công', async ({ page }) => {
  await page.goto(process.env.BASE_URL + '/wasuco/login');
  await expect(page.getByText('Chào mừng')).toBeVisible();
});`;

async function main() {
    // 1. extractFencedCode: Markdown fence -> lấy đầy đủ.
    const fenced = "```js\n" + VALID_CODE + "\n```";
    assert.equal(extractFencedCode(fenced), VALID_CODE.trim(), "fence extract phải đầy đủ");

    // 2. validateGeneratedCode:
    //    a. response đầy đủ UTF-8 -> ok.
    const good = validateGeneratedCode({ code: VALID_CODE, runSyntax: true });
    assert.equal(good.ok, true, `code hợp lệ phải ok: ${JSON.stringify(good)}`);
    //    b. cắt tại comment // Navigation -> reject (AI_CODEGEN_TRUNCATED).
    const cut = VALID_CODE.replace(/await expect[\s\S]*$/m, "  // Navigation");
    const cutRes = validateGeneratedCode({ code: cut, runSyntax: false });
    assert.equal(cutRes.ok, false);
    assert.equal(cutRes.errorCode, "AI_CODEGEN_TRUNCATED", "cắt tại comment -> TRUNCATED");
    //    c. thiếu }); -> reject.
    const noClose = VALID_CODE.replace(/\}\);\s*$/, "");
    const noCloseRes = validateGeneratedCode({ code: noClose, runSyntax: false });
    assert.equal(noCloseRes.ok, false);
    assert.equal(noCloseRes.errorCode, "AI_CODEGEN_TRUNCATED");
    //    d. mojibake -> reject GENERATED_CODE_ENCODING_ERROR.
    const moji = VALID_CODE.replace("Đăng nhập thành công", "ÄĐƒng nháº­p thÃ nh cÃ´ng");
    const mojiRes = validateGeneratedCode({ code: moji, runSyntax: false });
    assert.equal(mojiRes.ok, false);
    assert.equal(mojiRes.errorCode, "GENERATED_CODE_ENCODING_ERROR", "mojibake -> ENCODING_ERROR");
    //    e. syntax lỗi -> AI_CODEGEN_SYNTAX_ERROR (cân bằng ngoặc nhưng cú pháp sai).
    const badSyntax = VALID_CODE + "\nconst = ;\n";
    const badSyntaxRes = validateGeneratedCode({ code: badSyntax, runSyntax: true });
    assert.equal(badSyntaxRes.ok, false);
    assert.equal(badSyntaxRes.errorCode, "AI_CODEGEN_SYNTAX_ERROR");

    // 3. hasMojibake / balance / test declarations.
    assert.equal(hasMojibake("Tài khoản"), false);
    assert.equal(hasMojibake("TÃ i khoáº£n"), true);
    assert.equal(isBalanced(VALID_CODE), true);
    assert.equal(hasTestDeclaration(VALID_CODE), true);
    assert.equal(hasClosedTestBlock(VALID_CODE), true);
    assert.ok(syntaxCheck(VALID_CODE).ok, "node --check PASS cho code hợp lệ");

    // 4. Service: AI trả mojibake -> KHÔNG ghi code hỏng; deterministic fallback sinh file hợp lệ (UTF-8 đúng).
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cg-" ));
    const mojiCode = VALID_SIMPLE_CODE.replace("Đăng nhập thành công", "ÄĐƒng nháº­p thÃ nh cÃ´ng");
    const mojiProvider = { async generate() { return mojiCode; } };
    const svc = new AutomationWorkspaceService({ rootDir: tempRoot, aiProvider: mojiProvider });
    const gen = await svc.generate({ testCase: { id: "TC001", module: "Đăng nhập" }, mapping: SIMPLE_MAPPING, codegenText: "x", confirmedFacts: [] });
    assert.equal(gen.written, true, "fallback phải ghi file hợp lệ");
    assert.ok(gen.filePath && fs.existsSync(gen.filePath), "fallback tạo file");
    assert.equal(gen.source, "deterministic-fallback", "AI hỏng -> dùng deterministic fallback");
    const writtenMoji = fs.readFileSync(gen.filePath, "utf8");
    assert.ok(!hasMojibake(writtenMoji), "file fallback không bị mojibake");
    assert.ok(syntaxCheck(writtenMoji).ok, "fallback node --check PASS");

    // 5. Service: response đầy đủ UTF-8 -> ghi file, đọc lại chứa đúng tiếng Việt.
    const goodProvider = { async generate() { return VALID_SIMPLE_CODE; } };
    const svc2 = new AutomationWorkspaceService({ rootDir: tempRoot, aiProvider: goodProvider });
    const gen2 = await svc2.generate({ testCase: { id: "TC001", module: "Đăng nhập" }, mapping: SIMPLE_MAPPING, codegenText: "x", confirmedFacts: [] });
    assert.equal(gen2.written, true);
    assert.ok(gen2.filePath && fs.existsSync(gen2.filePath), "file được ghi");
    assert.equal(gen2.source, "ai", "AI hợp lệ -> dùng code AI");
    const written = fs.readFileSync(gen2.filePath, "utf8");
    assert.ok(written.includes("Đăng nhập"), "file chứa 'Đăng nhập'");
    assert.ok(written.includes("Chào mừng"), "file chứa tiếng Việt đúng");
    assert.ok(written.trimEnd().endsWith("});"), "file kết thúc hợp lệ");
    assert.ok(syntaxCheck(written).ok, "node --check PASS sau khi ghi");

    fs.rmSync(tempRoot, { recursive: true, force: true });
    console.log("Codegen Completeness/UTF-8 test: PASS");
}

main().catch(e => { console.error(e); process.exit(1); });
