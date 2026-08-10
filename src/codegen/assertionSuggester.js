/*
 assertionSuggester — Đề xuất điều kiện xác nhận (assertion) DETERMINISTIC cho V3 (Bước 5C).

 Nguyên tắc (wireframe 5C — đã duyệt):
   - Expected Result do TESTER sở hữu. Hệ thống chỉ ĐỀ XUẤT, không tự quyết định.
   - KHÔNG heuristic mạnh: không suy "đủ/chưa đủ thông tin" từ từ khóa một cách áp đặt;
     chỉ tạo candidate khi có bằng chứng rõ ràng trong dữ liệu hiện có (text trích dẫn, URL, role button).
   - KHÔNG AI ở 5C — nhưng contract suggestion giống hệt AI_SUGGESTED (source khác nhau),
     để sau này cắm AI vào không phá workflow (mục 6 wireframe).
   - Nếu không đủ bằng chứng → trả [] (tester tự bổ sung tay / UI hiện gợi ý nhẹ).
   - Thuần ESM, không gọi API/FS/AI — test được.
*/

export const ASSERTION_TYPES = {
    URL: "URL",
    TEXT_VISIBLE: "TEXT_VISIBLE",
    ROLE_VISIBLE: "ROLE_VISIBLE",
    LOCATOR_VISIBLE: "LOCATOR_VISIBLE",
    VALUE_EQUALS: "VALUE_EQUALS",
    ATTRIBUTE: "ATTRIBUTE",
    COUNT: "COUNT"
};

export const MATCHERS = {
    toHaveURL: "toHaveURL",
    toBeVisible: "toBeVisible",
    toBeHidden: "toBeHidden",
    toHaveValue: "toHaveValue",
    toBeDisabled: "toBeDisabled",
    toHaveCount: "toHaveCount"
};

const KEYWORD_HIEN_THI = /hiển thị|xuất hiện|nhìn thấy|thấy được/;
const KEYWORD_KHONG_HIEN_THI = /không (hiển thị|xuất hiện|nhìn thấy|thấy)|ẩn đi|không còn (hiển thị|thấy|nằm)/;
const KEYWORD_BUTTON = /nút|button/i;
const KEYWORD_DISABLED = /vô hiệu|không bấm được|disabled|mờ đi|không dùng được/i;

/** Trích chuỗi trích dẫn đầu tiên ("..." hoặc '...') trong text. */
export function extractQuoted(text) {
    const m = String(text ?? "").match(/"([^"]+)"/) ?? String(text ?? "").match(/'([^']+)'/);
    return m ? m[1] : null;
}

/** Trích URL đầu tiên (http(s)://, www., hoặc đường dẫn /xxx/yyy). */
export function extractUrl(text) {
    const m = String(text ?? "").match(/(https?:\/\/[^\s"'»]+|www\.[^\s"'»]+|\/[a-zA-Z0-9_\-./]+)/);
    return m ? m[1] : null;
}

/** Bộ đề xuất deterministic — trả list suggestion (source SYSTEM_SUGGESTED, status SUGGESTED). */
export function suggestAssertions({ expectedResult = "", steps = [] } = {}) {
    const text = String(expectedResult ?? "").trim();
    if (!text) return [];

    const suggestions = [];
    const quoted = extractQuoted(text);

    // 1. URL rõ ràng trong Expected Result.
    const url = extractUrl(text);
    if (url && /^(https?:\/\/|www\.)/i.test(url)) {
        suggestions.push({
            type: ASSERTION_TYPES.URL,
            target: "URL sau khi thao tác",
            locator: null,
            expected: url,
            matcher: MATCHERS.toHaveURL,
            source: "SYSTEM_SUGGESTED",
            status: "SUGGESTED",
            reason: `Kết quả mong đợi chứa URL "${url}".`
        });
    }

    // 2. Chuỗi trích dẫn + từ khóa hiển thị / không hiển thị.
    if (quoted) {
        if (KEYWORD_KHONG_HIEN_THI.test(text)) {
            suggestions.push({
                type: ASSERTION_TYPES.TEXT_VISIBLE,
                target: quoted,
                locator: `page.getByText(${JSON.stringify(quoted)})`,
                expected: quoted,
                matcher: MATCHERS.toBeHidden,
                source: "SYSTEM_SUGGESTED",
                status: "SUGGESTED",
                reason: `Kết quả mong đợi nói "${quoted}" KHÔNG hiển thị sau thao tác.`
            });
        } else if (KEYWORD_HIEN_THI.test(text) || text.length >= 12) {
            suggestions.push({
                type: ASSERTION_TYPES.TEXT_VISIBLE,
                target: quoted,
                locator: `page.getByText(${JSON.stringify(quoted)})`,
                expected: quoted,
                matcher: MATCHERS.toBeVisible,
                source: "SYSTEM_SUGGESTED",
                status: "SUGGESTED",
                reason: `Kết quả mong đợi nhắc tới nội dung "${quoted}" sau thao tác.`
            });
        }
    }

    // 3. Nút/button cụ thể được nhắc tên (trong trích dẫn).
    if (quoted && KEYWORD_BUTTON.test(text)) {
        suggestions.push({
            type: ASSERTION_TYPES.ROLE_VISIBLE,
            target: quoted,
            locator: `page.getByRole('button', { name: ${JSON.stringify(quoted)} })`,
            expected: quoted,
            matcher: MATCHERS.toBeVisible,
            source: "SYSTEM_SUGGESTED",
            status: "SUGGESTED",
            reason: `Kết quả mong đợi nhắc tới nút "${quoted}".`
        });
    }

    // 4. Trạng thái vô hiệu / disabled.
    if (KEYWORD_DISABLED.test(text)) {
        suggestions.push({
            type: ASSERTION_TYPES.ATTRIBUTE,
            target: quoted ?? "phần tử cần kiểm tra",
            locator: quoted ? `page.getByText(${JSON.stringify(quoted)})` : null,
            expected: "disabled",
            matcher: MATCHERS.toBeDisabled,
            source: "SYSTEM_SUGGESTED",
            status: "SUGGESTED",
            reason: "Kết quả mong đợi đề cập trạng thái vô hiệu/không dùng được."
        });
    }

    // 5. KHÔNG fallback từ recording/steps: Expected Result do tester sở hữu là nguồn duy nhất.
    //    Nếu không có bằng chứng rõ ràng trong Expected Result → [] (tester tự bổ sung tay;
    //    UI hiện gợi ý nhẹ). Tránh "hệ thống tự hiểu" từ locator recording → sai ý đồ tester.

    // Dedupe theo (matcher + expected).
    const seen = new Set();
    return suggestions.filter(s => {
        const key = `${s.matcher}|${s.expected}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}
