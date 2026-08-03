// Integration test — xác minh Playwright có thể khởi động browser qua channel.
// Chạy: PLAYWRIGHT_BROWSER_CHANNEL=chrome npx playwright test tests/browser-channel.integration.spec.js
// File này nằm trong testDir của playwright.config.js (testDir: ".").
import { test, expect } from "@playwright/test";

test("launches browser via configured channel", async ({ browser }) => {
    // browser không null nghĩa là đã launch được (channel hoặc bundled)
    expect(browser).toBeTruthy();
    const page = await browser.newPage();
    await page.setContent("<h1>ok</h1>");
    expect(await page.textContent("h1")).toBe("ok");
    await page.close();
});
