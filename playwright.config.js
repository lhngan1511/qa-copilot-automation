// Playwright Test config cho Automation MVP.
// Browser channel từ process.env.PLAYWRIGHT_BROWSER_CHANNEL:
//   chrome  -> dùng Chrome hệ thống (channel "chrome")
//   msedge  -> dùng Microsoft Edge hệ thống (channel "msedge")
//   (bỏ trống) -> dùng bundled Chromium (cần `npx playwright install chromium`)
//
// Quan sát quá trình automation (chỉ cấu hình, không đổi workflow):
//   PLAYWRIGHT_HEADLESS  : "true" (mặc định) chạy ẩn | "false" mở browser hệ thống để quan sát
//   PLAYWRIGHT_SLOW_MO   : số ms chờ giữa mỗi hành động (mặc định 0). Vd 500 để chạy chậm.
//
// testDir trỏ vào thư mục generated-tests — nơi Runner lưu file do AI sinh.
// Runner truyền RELATIVE path (từ project root) để Playwright tìm đúng test.
import { defineConfig } from "@playwright/test";

const channel = process.env.PLAYWRIGHT_BROWSER_CHANNEL?.trim() || undefined;
const headless = String(process.env.PLAYWRIGHT_HEADLESS ?? "true").trim().toLowerCase() !== "false";
const slowMo = Number(process.env.PLAYWRIGHT_SLOW_MO ?? "0") || 0;

export default defineConfig({
    testDir: "./outputs/generated-tests",
    timeout: 30000,
    fullyParallel: false,
    reporter: "list",
    use: {
        baseURL: process.env.BASE_URL || "http://localhost:3000",
        headless,
        channel,
        launchOptions: { slowMo },
        screenshot: "only-on-failure",
        trace: "retain-on-failure"
    }
});
