const ACTION_LABELS = {
    SEARCH: "Tìm kiếm",
    CREATE: "Thêm",
    UPDATE: "Cập nhật",
    DELETE: "Xóa"
};

const VI_PREFIX =
    "thêm mới|tạo mới|thêm|sửa|cập nhật|chỉnh sửa|xóa|xoá|tìm kiếm|tra cứu|quản lý";
const EN_PREFIX = "search|find|create|add|update|edit|delete|remove|view|manage";
const LEADING_ACTION = new RegExp(`^(?:${VI_PREFIX}|${EN_PREFIX})\\s+`, "i");
const ENGLISH_ACTION_TOKEN = new RegExp(`\\b(?:${EN_PREFIX})\\b`, "gi");

export function actionLabel(operation) {
    const key = String(operation ?? "")
        .trim()
        .toUpperCase()
        .replace(/[\s_-]+/g, "");
    if (/CREATE|ADD/.test(key)) return ACTION_LABELS.CREATE;
    if (/UPDATE|EDIT/.test(key)) return ACTION_LABELS.UPDATE;
    if (/DELETE|REMOVE/.test(key)) return ACTION_LABELS.DELETE;
    if (/SEARCH|FIND/.test(key)) return ACTION_LABELS.SEARCH;
    return "";
}

export function domainName(functionName, fallback = "dữ liệu") {
    let text = clean(functionName);
    let previous = "";
    while (text && text !== previous) {
        previous = text;
        text = text.replace(LEADING_ACTION, "").trim();
    }
    text = stripEnglishActionTokens(text);
    return text || fallback;
}

export function localizedFunctionName(functionName, operation) {
    const domain = domainName(functionName, "");
    const label = actionLabel(operation) || inferActionLabel(functionName);
    if (label && domain) return `${label} ${domain}`;
    return label || domain || clean(functionName);
}

export function stripEnglishActionTokens(value) {
    return clean(String(value ?? "").replace(ENGLISH_ACTION_TOKEN, " "));
}

export function sanitizeUserFacingText(value) {
    if (typeof value !== "string") return value;
    return stripEnglishActionTokens(value);
}

function inferActionLabel(functionName) {
    const normalized = comparable(functionName);
    if (/^(tim kiem|tra cuu|search|find)\b/.test(normalized)) return ACTION_LABELS.SEARCH;
    if (/^(them moi|tao moi|them|create|add)\b/.test(normalized)) return ACTION_LABELS.CREATE;
    if (/^(cap nhat|chinh sua|sua|update|edit)\b/.test(normalized)) return ACTION_LABELS.UPDATE;
    if (/^(xoa|delete|remove)\b/.test(normalized)) return ACTION_LABELS.DELETE;
    return "";
}

function clean(value) {
    return String(value ?? "")
        .replace(/\s+/g, " ")
        .trim();
}

function comparable(value) {
    return clean(value)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "d")
        .toLowerCase();
}
