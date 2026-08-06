/**
 * recordingParser — Parse source Playwright CodeGen thành steps / assertions / recordedValues
 * (Architecture V3 — Current Recording Session).
 *
 * Contract:
 *   RecordingStep {
 *     order, actionType, locator, target, valueKind,
 *     recordedValue, sourceStart, sourceEnd, sourceLine
 *   }
 *   RecordingAssertion {
 *     order, statement, locator, matcher, expected,
 *     sourceStart, sourceEnd, sourceLine
 *   }
 *
 * Quy tắc:
 *   - Không dùng AI để xác định recording thuộc testcase nào.
 *   - Không log password / dữ liệu nhạy cảm — recordedValue nhạy cảm đánh dấu `sensitive:true` + redacted.
 *   - Giữ sourceRange (start/end) và sourceLine cho từng bước.
 *   - Thuần ESM, không phụ thuộc Runner.
 */

const ACTION_METHODS = {
    fill: "FILL",
    click: "CLICK",
    selectOption: "SELECT",
    press: "PRESS",
    check: "CHECK",
    uncheck: "UNCHECK",
    goto: "GOTO",
    dblclick: "CLICK"
};

/** Trích nội dung balanced trong cặp ngoặc từ openIdx. */
function parenContent(s, openIdx) {
    let depth = 0, inStr = null, inTmpl = false;
    for (let i = openIdx; i < s.length; i++) {
        const c = s[i];
        if (inStr) { if (c === "\\") { i++; continue; } if (c === inStr) inStr = null; continue; }
        if (inTmpl) { if (c === "\\") { i++; continue; } if (c === "`") inTmpl = false; continue; }
        if (c === "'" || c === '"') { inStr = c; continue; }
        if (c === "`") { inTmpl = true; continue; }
        if (c === "(") depth++;
        else if (c === ")") { depth--; if (depth === 0) return s.slice(openIdx + 1, i); }
    }
    return null;
}

