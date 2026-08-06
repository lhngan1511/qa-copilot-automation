/**
 * assertionIntelligence — Diễn giải assertion Playwright + đối chiếu với
 * Expected Result để đánh giá "độ bao phủ" và gợi ý bổ sung.
 *
 * Đây là lớp "trí tuệ" của Drawer: thay vì hiện code Playwright, AI giải thích
 * ý nghĩa assertion, đối chiếu xem nó có chứng minh được Expected Result hay
 * không, thiếu kiểm tra gì. Thuần ESM để node test import trực tiếp.
 */

const KIND_DEFS = {
    toBeVisible: { label: "Hiển thị", dimension: "MESSAGE", meaning: obj => `Đối tượng "${obj}" được hiển thị trên màn hình` },
    toBeHidden: { label: "Ẩn đi", dimension: "MESSAGE", meaning: obj => `Đối tượng "${obj}" được ẩn đi` },
    toHaveText: { label: "Nội dung", dimension: "MESSAGE", meaning: obj => `Đối tượng "${obj}" hiển thị nội dung như kỳ vọng` },
    toHaveValue: { label: "Giá trị", dimension: "STATE", meaning: obj => `Ô nhập "${obj}" có giá trị như kỳ vọng` },
    toBeEnabled: { label: "Hoạt động", dimension: "STATE", meaning: obj => `Đối tượng "${obj}" được bật (có thể thao tác)` },
    toBeDisabled: { label: "Khóa", dimension: "STATE", meaning: obj => `Đối tượng "${obj}" bị khóa (không thao tác được)` },
    toHaveCount: { label: "Số lượng", dimension: "STATE", meaning: obj => `Có đúng số lượng đối tượng "${obj}" như kỳ vọng` },
    toHaveURL: { label: "Xác nhận URL", dimension: "URL", meaning: url => `URL thay đổi thành "${url}"` },
    toHaveTitle: { label: "Tiêu đề trang", dimension: "URL", meaning: title => `Trang có tiêu đề "${title}"` }
};

