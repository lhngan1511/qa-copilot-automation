import { parseRecording } from "./src/codegen/recordingParser.js";
// A2 — reproduce đúng input tester dán (3 case)
const cases = [
  ["case1 goto", "await page.goto('http://example.com');"],
  ["case2 fill+click", "await page.getByRole('textbox', { name: 'Mã' }).fill('ABC');\nawait page.getByRole('button', { name: 'Lưu' }).click();"],
  ["case3 expect", "await expect(page.getByText('Thêm thành công')).toBeVisible();"],
  ["case4 full", "await page.goto('http://x/login');\nawait page.getByRole('textbox', { name: 'Tài khoản' }).fill('admin');\nawait page.getByRole('button', { name: 'Đăng nhập' }).click();\nawait expect(page.getByRole('button', { name: 'adminButton' })).toBeVisible();"]
];
for (const [name, src] of cases) {
  try {
    const r = parseRecording(src);
    console.log(`[${name}] steps=${r.steps.length} assertions=${r.assertions.length} err=${r.error ?? "none"}`);
    console.log("   steps:", r.steps.map(s => `${s.order}:${s.actionType}`).join(" | "));
    console.log("   asserts:", r.assertions.map(a => `${a.order}:${a.matcher}`).join(" | "));
  } catch (e) {
    console.log(`[${name}] THROW:`, e.message);
  }
}
