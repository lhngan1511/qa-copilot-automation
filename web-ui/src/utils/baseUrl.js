/**
 * baseUrl — Tự nhận diện Base URL từ CodeGen (page.goto) + ưu tiên nguồn.
 *
 * Thứ tự nguồn BASE_URL:
 *   a. URL tester đã chỉnh/xác nhận trên UI;
 *   b. URL tự nhận diện từ CodeGen (page.goto(...)) — 1 origin;
 *   c. BASE_URL trong .env làm fallback;
 *   d. cả ba không có -> BASE_URL_MISSING.
 *
 * Nếu CodeGen có nhiều origin khác nhau -> không tự đoán, báo "Phát hiện nhiều
 * địa chỉ" và yêu cầu tester chọn.
 * Thuần ESM để node test import trực tiếp.
 */

const SOURCE = {
    USER: "USER", // tester chỉnh/xác nhận
    CODEGEN: "CODEGEN", // tự nhận diện từ page.goto
    ENV: "ENV", // .env fallback
    MULTIPLE: "MULTIPLE", // nhiều origin, cần chọn
    NONE: "NONE"
};

const SOURCE_LABEL = {
    USER: "Người dùng chỉnh sửa",
    CODEGEN: "CodeGen — page.goto(...)",
    ENV: ".env fallback",
    MULTIPLE: "Phát hiện nhiều địa chỉ — chọn URL",
    NONE: "Chưa có Base URL"
};

/** Kiểm tra chuỗi có phải URL hợp lệ có protocol (http/https). */
export function isValidUrl(value) {
    const s = String(value ?? "").trim();
    if (!s) return false;
    try {
        const u = new URL(s);
        return u.protocol === "http:" || u.protocol === "https:";
    } catch {
        return false;
    }
}

/** Tách origin (scheme://host[:port]) từ một URL tuyệt đối. */
export function originOf(url) {
    try {
        const u = new URL(url);
        if (u.protocol !== "http:" && u.protocol !== "https:") return null;
        return u.origin;
    } catch {
        return null;
    }
}

/**
 * Parse toàn bộ page.goto(...) trong CodeGen, lấy origin của URL tuyệt đối.
 * @returns {string[]} mảng origin duy nhất (unique, giữ thứ tự xuất hiện)
 */
export function extractBaseUrls(codegenText) {
    const text = String(codegenText ?? "");
    const seen = [];
    const re = /page\.goto\s*\(\s*(['"`])([^'"`]+)\1/g;
    let m;
    while ((m = re.exec(text)) !== null) {
        const url = m[2];
        const origin = originOf(url);
        if (origin && !seen.includes(origin)) seen.push(origin);
    }
    return seen;
}

/**
 * Giải quyết BASE_URL theo thứ tự nguồn.
 * @param {object} o
 * @param {string} o.edited  URL tester chỉnh/xác nhận
 * @param {string[]} o.detected  origins nhận diện từ CodeGen
 * @param {string} o.envFallback  BASE_URL từ .env
 * @returns {{baseUrl:string|null, source:string, options:string[], multiple:boolean}}
 */
export function resolveBaseUrl({ edited = "", detected = [], envFallback = "" } = {}) {
    const det = Array.isArray(detected) ? detected.filter(isValidUrl) : [];
    const editedUrl = isValidUrl(edited) ? edited.trim() : "";

    // a. tester đã chỉnh/xác nhận -> luôn thắng
    if (editedUrl) {
        return { baseUrl: editedUrl, source: SOURCE.USER, options: det, multiple: false };
    }
    // b. CodeGen: 1 origin -> tự nhận diện
    if (det.length === 1) {
        return { baseUrl: det[0], source: SOURCE.CODEGEN, options: det, multiple: false };
    }
    // b'. CodeGen: nhiều origin -> không tự đoán, cần chọn
    if (det.length > 1) {
        return { baseUrl: null, source: SOURCE.MULTIPLE, options: det, multiple: true };
    }
    // c. .env fallback
    const env = isValidUrl(envFallback) ? envFallback.trim() : "";
    if (env) {
        return { baseUrl: env, source: SOURCE.ENV, options: [], multiple: false };
    }
    // d. không có gì
    return { baseUrl: null, source: SOURCE.NONE, options: [], multiple: false };
}

/** Nhãn tiếng Việt của nguồn. */
export function sourceLabel(source) {
    return SOURCE_LABEL[source] ?? SOURCE_LABEL.NONE;
}

/** Khóa localStorage lưu Base URL theo workspace (module). */
export function workspaceKey(module) {
    return `automation:baseUrl:${String(module ?? "workspace").trim() || "workspace"}`;
}

export { SOURCE };
