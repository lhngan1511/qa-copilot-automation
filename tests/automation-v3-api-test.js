import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import createApp from "../src/server/createApp.js";

/*
 Bước 4 — API/Routes V3 (Record by Testcase).

 20 test bắt buộc:
   1  Create workspace từ approved testcase.
   2  Chỉ load reviewStatus=APPROVED.
   3  Select TC001.
   4  Start recording TC001.
   5  Không start session thứ hai.
   6  Stop giữ đúng testCaseId.
   7  Approve recording.
   8  Save DRAFT assertion.
   9  DRAFT không cho Generate.
   10 Confirm assertion.
   11 Generate qua GenerateService.
   12 Route không import rendererV3 trực tiếp.
   13 Generate sai state bị reject.
   14 Không lấy recording testcase khác.
   15 Restart repository vẫn load state.
   16 Error contract thống nhất.
   17 Không log dữ liệu nhạy cảm.
   18 Existing regression PASS.   (chạy riêng)
   19 Server boot PASS.
   20 working tree clean.         (chạy riêng)
*/

const testDir = path.dirname(fileURLToPath(import.meta.url));
const routesDir = path.resolve(testDir, "..", "src", "routes");
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "v3-api-"));

const APPROVED_SNAPSHOT = [
    {
        id: "TC001", title: "Đăng nhập thành công", module: "Login", type: "POSITIVE",
        reviewStatus: "APPROVED",
        testData: {
            fields: {
                "Tài khoản": { value: "admin", purpose: "VALID" },
                "Mật khẩu": { value: "Admin@123", purpose: "VALID" }
            }
        }
    },
    {
        id: "TC002", title: "Sai mật khẩu", module: "Login", type: "NEGATIVE",
        reviewStatus: "APPROVED",
        testData: {
            fields: {
                "Tài khoản": { value: "admin", purpose: "VALID" },
                "Mật khẩu": { value: "sai", purpose: "INVALID" }
            }
        }
    },
    // reviewStatus DRAFT — KHÔNG được load vào workspace.
    {
        id: "TC003", title: "Chưa duyệt", module: "Login", type: "POSITIVE",
        reviewStatus: "DRAFT", testData: { fields: {} }
    }
];

const SRC_TC001 = `import { test, expect } from '@playwright/test';
test('TC001 - Đăng nhập thành công', async ({ page }) => {
  await page.goto('http://172.16.1.100:9230/wasuco/login');
  await page.getByRole('textbox', { name: 'Tài khoản' }).fill('admin');
  await page.getByRole('textbox', { name: 'Mật khẩu' }).fill('Admin@123');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByText('Danh mục phần mềm quản lý')).toBeVisible();
});`;

async function startServer(dataDir, v3OutputDir) {
    const app = createApp({
        repositoryType: "file",
        dataDir,
        outputDir: path.join(dataDir, "outputs"),
        v3OutputDir
    });
    return new Promise(resolve => {
        const server = app.listen(0, "127.0.0.1", () => {
            resolve({
                server,
                baseUrl: `http://127.0.0.1:${server.address().port}`
            });
        });
    });
}

function closeServer(server) {
    return new Promise(resolve => server.close(resolve));
}

async function req(baseUrl, method, requestPath, body) {
    const jsonBody = body !== undefined;
    const response = await fetch(`${baseUrl}${requestPath}`, {
        method,
        headers: jsonBody ? { "content-type": "application/json" } : {},
        body: jsonBody ? JSON.stringify(body) : undefined
    });
    let json;
    try { json = await response.json(); } catch { json = null; }
    return { status: response.status, body: json };
}

