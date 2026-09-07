// Playwright Test config CHỈ dùng cho Rà locator (proactive audit) — kế thừa playwright.config.js,
// đổi 2 điểm:
//   1. testDir riêng (./outputs/generated-tests/.audit) — tách khỏi testDir chính để không bị
//      quét nhầm khi chạy full-suite qua playwright.config.js gốc (cùng lý do
//      playwright.boundary.config.js có config riêng cho Kiểm thử biên).
//   2. actionTimeout thấp hơn mặc định — khi 1 locator đã gãy (count=0), bước hành động sau đó
//      (click/fill/...) sẽ chờ hết timeout mới báo lỗi; audit không cần chờ như test thật, nên
//      rút ngắn để tester không phải đợi lâu khi rà 1 testcase có nhiều bước.
import { defineConfig } from "@playwright/test";
import baseConfig from "./playwright.config.js";

export default defineConfig(baseConfig, {
    testDir: "./outputs/generated-tests/.audit",
    use: {
        actionTimeout: 8000
    }
});
