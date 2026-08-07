/**
 * testDataBinding — Contract P0 FINAL: Action Preservation + TestData Binding + Assertion Source.
 *
 * Nguyên tắc:
 *   - CodeGen quyết định "làm gì" (locator/action/thứ tự).
 *   - JSON/Drawer quyết định "dùng dữ liệu gì".
 *   - Không bỏ action đã record trong CodeGen.
 *   - Thứ tự ưu tiên dữ liệu: EMPTY > USER_CONFIRMED > APPROVED_JSON > CODEGEN_RECORDED > ENV_FALLBACK > MISSING.
 *   - Không sinh assertion giả (không dùng locatorKey làm accessible name).
 * Thuần ESM, không phụ thuộc Runner/UI.
 */

import { selectSegmentAssertion, traceSegment } from "./assertionSegment.js";

export const TESTDATA_SOURCES = {
    EMPTY: "TESTCASE_EMPTY",
    USER_CONFIRMED: "USER_CONFIRMED",
    APPROVED_JSON: "APPROVED_JSON",
    CODEGEN_RECORDED: "CODEGEN_RECORDED",
    ENV_FALLBACK: "ENV_FALLBACK",
    MISSING: "MISSING"
};

/** entryRoute có phải URL tuyệt đối (http/https)? */
export function isAbsoluteUrl(route) {
    return /^https?:\/\//i.test(String(route ?? "").trim());
}

/**
 * Render statement `page.goto(...)` cho entryRoute.
 * - URL tuyệt đối (http://...) -> page.goto(process.env.BASE_URL + '/path') — bỏ origin/host,
 *   để LUÔN dùng process.env.BASE_URL (BASE_URL = origin/host). Tránh hardcode URL/host.
 * - Path tương đối (/wasuco/login) -> page.goto(process.env.BASE_URL + '/path').
 * @returns {string|null}
 */
export function renderGotoStatement(entryRoute) {
    const route = String(entryRoute ?? "").trim();
    if (!route || /->|→/.test(route)) return null;
    if (isAbsoluteUrl(route)) {
        // URL tuyệt đối -> bỏ origin/host, giữ path+query+hash; nối process.env.BASE_URL (origin).
        // Đáp ứng Rule Validation "không hardcode URL/host, phải dùng process.env.BASE_URL".
        const parsed = parseAbsoluteUrl(route);
        const target = parsed ? (parsed.path + parsed.search + parsed.hash || "/") : route;
        return `  await page.goto(process.env.BASE_URL + ${JSON.stringify(target)});`;
    }
    return `  await page.goto(process.env.BASE_URL + ${JSON.stringify(route)});`;
}

/** Parse http/https URL → { path, search, hash }. Trả null nếu không parse được. */
export function parseAbsoluteUrl(value) {
    try {
        const u = new URL(String(value));
        if (u.protocol !== "http:" && u.protocol !== "https:") return null;
        return { path: u.pathname, search: u.search, hash: u.hash };
    } catch {
        return null;
    }
}

/**
 * Alias ngữ nghĩa để resolve fieldKey. Chỉ phục vụ resolve field, KHÔNG hardcode business flow.
 * key = fieldKey chuẩn; value = các label/alias khớp.
 */
export const SEMANTIC_ALIASES = {
    username: ["tài khoản", "username", "account", "usernamelabel", "tên đăng nhập", "taikhoan", "user name"],
    password: ["mật khẩu", "password", "pass", "mat khau", "pass word", "pw"],
    captcha: ["mã xác nhận", "captcha", "verificationcode", "securitycode", "mã captcha", "ma xac nhan", "verification code", "security code"],
    email: ["email", "địa chỉ email", "e mail"],
    fullName: ["họ và tên", "tên", "fullname", "full name"]
};

/** Chuẩn hóa label để so khớp lỏng (bỏ dấu, lower, bỏ khoảng trắng thừa). */
export function normalizeFieldLabel(label) {
    return String(label ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[\s_\-]+/g, "")
        .trim();
}

