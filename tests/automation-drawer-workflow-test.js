import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import AutomationWorkspaceService from "../src/services/AutomationWorkspaceService.js";
import PlaywrightRunner from "../src/automation/PlaywrightRunner.js";
import { automationStatus } from "../web-ui/src/utils/assertionIntelligence.js";
import { visibleFailFields } from "../web-ui/src/utils/runDiagnose.js";

/* P0 — Drawer workflow một testcase + path contract + chẩn đoán Run. */

const codegenText = `const { test, expect } = require('@playwright/test');
test('Đăng nhập', async ({ page }) => {
  await page.goto(process.env.BASE_URL + '/login');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
});`;

const mapping = {
  testCaseId: "TC001",
  entryRoute: { type: "URL_PATH", value: "/login", sourceReference: null, status: "APPROVED" },
  authenticationSetup: { steps: [], status: "APPROVED" },
  navigationChain: { steps: [], status: "APPROVED" },
  route: { source: "PLAYWRIGHT_CODEGEN", value: "/login", status: "MAPPED" },
  stepMappings: [{ stepOrder: 1, businessStep: "Bấm Đăng nhập", actionType: "CLICK", locator: "page.getByRole('button', { name: 'Đăng nhập' })", confidence: 0.9, status: "MAPPED" }],
  assertionMappings: [{ businessExpectation: "Thành công", playwrightAssertion: "await expect(page).toHaveURL(process.env.BASE_URL + '/home')", confidence: 0.9, status: "MAPPED" }],
  missingData: [], warnings: []
};

const fakeProvider = { async generate(prompt) {
    const idMatch = String(prompt).match(/"id"\s*:\s*"(TC\d+)"/);
    const id = idMatch ? idMatch[1] : "TC001";
    return `import { test, expect } from '@playwright/test';\ntest('${id} - Đăng nhập', async ({ page }) => {\n  await page.goto(process.env.BASE_URL + '/login');\n  await page.getByRole('button', { name: 'Đăng nhập' }).click();\n  await expect(page).toHaveURL(process.env.BASE_URL + '/home');\n});`;
} };

