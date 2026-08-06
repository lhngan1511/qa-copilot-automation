// CodeGen.js — Playwright Codegen ghi lại cho màn hình Đăng nhập (demo).
// Đây là file "CodeGen.js" bạn tải lên ở bước ① Upload cùng approved-testcases.json.
// Lưu ý: mọi locator ở đây đều được Playwright Codegen sinh thật; AI Mapping sẽ
// đối chiếu từng testcase với những locator này.

const { test, expect } = require('@playwright/test');

test('Đăng nhập', async ({ page }) => {
  // 1. Mở màn hình đăng nhập
  await page.goto(process.env.BASE_URL + '/wasuco/login');

  // 2. Nhập Tài khoản
  await page.getByLabel('Tài khoản').click();
  await page.getByLabel('Tài khoản').fill('admin');

  // 3. Nhập Mật khẩu
  await page.getByLabel('Mật khẩu').click();
  await page.getByLabel('Mật khẩu').fill('Admin@123');

  // 4. Nhập Mã xác nhận
  await page.getByLabel('Mã xác nhận').fill('1234');

  // 5. Chọn nút Đăng nhập
  await page.getByRole('button', { name: 'Đăng nhập' }).click();

  // 6. Kiểm tra đăng nhập thành công
  await expect(page.getByText('Chào mừng bạn đến với hệ thống')).toBeVisible();
});
