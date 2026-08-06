import assert from "node:assert/strict";
import { analyzeCodegen } from "../web-ui/src/utils/codegenStats.js";

/* Sprint 2 — bước ① Upload: đọc CodeGen.js và đếm locator/action/page. */
const sample = `
const { test, expect } = require('@playwright/test');
test('Đăng nhập', async ({ page }) => {
  await page.goto('https://app/login');
  await page.getByLabel('Tài khoản').fill('admin');
  await page.getByLabel('Mật khẩu').fill('secret');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.getByRole('navigation').click();
  await expect(page.getByText('Chào')).toBeVisible();
});
`;

const stats = analyzeCodegen(sample);
// getByLabel x2, getByRole x2, getByText x1 -> locator pattern khớp
assert.equal(stats.locators, 5, "locator = getByLabel*2 + getByRole*2 + getByText*1");
// fill*2, click*2, goto*1 -> 5 action
assert.equal(stats.actions, 5, "action = fill*2 + click*2 + goto*1");
assert.ok(stats.assertions >= 2, "assertion = toBeVisible + expect");
assert.ok(stats.pages.includes("page"), "page biến phải được nhận diện");
assert.ok(stats.pageCount >= 1);

// Không có codegen -> 0
const empty = analyzeCodegen("");
assert.equal(empty.locators, 0);
assert.equal(empty.actions, 0);

// Nhiều page (page1, page2)
const multi = `
const { test } = require('@playwright/test');
test('x', async ({ page }) => {
  const page1 = await context.newPage();
  await page1.goto('https://a');
  const page2 = await context.newPage();
  await page2.goto('https://b');
});
`;
const multiStats = analyzeCodegen(multi);
assert.equal(multiStats.pages.includes("page1"), true);
assert.equal(multiStats.pages.includes("page2"), true);

console.log("CodeGen Stats (Sprint 2) test: PASS");
