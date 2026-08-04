import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {

  await page.goto('http://172.16.1.100:9230/wasuco/login?returnUrl=http%3A%2F%2F172.16.1.100%3A9230%2F');

  await page.getByRole('textbox', { name: 'Tài khoản' }).click();

  await page.getByRole('textbox', { name: 'Tài khoản' }).fill('admin');

  await page.getByRole('textbox', { name: 'Mật khẩu' }).click();

  await page.getByRole('textbox', { name: 'Mật khẩu' }).fill('123456@Â');

  await page.locator('button').first().click();

  await page.getByRole('textbox', { name: 'Mật khẩu' }).fill('123456@');

  await page.getByRole('textbox', { name: 'Mật khẩu' }).press('CapsLock');

  await page.getByRole('textbox', { name: 'Mật khẩu' }).fill('123456@');

  await page.getByRole('textbox', { name: 'Mật khẩu' }).press('CapsLock');

  await page.getByRole('textbox', { name: 'Mật khẩu' }).fill('123456@Aa');

  await page.getByRole('textbox', { name: 'Mã xác nhận' }).click();

  await page.getByRole('textbox', { name: 'Mã xác nhận' }).fill('xxxxx');

  await page.getByRole('button', { name: 'Đăng nhập' }).click();

  await expect(page.getByRole('link', { name: 'Asset Quản lý trang thiết bị' })).toBeVisible();

  await page.getByRole('link', { name: 'Asset Quản lý trang thiết bị' }).click();

  await expect(page.getByRole('button', { name: 'adminButton' })).toBeVisible();

  await page.getByRole('button', { name: 'Danh mục' }).click();

  await page.getByRole('link', { name: 'Đơn vị tính' }).click();

  await page.getByRole('button', { name: 'Thêm mới' }).click();

  await page.getByRole('textbox', { name: 'Tên đơn vị tính' }).click();

  await page.getByRole('textbox', { name: 'Tên đơn vị tính' }).fill('Cái 1');

  await page.getByText('Sinh mã').dblclick();

  await page.locator('form').filter({ hasText: 'Mã đơn vị tínhSinh mãTên đơn' }).getByRole('img').click();

  await page.locator('form').filter({ hasText: 'Mã đơn vị tínhSinh mãTên đơn' }).getByRole('img').click();

  await page.getByRole('textbox', { name: 'Ghi chú' }).click();

  await page.getByRole('textbox', { name: 'Ghi chú' }).fill('Nhập ghi chú');

  await page.getByRole('button', { name: 'Thêm mới', description: 'title button', exact: true }).click();

  await page.getByRole('button', { name: 'Thêm mới' }).click();

  await page.getByRole('textbox', { name: 'Tên đơn vị tính' }).click();

  await page.getByRole('textbox', { name: 'Tên đơn vị tính' }).fill('cái 2');

  await page.getByRole('textbox', { name: 'Ghi chú' }).click();

  await page.getByRole('textbox', { name: 'Ghi chú' }).fill('ghi chú 2');

  await page.getByRole('button', { name: 'Thêm mới', description: 'title button', exact: true }).click();

  await page.getByText('Thêm mới đơn vị tính thành cô').click();

  await expect(page.getByText('Thêm mới đơn vị tính thành cô')).toBeVisible();

  await page.getByRole('button', { name: 'Thêm mới' }).click();

  await page.getByRole('button', { name: 'Thêm mới', description: 'title button', exact: true }).click();

  await expect(page.getByText('Vui lòng nhập Tên đơn vị tính')).toBeVisible();

  await page.getByRole('button', { name: 'Hủy bỏ' }).click();

  await page.getByRole('textbox', { name: 'text search' }).click();

  await page.getByRole('textbox', { name: 'text search' }).fill('cái 1');

  await page.getByRole('button', { name: 'Tìm' }).click();

  await expect(page.getByText('trên tổng số 1 dòng dữ liệu')).toBeVisible();

  await page.getByRole('button', { description: 'Cập nhật', exact: true }).click();

  await page.getByRole('textbox', { name: 'Tên đơn vị tính' }).click();

  await page.getByRole('textbox', { name: 'Tên đơn vị tính' }).fill('Cái 2a');

  await page.getByRole('button', { name: 'Cập nhật' }).click();

  await page.getByRole('textbox', { name: 'text search' }).click();

  await page.getByRole('textbox', { name: 'text search' }).fill('cái 2a');

  await page.getByRole('button', { name: 'Tìm' }).click();

  await page.getByRole('button', { description: 'Cập nhật', exact: true }).click();

  await page.getByRole('textbox', { name: 'Ghi chú' }).click();

  await page.getByRole('textbox', { name: 'Ghi chú' }).fill('Nhập ghi chú abc');

  await page.getByRole('button', { name: 'Cập nhật' }).click();

  await expect(page.getByText('Cập nhật thành công')).toBeVisible();

  await page.getByText('Thành công', { exact: true }).click();

  await page.getByRole('button', { description: 'Cập nhật', exact: true }).click();

  await page.getByText('Sinh mã', { exact: true }).click();

  await page.getByRole('button', { name: 'Cập nhật' }).click();

  await expect(page.getByRole('button').filter({ hasText: /^$/ }).nth(2)).toBeVisible();

  await expect(page.getByRole('button').filter({ hasText: /^$/ }).nth(3)).toBeVisible();

  await page.getByRole('button', { description: 'Xóa', exact: true }).click();

  await expect(page.getByText('Xác nhận xóa')).toBeVisible();

  await expect(page.getByRole('button', { name: 'Xóa', description: 'title button' })).toBeVisible();

  await expect(page.getByRole('button', { name: 'Xóa', description: 'title button' })).toBeVisible();

  await expect(page.getByRole('button', { name: 'Hủy bỏ' })).toBeVisible();

  await page.getByRole('button', { name: 'Xóa', description: 'title button' }).click();

  await expect(page.getByText('Không tìm thấy kết quả')).toBeVisible();

});
