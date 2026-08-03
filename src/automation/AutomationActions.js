/**
 * Danh sách action / assertion được hỗ trợ bởi Playwright Generator.
 * Chuẩn hóa từ tên tiếng Việt (natural-language step) sang structured action.
 */

export const SUPPORTED_ACTIONS = new Set([
    "goto",
    "open",
    "fill",
    "click",
    "press",
    "select",
    "check",
    "uncheck",
    "wait",
    "screenshot",
    "login"
]);

export const SUPPORTED_ASSERTIONS = new Set([
    "toBeVisible",
    "toBeHidden",
    "toHaveValue",
    "toContainText",
    "toHaveText",
    "toBeEnabled",
    "toBeDisabled",
    "toHaveURL",
    "toHaveCount",
    "toBeChecked"
]);

const ACTION_SYNONYMS = {
    open: ["open", "mở", "mở màn hình", "mở màn hình hoặc chức năng", "đi đến", "navigate", "chuyển đến", "vào"],
    goto: ["goto", "go to", "truy cập", "truy cập url"],
    fill: ["fill", "nhập", "nhập dữ liệu", "nhập giá trị", "gõ", "input", "type", "điền"],
    click: ["click", "nhấn", "bấm", "chọn nút", "chọn", "submit", "nhấp", "lưu dữ liệu", "nhấn lưu", "thêm", "đăng nhập", "xác nhận", "lưu"],
    select: ["select", "chọn giá trị", "chọn từ danh sách", "chọn dropdown"],
    check: ["check", "chọn checkbox", "tích", "tích chọn"],
    uncheck: ["uncheck", "bỏ chọn checkbox", "bỏ tích"],
    press: ["press", "nhấn phím", "enter"],
    wait: ["wait", "chờ", "đợi", "chờ tải"],
    screenshot: ["screenshot", "chụp màn hình", "chụp hình"],
    setup: ["thiết lập điều kiện trước", "thiết lập", "điều kiện trước", "setup", "precondition"],
    verify: ["kiểm tra kết quả nghiệp vụ", "kiểm tra kết quả", "kiểm tra", "verify", "xác minh"]
};

const ASSERTION_SYNONYMS = {
    toBeVisible: ["hiển thị", "xuất hiện", "visible", "hiện", "thấy", "được hiển thị", "được tạo thành công"],
    toBeHidden: ["không hiển thị", "ẩn", "hidden", "biến mất", "không xuất hiện"],
    toHaveValue: ["nhận giá trị", "có giá trị", "giá trị đã nhập", "bằng"],
    toContainText: ["chứa", "bao gồm", "thông báo", "msg", "hiển thị thông báo", "thông báo thành công"],
    toHaveText: ["hiển thị text", "có nội dung", "hiển thị"],
    toBeEnabled: ["được kích hoạt", "enabled", "có thể bấm", "bấm được"],
    toBeDisabled: ["bị vô hiệu", "disabled", "không bấm được", "bị khóa"],
    toHaveURL: ["chuyển sang trang", "chuyển đến trang", "url", "redirect", "chuyển hướng"],
    toBeChecked: ["được chọn", "checked", "được tick"]
};

function normalizeToken(text) {
    return String(text ?? "")
        .trim()
        .toLowerCase()
        .replace(/[\s_]+/g, " ");
}

function matchesAny(text, synonyms) {
    const t = normalizeToken(text);
    if (!t) return false;
    return synonyms.some((syn) => t.includes(normalizeToken(syn)));
}

/**
 * Chuẩn hóa một action tiếng Việt/natural-language về action chuẩn.
 * @returns {string} action chuẩn, hoặc null nếu không nhận diện.
 */
export function normalizeAction(text) {
    for (const [action, synonyms] of Object.entries(ACTION_SYNONYMS)) {
        if (matchesAny(text, synonyms)) return action;
    }
    return null;
}

/**
 * Chuẩn hóa một assertion tiếng Việt về assertion chuẩn (Playwright).
 */
export function normalizeAssertion(text) {
    for (const [assertion, synonyms] of Object.entries(ASSERTION_SYNONYMS)) {
        if (matchesAny(text, synonyms)) return assertion;
    }
    return null;
}

/** Chuẩn hóa type assertion có sẵn (SUCCESS, VALIDATION, ...) sang Playwright. */
export function mapAssertionType(type) {
    const t = normalizeToken(type);
    if (!t) return "toBeVisible";
    if (["success", "authenticated"].includes(t)) return "toBeVisible";
    if (["validation"].includes(t)) return "toContainText";
    if (["access_denied", "operation_blocked", "script_not_executed"].includes(t)) {
        return "toBeVisible";
    }
    return "toBeVisible";
}

export default {
    SUPPORTED_ACTIONS,
    SUPPORTED_ASSERTIONS,
    normalizeAction,
    normalizeAssertion,
    mapAssertionType
};