/** Tách tên method assertion từ chuỗi playwrightAssertion (vd toBeVisible). */
export function assertionMethod(text) {
    const m = String(text ?? "").match(/\.(toBeVisible|toBeHidden|toHaveText|toHaveValue|toBeEnabled|toBeDisabled|toHaveCount|toHaveURL|toHaveTitle)\s*\(/);
    return m ? m[1] : null;
}

/** Trích "đối tượng" mà assertion kiểm tra (vd getByText('...') -> '...', getByRole name). */
export function assertionObject(text) {
    const s = String(text ?? "");
    // getByText('x') / getByLabel('x') / getByPlaceholder('x')
    let m = s.match(/getBy(?:Text|Label|Placeholder|AltText|Title)\s*\(\s*['"]([^'"]+)['"]/);
    if (m) return m[1];
    // getByRole('button', { name: 'x' })
    m = s.match(/getByRole\s*\(\s*['"]([^'"]+)['"][\s\S]*?name\s*:\s*['"]([^'"]+)['"]/);
    if (m) return `${m[1]} "${m[2]}"`;
    // toHaveURL('...') / toHaveText('...') / toHaveTitle('...')
    m = s.match(/(?:toHaveURL|toHaveText|toHaveTitle)\s*\(\s*['"]([^'"]+)['"]/);
    if (m) return m[1];
    return "phần tử trang";
}

/** Diễn giải một assertion thành {kind, object, meaning, status}. */
export function interpretAssertion(assertion) {
    const text = String(assertion?.playwrightAssertion ?? "");
    const method = assertionMethod(text);
    if (!method) {
        return {
            kind: "Chưa xác định",
            object: "",
            meaning: String(assertion?.businessExpectation ?? "Kiểm tra kết quả"),
            status: "UNKNOWN"
        };
    }
    const def = KIND_DEFS[method];
    const object = assertionObject(text);
    return {
        kind: def.label,
        object,
        meaning: def.meaning(object),
        status: "MAPPED"
    };
}

/** Xác định các "khía cạnh" kiểm tra mà Expected Result cần chứng minh. */
function expectedDimensions(expectedText) {
    const t = String(expectedText ?? "").toLowerCase();
    const dims = new Set();
    if (/(đăng nhập|login|dashboard|trang chủ|trang chính|chuyển|url|vào hệ thống)/.test(t)) dims.add("URL");
    if (/(lỗi|thông báo|hiển thị|không cho phép|bắt buộc|không thể|message|error|cảnh báo|thành công)/.test(t)) dims.add("MESSAGE");
    if (/(session|phiên|đăng nhập thành công|vào hệ thống|không đăng nhập|vẫn ở)/.test(t)) dims.add("SESSION");
    if (/(khóa|disabled|ẩn|vô hiệu|bắt buộc)/.test(t)) dims.add("STATE");
    return dims;
}

/** Các khía cạnh mà một assertion (method + object) chứng minh được. */
function assertionDimensions(method, object) {
    const dims = new Set();
    const dim = method ? KIND_DEFS[method]?.dimension : null;
    if (dim) dims.add(dim);
    const obj = String(object ?? "").toLowerCase();
    // Đối tượng nói về trang chính / dashboard / heading -> chứng minh đã vào được (URL/session)
    if (/dashboard|trang chủ|trang chính|home|heading|welcome|chào|bảng điều/.test(obj)) {
        dims.add("URL");
        dims.add("SESSION");
    }
    // toHaveURL tới trang chính/dashboard -> chứng minh session đăng nhập
    if (method === "toHaveURL" && /dashboard|trang|home|main/.test(obj)) dims.add("SESSION");
    return dims;
}

/** Đối chiếu Expected với các assertion đã map, tính độ bao phủ + gợi ý. */
export function analyzeExpectedCoverage({ expectedResult = "", assertionMappings = [] }) {
    const expected = String(expectedResult ?? "").trim() || "Kết quả mong đợi";
    const assertions = Array.isArray(assertionMappings) ? assertionMappings : [];
    const interpretations = assertions.map(interpretAssertion);

    const coveredDims = new Set();
    for (const a of assertions) {
        const method = assertionMethod(String(a?.playwrightAssertion ?? ""));
        const object = assertionObject(String(a?.playwrightAssertion ?? ""));
        for (const d of assertionDimensions(method, object)) coveredDims.add(d);
    }

    const relevantDims = expectedDimensions(expected);
    const dimensions = relevantDims.size > 0 ? relevantDims : new Set(["MESSAGE"]);
    const covered = [...dimensions].filter(d => coveredDims.has(d));
    const uncovered = [...dimensions].filter(d => !coveredDims.has(d));
    const coverage = dimensions.size === 0 ? 0 : Math.round((covered.length / dimensions.size) * 100);

    // Gợi ý cho phần chưa được chứng minh
    const recommendations = [];
    const recommendMap = {
        URL: "expect(page).toHaveURL(...) — xác nhận URL thay đổi sau bước",
        MESSAGE: "expect(page.getByText('...')).toBeVisible() — xác nhận thông báo hiển thị",
        SESSION: "expect(page).toHaveURL(...) hoặc kiểm tra heading trang chủ — xác nhận session/đăng nhập",
        STATE: "expect(page.getByRole('button', { name: '...' })).toBeDisabled() — xác nhận trạng thái khóa"
    };
    const missingChecks = uncovered.map(dim => ({
        dimension: dim,
        label: dim === "MESSAGE" ? "xác nhận thông báo" : dim === "URL" ? "xác nhận URL" : dim === "SESSION" ? "xác nhận Session" : "xác nhận trạng thái",
        recommendation: recommendMap[dim]
    }));

    const proved = interpretations.length > 0;
    return {
        expected,
        assertions: interpretations,
        coverage,
        proved,
        relevant: dimensions,
        covered: [...covered],
        uncovered: [...uncovered],
        missingChecks,
        // Kết luận bằng lời
        verdict: proved
            ? (coverage >= 100 ? "Các assertion đã chứng minh đủ Expected Result." : "Còn khía cạnh của Expected Result chưa được assertion chứng minh.")
            : "Chưa tìm thấy assertion nào chứng minh Expected Result."
    };
}

/** Trạng thái đối chiếu CodeGen: mapping / locator / assertion. */
export function codegenStatus(mapping) {
    const m = mapping || {};
    const hasMapping = m && typeof m === "object" && Object.keys(m).length > 0;
    const allSteps = [
        ...(Array.isArray(m.authenticationSetup?.steps) ? m.authenticationSetup.steps : []),
        ...(Array.isArray(m.navigationChain?.steps) ? m.navigationChain.steps : []),
        ...(Array.isArray(m.stepMappings) ? m.stepMappings : [])
    ];
    const locatorFound = allSteps.some(s => String(s?.codegenSource ?? "").toUpperCase() === "PLAYWRIGHT_CODEGEN");
    const assertionFound = Array.isArray(m.assertionMappings) && m.assertionMappings.length > 0;
    return {
        mapped: hasMapping,
        locatorFound,
        assertionFound
    };
}

/** Trạng thái Automation (spec.js đã sinh chưa). */
export function automationStatus(testCase) {
    return {
        generated: Boolean(testCase?.generatedCode || testCase?.generatedFile),
        filePath: testCase?.generatedFile || ""
    };
}
