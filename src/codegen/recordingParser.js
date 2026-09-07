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
    dblclick: "CLICK",
    hover: "HOVER"
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

/**
 * Quét 1 chuỗi gọi hàm dạng `page.a(...).b(...).c(...)` bắt đầu từ vị trí `identStart` (chỉ số
 * ký tự đầu "page"/"page1"...). Trả về `{ calls: [{name, argsText, callEnd}], chainEnd }` theo
 * đúng thứ tự nguồn — dùng `parenContent` để lấy đúng nội dung ngoặc CÂN BẰNG cho từng lời gọi
 * (xử lý đúng ngoặc lồng nhau ngay trong chính selector, ví dụ `locator('tr:nth-child(5)')`, và
 * chuỗi nhiều lớp, ví dụ `.first()`/`.nth(n)`/`getByRole(...).getByLabel(...)`).
 *
 * KHÔNG dùng 1 regex đơn giả định "locator gọi đúng 1 lần rồi tới thẳng method cuối" như bản cũ
 * — vỡ với các trường hợp trên (bug thật Ngân báo lại 2026-08-28: nhiều bước — bấm nút có
 * `.first()`, chọn dòng bảng có CSS selector lồng ngoặc, tick checkbox qua locator 2 lớp — bị
 * rơi mất lặng lẽ khỏi kết quả parse, không có cảnh báo gì).
 */
function scanChain(s, identStart) {
    const headM = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(s.slice(identStart));
    if (!headM) return null;
    let pos = identStart + headM[0].length;
    const calls = [];
    for (;;) {
        let p = pos;
        while (p < s.length && /\s/.test(s[p])) p++;
        if (s[p] !== ".") break;
        p++;
        while (p < s.length && /\s/.test(s[p])) p++;
        const nameM = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(s.slice(p));
        if (!nameM) break;
        const name = nameM[0];
        let p2 = p + name.length;
        while (p2 < s.length && /\s/.test(s[p2])) p2++;
        if (s[p2] !== "(") break; // không phải lời gọi hàm (thuộc tính/kết thúc chain) — dừng
        const argsText = parenContent(s, p2);
        if (argsText === null) break; // ngoặc không cân bằng (script dán dở dang) — dừng an toàn
        const callEnd = parenContentEnd(s, p2) + 1;
        calls.push({ name, argsText, callEnd });
        pos = callEnd;
    }
    return { calls, chainEnd: pos };
}

/** Nhãn dự phòng khi locator không có accessible name (getByRole/getByLabel/...) — ví dụ
 *  `page.locator('#txt_ma_ky_luat')` không có "name" để trích. Lấy đúng nội dung bên trong cặp
 *  ngoặc balanced đầu tiên (dùng lại parenContent — xử lý đúng ngoặc/chuỗi lồng nhau, ví dụ
 *  `locator('tr:nth-child(5)')`), bỏ dấu nháy bao ngoài. Không rơi về chỉ còn tên method
 *  ("locator"/"click"...) — nếu không thì nhiều field khác nhau đều hiện y hệt nhau, tester
 *  không phân biệt được field nào là field nào (bug thật, Ngân báo lại 2026-08-28). */
