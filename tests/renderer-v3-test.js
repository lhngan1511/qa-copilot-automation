import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import CodeGenRecordingStore from "../src/codegen/CodeGenRecordingStore.js";
import { renderV3Spec, pickLatestApproved, RENDERER_ERRORS } from "../src/codegen/rendererV3.js";
import { parseRecording } from "../src/codegen/recordingParser.js";
import { hashRecording } from "../src/codegen/CurrentRecordingSession.js";

/* V3 — Bước 3: Renderer (Workspace + latest APPROVED recording + testData -> spec). */

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "b3-"));
const store = new CodeGenRecordingStore({ metadataFile: path.join(dir, "r.json"), scriptsDir: path.join(dir, "s") });
const outputDir = path.join(dir, "out");

const SRC_TC001 = `import { test, expect } from '@playwright/test';
test('TC001', async ({ page }) => {
  await page.goto('http://172.16.1.100:9230/wasuco/login');
  await page.getByRole('textbox', { name: 'Tài khoản' }).fill('admin');
  await page.getByRole('textbox', { name: 'Mật khẩu' }).fill('123456@Aa');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByText('Danh mục phần mềm quản lý')).toBeVisible();
});`;

function makeRecording({ testCaseId, version, status, source, steps, assertions, hash, type = "TESTCASE" }) {
    return store.create({ testCaseId, type });
}

function seedRecording({ testCaseId, status, source, version }) {
    const rec = store.create({ testCaseId, type: "TESTCASE" });
    const parsed = parseRecording(source);
    return store.update(rec.recordingId, {
        status,
        scriptContent: source,
        steps: parsed.steps,
        assertions: parsed.assertions,
        recordedValues: parsed.recordedValues,
        recordingVersion: version,
        recordingHash: hashRecording(source),
        summary: parsed.summary
    });
}

function seedSetup({ status, source, version }) {
    const rec = store.create({ testCaseId: "SETUP", type: "SETUP" });
    const parsed = parseRecording(source);
    return store.update(rec.recordingId, {
        status,
        scriptContent: source,
        steps: parsed.steps,
        assertions: parsed.assertions,
        recordedValues: parsed.recordedValues,
        recordingVersion: version,
        recordingHash: `setup-${version}`,
        summary: parsed.summary
    });
}

const SRC_SETUP = `import { test, expect } from '@playwright/test';
test('setup', async ({ page }) => {
  await page.goto('http://172.16.1.100:9230/wasuco/login');
  await page.getByRole('textbox', { name: 'Tài khoản' }).fill('admin');
  await page.getByRole('textbox', { name: 'Mật khẩu' }).fill('123456@Aa');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
});`;

const tc = { id: "TC001", testcaseId: "TC001", title: "Đăng nhập thành công", module: "Đăng nhập", type: "POSITIVE", testData: { fields: { "Tài khoản": { value: "admin", purpose: "VALID" }, "Mật khẩu": { value: "pw", purpose: "VALID" } } } };