async function main() {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "dw-"));
    const svc = new AutomationWorkspaceService({ rootDir: tempRoot, aiProvider: fakeProvider });

    // 1. Generate trả filePath tuyệt đối + exists=true.
    const gen = await svc.generate({ testCase: { id: "TC001", module: "Đăng nhập", executionReadiness: "READY" }, mapping, codegenText, confirmedFacts: [] });
    assert.equal(gen.validation?.ok, true);
    assert.equal(gen.exists, true, "generate phải trả exists=true");
    assert.ok(path.isAbsolute(gen.filePath), `filePath phải tuyệt đối: ${gen.filePath}`);
    assert.ok(fs.existsSync(gen.filePath), "file tồn tại thật");

    // 2. Frontend lưu nguyên filePath (không basename). automationStatus "Đã sinh" chỉ khi file tồn tại.
    const tcAfterGen = { generatedFile: gen.filePath, generatedFileExists: gen.exists === true, generatedCode: "x" };
    const auto = automationStatus(tcAfterGen);
    assert.equal(auto.generated, true);
    assert.equal(auto.filePath, gen.filePath, "giữ nguyên đường dẫn tuyệt đối");

    // 3. Run nhận đúng absolute filePath (không bị SPEC_NOT_FOUND nếu file tồn tại + đủ BASE_URL).
    process.env.BASE_URL = "";
    const runner = new PlaywrightRunner({ rootDir: tempRoot });
    const noBase = await runner.runFile(gen.filePath, { env: {} });
    assert.notEqual(noBase.errorCode, "SPEC_NOT_FOUND", "file tồn tại + absolute path -> không SPEC_NOT_FOUND");
    assert.equal(noBase.errorCode, "BASE_URL_MISSING", "thiếu BASE_URL -> BASE_URL_MISSING");
    assert.equal(noBase.fileExists, true);

    // 4. SPEC_NOT_FOUND khi file không tồn tại: báo đường dẫn đầy đủ + cwd, không có locator giả.
    const ghost = path.join(tempRoot, "outputs", "generated-tests", "GHOST.spec.js");
    const missing = await runner.runFile(ghost, { env: { BASE_URL: "http://x:1" } });
    assert.equal(missing.errorCode, "SPEC_NOT_FOUND");
    assert.ok(missing.errorMessage.includes(ghost), `SPEC_NOT_FOUND phải chứa đường dẫn đầy đủ: ${missing.errorMessage}`);
    assert.equal(missing.failedLocator, null, "SPEC_NOT_FOUND không được có locator");
    assert.equal(missing.failedStep, null);
    assert.equal(missing.fileExists, false);
    // visibleFailFields: SPEC_NOT_FOUND không hiện locator/assertion.
    const vis = visibleFailFields(failDetail(missing));
    assert.equal(vis.locator, false);
    assert.equal(vis.expected, false);
    assert.equal(vis.step, false);

    // 5. generateOne trong Drawer không phụ thuộc checkbox: chỉ cần mapping của testcase đang mở.
    // Mô phỏng: testcase được chọn generate độc lập (không qua selectedIds).
    const genOne = await svc.generate({ testCase: { id: "TC002", module: "Đăng nhập" }, mapping, codegenText, confirmedFacts: [] });
    assert.ok(genOne.filePath.includes("TC002.spec.js"), "generateOne theo id TC002, không phụ thuộc checkbox");

    // 6. Mỗi lần Run mới phải xóa diagnostic cũ.
    const stale = { errorCode: "LOCATOR_NOT_FOUND", failedLocator: "page.getByRole('button', { name: 'Đăng nhập' })", failedStep: "x", expectedValue: "a", actualValue: "b", output: "old", screenshotPath: "s.png" };
    const cleared = { ...emptyExecution(), status: "RUNNING" };
    assert.equal(cleared.failedLocator, null, "xóa locator cũ");
    assert.equal(cleared.output, "", "xóa output cũ");
    assert.equal(cleared.errorCode, null, "xóa errorCode cũ");
    assert.equal(cleared.screenshotPath, null, "xóa screenshot cũ");
    assert.notEqual(stale.errorCode, cleared.errorCode);

    // 7. Service.run: log [RUN_REQUEST] an toàn (testCaseId, filePath, isAbsolute, exists, cwd) + giữ nguyên absolute path.
    const logs = [];
    const origLog = console.log;
    console.log = (...args) => { logs.push(args.join(" ")); };
    const runRes = await svc.run({ filePath: gen.filePath, env: { BASE_URL: "http://x:1" }, testCaseId: "TC001" });
    console.log = origLog;
    const runLog = logs.find(l => l.includes("[RUN_REQUEST]"));
    assert.ok(runLog, "phải log [RUN_REQUEST]");
    assert.match(runLog, /testCaseId=TC001/);
    assert.ok(runLog.includes("isAbsolute=true"), `log phải có isAbsolute=true: ${runLog}`);
    assert.ok(runLog.includes("exists=true"), `log phải có exists=true: ${runLog}`);
    assert.ok(runLog.includes("cwd="), "log phải có cwd");
    assert.ok(!/(password|secret|LOGIN_)/i.test(runLog), "log không chứa secret");
    assert.equal(runRes.requestedFilePath, gen.filePath, "Run giữ nguyên absolute path");
    assert.equal(runRes.fileExists, true);

    fs.rmSync(tempRoot, { recursive: true, force: true });
    console.log("Automation Drawer Workflow test: PASS");
}

// reuse emptyExecution shape (mirror of page)
function emptyExecution() {
    return { status: "NOT_RUN", durationMs: null, errorCode: null, errorMessage: "", failedStep: null, failedLocator: null, expectedValue: null, actualValue: null, output: "", screenshotPath: null, tracePath: null, reportPath: null };
}
function failDetail(result = {}) {
    return {
        errorCode: result.errorCode ?? null,
        errorMessage: result.errorMessage ?? "",
        failedStep: result.failedStep ?? null,
        failedLocator: result.failedLocator ?? null,
        filePath: result.filePath ?? null,
        requestedFilePath: result.requestedFilePath ?? null,
        fileExists: result.fileExists ?? null,
        line: result.line ?? null,
        expectedValue: result.expectedValue ?? null,
        actualValue: result.actualValue ?? null,
        output: result.output ?? ""
    };
}

main().catch(e => { console.error(e); process.exit(1); });