/** Lấy accessible name / label từ locator call. */
function locatorName(locatorCall) {
    let m = locatorCall.match(/name\s*:\s*['"]([^'"]+)['"]/);
    if (m) return m[1];
    m = locatorCall.match(/getBy(?:Text|Label|Placeholder|AltText|Title)\s*\(\s*['"]([^'"]+)['"]/);
    if (m) return m[1];
    m = locatorCall.match(/getByRole\s*\(\s*['"]([^'"]+)['"]/);
    if (m) return m[1];
    return null;
}

/** Field nhạy cảm (mật khẩu/captcha) — không log giá trị thật. */
export function isSensitiveField(target) {
    const t = String(target ?? "").toLowerCase();
    return /mật khẩu|password|pass\b|captcha|mã xác nhận|secret/.test(t);
}

/**
 * Parse source Playwright CodeGen.
 * @returns {{steps:Array, assertions:Array, recordedValues:Object}}
 */
export function parseRecording(source) {
    const s = String(source ?? "");
    const steps = [];
    const assertions = [];
    const recordedValues = {};

    // Regex bắt đầu action (page.getBy*().method( hoặc page.goto( ) hoặc expect(
    const re = /\b(page\d*\s*\.\s*(?:getBy[A-Za-z]+\([^)]*\)|locator\([^)]*\))\s*\.\s*(fill|click|selectOption|press|check|uncheck|dblclick)\s*\(|page\d*\s*\.\s*goto\s*\(|expect\s*\()/g;
    let m;
    let order = 0;

    while ((m = re.exec(s)) !== null) {
        const start = m.index;
        const seg = m[0];
        const line = s.slice(0, start).split("\n").length;

        // ---- ASSERTION ----
        if (seg.startsWith("expect(")) {
            const openIdx = start + seg.indexOf("(");
            const expectEnd = (() => {
                let depth = 0, inStr = null, inTmpl = false;
                for (let i = openIdx; i < s.length; i++) {
                    const c = s[i];
                    if (inStr) { if (c === "\\") { i++; continue; } if (c === inStr) inStr = null; continue; }
                    if (inTmpl) { if (c === "\\") { i++; continue; } if (c === "`") inTmpl = false; continue; }
                    if (c === "'" || c === '"') { inStr = c; continue; }
                    if (c === "`") { inTmpl = true; continue; }
                    if (c === "(") depth++;
                    else if (c === ")") { depth--; if (depth === 0) return i; }
                }
                return -1;
            })();
            if (expectEnd === -1) continue;
            // Sau expect(...) có thể là .matcher(...)
            let fullEnd = expectEnd;
            const after = s.slice(expectEnd + 1).match(/^\s*\.\s*([A-Za-z]+)\s*\(/);
            if (after) {
                const methodOpen = s.indexOf("(", expectEnd + 1);
                let d = 0, inS = null;
                for (let j = methodOpen; j < s.length; j++) {
                    const c = s[j];
                    if (inS) { if (c === "\\") { j++; continue; } if (c === inS) inS = null; continue; }
                    if (c === "'" || c === '"') { inS = c; continue; }
                    if (c === "(") d++;
                    else if (c === ")") { d--; if (d === 0) { fullEnd = j; break; } }
                }
            }
            const statement = s.slice(start, fullEnd + 1).replace(/^await\s+/, "").trim();
            const matcherM = statement.match(/\.\s*([A-Za-z]+)\s*\([^)]*\)\s*$/);
            const matcher = matcherM ? matcherM[1] : null;
            const loc = statement.match(/(page(?:\.getBy[A-Za-z]+\([^)]*\)|\.locator\([^)]*\)))/);
            assertions.push({
                order: assertions.length + 1,
                statement,
                locator: loc ? loc[1] : null,
                matcher,
                expected: extractExpected(statement),
                sourceStart: start,
                sourceEnd: fullEnd + 1,
                sourceLine: line
            });
            continue;
        }

        // ---- ACTION ----
        const methodM = seg.match(/\.\s*(fill|click|selectOption|press|check|uncheck|dblclick)\s*\(|\.\s*(goto)\s*\(/);
        const method = (methodM?.[1] || methodM?.[2] || "").trim();
        if (!method) continue;
        const methodIdx = start + seg.lastIndexOf(method);
        const openIdx = s.indexOf("(", methodIdx);
        const argText = parenContent(s, openIdx);
        const locatorSeg = s.slice(start, start + seg.indexOf(method)).replace(/^page\d*\s*\.\s*/, "").trim();

        order += 1;
        const actionType = ACTION_METHODS[method] || method.toUpperCase();
        const target = locatorName(locatorSeg) || locatorSeg.replace(/\(.*$/, "").slice(0, 40) || (actionType === "GOTO" ? "Mở trang" : "Thao tác");

        let valueKind = null;
        let recordedValue = null;
        let sensitive = false;
        if (argText != null) {
            const lit = argText.match(/^\s*['"]([^'"]*)['"]\s*$/);
            const env = argText.match(/process\.env\.([A-Z_]+)/);
            if (env) { valueKind = "ENV"; recordedValue = env[1]; }
            else if (lit) { valueKind = "LITERAL"; recordedValue = lit[1]; }
            else if (actionType === "GOTO") { valueKind = "URL"; recordedValue = argText.trim(); }
            else { valueKind = "EXPR"; recordedValue = argText.trim(); }
        }
        // Đánh dấu sensitive + redact nếu field nhạy cảm.
        if (isSensitiveField(target) && recordedValue != null && valueKind === "LITERAL") {
            sensitive = true;
        }

        steps.push({
            order,
            actionType,
            locator: locatorSeg,
            target,
            valueKind,
            recordedValue: sensitive ? "REDACTED" : recordedValue,
            sensitive,
            sourceStart: start,
            sourceEnd: openIdx !== -1 ? parenContentEnd(s, openIdx) + 1 : start + seg.length,
            sourceLine: line
        });

        // recordedValues (chỉ literal không nhạy cảm, hoặc đánh dấu redacted)
        if (target && recordedValue != null) {
            recordedValues[target] = sensitive ? "REDACTED" : recordedValue;
        }
    }

    return { steps, assertions, recordedValues };
}

/** Trích expected từ statement assertion (best-effort). */
function extractExpected(statement) {
    const m = statement.match(/(?:toHaveText|toHaveValue|toHaveURL|toHaveTitle)\s*\(\s*['"]([^'"]+)['"]\s*\)/);
    if (m) return m[1];
    return null;
}

/** Trả vị trí đóng ngoặc của parenContent. */
function parenContentEnd(s, openIdx) {
    let depth = 0, inStr = null;
    for (let i = openIdx; i < s.length; i++) {
        const c = s[i];
        if (inStr) { if (c === "\\") { i++; continue; } if (c === inStr) inStr = null; continue; }
        if (c === "'" || c === '"') { inStr = c; continue; }
        if (c === "(") depth++;
        else if (c === ")") { depth--; if (depth === 0) return i; }
    }
    return openIdx;
}