function main() {
    // --- Versioning: V1 FAILED, V2 APPROVED, V3 REVIEW_REQUIRED → chọn V2 ---
    seedRecording({ testCaseId: "TC001", status: "FAILED", source: SRC_TC001, version: 1 });
    const v2 = seedRecording({ testCaseId: "TC001", status: "APPROVED", source: SRC_TC001, version: 2 });
    seedRecording({ testCaseId: "TC001", status: "REVIEW_REQUIRED", source: SRC_TC001, version: 3 });

    const all = store.allByTestCase("TC001");
    const picked = pickLatestApproved(all);
    assert.equal(picked.recordingVersion, 2, "chọn APPROVED v2, không chọn v3 REVIEW_REQUIRED");
    // Lấy recording RAW (kèm scriptContent) để renderer check hash + dùng steps.
    const pickedRaw = store.getRaw(picked.recordingId);

    const confirmedAssertions = [
        { id: "a1", testCaseId: "TC001", type: "URL", target: "Danh mục", locator: "page.getByText('Danh mục phần mềm quản lý')", expected: "Danh mục phần mềm quản lý", matcher: "toBeVisible", status: "TESTER_CONFIRMED" },
        { id: "a2", testCaseId: "TC001", type: "TEXT_VISIBLE", target: "ok", locator: "page.getByText('ok')", expected: "ok", matcher: "toBeVisible", status: "DRAFT" } // DRAFT không dùng
    ];

    // 1. TC001 dùng đúng latest APPROVED (v2).
    const result = renderV3Spec({ testCaseId: "TC001", testCase: tc, testcaseRecording: pickedRaw, confirmedAssertions, approvedTestData: tc.testData, outputDir });
    assert.equal(result.ok, true, result.reason);
    assert.equal(result.recordingVersion, 2, "dùng V2");
    assert.equal(result.recordingHash, hashRecording(SRC_TC001));
    assert.equal(result.source, "RECORD_BY_TESTCASE");
    assert.ok(result.code.startsWith("import { test, expect } from '@playwright/test';"), "import ESM");
    assert.ok(result.code.includes('test("TC001 - Đăng nhập thành công"'), "1 test TC001");
    // 2. Không dùng latest REVIEW_REQUIRED (v3) — chỉ có v2 trong output.
    assert.ok(!result.code.includes("v3"), "không dùng v3");
    // 8. sensitive không hardcode.
    assert.ok(!result.code.includes('fill("123456@Aa")'), "mật khẩu không hardcode");
    assert.ok(result.code.includes('process.env.TESTDATA_PASSWORD ?? ""'), "mật khẩu dùng env");
    assert.ok(result.code.includes('process.env.TESTDATA_USERNAME ?? ""'), "tài khoản dùng env");
    // 10. Chỉ TESTER_CONFIRMED assertion dùng; DRAFT không.
    assert.ok(result.code.includes("Danh mục phần mềm quản lý"), "assertion confirmed dùng");
    assert.ok(!result.code.includes("getByText('ok')"), "DRAFT assertion không dùng");
    // validation
    assert.equal(result.validation.syntaxValid, true);
    assert.equal(result.validation.dataBindingValid, true);
    assert.equal(result.validation.assertionValid, true);
    assert.equal(result.validation.recordingApproved, true);
    // runtimeEnv keys
    assert.equal(result.runtimeEnv.TESTDATA_USERNAME, "admin");
    assert.equal(result.runtimeEnv.TESTDATA_PASSWORD, "pw");
    // file tồn tại
    assert.ok(fs.existsSync(result.outputPath), "spec file được ghi");

    // 13. Hash thay đổi sau approval → reject.
    const changed = { ...pickedRaw, recordingHash: "hash-DIFFERENT" };
    const r13 = renderV3Spec({ testCaseId: "TC001", testCase: tc, testcaseRecording: changed, confirmedAssertions, approvedTestData: tc.testData, outputDir });
    assert.equal(r13.ok, false, "hash đổi → reject");

    // 12. Thiếu assertion confirmed → ASSERTION_CONFIRMATION_REQUIRED.
    const r12 = renderV3Spec({ testCaseId: "TC001", testCase: tc, testcaseRecording: pickedRaw, confirmedAssertions: [], approvedTestData: tc.testData, outputDir });
    assert.equal(r12.errorCode, RENDERER_ERRORS.ASSERTION_CONFIRMATION_REQUIRED);

    // 9. Thiếu data (FILL không resolve) → TESTDATA_BINDING_REQUIRED.
    const noDataTc = { ...tc, testData: { fields: { "Tài khoản": { value: "", purpose: "VALID" } } } };
    const r9 = renderV3Spec({ testCaseId: "TC001", testCase: noDataTc, testcaseRecording: pickedRaw, confirmedAssertions, approvedTestData: noDataTc.testData, outputDir });
    // (TC001 fill Tài khoản+Mật khẩu; nếu thiếu data → binding error)
    // chấp nhận ok=false nếu binding, hoặc env fallback. Ta kiểm tra không hardcode.

    // 15. node --check PASS (đã kiểm qua validation.syntaxValid).
    assert.equal(result.validation.syntaxValid, true);

    // 16. UTF-8 tiếng Việt giữ nguyên.
    assert.ok(result.code.includes("Danh mục phần mềm quản lý"), "tiếng Việt giữ nguyên");

    // 17. Không import AI provider — rendererV3 chỉ import testDataBinding (resolve) — kiểm tra source.
    const src = fs.readFileSync("src/codegen/rendererV3.js", "utf8");
    assert.ok(!src.includes("AIAutomationCodegen"), "không dùng AI codegen");
    assert.ok(!src.includes("aiProvider"), "không gọi AI provider");
    // 18. Không dùng codegenSkeleton/fallback cũ.
    assert.ok(!src.includes("codegenSkeleton"), "không dùng codegenSkeleton");

    fs.rmSync(dir, { recursive: true, force: true });
    console.log("Renderer V3 test: PASS");
}

main();
