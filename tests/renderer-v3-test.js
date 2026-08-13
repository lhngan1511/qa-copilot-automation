import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import CodeGenRecordingStore from "../src/codegen/CodeGenRecordingStore.js";
import { renderV3Spec, pickLatestApproved, renderStep, RENDERER_ERRORS } from "../src/codegen/rendererV3.js";
import { parseRecording } from "../src/codegen/recordingParser.js";
import { hashRecording } from "../src/codegen/CurrentRecordingSession.js";
import GenerateService from "../src/codegen/GenerateService.js";
import AutomationWorkspace from "../src/codegen/AutomationWorkspace.js";

/* V3 — Bước 3 (refactor): Renderer thuần + GenerateService orchestrator. */

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "b3r-"));
const store = new CodeGenRecordingStore({ metadataFile: path.join(dir, "r.json"), scriptsDir: path.join(dir, "s") });
const ws = new AutomationWorkspace({ metadataFile: path.join(dir, "w.json") });
const w = ws.create({ module: "Đăng nhập", testCases: [
    { id: "TC001", title: "Đăng nhập thành công", module: "Đăng nhập", type: "POSITIVE", reviewStatus: "APPROVED" },
    { id: "TC002", title: "Sai mật khẩu", module: "Đăng nhập", reviewStatus: "APPROVED" }
] });
ws.setSelected(w.workspaceId, "TC001", true);
const outputDir = path.join(dir, "out");

const SRC_TC001 = `import { test, expect } from '@playwright/test';
test('TC001', async ({ page }) => {
  await page.goto('http://172.16.1.100:9230/wasuco/login');
  await page.getByRole('textbox', { name: 'Tài khoản' }).fill('admin');
  await page.getByRole('textbox', { name: 'Mật khẩu' }).fill('123456@Aa');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByText('Danh mục phần mềm quản lý')).toBeVisible();
});`;

function seed({ testCaseId, status, source, version }) {
    const rec = store.create({ testCaseId, type: "TESTCASE" });
    const p = parseRecording(source);
    return store.getRaw(store.update(rec.recordingId, {
        status, scriptContent: source, steps: p.steps, assertions: p.assertions, recordedValues: p.recordedValues,
        recordingVersion: version, recordingHash: hashRecording(source), summary: p.summary, approvedAt: status === "APPROVED" ? new Date().toISOString() : null, approvedBy: status === "APPROVED" ? "tester" : null
    }).recordingId);
}

const tc = { id: "TC001", testcaseId: "TC001", title: "Đăng nhập thành công", module: "Đăng nhập", type: "POSITIVE", testData: { fields: { "Tài khoản": { value: "admin", purpose: "VALID" }, "Mật khẩu": { value: "pw", purpose: "VALID" } } } };

