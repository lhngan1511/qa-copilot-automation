/**
 * runDiagnose — Logic hiển thị tab "Chạy thử" trong Drawer (Generate → Run → Diagnose).
 * Thuần ESM để node test import trực tiếp. Backend đã phân loại lỗi (errorCode +
 * errorMessage tiếng Việt); lớp này chỉ quyết định UI: tab hiện/ẩn, bật/tắt nút,
 * và diễn giải kết quả chạy.
 */

/** Tab "Chạy thử" chỉ hiện khi đã sinh spec.js. */
export function isRunTabVisible({ generated }) {
    return Boolean(generated);
}

/** Nút Run chỉ bật khi đã có spec + đủ dữ liệu + môi trường hợp lệ. */
export function isRunEnabled({ generated, dataReady, environmentValid }) {
    return Boolean(generated) && Boolean(dataReady) && Boolean(environmentValid);
}

/** Diễn giải kết quả chạy cho hiển thị (PASS/FAIL/Chưa chạy). */
export function runDisplay(result = {}) {
    const status = String(result?.status ?? "NOT_RUN").toUpperCase();
    const passed = status === "PASSED" || result?.passed === true;
    const failed = !passed && (status === "FAILED" || status === "ERROR" || status === "DIAGNOSTIC" || status === "FAILED_APP_UNREACHABLE");
    return {
        status,
        passed,
        failed,
        label: passed ? "PASS" : failed ? "FAIL" : "Chưa chạy",
        tone: passed ? "pass" : failed ? "fail" : "idle"
    };
}

/** Đoạn mã gợi ý dùng cho nút "Sao chép". */
export function recommendationCode(check) {
    return String(check?.recommendation ?? "");
}

/** Lý do không bật được Run (để hiển thị gợi ý cho tester). */
export function runBlocker({ generated, dataReady, environmentValid }) {
    if (!generated) return "Chưa có spec.js — hãy 'Sinh automation' ở bước ④ trước.";
    if (!dataReady) return "Testcase còn thiếu dữ liệu — hãy bổ sung ở tab 'Dữ liệu kiểm thử'.";
    if (!environmentValid) return "Chưa chọn môi trường chạy — hãy chọn ở bước ① (môi trường chạy).";
    return null;
}

/** Nội dung hiển thị cho một kết quả FAIL (các trường backend trả về). */
export function failDetail(result = {}) {
    return {
        errorCode: result.errorCode ?? null,
        errorMessage: result.errorMessage ?? "Có lỗi xảy ra khi chạy kiểm thử.",
        failedStep: result.failedStep ?? null,
        failedLocator: result.failedLocator ?? null,
        filePath: result.filePath ?? null,
        line: result.line ?? null,
        expectedValue: result.expectedValue ?? null,
        actualValue: result.actualValue ?? null,
        output: result.output ?? "",
        screenshotPath: result.screenshotPath ?? null,
        tracePath: result.tracePath ?? null,
        reportPath: result.reportPath ?? null
    };
}

/** Hướng dẫn xử lý ngắn cho tester theo errorCode (dự phòng khi backend chưa có). */
export function guidanceFor(errorCode) {
    const map = {
        LOCATOR_NOT_FOUND: "Xem lại locator ở tab 'Đối chiếu kịch bản' cho khớp CodeGen.",
        ASSERTION_FAILED: "Đối chiếu Expected với kết quả thực tế (Expected/Received).",
        BASE_URL_MISSING: "Thêm BASE_URL vào file .env và khởi động lại server.",
        BROWSER_NOT_INSTALLED: "Cài Chrome/Edge hoặc chạy `npx playwright install chromium`.",
        SPEC_NOT_FOUND: "Sinh automation ở bước ④ trước khi chạy.",
        TIMEOUT: "Kiểm tra bước chậm/loading hoặc tăng thời gian chờ.",
        UNKNOWN_ERROR: "Xem log bên dưới để chẩn đoán."
    };
    return map[errorCode] ?? "Xem log bên dưới để chẩn đoán.";
}
