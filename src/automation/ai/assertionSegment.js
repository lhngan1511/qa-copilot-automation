/**
 * assertionSegment — Chọn assertion theo ĐÚNG SEGMENT của testcase trong CodeGen.
 *
 * Vấn đề hiện tại: extractCodegenAssertion quét toàn file và lấy expect() cuối cùng,
 * có thể thuộc testcase/flow khác (vd TC004 validation). Module này:
 *   1. Parse CodeGen thành chuỗi statement (action + assertion) kèm vị trí line/start/end.
 *   2. Gom thành các test block `test('...', async ({page}) => {...})`.
 *   3. Xác định segment của testcase từ mapping (setup + business steps locator) + main action.
 *   4. Chỉ lấy assertion NẰM SAU main action trong CÙNG block.
 *   5. Không có assertion đúng segment -> null (tester chọn / ASSERTION_MAPPING_REQUIRED).
 * Thuần ESM, không phụ thuộc Runner.
 */

import { isValidAssertionSource } from "./testDataBinding.js";

/** Trích nội dung balanced trong cặp ngoặc đầu tiên từ vị trí openIdx. */
function parenContent(s, openIdx) {
    let depth = 0;
    let inStr = null;
    let inTmpl = false;
    for (let i = openIdx; i < s.length; i++) {
        const c = s[i];
        if (inStr) {
            if (c === "\\") { i += 1; continue; }
            if (c === inStr) inStr = null;
            continue;
        }
        if (inTmpl) {
            if (c === "\\") { i += 1; continue; }
            if (c === "`") inTmpl = false;
            continue;
        }
        if (c === "'" || c === '"') { inStr = c; continue; }
        if (c === "`") { inTmpl = true; continue; }
        if (c === "(") depth += 1;
        else if (c === ")") {
            depth -= 1;
            if (depth === 0) return s.slice(openIdx + 1, i);
        }
    }
    return null;
}

/** Tìm vị trí đóng của một call bắt đầu tại openIdx (đọc balanced). */
function callEnd(s, openIdx) {
    let depth = 0;
    let inStr = null;
    let inTmpl = false;
    for (let i = openIdx; i < s.length; i++) {
        const c = s[i];
        if (inStr) {
            if (c === "\\") { i += 1; continue; }
            if (c === inStr) inStr = null;
            continue;
        }
        if (inTmpl) {
            if (c === "\\") { i += 1; continue; }
            if (c === "`") inTmpl = false;
            continue;
        }
        if (c === "'" || c === '"') { inStr = c; continue; }
        if (c === "`") { inTmpl = true; continue; }
        if (c === "(") depth += 1;
        else if (c === ")") {
            depth -= 1;
            if (depth === 0) return i;
        }
    }
    return -1;
}