/** Resolve fieldKey từ label theo alias (tổng quát, không hardcode Login). */
export function resolveFieldKey(fieldLabel) {
    const norm = normalizeFieldLabel(fieldLabel);
    if (!norm) return null;
    for (const [key, aliases] of Object.entries(SEMANTIC_ALIASES)) {
        const keyNorm = normalizeFieldLabel(key);
        const all = [key, ...aliases].map(normalizeFieldLabel);
        if (all.includes(norm) || all.some(a => norm.includes(a) && a.length >= 4)) return key;
    }
    return null;
}

/**
 * Contract chốt (II): resolve giá trị theo thứ tự ưu tiên.
 * @returns {{value:(string|null), source:string}}
 */
export function resolveTestValue({ purpose, savedDrawerValue, approvedJsonValue, recordedCodeGenValue, envValue }) {
    if (String(purpose ?? "").toUpperCase() === "EMPTY") {
        return { value: "", source: TESTDATA_SOURCES.EMPTY };
    }
    if (savedDrawerValue !== undefined && savedDrawerValue !== null && String(savedDrawerValue).trim() !== "") {
        return { value: String(savedDrawerValue), source: TESTDATA_SOURCES.USER_CONFIRMED };
    }
    if (approvedJsonValue !== undefined && approvedJsonValue !== null && String(approvedJsonValue).trim() !== "") {
        return { value: String(approvedJsonValue), source: TESTDATA_SOURCES.APPROVED_JSON };
    }
    if (recordedCodeGenValue !== undefined && recordedCodeGenValue !== null && String(recordedCodeGenValue).trim() !== "") {
        return { value: String(recordedCodeGenValue), source: TESTDATA_SOURCES.CODEGEN_RECORDED };
    }
    if (envValue !== undefined && envValue !== null && String(envValue).trim() !== "") {
        return { value: String(envValue), source: TESTDATA_SOURCES.ENV_FALLBACK };
    }
    return { value: null, source: TESTDATA_SOURCES.MISSING };
}

/** Lấy approvedJsonValue từ testCase.testData theo field name (ưu tiên fields, rồi inputs). */
export function approvedJsonValue(testCase, fieldName) {
    const fields = testCase?.testData?.fields;
    if (fields && typeof fields === "object") {
        const f = fields[fieldName];
        if (f && typeof f === "object") return String(f.value ?? f?.value ?? "");
    }
    if (testCase?.testData?.inputs && typeof testCase.testData.inputs === "object") {
        const v = testCase.testData.inputs[fieldName];
        if (v != null) return String(v);
    }
    return undefined;
}

/** Lấy savedDrawerValue (sau khi tester bấm "Lưu dữ liệu") từ testCase.testData.confirmed. */
export function savedDrawerValue(testCase, fieldName) {
    const confirmed = testCase?.testData?.confirmed;
    if (confirmed && typeof confirmed === "object" && confirmed[fieldName] !== undefined) {
        return String(confirmed[fieldName]);
    }
    return undefined;
}

/** Lấy purpose của field (EMPTY/VALID/INVALID...) từ approved JSON. */
export function fieldPurpose(testCase, fieldName) {
    const fields = testCase?.testData?.fields;
    if (fields && typeof fields === "object") {
        const f = fields[fieldName];
        if (f && typeof f === "object") return String(f.purpose ?? "").toUpperCase();
    }
    return "";
}

/** Map fieldKey -> runtime env var cho credential (không hardcode business flow). */
export function envKeyForFieldKey(fieldKey) {
    if (fieldKey === "username") return "TESTDATA_USERNAME";
    if (fieldKey === "password") return "TESTDATA_PASSWORD";
    if (fieldKey === "captcha") return "TESTDATA_CAPTCHA";
    return null;
}

/** envValue cho một field (từ envValues truyền vào, rồi process.env TESTDATA hoac LOGIN). */
export function envValueForField(fieldName, envValues = {}) {
    const fieldKey = resolveFieldKey(fieldName);
    const envKey = envKeyForFieldKey(fieldKey);
    if (!envKey) return undefined;
    const fromParam = envValues?.[envKey];
    if (fromParam !== undefined && fromParam !== null && String(fromParam).trim() !== "") return String(fromParam);
    const fromProcess = process.env[envKey] || process.env[envKey.replace("TESTDATA_", "LOGIN_")];
    if (fromProcess && String(fromProcess).trim() !== "") return String(fromProcess);
    return undefined;
}

