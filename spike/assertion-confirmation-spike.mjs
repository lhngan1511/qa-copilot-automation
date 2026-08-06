/**
 * SPIKE — Luồng hỏi & xác nhận assertion (Expected Result → TESTER_CONFIRMED).
 *
 * Mô phỏng:
 *   1. Đọc Expected Result (nghiệp vụ).
 *   2. AI phát hiện thiếu bằng chứng + đặt câu hỏi (theo loại).
 *   3. Tester chọn loại bằng chứng + cung cấp giá trị.
 *   4. Hệ thống tạo assertion nháp (DRAFT).
 *   5. Tester xác nhận → TESTER_CONFIRMED.
 *   6. Render spec dùng assertion TESTER_CONFIRMED (không dùng SUGGESTED/DRAFT/REJECTED).
 *   7. node --check PASS.
 *
 * KHÔNG sửa production — minh hoạ contract + luồng.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import os from 'node:os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---- Contract assertion (chỉ DRAFT→TESTER_CONFIRMED được dùng) ----
function makeAssertion({ id, testCaseId, type, expected, matcher, source, status, reason }) {
  return { id, testCaseId, type, target: expected, locator: null, expected, matcher, source, status, reason, createdAt: new Date().toISOString(), confirmedAt: status === 'TESTER_CONFIRMED' ? new Date().toISOString() : null };
}

// ---- Render matcher theo type ----
function renderAssertion(a) {
  const e = JSON.stringify(a.expected);
  switch (a.matcher) {
    case 'toHaveURL': return `expect(page).toHaveURL(${e})`;
    case 'toBeVisible': return `expect(page.getByText(${e})).toBeVisible()`;
    case 'toHaveValue': return `expect(page.getByLabel(${e})).toHaveValue(${e})`;
    case 'toBeDisabled': return `expect(page.getByLabel(${e})).toBeDisabled()`;
    case 'toHaveCount': return `expect(page.locator(${e})).toHaveCount(${a.expected})`;
    default: return null;
  }
}

// ---- Demo 2 kịch bản ----
const tc001 = {
  testCaseId: 'TC001',
  expectedResult: 'Người dùng đăng nhập thành công.',
  chosenType: 'URL',
  value: 'http://172.16.1.100:9230/',
  matcher: 'toHaveURL'
};
const tc002 = {
  testCaseId: 'TC002',
  expectedResult: 'Hệ thống không cho phép hoàn tất đăng nhập khi Tài khoản để trống.',
  chosenType: 'TEXT_VISIBLE',
  value: 'Tài khoản không được để trống',
  matcher: 'toBeVisible'
};

for (const tc of [tc001, tc002]) {
  console.log(`\n===== TC: ${tc.testCaseId} =====`);
  console.log(`Expected: ${tc.expectedResult}`);
  // AI đặt câu hỏi theo loại
  const question = tc.chosenType === 'URL'
    ? `[AI hỏi] Sau ${tc.testCaseId === 'TC001' ? 'đăng nhập' : 'bước này'}, hệ thống chuyển đến URL nào?`
    : `[AI hỏi] Thông báo nào phải xuất hiện?`;
  console.log(question);
  console.log(`[Tester chọn loại] ${tc.chosenType}  [Tester nhập] ${tc.value}`);

  // Tạo nháp DRAFT
  const draft = makeAssertion({ id: `asrt-${tc.testCaseId}`, testCaseId: tc.testCaseId, type: tc.chosenType, expected: tc.value, matcher: tc.matcher, source: 'TESTER_INPUT', status: 'DRAFT', reason: '' });
  console.log(`→ Assertion nháp (DRAFT): ${renderAssertion(draft)}`);

  // Tester xác nhận
  const confirmed = { ...draft, status: 'TESTER_CONFIRMED', confirmedAt: new Date().toISOString() };
  console.log(`→ Tester xác nhận → TESTER_CONFIRMED`);

  // Coverage: chỉ tính TESTER_CONFIRMED
  const all = [confirmed, makeAssertion({ id: 'x', testCaseId: tc.testCaseId, type: 'URL', expected: '/dashboard', matcher: 'toHaveURL', source: 'AI_SUGGESTED', status: 'SUGGESTED', reason: '' })];
  const confirmedOnly = all.filter(a => a.status === 'TESTER_CONFIRMED');
  console.log(`→ Coverage dựa trên ${confirmedOnly.length}/${all.length} assertion TESTER_CONFIRMED`);
}

// ---- Render spec TC001 với assertion TESTER_CONFIRMED ----
const tc001Confirmed = makeAssertion({ id: 'asrt-TC001', testCaseId: 'TC001', type: 'URL', expected: 'http://172.16.1.100:9230/', matcher: 'toHaveURL', source: 'TESTER_INPUT', status: 'TESTER_CONFIRMED', reason: '' });
const spec = [
  `import { test, expect } from '@playwright/test';`,
  `test("TC001 - Đăng nhập thành công", async ({ page }) => {`,
  `  await page.goto("http://172.16.1.100:9230/wasuco/login");`,
  `  await page.getByRole('textbox', { name: 'Tài khoản' }).fill(process.env.TESTDATA_USERNAME ?? "");`,
  `  await page.getByRole('textbox', { name: 'Mật khẩu' }).fill(process.env.TESTDATA_PASSWORD ?? "");`,
  `  await page.getByRole('button', { name: 'Đăng nhập' }).click();`,
  `  await ${renderAssertion(tc001Confirmed)};`,
  `});`
].join('\n');

console.log('\n===== SPEC TC001 (dùng assertion TESTER_CONFIRMED) =====');
console.log(spec);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'asrt-'));
const file = path.join(tmp, 'check.mjs');
fs.writeFileSync(file, spec, 'utf8');
const r = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\nnode --check: ${r.status === 0 ? 'PASS' : 'FAIL: ' + r.stderr}`);

// Assertion AI đề xuất sai (SUGGESTED) KHÔNG vào spec
const specHasDashboard = spec.includes('/dashboard');
console.log(`Assertion AI đề xuất sai (/dashboard) vào spec? ${specHasDashboard ? 'CÓ - SAI' : 'KHÔNG - ĐÚNG'}`);

console.log('\n=== KẾT LUẬN SPIKE: luồng hỏi→nháp→xác nhận→TESTER_CONFIRMED→render→node --check PASS; assertion sai bị loại ===');
