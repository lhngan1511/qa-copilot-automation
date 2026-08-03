import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('http://172.16.1.100:9230/user/login?returnUrl=http%3A%2F%2F172.16.1.100%3A9230%2F');

  await page.getByRole('textbox', { name: 'Tài khoản' }).click();

  await page.getByRole('textbox', { name: 'Tài khoản' }).fill('admin');

  await page.getByRole('textbox', { name: 'Mật khẩu' }).click();

  await page.getByRole('textbox', { name: 'Mật khẩu' }).fill('123456@Â');

  await page.locator('button').first().click();

  await page.getByRole('textbox', { name: 'Mật khẩu' }).fill('123456@Aa');

  await page.getByRole('textbox', { name: 'Mã xác nhận' }).click();

  await page.getByRole('textbox', { name: 'Mã xác nhận' }).fill('123456');

  await page.getByRole('button', { name: 'Đăng nhập' }).click();

  await expect(page.getByRole('button', { name: 'adminButton' })).toBeVisible();

  await page.getByRole('textbox', { name: 'Tài khoản' }).click();

  await page.getByRole('textbox', { name: 'Tài khoản' }).fill('admin');

  await page.getByRole('textbox', { name: 'Mã xác nhận' }).click();

  await page.getByRole('textbox', { name: 'Mã xác nhận' }).fill('11111');

  await page.getByRole('button', { name: 'Đăng nhập' }).click();

  await expect(page.getByText('Vui lòng nhập Mật khẩu')).toBeVisible();

  await page.getByRole('textbox', { name: 'Mật khẩu' }).click();

  await page.getByRole('textbox', { name: 'Mật khẩu' }).fill('123456@Â');

  await page.locator('button').first().click();

  await page.getByRole('textbox', { name: 'Mật khẩu' }).fill('123456@Aa');

  await page.getByRole('textbox', { name: 'Mã xác nhận' }).click();

  await page.getByRole('textbox', { name: 'Mã xác nhận' }).fill('1234566');

  await page.getByRole('button', { name: 'Đăng nhập' }).click();

  await expect(page.getByText('Vui lòng nhập Tên tài khoản')).toBeVisible();

  await page.getByRole('textbox', { name: 'Tài khoản' }).click();

  await page.getByRole('textbox', { name: 'Tài khoản' }).fill('');

  await page.getByRole('textbox', { name: 'Tài khoản' }).press('CapsLock');

  await page.getByRole('textbox', { name: 'Tài khoản' }).fill('admin');

  await page.getByRole('textbox', { name: 'Mật khẩu' }).click();

  await page.getByRole('textbox', { name: 'Mật khẩu' }).fill('123456@Aa');

  await page.locator('button').first().click();

  await page.getByRole('button', { name: 'Đăng nhập' }).click();

  await expect(page.getByText('Vui lòng nhập Mã xác nhận')).toBeVisible();
});
