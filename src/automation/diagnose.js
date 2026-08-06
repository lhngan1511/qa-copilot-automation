/**
 * diagnose — Phân loại lỗi khi chạy Playwright và dựng phản hồi có cấu trúc.
 *
 * Backend Run trả về object có cấu trúc (không chỉ một chuỗi lỗi):
 *   { status, passed, durationMs, errorCode, errorMessage, failedStep,
 *     failedLocator, filePath, line, output, screenshotPath, tracePath, reportPath }
 *
 * Lớp này tách việc "phân loại" + "trích xuất" thành hàm thuần để test trực tiếp.
 */

export const ERROR_CODES = {
    LOCATOR_NOT_FOUND: "LOCATOR_NOT_FOUND",
    ASSERTION_FAILED: "ASSERTION_FAILED",
    BASE_URL_MISSING: "BASE_URL_MISSING",
    BROWSER_NOT_INSTALLED: "BROWSER_NOT_INSTALLED",
    SPEC_NOT_FOUND: "SPEC_NOT_FOUND",
    TIMEOUT: "TIMEOUT",
    SPAWN_FAILED: "SPAWN_FAILED",
    PLAYWRIGHT_PROJECT_NOT_FOUND: "PLAYWRIGHT_PROJECT_NOT_FOUND",
    UNKNOWN_ERROR: "UNKNOWN_ERROR"
};

/** Thông báo tiếng Việt + hướng dẫn xử lý cho từng loại lỗi. */
export const ERROR_MESSAGES = {
    LOCATOR_NOT_FOUND:
        "Không tìm thấy phần tử (locator) trên trang. Kiểm tra lại locator đã map có khớp với CodeGen/màn hình thật không.",
    ASSERTION_FAILED:
        "Kết quả thực tế không khớp với kỳ vọng (assertion thất bại). Xem phần Expected/Received để đối chiếu.",
    BASE_URL_MISSING:
        "Chưa cấu hình môi trường chạy. Cần đặt BASE_URL trong file .env (ví dụ BASE_URL=http://192.168.1.10/wasuco) rồi khởi động lại server.",
    BROWSER_NOT_INSTALLED:
        "Chưa cài trình duyệt. Cài Chrome/Edge và đặt PLAYWRIGHT_BROWSER_CHANNEL=chrome|msedge, hoặc chạy `npx playwright install chromium`.",
    SPEC_NOT_FOUND:
        "Không tìm thấy file kiểm thử đã sinh (spec.js). Hãy sinh automation ở bước ④ trước khi chạy.",
    TIMEOUT:
        "Thao tác quá thời gian chờ. Kiểm tra bước chậm, loading quá lâu hoặc điều kiện trước chưa đạt.",
    SPAWN_FAILED:
        "Không thể khởi chạy Playwright. Kiểm tra trình duyệt đã cài (npx playwright install chromium) và đường dẫn node_modules.",
    PLAYWRIGHT_PROJECT_NOT_FOUND:
        "playwright.config.js khai báo project nhưng không có project 'chromium'. Kiểm tra lại projects trong playwright.config.js.",
    UNKNOWN_ERROR:
        "Xảy ra lỗi không xác định khi chạy. Xem log bên dưới để chẩn đoán."
};

