import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import CodeGenRecordingStore from "../src/codegen/CodeGenRecordingStore.js";
import { renderV3Spec, RENDERER_ERRORS } from "../src/codegen/rendererV3.js";
import { parseRecording } from "../src/codegen/recordingParser.js";
import { hashRecording } from "../src/codegen/CurrentRecordingSession.js";

/* V3 — Bước 3 extra: SETUP+TESTCASE thứ tự, self-contained, USER_CONFIRMED, EMPTY. */

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "b3x-"));
const store = new CodeGenRecordingStore({ metadataFile: path.join(dir, "r.json"), scriptsDir: path.join(dir, "s") });
const outputDir = path.join(dir, "out");

function seed({ testCaseId, status, source, version, type = "TESTCASE" }) {
    const rec = store.create({ testCaseId, type });
    const p = parseRecording(source);
    return store.getRaw(store.update(rec.recordingId, {
        status, scriptContent: source, steps: p.steps, assertions: p.assertions,
        recordedValues: p.recordedValues, recordingVersion: version, recordingHash: hashRecording(source), summary: p.summary
    }).recordingId);
}

const SRC_SETUP = `import { test, expect } from '@playwright/test';
test('setup', async ({ page }) => {
  await page.goto('http://172.16.1.100:9230/wasuco/login');
  await page.getByRole('textbox', { name: 'Tài khoản' }).fill('admin');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
});`;

const SRC_TC001 = `import { test, expect } from '@playwright/test';
test('TC001', async ({ page }) => {
  await page.goto('http://172.16.1.100:9230/wasuco/danh-muc/don-vi-tinh');
  await page.getByRole('button', { name: 'Thêm mới' }).click();
  await page.getByLabel('Tên đơn vị tính').fill('Chiếc');
  await page.getByRole('button', { name: 'Lưu' }).click();
  await expect(page.getByText('Thêm mới thành công')).toBeVisible();
});`;

const tc001 = { id: "TC001", testcaseId: "TC001", title: "Thêm đơn vị tính thành công", module: "Đơn vị tính", type: "POSITIVE", testData: { fields: { "Tên đơn vị tính": { value: "Chiếc", purpose: "VALID" } } } };

const confirmedAssertions = [
    { id: "a1", testCaseId: "TC001", type: "TEXT_VISIBLE", target: "Thêm mới thành công", locator: "page.getByText('Thêm mới thành công')", expected: "Thêm mới thành công", matcher: "toBeVisible", status: "TESTER_CONFIRMED" }
];

function main() {
    // 4. SETUP + TESTCASE giữ đúng thứ tự.
    const setup = seed({ testCaseId: "SETUP", type: "SETUP", status: "APPROVED", source: SRC_SETUP, version: 1 });
    const tc = seed({ testCaseId: "TC001", status: "APPROVED", source: SRC_TC001, version: 1 });
    const r = renderV3Spec({ testCaseId: "TC001", testCase: tc001, setupRecording: setup, testcaseRecording: tc, confirmedAssertions, approvedTestData: tc001.testData, outputDir });
    assert.equal(r.ok, true, r.reason);
    const gotoIdx = r.code.indexOf("page.goto");
    const addIdx = r.code.indexOf("Thêm mới");
    assert.ok(gotoIdx < addIdx, "SETUP (goto) trước TESTCASE (Thêm mới)");
    assert.ok(r.code.includes("/wasuco/danh-muc/don-vi-tinh"), "goto testcase sau setup");

    // 5. Không SETUP vẫn render được self-contained (TC001 có goto riêng).
    const r5 = renderV3Spec({ testCaseId: "TC001", testCase: tc001, testcaseRecording: tc, confirmedAssertions, approvedTestData: tc001.testData, outputDir });
    assert.equal(r5.ok, true, "không SETUP vẫn render self-contained");
    assert.ok(r5.code.includes("/wasuco/danh-muc/don-vi-tinh"), "TC001 tự goto");

    // 6. USER_CONFIRMED thắng APPROVED_JSON.
    const tcConfirm = { ...tc001, testData: { ...tc001.testData, confirmed: { "Tên đơn vị tính": "Máy" } } };
    const r6 = renderV3Spec({ testCaseId: "TC001", testCase: tc001, testcaseRecording: tc, confirmedAssertions, confirmedTestData: { "Tên đơn vị tính": "Máy" }, approvedTestData: tc001.testData, outputDir });
    assert.equal(r6.ok, true);
    assert.ok(r6.code.includes('fill("Máy")'), "USER_CONFIRMED thắng (fill Máy)");

    // 7. EMPTY sinh chuỗi rỗng hợp lệ (không fill field EMPTY).
    const tcEmpty = { ...tc001, testData: { fields: { "Tên đơn vị tính": { value: "", purpose: "EMPTY" } } } };
    const r7 = renderV3Spec({ testCaseId: "TC001", testCase: tcEmpty, testcaseRecording: tc, confirmedAssertions, approvedTestData: tcEmpty.testData, outputDir });
    assert.equal(r7.ok, true, "EMPTY không chặn");
    assert.ok(!r7.code.includes(".fill("), "EMPTY field không fill");

    fs.rmSync(dir, { recursive: true, force: true });
    console.log("Renderer V3 Extra test: PASS");
}

main();