function main() {
    // --- Versioning: V1 FAILED, V2 APPROVED, V3 REVIEW_REQUIRED → chọn V2 ---
    seed({ testCaseId: "TC001", status: "FAILED", source: SRC_TC001, version: 1 });
    seed({ testCaseId: "TC001", status: "APPROVED", source: SRC_TC001, version: 2 });
    seed({ testCaseId: "TC001", status: "REVIEW_REQUIRED", source: SRC_TC001, version: 3 });
    const picked = pickLatestApproved(store.allByTestCase("TC001"));
    assert.equal(picked.recordingVersion, 2, "chọn APPROVED v2");
    const pickedRaw = store.getRaw(picked.recordingId);

    const confirmedAssertions = [
        { id: "a1", testCaseId: "TC001", type: "URL", target: "Danh mục", locator: "page.getByText('Danh mục phần mềm quản lý')", expected: "Danh mục phần mềm quản lý", matcher: "toBeVisible", status: "TESTER_CONFIRMED" },
        { id: "a2", testCaseId: "TC001", type: "TEXT_VISIBLE", target: "ok", locator: "page.getByText('ok')", expected: "ok", matcher: "toBeVisible", status: "DRAFT" }
    ];

    // 1. Renderer thuần — KHÔNG ghi file, chỉ trả code + runtimeEnv + validation + metadata.
    const result = renderV3Spec({ testCase: tc, testcaseRecording: pickedRaw, confirmedAssertions, approvedTestData: tc.testData });
    assert.equal(result.ok, true, result.reason);
    assert.ok(!("outputPath" in result), "renderer không ghi file / không outputPath");
    assert.ok(!("filePath" in result), "renderer không biết filesystem");
    // metadata gom recording
    assert.equal(result.metadata.recording.id, pickedRaw.recordingId);
    assert.equal(result.metadata.recording.version, 2);
    assert.equal(result.metadata.recording.hash, hashRecording(SRC_TC001));
    assert.ok(result.metadata.recording.approvedAt, "có approvedAt");
    // validation chia 2 tầng
    assert.equal(result.validation.recording.approved, true);
    assert.equal(result.validation.recording.hashValid, true);
    assert.equal(result.validation.recording.versionValid, true);
    assert.equal(result.validation.spec.syntaxValid, true);
    assert.equal(result.validation.spec.assertionValid, true);
    assert.equal(result.validation.spec.bindingValid, true);
    // runtimeEnv có nguồn
    assert.equal(result.runtimeEnv.LOGIN_USERNAME.value, null);
    assert.equal(result.runtimeEnv.LOGIN_USERNAME.source, "SETUP_ENV");
    assert.equal(result.runtimeEnv.LOGIN_PASSWORD.source, "SETUP_ENV");
    // code đúng
    assert.ok(result.code.startsWith("import { test, expect } from '@playwright/test';"));
    assert.ok(result.code.includes('test("TC001 - Đăng nhập thành công"'));
    assert.ok(!result.code.includes("getByText('ok')"), "DRAFT không dùng");
    assert.ok(result.code.includes("Danh mục phần mềm quản lý"), "assertion confirmed dùng");

    // renderStep stateless: step → {line, runtimeEnv, diagnostics}
    const st = renderStep({ actionType: "FILL", locator: "getByRole('textbox', { name: 'Tài khoản' }).", target: "Tài khoản", recordedValue: "admin" }, { purposeMap: {}, confirmedTestData: {}, approvedTestData: { fields: { "Tài khoản": { value: "admin", purpose: "VALID" } } } });
    assert.equal(st.line, "  await page.getByRole('textbox', { name: 'Tài khoản' }).fill(process.env.LOGIN_USERNAME ?? \"\");");
    // P0 TC001 — setup env: giá trị credential KHÔNG lộ từ testcase data (đến từ runtime config).
    assert.equal(st.runtimeEnv.LOGIN_USERNAME.source, "SETUP_ENV");
    assert.equal(st.runtimeEnv.LOGIN_USERNAME.value, null);
    assert.deepEqual(st.diagnostics, [], "không lỗi");

    // Hash đổi sau approval → reject.
    const changed = { ...pickedRaw, recordingHash: "different" };
    const r13 = renderV3Spec({ testCase: tc, testcaseRecording: changed, confirmedAssertions, approvedTestData: tc.testData });
    assert.equal(r13.ok, false);
    assert.equal(r13.errorCode, RENDERER_ERRORS.RECORDING_CHANGED_AFTER_APPROVAL);

    // Thiếu assertion → ASSERTION_CONFIRMATION_REQUIRED.
    const r12 = renderV3Spec({ testCase: tc, testcaseRecording: pickedRaw, confirmedAssertions: [], approvedTestData: tc.testData });
    assert.equal(r12.errorCode, RENDERER_ERRORS.ASSERTION_CONFIRMATION_REQUIRED);

    // ---- GenerateService orchestrator: render + ghi file + cập nhật workspace ----
    const service = new GenerateService({ workspace: ws, store, outputDir });
    const gen = service.generate({ workspaceId: w.workspaceId, testCaseId: "TC001", approvedTestData: tc.testData, confirmedAssertions });
    assert.equal(gen.ok, true, gen.reason);
    assert.ok(gen.outputPath, "Service ghi file (renderer không)");
    assert.ok(fs.existsSync(gen.outputPath), "file tồn tại");
    assert.equal(ws.getTestCase(w.workspaceId, "TC001").generateStatus, "GENERATED");
    assert.equal(ws.getTestCase(w.workspaceId, "TC001").recordingVersion, 2);
    assert.ok(fs.readFileSync(gen.outputPath, "utf8").includes("TC001 - Đăng nhập thành công"), "file chứa spec");

    // UTF-8 tiếng Việt
    assert.ok(result.code.includes("Danh mục phần mềm quản lý"));

    fs.rmSync(dir, { recursive: true, force: true });
    console.log("Renderer V3 (refactor) test: PASS");
}

main();