const ASSERTION_PATTERN =
    /expect\(|toBeVisible|toBeHidden|toHaveText|toHaveValue|toBeEnabled|toBeDisabled|toHaveCount|toHaveURL|toHaveTitle|AssertionError|Expected:|Received:/i;
const LOCATOR_PATTERN =
    /waiting for locator|locator\s*\.[a-z]+:|Element is not visible|strict mode violation|Cannot read properties|frame was detached|element is not attached|waiting for selector|getByRole|getByLabel|getByText|getByPlaceholder|getByTestId|navigating to about:blank/i;
const TIMEOUT_PATTERN =
    /Timeout\s+\d+ms\s+exceeded|did not reach a stable state|Test timeout|exceeded its timeout|page\.waitForTimeout|waiting for .*timed out|Timed out waiting/i;
const APP_UNREACHABLE_PATTERN =
    /net::ERR_CONNECTION_REFUSED|net::ERR_NAME_NOT_RESOLVED|net::ERR_CONNECTION_TIMED_OUT|ECONNREFUSED|net::ERR_INTERNET_DISCONNECTED/i;
const NO_TESTS_PATTERN = /No tests found|GENERATED_TEST_FILE_NOT_FOUND|INVALID_TEST_FILE_NAME/i;

/**
 * Phân loại lỗi từ log Playwright.
 * @param {object} o
 * @param {string} o.log
 * @param {boolean} o.baseUrlPresent
 * @param {string|null} o.browserDiagnostic  diagnostic từ resolveBrowser (BUNDLED_CHROMIUM_NOT_INSTALLED / SYSTEM_*_NOT_FOUND)
 * @param {number|null} o.code  exit code
 * @returns {{errorCode:string|null, errorMessage:string|null}}
 */
export function classifyError({ log = "", baseUrlPresent = true, browserDiagnostic = null, code = 0 }) {
    if (code === 0) return { errorCode: null, errorMessage: null };
    const text = String(log ?? "");

    // Ưu tiên: thiếu BASE_URL / browser / spec — đây là lỗi cấu hình rõ ràng.
    if (!baseUrlPresent) return { errorCode: ERROR_CODES.BASE_URL_MISSING, errorMessage: ERROR_MESSAGES.BASE_URL_MISSING };
    if (/BUNDLED_CHROMIUM_NOT_INSTALLED|SYSTEM_CHROME_NOT_FOUND|SYSTEM_EDGE_NOT_FOUND|Executable doesn't exist|browserType.launch|Failed to launch/i.test(`${browserDiagnostic ?? ""} ${text}`)) {
        return { errorCode: ERROR_CODES.BROWSER_NOT_INSTALLED, errorMessage: ERROR_MESSAGES.BROWSER_NOT_INSTALLED };
    }
    if (NO_TESTS_PATTERN.test(text)) return { errorCode: ERROR_CODES.SPEC_NOT_FOUND, errorMessage: ERROR_MESSAGES.SPEC_NOT_FOUND };

    // Lỗi assertion nên ưu tiên hơn locator (expect bao quanh locator trong log).
    if (ASSERTION_PATTERN.test(text)) return { errorCode: ERROR_CODES.ASSERTION_FAILED, errorMessage: ERROR_MESSAGES.ASSERTION_FAILED };
    if (LOCATOR_PATTERN.test(text)) return { errorCode: ERROR_CODES.LOCATOR_NOT_FOUND, errorMessage: ERROR_MESSAGES.LOCATOR_NOT_FOUND };
    if (TIMEOUT_PATTERN.test(text)) return { errorCode: ERROR_CODES.TIMEOUT, errorMessage: ERROR_MESSAGES.TIMEOUT };
    if (APP_UNREACHABLE_PATTERN.test(text)) return { errorCode: ERROR_CODES.UNKNOWN_ERROR, errorMessage: ERROR_MESSAGES.UNKNOWN_ERROR + " (Kiểm tra BASE_URL / máy chủ có khả dụng không.)" };
    return { errorCode: ERROR_CODES.UNKNOWN_ERROR, errorMessage: ERROR_MESSAGES.UNKNOWN_ERROR };
}

/** Trích locator gây lỗi từ log. */
export function extractFailedLocator(log) {
    const text = String(log ?? "");
    const waiting = text.match(/waiting for locator\('([^']+)'\)/i);
    if (waiting) return waiting[1];
    const call = text.match(/page\.(getBy[A-Za-z]+\([^)]*\))/);
    if (call) return `page.${call[1]}`;
    const role = text.match(/getByRole\('([^']+)'[^)]*\)/);
    if (role) return `page.getByRole('${role[1]}')`;
    return null;
}

/** Trích dòng (line) bị lỗi từ stack trace: `at ...:LINE:COL`. */
export function extractLine(log) {
    const text = String(log ?? "");
    const all = [...text.matchAll(/:(\d+):\d+\s*$/gm)];
    const m = all.pop();
    return m ? Number(m[1]) : null;
}

/** Trích tên file spec bị lỗi từ stack / log. */
export function extractFile(log, fallback = null) {
    const text = String(log ?? "");
    const m = text.match(/([\w.-]+\.spec\.[cm]?[jt]s)/i);
    if (m) return m[1];
    return fallback;
}

/** Trích Expected/Received từ lỗi assertion Playwright. */
export function extractAssertionExpectedActual(log) {
    const text = String(log ?? "");
    const expected = text.match(/Expected(?: substring)?:\s*([^\n]+)/i);
    const received = text.match(/Received(?: substring)?:\s*([^\n]+)/i);
    return {
        expected: expected ? expected[1].trim() : null,
        actual: received ? received[1].trim() : null
    };
}

/** Trích đường dẫn artefact (screenshot / trace / report) từ log. */
export function extractArtifacts(log) {
    const text = String(log ?? "");
    const paths = [...text.matchAll(/[\w./\\-]+(?:screenshot|trace|report|test-results)[\w./\\-]*(?:\.png|\.zip|\.html|\.json)?/gi)].map(m => m[0].trim()).filter(Boolean);
    const find = re => paths.find(p => re.test(p)) ?? null;
    return {
        screenshotPath: find(/\.png$/i),
        tracePath: find(/trace.*\.zip|\.zip$/i),
        reportPath: find(/\.html$/i) ?? find(/test-results/i)
    };
}

/**
 * Dựng phản hồi Run có cấu trúc.
 * @returns {{status:string, passed:boolean, durationMs:number, errorCode:string|null,
 *   errorMessage:string|null, failedStep:string|null, failedLocator:string|null,
 *   filePath:string|null, line:number|null, output:string, screenshotPath:string|null,
 *   tracePath:string|null, reportPath:string|null}}
 */
export function buildRunResponse({
    status,
    durationMs = 0,
    log = "",
    baseUrlPresent = true,
    browserDiagnostic = null,
    code = 0,
    filePath = null
}) {
    const { errorCode, errorMessage } = classifyError({ log, baseUrlPresent, browserDiagnostic, code });
    const failedLocator = extractFailedLocator(log);
    const ea = extractAssertionExpectedActual(log);
    return {
        status,
        passed: status === "PASSED",
        durationMs,
        errorCode,
        errorMessage,
        failedStep: extractFailedStep(log),
        failedLocator,
        filePath: extractFile(log, filePath),
        line: extractLine(log),
        output: String(log ?? "").slice(0, 4000),
        ...extractArtifacts(log),
        expectedValue: ea.expected,
        actualValue: ea.actual
    };
}

/** Trích tên bước/bài test bị lỗi (best-effort) từ log. */
export function extractFailedStep(log) {
    const text = String(log ?? "");
    const m = text.match(/\d+\)\s+\[[^\]]+\]\s+(.+)/);
    if (m) return m[1].trim();
    return null;
}
