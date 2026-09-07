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
        requestedFilePath: result.requestedFilePath ?? null,
        fileExists: result.fileExists ?? null,
        line: result.line ?? null,
        expectedValue: result.expectedValue ?? null,
        actualValue: result.actualValue ?? null,
        output: result.output ?? "",
        screenshotPath: result.screenshotPath ?? null,
        tracePath: result.tracePath ?? null,
        reportPath: result.reportPath ?? null
    };
}

/** Các field chỉ nên hiển thị với từng loại lỗi (tránh dữ liệu gây nhiễu). */
export function visibleFailFields(detail) {
    const code = detail.errorCode;
    if (code === "SPEC_NOT_FOUND") {
        // Không hiển thị locator/assertion vì Playwright chưa bắt đầu chạy.
        return { filePath: true, locator: false, step: false, expected: false, output: true };
    }
    if (code === "LOCATOR_NOT_FOUND") return { filePath: true, locator: true, step: true, expected: false, output: true };
    if (code === "ASSERTION_FAILED") return { filePath: true, locator: false, step: true, expected: true, output: true };
    if (code === "BASE_URL_MISSING") return { filePath: true, locator: false, step: false, expected: false, output: true };
    return { filePath: true, locator: true, step: true, expected: true, output: true };
}

/** Loại locator theo cách gọi Playwright — dùng để đưa gợi ý sửa đúng loại (self-healing). */
function classifyLocatorKind(failedLocator) {
    const s = String(failedLocator ?? "");
    if (!s) return null;
    if (/getByRole/i.test(s)) return "role";
    if (/getByLabel/i.test(s)) return "label";
    if (/getByPlaceholder/i.test(s)) return "placeholder";
    if (/getByTestId/i.test(s)) return "testid";
    if (/getByText/i.test(s)) return "text";
    if (/^\/\/|xpath=/i.test(s)) return "xpath";
    return "css";
}

/** Gợi ý sửa theo loại locator bị fail — thứ tự ưu tiên độ ổn định: role/label/placeholder/text
 *  > data-testid > css > xpath (css/xpath dễ vỡ nhất khi giao diện đổi). */
const LOCATOR_HEALING_HINTS = {
    role: "Locator bám theo vai trò (role) + tên hiển thị không khớp — kiểm tra lại tên nút/nhãn trên giao diện thật có bị đổi chữ không.",
    label: "Locator bám theo label không khớp — nhãn trường trên giao diện có thể đã đổi chữ.",
    placeholder: "Locator bám theo placeholder không khớp — placeholder có thể đã đổi hoặc bị xoá.",
    text: "Locator bám theo nội dung chữ không khớp — nội dung hiển thị trên giao diện có thể đã đổi.",
    testid: "Locator bám theo data-testid không khớp — phần tử có thể đã bị đổi/xoá thuộc tính test-id.",
    css: "Locator bám theo CSS/class không khớp — CSS dễ đổi mỗi khi giao diện cập nhật, đây là loại kém ổn định nhất.",
    xpath: "Locator bám theo XPath không khớp — XPath dễ vỡ khi cấu trúc trang đổi, đây là loại kém ổn định nhất."
};

/** Hướng dẫn xử lý ngắn cho tester theo errorCode (dự phòng khi backend chưa có).
 *  Với LOCATOR_NOT_FOUND, truyền thêm failedLocator để có gợi ý theo đúng loại locator bị fail —
 *  vì locator ở dự án này lấy từ Recording (không đoán/sửa tay trong spec), nên hướng xử lý luôn
 *  là quay lại Ghi màn hình để cập nhật locator mới, không tự sửa file spec đã sinh. */
export function guidanceFor(errorCode, failedLocator = null) {
    if (errorCode === "LOCATOR_NOT_FOUND") {
        const kind = classifyLocatorKind(failedLocator);
        const hint = kind ? LOCATOR_HEALING_HINTS[kind] : "Locator không khớp với giao diện hiện tại.";
        return `${hint} Quay lại bước Ghi màn hình để cập nhật locator mới rồi Sinh lại automation — không tự sửa tay file spec.`;
    }
    const map = {
        ASSERTION_FAILED: "Đối chiếu Expected với kết quả thực tế (Expected/Received).",
        BASE_URL_MISSING: "Thêm BASE_URL vào file .env và khởi động lại server.",
        BROWSER_NOT_INSTALLED: "Cài Chrome/Edge hoặc chạy `npx playwright install chromium`.",
        SPEC_NOT_FOUND: "Sinh automation ở bước ④ trước khi chạy.",
        TIMEOUT: "Kiểm tra bước chậm/loading hoặc tăng thời gian chờ.",
        UNKNOWN_ERROR: "Xem log bên dưới để chẩn đoán."
    };
    return map[errorCode] ?? "Xem log bên dưới để chẩn đoán.";
}
