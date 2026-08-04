/**
 * locatorValidation — trích + chuẩn hóa locator từ Playwright Codegen và kiểm tra
 * một locator từ AI mapping/code có nằm trong Codegen source hay không.
 *
 * Dùng cho cả:
 *  - AI Mapping validation (mọi locator phải xuất hiện trong Codegen).
 *  - AI Code validation (code không được dùng locator ngoài mapping/codegen).
 */
import fs from "node:fs";

/** Chuẩn hóa một chuỗi locator để so khớp lỏng (bỏ khoảng trắng, thống nhất nháy đơn). */
export function normalizeLocator(locator) {
    return String(locator ?? "")
        .replace(/\s+/g, " ")
        .replace(/"([^"]*)"/g, "'$1'")
        .replace(/\s*([(),{}])\s*/g, "$1")
        .replace(/^\s*await\s+/, "")
        .trim();
}

/** Trích danh sách locator call từ nội dung codegen (page.getByRole/getByText/...). */
export function extractCodegenLocators(codegenText) {
    const calls = [];
    const re = /page\.(getByRole|getByText|getByPlaceholder|getByTestId|locator|getByLabel)\([^;]*?\)/g;
    let m;
    while ((m = re.exec(codegenText || "")) !== null) {
        const raw = m[0];
        const norm = normalizeLocator(raw);
        if (norm) calls.push(norm);
    }
    // de-dup
    return Array.from(new Set(calls));
}

/** Tạo tập fingerprint (chuẩn hóa) của codegen để tra cứu nhanh. */
export function buildCodegenLocatorSet(codegenText) {
    const set = new Set();
    for (const loc of extractCodegenLocators(codegenText)) set.add(loc);
    return set;
}

/** Kiểm tra một locator (từ mapping/code) có nằm trong codegen source không. */
export function isLocatorInCodegen(locator, codegenLocatorSet) {
    if (!locator) return false;
    const norm = normalizeLocator(locator);
    // so trực tiếp, hoặc so phần thân sau "page."
    if (codegenLocatorSet.has(norm)) return true;
    const body = norm.replace(/^page\./, "");
    for (const cand of codegenLocatorSet) {
        if (cand.replace(/^page\./, "") === body) return true;
    }
    return false;
}

/** Đọc codegen từ file hoặc chuỗi. */
export function loadCodegenText({ codegenText = null, codegenFile = null } = {}) {
    if (codegenText != null) return codegenText;
    if (codegenFile && fs.existsSync(codegenFile)) {
        return fs.readFileSync(codegenFile, "utf8");
    }
    return "";
}

export default {
    normalizeLocator,
    extractCodegenLocators,
    buildCodegenLocatorSet,
    isLocatorInCodegen,
    loadCodegenText
};
