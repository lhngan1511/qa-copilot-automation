// Playwright Test config CHỈ dùng cho job RUN_BOUNDARY (Kiểm thử biên chạy từ xa, Ngân yêu cầu
// 2026-09-07) — mirror đúng playwright.boundary.config.js gốc ở repo chính: kế thừa
// playwright.config.js của chính Runner này, chỉ đổi 1 điểm: luôn chụp ảnh màn hình sau mỗi lần
// chạy (PASSED lẫn FAILED), không chỉ khi FAILED như config mặc định — tester cần quan sát giao
// diện thực tế sau khi nhập giá trị biên, không chỉ tin nhãn PASSED/FAILED tự động.
import { defineConfig } from "@playwright/test";
import baseConfig from "./playwright.config.js";

export default defineConfig(baseConfig, {
    use: {
        screenshot: "on"
    }
});