async function main() {
    const dataDir = path.join(tempRoot, "data");
    const v3Out = path.join(tempRoot, "out");

    // ===== Server boot PASS (test 19) =====
    let { server, baseUrl } = await startServer(dataDir, v3Out);
    const health = await req(baseUrl, "GET", "/health");
    assert.equal(health.status, 200, "health 200");
    assert.equal(health.body?.success, true, "health success");

    // ===== 1. Create workspace từ approved testcase =====
    const created = await req(baseUrl, "POST", "/api/automation-v3/workspaces", {
        source: "NEW",
        module: "Login",
        approvedTestCases: APPROVED_SNAPSHOT
    });
    assert.equal(created.status, 200, "create workspace 200");
    assert.ok(created.body.workspaceId.startsWith("WS-"), "workspaceId WS-");
    assert.equal(created.body.status, "NEW");

    // ===== 2. Chỉ load reviewStatus=APPROVED =====
    assert.equal(created.body.approvedCount, 2, "chỉ count APPROVED (TC001, TC002)");
    const ids = created.body.items.map(i => i.testCaseId);
    assert.deepEqual(ids.sort(), ["TC001", "TC002"], "không load TC003 (DRAFT)");
    const workspaceId = created.body.workspaceId;

    // ===== 3. Select TC001 =====
    const select = await req(baseUrl, "POST",
        `/api/automation-v3/workspaces/${workspaceId}/testcases/TC001/select`);
    assert.equal(select.status, 200, "select 200");
    assert.equal(select.body.selectedForAutomation, true, "selected");
    assert.equal(select.body.automationStatus, "SELECTED", "SELECTED");

    // ===== 4. Start recording TC001 =====
    const start = await req(baseUrl, "POST",
        `/api/automation-v3/workspaces/${workspaceId}/recordings/start`,
        { testCaseId: "TC001", type: "TESTCASE", url: "http://172.16.1.100:9230/wasuco/login" });
    assert.equal(start.status, 200, "start 200");
    assert.equal(start.body.testCaseId, "TC001", "start TC001");
    assert.equal(start.body.status, "RECORDING", "RECORDING");
    const recordingId = start.body.recordingId;

    // ===== 5. Không start session thứ hai =====
    // Chọn TC002 trước để vượt qua TESTCASE_NOT_SELECTED → tới check RECORDING_ALREADY_ACTIVE.
    await req(baseUrl, "POST",
        `/api/automation-v3/workspaces/${workspaceId}/testcases/TC002/select`);
    const secondStart = await req(baseUrl, "POST",
        `/api/automation-v3/workspaces/${workspaceId}/recordings/start`,
        { testCaseId: "TC002", type: "TESTCASE" });
    assert.equal(secondStart.status, 409, "409");
    assert.equal(secondStart.body.errorCode, "RECORDING_ALREADY_ACTIVE", "RECORDING_ALREADY_ACTIVE");

    // ===== 6. Stop giữ đúng testCaseId =====
    const stop = await req(baseUrl, "POST",
        `/api/automation-v3/workspaces/${workspaceId}/recordings/stop`,
        { recordingId, source: SRC_TC001 });
    assert.equal(stop.status, 200, "stop 200");
    assert.equal(stop.body.testCaseId, "TC001", "stop giữ TC001");
    assert.equal(stop.body.recordingId, recordingId, "stop giữ recordingId");
    assert.equal(stop.body.status, "RECORDED", "RECORDED");

    // ===== 7. Approve recording =====
    const approve = await req(baseUrl, "POST",
        `/api/automation-v3/workspaces/${workspaceId}/recordings/${recordingId}/approve`,
        { approvedBy: "tester" });
    assert.equal(approve.status, 200, "approve 200");
    assert.equal(approve.body.status, "APPROVED", "APPROVED");
    assert.equal(approve.body.approvedBy, "tester", "approvedBy");
    assert.ok(approve.body.approvedAt, "approvedAt");
    assert.ok(approve.body.recordingHash, "hash khóa");

    // workspace item → APPROVED
    const wsAfterApprove = await req(baseUrl, "GET",
        `/api/automation-v3/workspaces/${workspaceId}`);
    const tc001 = wsAfterApprove.body.items.find(i => i.testCaseId === "TC001");
    assert.equal(tc001.automationStatus, "APPROVED", "workspace item APPROVED");
    assert.equal(tc001.recordingSummary.status, "APPROVED", "recordingSummary APPROVED");

    // ===== 8. Save DRAFT assertion =====
    const draft = await req(baseUrl, "POST",
        `/api/automation-v3/workspaces/${workspaceId}/testcases/TC001/assertions`,
        {
            type: "TEXT_VISIBLE",
            target: "Danh mục",
            locator: "page.getByText('Danh mục phần mềm quản lý')",
            expected: "Danh mục phần mềm quản lý",
            matcher: "toBeVisible",
            source: "TESTER_INPUT",
            status: "DRAFT"
        });
    assert.equal(draft.status, 200, "save draft 200");
    assert.equal(draft.body.status, "DRAFT", "DRAFT");
    const assertionId = draft.body.id;

    // ===== 9. DRAFT không cho Generate =====
    const genDraft = await req(baseUrl, "POST",
        `/api/automation-v3/workspaces/${workspaceId}/testcases/TC001/generate`);
    assert.equal(genDraft.status, 409, "409 khi DRAFT");
    assert.equal(genDraft.body.errorCode, "ASSERTION_CONFIRMATION_REQUIRED", "DRAFT không generate");

    // ===== 10. Confirm assertion =====
    const confirm = await req(baseUrl, "PATCH",
        `/api/automation-v3/workspaces/${workspaceId}/testcases/TC001/assertions/${assertionId}/confirm`);
    assert.equal(confirm.status, 200, "confirm 200");
    assert.equal(confirm.body.status, "TESTER_CONFIRMED", "TESTER_CONFIRMED");

    // ===== 11. Generate qua GenerateService =====
    const gen = await req(baseUrl, "POST",
        `/api/automation-v3/workspaces/${workspaceId}/testcases/TC001/generate`,
        { confirmedTestData: {} });
    assert.equal(gen.status, 200, "generate 200");
    assert.equal(gen.body.status, "GENERATED", "GENERATED");
    assert.equal(gen.body.testCaseId, "TC001", "testCaseId");
    assert.ok(gen.body.outputPath, "outputPath");
    assert.ok(fs.existsSync(gen.body.outputPath), "file tồn tại");
    assert.ok(gen.body.metadata?.recording?.id, "metadata recording");
    assert.ok(Array.isArray(gen.body.runtimeEnvKeys), "runtimeEnvKeys array");
    assert.ok(gen.body.runtimeEnvKeys.includes("TESTDATA_USERNAME"), "runtimeEnvKeys username");
    assert.equal(gen.body.validation.spec.bindingValid, true, "binding valid");
    assert.equal(gen.body.validation.spec.syntaxValid, true, "syntax valid");

    // workspace generateStatus → GENERATED
    const wsAfterGen = await req(baseUrl, "GET", `/api/automation-v3/workspaces/${workspaceId}`);
    const tc001gen = wsAfterGen.body.items.find(i => i.testCaseId === "TC001");
    assert.equal(tc001gen.generateStatus, "GENERATED", "GENERATED");
    assert.ok(tc001gen.generatedFile, "generatedFile lưu");

    // ===== 12. Route không import rendererV3 trực tiếp =====
    const routesFile = fs.readFileSync(path.join(routesDir, "automationV3Routes.js"), "utf8");
    assert.ok(!routesFile.includes("rendererV3"), "route không import rendererV3");
    assert.ok(routesFile.includes("AutomationWorkspaceApplicationService"), "route dùng Application Service");

    // ===== 13. Generate sai state bị reject =====
    // 13a. TC002 chưa có recording APPROVED → RECORDING_APPROVAL_REQUIRED.
    await req(baseUrl, "POST",
        `/api/automation-v3/workspaces/${workspaceId}/testcases/TC002/select`);
    const genNoRecording = await req(baseUrl, "POST",
        `/api/automation-v3/workspaces/${workspaceId}/testcases/TC002/generate`);
    assert.equal(genNoRecording.status, 409, "409 no recording");
    assert.equal(genNoRecording.body.errorCode, "RECORDING_APPROVAL_REQUIRED", "no recording");

    // 13b. Unselect → generate → TESTCASE_NOT_SELECTED.
    await req(baseUrl, "POST",
        `/api/automation-v3/workspaces/${workspaceId}/testcases/TC002/unselect`);
    const genUnselected = await req(baseUrl, "POST",
        `/api/automation-v3/workspaces/${workspaceId}/testcases/TC002/generate`);
    assert.equal(genUnselected.body.errorCode, "TESTCASE_NOT_SELECTED", "unselected");

    // ===== 14. Không lấy recording testcase khác =====
    // List recordings TC001 — chỉ có recording TC001 (không lẫn TC002/SETUP).
    const recs = await req(baseUrl, "GET",
        `/api/automation-v3/workspaces/${workspaceId}/testcases/TC001/recordings`);
    assert.equal(recs.status, 200, "list recordings 200");
    assert.ok(Array.isArray(recs.body), "array");
    assert.ok(recs.body.every(r => r.testCaseId === "TC001"), "chỉ recording TC001");
    assert.ok(recs.body.every(r => !("scriptContent" in r) && !("source" in r)), "không trả source/script");

    // ===== 15. Restart repository vẫn load state =====
    await closeServer(server);
    ({ server, baseUrl } = await startServer(dataDir, v3Out));
    const reloaded = await req(baseUrl, "GET", `/api/automation-v3/workspaces/${workspaceId}`);
    assert.equal(reloaded.status, 200, "restart load workspace");
    const reloadTc = reloaded.body.items.find(i => i.testCaseId === "TC001");
    assert.equal(reloadTc.selectedForAutomation, true, "selected persisted");
    assert.equal(reloadTc.automationStatus, "APPROVED", "approval persisted");
    assert.equal(reloadTc.generateStatus, "GENERATED", "generate persisted");
    assert.ok(reloadTc.generatedFile, "generatedFile metadata persisted");
    assert.equal(reloadTc.assertionStatus.confirmed, 1, "confirmed assertion persisted");
    // recording versions persisted
    const reloadRecs = await req(baseUrl, "GET",
        `/api/automation-v3/workspaces/${workspaceId}/testcases/TC001/recordings`);
    assert.equal(reloadRecs.body.length, 1, "recording version persisted");

    // ===== 16. Error contract thống nhất =====
    const missingWs = await req(baseUrl, "GET", "/api/automation-v3/workspaces/WS-NOPE");
    assert.equal(missingWs.status, 404, "404");
    assert.equal(missingWs.body.success, false, "success=false");
    assert.equal(missingWs.body.errorCode, "WORKSPACE_NOT_FOUND", "errorCode");
    assert.ok(typeof missingWs.body.message === "string", "message string");
    assert.ok(!missingWs.body.errorCode.includes("Error:"), "không leak stack");
    assert.ok(!String(missingWs.body.message).includes("    at "), "không có stack trace");

    // ===== 17. Không log / không trả dữ liệu nhạy cảm =====
    const genOut = await req(baseUrl, "POST",
        `/api/automation-v3/workspaces/${workspaceId}/testcases/TC001/generate`,
        { confirmedTestData: {} });
    const raw = JSON.stringify(genOut.body);
    assert.ok(!raw.includes("Admin@123"), "không trả password value");
    assert.ok(!raw.includes("runtimeEnv: {"), "không trả runtimeEnv value");
    assert.ok(!("runtimeEnv" in genOut.body), "response không có runtimeEnv values");
    assert.ok(!raw.includes("GEMINI_API_KEY"), "không leak Gemini key");

    await closeServer(server);
    fs.rmSync(tempRoot, { recursive: true, force: true });
    console.log("Automation V3 API test: PASS");
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