/**
 * Render biểu thức giá trị cho một fill action theo binding đã resolve.
 * - Credential field: process.env.TESTDATA_X ?? "" (không literal, không nằm trong dấu nháy).
 * - Field không nhạy cảm: inline JSON.stringify(value).
 * @returns {null | {expression:string, source:string, fieldKey:string, envKey:string|null, generatedStatementType:string}}
 */
export function renderFillExpression({ fieldName, purpose, savedDrawerValue, approvedJsonValue, recordedCodeGenValue, envValue }) {
    const resolved = resolveTestValue({
        purpose,
        savedDrawerValue,
        approvedJsonValue,
        recordedCodeGenValue,
        envValue
    });
    const fieldKey = resolveFieldKey(fieldName);
    const envKey = envKeyForFieldKey(fieldKey);

    if (resolved.source === TESTDATA_SOURCES.EMPTY) {
        // purpose=EMPTY -> không điền (bỏ qua) hoặc điền rỗng. Trả marker.
        return { expression: null, value: "", source: TESTDATA_SOURCES.EMPTY, fieldKey, envKey: null, generatedStatementType: "skip-empty" };
    }
    if (resolved.source === TESTDATA_SOURCES.MISSING || resolved.value == null || String(resolved.value).trim() === "") {
        return { expression: null, value: null, source: TESTDATA_SOURCES.MISSING, fieldKey, envKey, generatedStatementType: "missing" };
    }
    // Credential dùng runtime env reference.
    if (envKey) {
        return { expression: `process.env.${envKey} ?? ""`, value: resolved.value, source: resolved.source, fieldKey, envKey, generatedStatementType: "fill-env-reference" };
    }
    return { expression: JSON.stringify(resolved.value), value: resolved.value, source: resolved.source, fieldKey, envKey: null, generatedStatementType: "fill-literal" };
}

/** Kiểm tra assertion có phải "thật" (không phải internal key/locatorKey làm accessible name). */
/** Label dùng trong assertion KHÔNG được ghép từ nhiều field/action (tránh getByText('Đăng nhập Mã xác nhận')). */
function isConcatenatedAssertionLabel(label) {
    const l = String(label ?? "").toLowerCase();
    if (!l) return false;
    const tokens = ["đăng nhập", "tài khoản", "mật khẩu", "mã xác nhận", "tên đơn vị tính", "mã đơn vị tính", "ghi chú", "username", "password", "captcha", "thêm mới", "lưu", "tìm kiếm"];
    const found = tokens.filter(t => l.includes(t));
    // Chỉ coi là "ghép giả" khi toàn bộ chuỗi chỉ gồm 2 token liền nhau, KHÔNG có từ nối/khác.
    // (vd 'Đăng nhập Mã xác nhận' -> 2 token liền; nhưng 'Tài khoản hoặc mật khẩu không' -> có 'hoặc','không' -> KHÔNG phải ghép, là thông báo hợp lệ.)
    if (found.length < 2) return false;
    // Bỏ các từ nối/giới từ/thường gặp; nếu phần còn lại chỉ còn token field -> ghép.
    const filler = ["hoặc", "không", "và", "được", "phải", "bắt buộc", "nhập", "sai", "đúng", "đã", "chưa", "của", "cho", "vào", "vui", "lòng", "thành công", "thất bại"];
    const words = l.split(/\s+/).filter(w => w.trim());
    const nonTokenWords = words.filter(w => !tokens.some(t => w.includes(t) || t.includes(w)));
    // Nếu có từ không phải token field (trừ filler) -> đây là câu thông báo, không phải label ghép.
    return nonTokenWords.filter(w => !filler.includes(w)).length === 0;
}