/** Normalize locator để so khớp (bỏ page. prefix, dấu chấm đuôi, khoảng trắng). */
function normLoc(l) {
    return String(l ?? "")
        .replace(/^page\d*\s*\.\s*/, "")
        .replace(/\.\s*$/, "")
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Parse CodeGen thành statement có vị trí.
 * @returns {Array<{type:'action'|'assertion'|'goto', start, end, line, locator, action, method, name}>}
 */
export function parseStatements(codegenText) {
    const s = String(codegenText ?? "");
    const stmts = [];
    // Regex bắt đầu của: action page.getBy*().method( hoặc page.goto( hoặc expect(
    const re = /\b(page\d*\s*\.\s*(?:getBy[A-Za-z]+\([^)]*\)|locator\([^)]*\))\s*\.\s*(fill|click|selectOption|press|check|uncheck|dblclick)\s*\(|page\d*\s*\.\s*goto\s*\(|expect\s*\()/g;
    let m;
    while ((m = re.exec(s)) !== null) {
        const start = m.index;
        const seg = m[0];
        const line = s.slice(0, start).split("\n").length;

        if (seg.startsWith("expect(")) {
            const openIdx = start + seg.indexOf("(");
            const expectEnd = callEnd(s, openIdx);
            if (expectEnd === -1) continue;
            // Sau expect(...) có thể là .matcher(...)
            let fullEnd = expectEnd;
            const after = s.slice(expectEnd + 1).match(/^\s*\.\s*([A-Za-z]+)\s*\(/);
            if (after) {
                const methodOpen = s.indexOf("(", expectEnd + 1);
                const me = callEnd(s, methodOpen);
                if (me !== -1) fullEnd = me;
            }
            const stmt = s.slice(start, fullEnd + 1).replace(/^await\s+/, "").trim();
            const nameMatch = stmt.match(/getBy(?:Text|Label|Placeholder|AltText|Title)\s*\(\s*['"]([^'"]+)['"]/);
            stmts.push({
                type: "assertion",
                start,
                end: fullEnd + 1,
                line,
                stmt,
                name: nameMatch ? nameMatch[1] : null
            });
            continue;
        }

        // action
        const methodMatch = seg.match(/\.\s*(fill|click|selectOption|press|check|uncheck|dblclick)\s*\(|\.\s*(goto)\s*\(/);
        const method = (methodMatch?.[1] || methodMatch?.[2] || "").trim();
        if (!method) continue;
        const methodIdx = start + seg.lastIndexOf(method);
        const openIdx = s.indexOf("(", methodIdx);
        const argText = parenContent(s, openIdx);
        const locatorSeg = s.slice(start, start + seg.indexOf(method)).replace(/^page\d*\s*\.\s*/, "").trim();
        // accessible name của locator
        const nameMatch = locatorSeg.match(/getBy(?:Text|Label|Placeholder|AltText|Title)\s*\(\s*['"]([^'"]+)['"]/) || locatorSeg.match(/getByRole\s*\(\s*['"]([^'"]+)['"][\s\S]*?name\s*:\s*['"]([^'"]+)['"]/);
        stmts.push({
            type: method === "goto" ? "goto" : "action",
            start,
            end: openIdx !== -1 ? callEnd(s, openIdx) + 1 : start + seg.length,
            line,
            action: method,
            locator: locatorSeg,
            name: nameMatch ? (nameMatch[2] || nameMatch[1]) : null,
            recordedValue: argText && method === "fill" ? (argText.match(/^\s*['"]([^'"]*)['"]\s*$/) ? argText.match(/^\s*['"]([^'"]*)['"]\s*$/)[1] : null) : null
        });
    }
    // sắp theo vị trí
    stmts.sort((a, b) => a.start - b.start);
    return stmts;
}

/**
 * Gom statements thành các test block (test('...', async ({page}) => {...})).
 * @returns {Array<{start, end, title, titleLine, statements}>}
 */
export function segmentIntoBlocks(stmts, codegenText) {
    const s = String(codegenText ?? "");
    const blocks = [];
    let current = null;
    for (const st of stmts) {
        // Một test block bắt đầu khi gặp assertion/action mới sau một `test(` gần nhất.
        // Dễ hơn: dò `test(` trong source để cắt block.
    }
    // Cắt theo `test('...'`:
    const testRe = /\btest\s*\(\s*['"`]([^'"`]*)['"`]\s*,\s*async\s*\(\s*\{\s*page\s*\}\s*\)\s*=>\s*\{/g;
    let m;
    const testStarts = [];
    while ((m = testRe.exec(s)) !== null) testStarts.push({ title: m[1], start: m.index, line: s.slice(0, m.index).split("\n").length });
    for (let i = 0; i < testStarts.length; i++) {
        const block = testStarts[i];
        const end = i + 1 < testStarts.length ? testStarts[i + 1].start : s.length;
        const inner = stmts.filter(st => st.start >= block.start && st.start < end);
        blocks.push({
            title: block.title,
            start: block.start,
            end,
            line: block.line,
            statements: inner
        });
    }
    return blocks;
}

/** Lấy các locator của mapping (setup + business) đã normalized. */
function mappingLocators(mapping) {
    const locs = [];
    for (const st of mapping?.authenticationSetup?.steps ?? []) locs.push(st?.locator ?? "");
    for (const st of mapping?.navigationChain?.steps ?? []) locs.push(st?.locator ?? "");
    for (const st of mapping?.stepMappings ?? []) locs.push(st?.locator ?? "");
    return locs.map(normLoc).filter(Boolean);
}

/** Chuẩn hóa testCaseId để so khớp trong title block. */
function normId(id) {
    return String(id ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
}

/** Tìm block chứa testcase — ưu tiên title khớp testCaseId, rồi mới main action/locator. */
export function findTestcaseBlock(stmts, blocks, mapping) {
    const businessSteps = mapping?.stepMappings ?? [];
    // Main action: stepMappings cuối; nếu rỗng, dùng step cuối của authSetup+navChain.
    const allMappedSteps = [
        ...(mapping?.authenticationSetup?.steps ?? []),
        ...(mapping?.navigationChain?.steps ?? []),
        ...businessSteps
    ];
    const mainStep = businessSteps[businessSteps.length - 1] || allMappedSteps[allMappedSteps.length - 1];
    const mainLoc = mainStep ? normLoc(mainStep?.locator) : "";
    const allLocs = mappingLocators(mapping);
    const testCaseId = String(mapping?.testCaseId ?? "").trim();
    const idNorm = normId(testCaseId);

    // 1. Block có title chứa testCaseId (vd `test('TC001 - ...')`) — chính xác nhất.
    if (idNorm) {
        for (const b of blocks) {
            if (normId(b.title).includes(idNorm)) {
                const mainSt = mainLoc ? b.statements.find(st => (st.type === "action" || st.type === "goto") && normLoc(st.locator) === mainLoc) : null;
                return { block: b, mainStatement: mainSt || null, byTitle: true };
            }
        }
    }
    // 2. Fallback: block chứa main action (locator của stepMappings cuối).
    if (mainLoc) {
        for (const b of blocks) {
            const hit = b.statements.find(st => (st.type === "action" || st.type === "goto") && normLoc(st.locator) === mainLoc);
            if (hit) return { block: b, mainStatement: hit, byTitle: false };
        }
    }
    // 3. Fallback: block chứa nhiều locator của mapping nhất.
    if (allLocs.length) {
        let best = null, bestCount = -1;
        for (const b of blocks) {
            const count = b.statements.filter(st => (st.type === "action" || st.type === "goto") && allLocs.includes(normLoc(st.locator))).length;
            if (count > bestCount) { bestCount = count; best = b; }
        }
        if (best) {
            const mainSt = mainLoc ? best.statements.find(st => (st.type === "action" || st.type === "goto") && normLoc(st.locator) === mainLoc) : null;
            return { block: best, mainStatement: mainSt || null, byTitle: false };
        }
    }
    return null;
}

/**
 * Chọn assertion theo segment của testcase.
 * @returns {{ok:boolean, assertion:string|null, candidates:Array, segment:{block,start,end,line}, mainActionLine:number|null, selectedLine:number|null, reason:string}}
 */
export function selectSegmentAssertion({ mapping, codegenText }) {
    const s = String(codegenText ?? "");
    const stmts = parseStatements(s);
    const blocks = segmentIntoBlocks(stmts, s);
    const found = findTestcaseBlock(stmts, blocks, mapping);

    const result = {
        ok: false,
        assertion: null,
        candidates: [],
        segment: found ? { blockTitle: found.block.title, start: found.block.start, end: found.block.end, line: found.block.line } : null,
        mainActionLine: found?.mainStatement?.line ?? null,
        selectedLine: null,
        reason: ""
    };

    if (!found) {
        result.reason = "Không xác định được segment của testcase trong CodeGen — yêu cầu tester chọn assertion.";
        return result;
    }
    const block = found.block;
    const mainEnd = found.mainStatement?.end ?? block.start;

    // Assertion candidate: trong CÙNG block, nằm SAU main action.
    const candidates = block.statements.filter(st =>
        st.type === "assertion" &&
        isValidAssertionSource({ playwrightAssertion: st.stmt }) &&
        st.start >= mainEnd
    );
    result.candidates = candidates.map(c => ({ line: c.line, start: c.start, end: c.end, stmt: c.stmt, name: c.name }));
    if (candidates.length === 0) {
        result.reason = "Không có assertion hợp lệ sau main action trong segment của testcase — yêu cầu tester chọn assertion.";
        return result;
    }

    // Chọn tốt nhất: ưu tiên assertion "thành công" (URL/heading/success text) nếu có.
    const scored = candidates.map(c => ({
        c,
        score: assertionScore(c)
    }));
    scored.sort((a, b) => b.score - a.score);
    const selected = scored[0].c;
    result.ok = true;
    result.assertion = selected.stmt;
    result.selectedLine = selected.line;
    result.reason = scored[0].score > 0 ? "chọn assertion thành công trong segment" : "chọn assertion đầu tiên sau main action trong segment";
    return result;
}

/** Điểm cho assertion: ưu tiên toHaveURL / toHaveTitle / heading / text thành công. */
function assertionScore(st) {
    const txt = String(st.stmt ?? "");
    let score = 0;
    if (/toHaveURL/.test(txt)) score += 5;
    if (/toHaveTitle/.test(txt)) score += 4;
    if (/getByRole\(\s*['"]heading['"]/.test(txt)) score += 3;
    const name = String(st.name ?? "").toLowerCase();
    if (/thành công|chào mừng|chào|success|welcome|dashboard|trang chủ|đăng nhập thành công/.test(name)) score += 3;
    if (/toBeVisible/.test(txt)) score += 1;
    return score;
}

/** Trace segment (không log giá trị nhạy cảm). */
export function traceSegment({ testCaseId, segment, mainActionLine, candidates, selectedLine, selectionReason }) {
    console.log(
        `[ASSERTION_SEGMENT_TRACE] testCaseId=${testCaseId ?? "?"} ` +
        `segmentStart=${segment?.start ?? "?"} segmentEnd=${segment?.end ?? "?"} mainActionLine=${mainActionLine ?? "?"} ` +
        `candidateAssertions=${JSON.stringify((candidates ?? []).map(c => ({ line: c.line, start: c.start, end: c.end, name: c.name })))} ` +
        `selectedAssertion=${selectedLine ?? "?"} selectionReason=${JSON.stringify(selectionReason ?? "")}`
    );
}
