// CodeGen.js — Playwright Codegen ghi lại cho màn hình Danh mục đơn vị tính (demo).
// Bao gồm cả luồng đăng nhập và các thao tác: tìm kiếm, thêm mới, lưu đơn vị tính.
// AI Mapping sẽ đối chiếu từng testcase với những locator thật này.

const { test, expect } = require('@playwright/test');

test('Danh mục đơn vị tính', async ({ page }) => {
  // === Đăng nhập (điều kiện tiên quyết) ===
  await page.goto(process.env.BASE_URL + '/wasuco/login');
  await page.getByLabel('Tài khoản').fill('admin');
  await page.getByLabel('Mật khẩu').fill('Admin@123');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();

  // === Vào màn hình Danh mục đơn vị tính ===
  await page.goto(process.env.BASE_URL + '/wasuco/danh-muc/don-vi-tinh');

  // === Tìm kiếm đơn vị tính theo từ khóa ===
  await page.getByPlaceholder('Nhập mã hoặc tên đơn vị tính').fill('Chiếc');
  await page.getByRole('button', { name: 'Tìm kiếm' }).click();
  await expect(page.getByRole('table')).toBeVisible();

  // === Thêm mới đơn vị tính ===
  await page.getByRole('button', { name: 'Thêm mới' }).click();
  await page.getByLabel('Mã đơn vị tính').fill('DVT001');
  await page.getByLabel('Tên đơn vị tính').fill('Chiếc');
  await page.getByLabel('Ghi chú').fill('Đơn vị tính dùng cho thiết bị');
  await page.getByRole('button', { name: 'Lưu' }).click();

  // === Kiểm tra thêm mới thành công ===
  await expect(page.getByText('Thêm mới thành công')).toBeVisible();
});