export function isValidAssertionSource(assertion) {
    const expr = String(assertion?.playwrightAssertion ?? "");
    if (!expr.trim()) return false;
    if (!/page\.getBy|toHaveURL|toHaveTitle|expect\(page\)|toBeVisible|toHaveText|toHaveValue|toBeHidden|toHaveCount|toBeEnabled|toBeDisabled/.test(expr)) return false;
    // Nội bộ: locatorKey/variableName/adminButton không được làm accessible name.
    if (/adminButton|locatorKey|variableName|name\s*:\s*['"]?(adminButton|locatorKey)/i.test(expr)) return false;
    return true;
}

/** Trích assertion `expect(...)` thật đã record trong CodeGen (nguồn #4), kèm chuỗi method (.toHaveURL/.toBeVisible...). */
export function extractCodegenAssertion(codegenText) {
    const cg = String(codegenText ?? "");
    if (!cg.includes("expect(")) return null;
    const statements = [];
    const re = /\bexpect\s*\(/g;
    let m;
    while ((m = re.exec(cg)) !== null) {
        const startIdx = m.index;
        const openIdx = m.index + m[0].length - 1; // vị trí '(' của expect
        // Đọc balanced `(...)` của expect, rồi nếu tiếp theo là `.method(` thì đọc luôn method.
        let i = openIdx;
        let depth = 0;
        let inStr = null;
        let inTmpl = false;
        let expectEnd = -1;
        while (i < cg.length) {
            const c = cg[i];
            if (inStr) {
                if (c === "\\") { i += 1; continue; }
                if (c === inStr) inStr = null;
                i += 1; continue;
            }
            if (inTmpl) {
                if (c === "\\") { i += 1; continue; }
                if (c === "`") inTmpl = false;
                i += 1; continue;
            }
            if (c === "'" || c === '"') { inStr = c; i += 1; continue; }
            if (c === "`") { inTmpl = true; i += 1; continue; }
            if (c === "(") depth += 1;
            else if (c === ")") {
                depth -= 1;
                if (depth === 0) { expectEnd = i; break; }
            }
            i += 1;
        }
        if (expectEnd === -1) continue;
        // Sau expect(...) có thể là .toHaveURL(...) / .toBeVisible() / .toHaveText(...)
        let fullEnd = expectEnd;
        const after = cg.slice(expectEnd + 1).match(/^\s*\.\s*([A-Za-z]+)\s*\(/);
        if (after) {
            const methodStart = expectEnd + 1 + after[0].indexOf("(");
            const methodOpen = cg.indexOf("(", methodStart);
            // Đọc balanced cho method
            let d = 0; let inS2 = null; let inT2 = false;
            for (let j = methodOpen; j < cg.length; j++) {
                const c = cg[j];
                if (inS2) { if (c === "\\") { j += 1; continue; } if (c === inS2) inS2 = null; continue; }
                if (inT2) { if (c === "\\") { j += 1; continue; } if (c === "`") inT2 = false; continue; }
                if (c === "'" || c === '"') { inS2 = c; continue; }
                if (c === "`") { inT2 = true; continue; }
                if (c === "(") d += 1;
                else if (c === ")") { d -= 1; if (d === 0) { fullEnd = j; break; } }
            }
        }
        const stmt = cg.slice(startIdx, fullEnd + 1).replace(/^await\s+/, "").trim();
        if (isValidAssertionSource({ playwrightAssertion: stmt })) {
            // Ghi source line/start/end để chứng minh assertion nào được chọn (không log giá trị nhạy cảm).
            const line = cg.slice(0, startIdx).split("\n").length;
            console.log(`[CODEGEN_ASSERT_SOURCE] line=${line} start=${startIdx} end=${fullEnd + 1} assertion=${JSON.stringify(stmt.slice(0, 120))}`);
            statements.push({ stmt, line, start: startIdx, end: fullEnd + 1 });
        }
    }
    if (statements.length === 0) return null;
    // Chọn assertion cuối (thường là assertion kết quả).
    return statements[statements.length - 1].stmt;
}

/**
 * Resolve assertion source theo thứ tự (VI):
 *   1. assertionMappings đã map thật.
 *   2. assertion tester xác nhận.
 *   3. expectedResult có locator chứng minh.
 *   4. URL/heading/element thật từ CodeGen.
 *   5. không có -> ASSERTION_MAPPING_REQUIRED (không tự bịa).
 */
export function resolveAssertion({ assertionMappings = [], expectedResult = "", codegenText = "", mapping = null, testCaseId = "", testCaseType = "" }) {
    // 1. assertionMappings đã map từ CodeGen thật (tester xác nhận) — ưu tiên cao nhất.
    const mapped = (Array.isArray(assertionMappings) ? assertionMappings : [])
        .filter(a => isValidAssertionSource(a));
    if (mapped.length > 0) {
        return {
            ok: true,
            assertion: mapped[0],
            source: "ASSERTION_MAPPING",
            playwrightAssertion: String(mapped[0].playwrightAssertion).replace(/^await\s+/, "").trim()
        };
    }
    // 2. Chọn assertion theo ĐÚNG SEGMENT của testcase trong CodeGen
    //    (không quét toàn file lấy expect đầu/cuối, không lấy assertion của flow khác;
    //     với testcase thành công KHÔNG chọn assertion lỗi/validation).
    const seg = selectSegmentAssertion({ mapping, codegenText, testCaseType, expectedResult });
    traceSegment({
        testCaseId,
        segment: seg.segment,
        mainActionLine: seg.mainActionLine,
        candidates: seg.candidates,
        selectedLine: seg.selectedLine,
        selectionReason: seg.reason
    });
    if (seg.ok && seg.assertion) {
        return { ok: true, assertion: { playwrightAssertion: seg.assertion }, source: "CODEGEN_SEGMENT", playwrightAssertion: seg.assertion.replace(/^await\s+/, "").trim() };
    }
    // 5. không có assertion đúng segment -> không tự đoán từ toàn file (ASSERTION_MAPPING_REQUIRED).
    return { ok: false, assertion: null, source: "MISSING", errorCode: "ASSERTION_MAPPING_REQUIRED", reason: seg.reason || "Chưa có assertion thật trong segment của testcase. Hãy map assertion từ CodeGen hoặc xác nhận." };
}

/** Dựng assertion từ expectedResult + codegen (best-effort, chỉ dùng locator CÓ trong codegen). */
export function assertionFromExpected(expectedResult, codegenText) {
    const expected = String(expectedResult ?? "").toLowerCase();
    const cg = String(codegenText ?? "");
    // Ưu tiên: nếu codegen có toHaveURL sau khi điều hướng -> dùng toHaveURL.
    const urlMatch = cg.match(/toHaveURL\(([^)]*)\)/);
    if (urlMatch && /đăng nhập thành công|vào hệ thống|chuyển|trang chủ|trang chính|mở dashboard/.test(expected)) {
        return `await expect(page).toHaveURL(${urlMatch[1]});`;
    }
    // Nếu codegen có getByText success hiển thị -> dùng.
    const textMatch = cg.match(/getByText\(\s*['"]([^'"]*(?:thành công|thành công|chào|chào mừng|success)[^'"]*)['"]\s*\)/i);
    if (textMatch) {
        return `await expect(page.getByText('${textMatch[1]}')).toBeVisible();`;
    }
    return null;
}

/** Trace một action (VII) — an toàn, không log giá trị nhạy cảm. */
export function traceAction({ testCaseId, sourceStep, sourceLocator, sourceAction, sourceValueKind, mappedFieldKey, resolvedValueSource, generatedStatementType }) {
    console.log(
        `[CODEGEN_ACTION_TRACE] testCaseId=${testCaseId} sourceStep=${sourceStep ?? "?"} sourceLocator=${sourceLocator ?? "?"} ` +
        `sourceAction=${sourceAction ?? "?"} sourceValueKind=${sourceValueKind ?? "?"} mappedFieldKey=${mappedFieldKey ?? "?"} ` +
        `resolvedValueSource=${resolvedValueSource ?? "?"} generatedStatementType=${generatedStatementType ?? "?"}`
    );
}

/** Độ dài an toàn của chuỗi nhạy cảm (chỉ đếm, không log giá trị). */
export function sensitiveLen(v) {
    return String(v ?? "").length;
}