function fallbackLocatorLabel(locatorSeg) {
    const openIdx = locatorSeg.indexOf("(");
    if (openIdx === -1) return locatorSeg.slice(0, 40) || null;
    const content = parenContent(locatorSeg, openIdx);
    const cleaned = String(content ?? "").trim().replace(/^['"]|['"]$/g, "").trim();
    return cleaned ? cleaned.slice(0, 60) : (locatorSeg.slice(0, openIdx) || null);
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

    // ==================== ASSERTIONS: expect(...) [.matcher(...)] ====================
    // Quét riêng khỏi ACTION (khác bản cũ dùng 1 regex chung) — logic BÊN TRONG giữ nguyên y hệt
    // bản cũ, không đổi hành vi; tách quét riêng chỉ để ACTION dùng được chain-scanner mới mà
    // không ảnh hưởng phần assertion đang đúng.
    const expectRe = /\bexpect\s*\(/g;
    let em;
    while ((em = expectRe.exec(s)) !== null) {
        const start = em.index;
        const seg = em[0];
        const line = s.slice(0, start).split("\n").length;
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
    }

    // ==================== ACTIONS: page.<chain>.<method>(...) ====================
    // Quét mọi identifier "page"/"page1"... rồi dùng scanChain để đi hết chuỗi gọi hàm (xử lý
    // đúng ngoặc lồng nhau trong selector và chain nhiều lớp — .first()/.nth(n)/getByRole(...)
    // .getByLabel(...) — điều mà 1 regex đơn của bản cũ không làm được, khiến nhiều bước bị rơi
    // mất lặng lẽ khỏi kết quả parse). Loại action = tên lời gọi CUỐI trong chain; mọi lời gọi
    // trước đó ghép lại thành locatorSeg (dùng cho locatorName/fallbackLocatorLabel y hệt trước).
    const pageRe = /\bpage\d*\s*\./g;
    let pm;
    let order = 0;
    while ((pm = pageRe.exec(s)) !== null) {
        const identStart = pm.index;
        const chain = scanChain(s, identStart);
        if (!chain || chain.calls.length === 0) continue;
        pageRe.lastIndex = Math.max(chain.chainEnd, pageRe.lastIndex);

        const lastCall = chain.calls[chain.calls.length - 1];
        const method = lastCall.name;

        // Hộp thoại xác nhận (confirm/alert/prompt) — page.once('dialog', dialog => {...}) —
        // KHÔNG phải chain locator+action như các bước khác (chỉ 1 lời gọi, không có locator).
        // Trước đây bị rơi im lặng khỏi kết quả parse (method "once"/"on" không nằm trong
        // ACTION_METHODS) → spec sinh ra thiếu hẳn dòng xử lý dialog → khi chạy thật, Playwright
        // KHÔNG có listener sẽ tự động DISMISS hộp thoại, làm hỏng mọi testcase "Xóa thành công"/
        // bất kỳ luồng nào cần XÁC NHẬN (accept) hộp thoại — bug thật Ngân báo lại 2026-09-03.
        if ((method === "once" || method === "on") && chain.calls.length === 1) {
            const argText = lastCall.argsText ?? "";
            if (/^\s*['"]dialog['"]\s*,/.test(argText)) {
                const isAccept = /\bdialog\s*\.\s*accept\s*\(/.test(argText);
                const line = s.slice(0, identStart).split("\n").length;
                order += 1;
                steps.push({
                    order,
                    actionType: "DIALOG",
                    locator: "",
                    target: "Hộp thoại xác nhận",
                    valueKind: "DIALOG_ACTION",
                    // Playwright CodeGen LUÔN ghi lại dialog.dismiss() bất kể tester bấm OK hay
                    // Cancel lúc ghi màn hình thật (giới hạn của công cụ, không phải bug của
                    // parser) — giữ ĐÚNG những gì script ghi được, KHÔNG tự suy đoán/đổi thành
                    // ACCEPT. Nếu tester muốn luồng "xác nhận" (đồng ý xóa...), cần tự sửa
                    // "dismiss()" thành "accept()" trong script đã dán trước khi phân tích.
                    recordedValue: isAccept ? "ACCEPT" : "DISMISS",
                    sensitive: false,
                    sourceStart: identStart,
                    sourceEnd: lastCall.callEnd,
                    sourceLine: line
                });
            }
            continue;
        }
        if (!ACTION_METHODS[method]) continue; // lời gọi cuối không phải action đã biết — bỏ qua

        const locatorCalls = chain.calls.slice(0, -1);
        const locatorSeg = locatorCalls.length > 0
            ? `${locatorCalls.map(c => `${c.name}(${c.argsText})`).join(".")}.`
            : "";
        const argText = lastCall.argsText;
        const line = s.slice(0, identStart).split("\n").length;

        order += 1;
        const actionType = ACTION_METHODS[method] || method.toUpperCase();
        const target = locatorName(locatorSeg) || fallbackLocatorLabel(locatorSeg) || (actionType === "GOTO" ? "Mở trang" : "Thao tác");

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
        // P0-C runtime bug — redact sensitive CHỈ khi action mang VALUE thật (FILL).
        // PRESS/SELECT chứa keyboard command (Tab/Enter/ArrowDown...) — KHÔNG phải secret,
        // không được biến thành "REDACTED" (gây press("REDACTED") khi generate).
        if (actionType === "FILL" && isSensitiveField(target) && recordedValue != null && valueKind === "LITERAL") {
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
            sourceStart: identStart,
            sourceEnd: lastCall.callEnd,
            sourceLine: line
        });

        // recordedValues (chỉ literal không nhạy cảm, hoặc đánh dấu redacted)
        if (target && recordedValue != null) {
            recordedValues[target] = sensitive ? "REDACTED" : recordedValue;
        }
    }

    return { steps, assertions, recordedValues, summary: buildSummary(steps, assertions) };
}

/** Tạo summary recording (điểm 3) — UI dùng trực tiếp, không cần parse lại. */
export function buildSummary(steps = [], assertions = []) {
    const s = Array.isArray(steps) ? steps : [];
    const a = Array.isArray(assertions) ? assertions : [];
    const actionCount = s.length;
    const assertionCount = a.length;
    const count = type => s.filter(x => x.actionType === type).length;
    return {
        actionCount,
        assertionCount,
        fillCount: count("FILL"),
        clickCount: count("CLICK"),
        navigationCount: count("GOTO"),
        selectCount: count("SELECT"),
        checkCount: count("CHECK"),
        assertCount: a.length,
        duration: null // gán lúc stop (startedAt→completedAt)
    };
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
