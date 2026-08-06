/**
 * codegenStats — Phân tích nhanh một file Playwright Codegen (JS) để hiển thị
 * tóm tắt ở bước ① Upload: số locator / action / page. Chỉ dùng cho giao diện
 * (giúp tester thấy "Đọc code thành công"), KHÔNG phải bộ phân tích ngữ nghĩa.
 */

const LOCATOR_PATTERNS = [
    /getByRole\s*\(/g,
    /getByLabel\s*\(/g,
    /getByPlaceholder\s*\(/g,
    /getByText\s*\(/g,
    /getByTestId\s*\(/g,
    /getByAltText\s*\(/g,
    /getByTitle\s*\(/g,
    /locator\s*\(/g,
    /frameLocator\s*\(/g
];

const ACTION_PATTERNS = [
    /\.click\s*\(/g,
    /\.fill\s*\(/g,
    /\.press\s*\(/g,
    /\.selectOption\s*\(/g,
    /\.check\s*\(/g,
    /\.uncheck\s*\(/g,
    /\.dblclick\s*\(/g,
    /\.hover\s*\(/g,
    /\.goto\s*\(/g,
    /\.navigate\s*\(/g
];

const ASSERTION_PATTERNS = [
    /toBeVisible\s*\(/g,
    /toBeHidden\s*\(/g,
    /toHaveValue\s*\(/g,
    /toHaveText\s*\(/g,
    /toHaveCount\s*\(/g,
    /toBeEnabled\s*\(/g,
    /toBeDisabled\s*\(/g,
    /toHaveURL\s*\(/g,
    /toHaveTitle\s*\(/g,
    /expect\s*\(/g
];

function countMatches(text, patterns) {
    let count = 0;
    for (const pattern of patterns) {
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(text)) !== null) {
            count += 1;
        }
    }
    return count;
}

/** Tìm tên các biến Page được khai báo (vd `const page =`, `page1`, `context.newPage()`). */
function collectPages(text) {
    const pages = new Set();
    // Khai báo: `const page =`, `let page =`, `const page1 =`...
    const decl = text.match(/\b(?:const|let|var)\s+(page\d*)\s*=/g) || [];
    for (const d of decl) {
        const m = d.match(/page\d*/);
        if (m) pages.add(m[0]);
    }
    // Tạo mới: `browser.newPage()`, `context.newPage()`, `.newPage()`
    const newPages = text.match(/(?:browser|context)\.newPage\s*\(\)/g) || [];
    if (newPages.length) pages.add("page");
    // Cách dùng trực tiếp `page.` trong thân test (dự phòng)
    const usages = text.match(/\b(page\d*)\./g) || [];
    for (const u of usages) {
        const m = u.match(/page\d*/);
        if (m) pages.add(m[0]);
    }
    return [...pages];
}

/** Trả về tóm tắt: số locator / action / assertion / page và danh sách gợi ý. */
export function analyzeCodegen(text) {
    const source = String(text ?? "");
    const locators = countMatches(source, LOCATOR_PATTERNS);
    const actions = countMatches(source, ACTION_PATTERNS);
    const assertions = countMatches(source, ASSERTION_PATTERNS);
    const pages = collectPages(source);
    return {
        locators,
        actions,
        assertions,
        pages,
        pageCount: pages.length
    };
}
