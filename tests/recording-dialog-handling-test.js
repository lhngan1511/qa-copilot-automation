import assert from "node:assert/strict";
import { parseRecording } from "../src/codegen/recordingParser.js";
import { renderStep } from "../src/codegen/rendererV3.js";

/* Bug thật Ngân báo lại 2026-09-03: hộp thoại xác nhận native (confirm/alert) của trình duyệt —
   page.once('dialog', dialog => {...}) — bị PARSER rơi im lặng khỏi kết quả parse (method
   "once"/"on" không nằm trong ACTION_METHODS), khiến spec sinh ra thiếu hẳn dòng xử lý dialog.
   Khi chạy thật, Playwright KHÔNG có listener sẽ tự động DISMISS hộp thoại — hỏng mọi testcase
   "Xóa thành công" (hoặc bất kỳ luồng cần accept hộp thoại). */

const SCRIPT_DISMISS = `import { test, expect } from '@playwright/test';
test('test', async ({ page }) => {
  await page.getByRole('row', { name: 'A11' }).getByLabel('').check();
  page.once('dialog', dialog => {
    console.log(\`Dialog message: \${dialog.message()}\`);
    dialog.dismiss().catch(() => {});
  });
  await page.getByRole('button', { name: 'Xóa' }).first().click();
  await expect(page.getByText('Đã xóa thành công')).toBeVisible();
});`;

// 1. Dialog block PHẢI được parse thành 1 step (không rơi mất im lặng).
const { steps } = parseRecording(SCRIPT_DISMISS);
const dialogSteps = steps.filter(s => s.actionType === "DIALOG");
assert.equal(dialogSteps.length, 1, "dialog.once() phải được nhận diện thành 1 step");
assert.equal(dialogSteps[0].recordedValue, "DISMISS", "giữ đúng dismiss() như script ghi lại — không tự suy đoán thành accept");
assert.equal(dialogSteps[0].locator, "", "dialog không phải element trên trang — không có locator");

// 2. Thứ tự: dialog PHẢI đứng NGAY TRƯỚC bước click "Xóa" (đúng thứ tự nguồn — page.once đăng ký
// trước khi hành động mở hộp thoại xảy ra).
const checkStep = steps.find(s => s.actionType === "CHECK");
const clickXoaStep = steps.find(s => s.actionType === "CLICK" && s.target === "Xóa");
assert.ok(checkStep.order < dialogSteps[0].order, "dialog đứng sau bước check dòng");
assert.ok(dialogSteps[0].order < clickXoaStep.order, "dialog đứng NGAY TRƯỚC click Xóa (đúng thứ tự đăng ký listener)");

// 3. Các step khác (CHECK, CLICK) không bị ảnh hưởng — vẫn parse đúng như cũ.
assert.equal(steps.filter(s => s.actionType === "CLICK").length, 1);
assert.equal(steps.filter(s => s.actionType === "CHECK").length, 1);

// 4. renderStep phải sinh đúng dòng page.once('dialog', ...) tương ứng — dismiss.
const renderedDismiss = renderStep(dialogSteps[0]);
assert.match(renderedDismiss.line, /page\.once\('dialog', dialog => dialog\.dismiss\(\)\.catch/);

// 5. Trường hợp accept() — tester tự sửa script trước khi phân tích (đúng luồng "xác nhận xóa").
const SCRIPT_ACCEPT = SCRIPT_DISMISS.replace("dialog.dismiss()", "dialog.accept()");
const { steps: stepsAccept } = parseRecording(SCRIPT_ACCEPT);
const acceptStep = stepsAccept.find(s => s.actionType === "DIALOG");
assert.equal(acceptStep.recordedValue, "ACCEPT");
const renderedAccept = renderStep(acceptStep);
assert.match(renderedAccept.line, /page\.once\('dialog', dialog => dialog\.accept\(\)\.catch/);

// 6. page.on('dialog', ...) (không phải once) cũng được nhận diện tương tự.
const SCRIPT_ON = SCRIPT_DISMISS.replace("page.once('dialog'", "page.on('dialog'");
const { steps: stepsOn } = parseRecording(SCRIPT_ON);
assert.equal(stepsOn.filter(s => s.actionType === "DIALOG").length, 1, "page.on('dialog', ...) cũng được nhận diện");

// 7. Không có dialog trong script -> không sinh step DIALOG nào (không dương tính giả).
const { steps: noDialog } = parseRecording(`await page.getByRole('button', { name: 'Lưu' }).click();`);
assert.equal(noDialog.filter(s => s.actionType === "DIALOG").length, 0);

console.log("Recording Dialog Handling test: PASS");
