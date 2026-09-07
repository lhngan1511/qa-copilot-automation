# Quy tắc Playwright cho dự án này

> Tham khảo từ `docs/claude-testing-kit-main/.claude/rules/playwright_rules.md`, rút gọn cho đúng
> ngăn xếp thật (JS/CommonJS Playwright Test, không Java/Selenium/Appium) và kiến trúc
> recording-driven của dự án (xem [locator_strategy.md](locator_strategy.md) trước).

## 1. Thứ tự ưu tiên locator (chỉ áp dụng khi tự sinh/viết tay locator)

```
getByRole() > getByLabel() > getByPlaceholder() > getByText() > getByTestId() > locator("css")
```

`rendererV3.js` đã theo đúng thứ tự này khi sinh fallback locator cho assertion
(`page.getByLabel(...)`, `page.getByText(...)`) — giữ nguyên khi thêm loại assertion mới, không
lùi về CSS/XPath nếu còn cách semantic dùng được.

## 2. Chiến lược chờ đợi (Wait Strategy)

**Nghiêm cấm:**
- `page.waitForTimeout()` — hard sleep
- `await new Promise(r => setTimeout(r, N))` tự tạo delay

**Dùng thay thế:**
- Auto-waiting mặc định của Playwright + Web-First Assertions:
  ```js
  await expect(locator).toBeVisible();
  await expect(locator).toBeEnabled();
  await expect(locator).toHaveText('...');
  ```
- `waitForSelector()` chỉ khi `expect()` không đáp ứng được yêu cầu đặc biệt.

## 3. Cấu hình chạy hiện tại của dự án (`playwright.config.js`)

- `testDir: "./outputs/generated-tests"` — nơi Runner ghi file do hệ thống sinh, không tạo file
  test thủ công ngoài thư mục này để tránh Playwright quét nhầm.
- `headless` / `slowMo` / `channel` đọc từ env (`PLAYWRIGHT_HEADLESS`, `PLAYWRIGHT_SLOW_MO`,
  `PLAYWRIGHT_BROWSER_CHANNEL`) — `PlaywrightRunner.js` ghi đè theo từng lần chạy, không hardcode
  giá trị trong config khi thêm tính năng mới.
- `screenshot: "only-on-failure"`, `trace: "retain-on-failure"` ở config gốc; riêng
  `playwright.boundary.config.js` (Kiểm thử biên) bật `screenshot: "on"` vì tester cần thấy giao
  diện thật cả khi PASSED lẫn FAILED — xem chú thích trong `PlaywrightRunner.js#runBoundarySpec`.
- Chưa pin `viewport` cố định (mặc định Playwright 1280×720). Nếu sau này cần pin viewport để demo
  nhất quán, sửa `use.viewport` trong `playwright.config.js` — đây là quyết định ảnh hưởng hành vi
  chạy thật, cần xác nhận với tester/dev trước khi đổi, không tự ý thêm.

## 4. Cấu trúc test sinh ra

Spec sinh ra hiện là **file phẳng theo từng testcase** (`outputs/generated-tests/TC001.spec.js`),
không phải Page Object Model — vì input là Recording (1 recording ↔ 1 spec), không phải code viết
tay cần tách Page/Test/Utils. Không áp POM lên spec sinh tự động; nếu viết Playwright thủ công
khác trong repo (helper, tool debug) thì tách rõ setup/thao tác/assertion cho dễ đọc.
