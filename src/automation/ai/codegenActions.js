/**
 * codegenActions — Trích các action đã record trong CodeGen source.
 *
 * Nguyên tắc I.3: KHÔNG được bỏ action đã tồn tại trong CodeGen.
 * CodeGen quyết định "làm gì" (locator/action/thứ tự).
 * Thuần ESM, không phụ thuộc Runner.
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

/** Trích nội dung bên trong cặp ngoặc đầu tiên (không lồng). */
function parenContent(s, openIdx) {
    let depth = 0;
    let inStr = null;
    for (let i = openIdx; i < s.length; i++) {
        const c = s[i];
        if (inStr) {
            if (c === "\\") { i += 1; continue; }
            if (c === inStr) inStr = null;
            continue;
        }
        if (c === "'" || c === '"') { inStr = c; continue; }
        if (c === "(") depth += 1;
        else if (c === ")") {
            depth -= 1;
            if (depth === 0) return s.slice(openIdx + 1, i);
        }
    }
    return null;
}

/** Lấy accessible name / label từ một locator call. */
function locatorName(locatorCall) {
    const m = locatorCall.match(/name\s*:\s*['"]([^'"]+)['"]/);
    if (m) return m[1];
    const txt = locatorCall.match(/getBy(?:Text|Label|Placeholder|AltText|Title)\s*\(\s*['"]([^'"]+)['"]/);
    if (txt) return txt[1];
    const role = locatorCall.match(/getByRole\s*\(\s*['"]([^'"]+)['"]/);
    if (role) return role[1];
    return null;
}

/** Trích giá trị literal (string) nếu có từ đối số. */
function literalValue(argText) {
    const m = String(argText ?? "").match(/^\s*['"]([^'"]*)['"]\s*$/);
    if (m) return { kind: "LITERAL", value: m[1] };
    if (/process\.env\.([A-Z_]+)/.test(String(argText ?? ""))) {
        const e = String(argText ?? "").match(/process\.env\.([A-Z_]+)/);
        return { kind: "ENV", value: e[1] };
    }
    return { kind: "UNKNOWN", value: String(argText ?? "").trim() };
}

/**
 * Trích các action Playwright từ codegen source theo thứ tự xuất hiện.
 * @returns {Array<{sourceStep:number, sourceLocator:string, sourceAction:string,
 *   sourceValueKind:string|null, recordedValue:string|null, sourceCode:string, locator:string}>}
 */
export function extractCodegenActions(codegenText) {
    const s = String(codegenText ?? "");
    const actions = [];
    const re = /(\bpage\d*\s*\.\s*(?:getBy[A-Za-z]+\([^)]*\)|locator\([^)]*\))\s*\.\s*(fill|click|selectOption|press|check|uncheck)\s*\(|\bpage\d*\s*\.\s*(goto)\s*\()/g;
    let m;
    let step = 0;
    while ((m = re.exec(s)) !== null) {
        const start = m.index;
        const seg = m[0];
        const method = (m[2] || m[3] || "").trim();
        if (!method) continue;
        step += 1;

        // Tìm đối số của method (fill('x') / click() / goto('url')).
        const methodIdx = start + seg.indexOf(method);
        const openIdx = s.indexOf("(", methodIdx);
        const argText = parenContent(s, openIdx);

        let sourceAction = ACTION_METHODS[method] || method.toUpperCase();
        let sourceValueKind = null;
        let recordedValue = null;
        if (method === "fill" && argText != null) {
            const lv = literalValue(argText);
            sourceValueKind = lv.kind;
            recordedValue = lv.kind === "LITERAL" ? lv.value : lv.value;
        } else if (method === "press" && argText != null) {
            const lv = literalValue(argText);
            sourceValueKind = "KEY";
            recordedValue = lv.kind === "LITERAL" ? lv.value : null;
        } else if (method === "selectOption" && argText != null) {
            const lv = literalValue(argText);
            sourceValueKind = "OPTION";
            recordedValue = lv.kind === "LITERAL" ? lv.value : null;
        } else if (method === "goto" && argText != null) {
            const lv = literalValue(argText);
            sourceValueKind = "URL";
            recordedValue = lv.kind === "LITERAL" ? lv.value : null;
        }

        // Locator call là phần trước method.
        const locatorSeg = s.slice(start, start + seg.indexOf(method)).trim();
        const sourceLocator = locatorName(locatorSeg) || locatorSeg.replace(/^page\d*\s*\.\s*/, "").slice(0, 60);
        actions.push({
            sourceStep: step,
            sourceLocator,
            sourceAction,
            sourceValueKind,
            recordedValue,
            sourceCode: seg.trim(),
            locator: locatorSeg.replace(/^page\d*\s*\.\s*/, "").trim()
        });
    }
    return actions;
}

/** Tìm action CodeGen khớp với một mapping step (theo locator name/label). */
export function matchCodegenAction(codegenActions, step) {
    const target = String(step?.target ?? step?.businessStep ?? "");
    const stepLocator = String(step?.locator ?? "");
    const targetNorm = target.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    if (!codegenActions || codegenActions.length === 0) return null;

    // Chuẩn hóa locator: bỏ tiền tố page., bỏ dấu chấm đuôi, bỏ khoảng trắng.
    const normLoc = s => String(s ?? "")
        .replace(/^page\d*\s*\.\s*/, "")
        .replace(/\.\s*$/, "")
        .replace(/\s+/g, " ")
        .trim();

    // Ưu tiên: locator khớp (chỉ so action có locator thật).
    if (stepLocator) {
        const stepLoc = normLoc(stepLocator);
        const stepAction = String(step?.actionType ?? "").toUpperCase();
        const candidates = codegenActions.filter(a => {
            const aLoc = normLoc(a.locator ?? "");
            if (!aLoc || aLoc === "goto") return false;
            return aLoc === stepLoc;
        });
        if (candidates.length > 0) {
            // Ưu tiên action cùng loại với step (FILL step -> FILL codegen action), rồi mới cái đầu tiên.
            if (stepAction) {
                const same = candidates.find(a => String(a.sourceAction).toUpperCase() === stepAction);
                if (same) return same;
            }
            return candidates[0];
        }
    }
    // Fallback: target name khớp sourceLocator (bỏ action không có sourceLocator, vd goto).
    if (targetNorm) {
        const hit = codegenActions.find(a => {
            const n = String(a.sourceLocator ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
            if (!n) return false; // action không có sourceLocator (vd goto) -> không match.
            return n.includes(targetNorm) || targetNorm.includes(n);
        });
        if (hit) return hit;
    }
    return null;
}
