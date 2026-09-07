// Playwright Test config CHỈ dùng cho Kiểm thử biên (Phase 5) — kế thừa playwright.config.js,
// chỉ đổi 1 điểm: luôn chụp ảnh màn hình sau mỗi lần chạy (PASSED lẫn FAILED), không chỉ khi
// FAILED như cấu hình mặc định. Lý do: tester cần QUAN SÁT giao diện thực tế sau khi nhập giá
// trị biên và nhấn Lưu/Enter để tự đánh giá — không thể chỉ tin vào nhãn PASSED/FAILED tự động
// (vd: FAILED có thể do timeout/lỗi kỹ thuật không liên quan gì đến giá trị biên đang kiểm thử).
import { defineConfig } from "@playwright/test";
import baseConfig from "./playwright.config.js";

export default defineConfig(baseConfig, {
    use: {
        screenshot: "on"
    }
});
