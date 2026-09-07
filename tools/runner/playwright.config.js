// Playwright Test config riêng cho Runner Agent (không phụ thuộc repo qa-copilot-automation).
// Cùng nguyên tắc với playwright.config.js gốc: browser/headed/slowMo lấy từ env do agent.mjs đặt
// mỗi lần chạy, để hành vi giống hệt lúc server tự chạy local (PlaywrightRunner).
import { defineConfig } from "@playwright/test";

const channel = process.env.PLAYWRIGHT_BROWSER_CHANNEL?.trim() || undefined;
const headless = String(process.env.PLAYWRIGHT_HEADLESS ?? "false").trim().toLowerCase() !== "false";
const slowMo = Number(process.env.PLAYWRIGHT_SLOW_MO ?? "0") || 0;

export default defineConfig({
    testDir: "./work",
    timeout: 30000,
    fullyParallel: false,
    reporter: "line",
    use: {
        baseURL: process.env.BASE_URL || "http://localhost:3000",
        headless,
        channel,
        launchOptions: { slowMo },
        screenshot: "only-on-failure",
        trace: "retain-on-failure"
    }
});
