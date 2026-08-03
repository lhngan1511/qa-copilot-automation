// Playwright Test config cho Automation MVP.
// Browser channel từ process.env.PLAYWRIGHT_BROWSER_CHANNEL:
//   chrome  -> dùng Chrome hệ thống (channel "chrome")
//   msedge  -> dùng Microsoft Edge hệ thống (channel "msedge")
//   (bỏ trống) -> dùng bundled Chromium (cần `npx playwright install chromium`)
import { defineConfig } from "@playwright/test";

const channel = process.env.PLAYWRIGHT_BROWSER_CHANNEL?.trim() || undefined;

export default defineConfig({
    testDir: ".",
    timeout: 30000,
    fullyParallel: false,
    reporter: "list",
    use: {
        baseURL: process.env.BASE_URL || "http://localhost:3000",
        headless: true,
        channel,
        screenshot: "only-on-failure",
        trace: "retain-on-failure"
    }
});
