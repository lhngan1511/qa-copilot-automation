import assert from "node:assert/strict";
import PlaywrightRunner from "../src/automation/PlaywrightRunner.js";

/* Rà locator (proactive audit) — instrumentForAudit + classifyAuditResults là hàm THUẦN
   (không I/O), test trực tiếp bằng fixture giống hệt cấu trúc spec do rendererV3.js sinh ra. */

const runner = new PlaywrightRunner({ spawnFn: () => { throw new Error("không dùng trong test này"); } });

const fixtureSpec = `import { test, expect } from '@playwright/test';
const testData = {
  "Tài khoản": "admin",
};

test("TC001 - Đăng nhập", async ({ page }) => {
  await page.goto(process.env.BASE_URL + "/login");
  await page.getByLabel('Tài khoản').fill(testData["Tài khoản"]);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByText('Xin chào')).toBeVisible();
});
`;

// 1. instrumentForAudit — chèn đúng trước dòng fill/click, KHÔNG chèn trước goto/expect.
const instrumented = runner.instrumentForAudit(fixtureSpec, "C:/tmp/TC001.audit-result.json");
assert.equal(instrumented.ok, true, "nhận diện đúng cấu trúc spec chuẩn");
const code = instrumented.code;
assert.match(code, /import fs from "node:fs";/, "chèn import fs");
assert.match(code, /const __audit = \[\];/, "khai báo mảng audit");
assert.match(code, /try \{/, "bọc try");
assert.match(code, /\} finally \{/, "bọc finally");
assert.match(code, /fs\.writeFileSync\("C:\/tmp\/TC001\.audit-result\.json", JSON\.stringify\(__audit\)\);/, "ghi kết quả ra đúng path (đã đổi \\ -> /)");
// Dòng audit-push phải đứng NGAY TRƯỚC dòng fill/click gốc, cùng thứ tự.
const lines = code.split("\n");
const fillIdx = lines.findIndex(l => l.includes(".fill(testData"));
const clickIdx = lines.findIndex(l => l.includes(".click();"));
assert.match(lines[fillIdx - 1], /__audit\.push\(\{ line: \d+, expr: "page\.getByLabel\('Tài khoản'\)", count: await \(page\.getByLabel\('Tài khoản'\)\)\.count\(\) \}\);/, "chèn audit-push trước fill với đúng expr");
assert.match(lines[clickIdx - 1], /__audit\.push\(\{ line: \d+, expr: "page\.getByRole\('button', \{ name: 'Đăng nhập' \}\)", count:/, "chèn audit-push trước click với đúng expr");
// goto / expect KHÔNG bị chèn audit-push ngay trước.
const gotoIdx = lines.findIndex(l => l.includes("page.goto("));
const expectIdx = lines.findIndex(l => l.includes("toBeVisible()"));
assert.ok(!lines[gotoIdx - 1].includes("__audit.push"), "goto không bị audit");
assert.ok(!lines[expectIdx - 1].includes("__audit.push"), "assertion không bị audit (chỉ audit hành động)");

// 2. Cấu trúc không nhận diện được -> ok:false, không throw.
const malformed = runner.instrumentForAudit("const x = 1;", "C:/tmp/x.json");
assert.equal(malformed.ok, false);
assert.match(malformed.error, /Không nhận diện được cấu trúc/);

// 3. classifyAuditResults — count -> verdict + fragile theo loại locator.
const raw = [
    { line: 7, expr: "getByLabel('Tài khoản')", count: 1 },
    { line: 8, expr: "getByRole('button', { name: 'Đăng nhập' })", count: 0 },
    { line: 9, expr: "locator('.btn-submit')", count: 1 },
    { line: 10, expr: "locator('.row')", count: 3 }
];
const results = runner.classifyAuditResults(raw);
assert.deepEqual(results.map(r => r.verdict), ["OK", "BROKEN", "OK", "AMBIGUOUS"], "verdict đúng theo count 1/0/1/3");
assert.deepEqual(results.map(r => r.kind), ["label", "role", "css", "css"], "phân loại đúng kind theo biểu thức");
assert.deepEqual(results.map(r => r.fragile), [false, false, true, true], "css/xpath được đánh dấu kém ổn định (fragile)");
assert.deepEqual(runner.classifyAuditResults(null), [], "input không hợp lệ -> mảng rỗng, không throw");

console.log("Locator Audit test: PASS");
