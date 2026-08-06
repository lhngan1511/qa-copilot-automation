/**
 * codegenGuard — Kiểm tra tính hoàn chỉnh + encoding của code AI sinh trước khi ghi.
 *
 * Mục tiêu: KHÔNG ghi file nếu code bị cắt cụt (truncation) hoặc hỏng UTF-8 (mojibake).
 * Thuần ESM + không phụ thuộc Runner để test trực tiếp.
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";

/** Trích code từ response AI, bỏ code fence ```js ... ``` nếu có. */
export function extractFencedCode(text) {
    const s = String(text ?? "");
    const trimmed = s.trim();
    // Bỏ fence đầu ```js ```javascript ``` và fence cuối ```
    const fenceStart = trimmed.match(/^```(?:js|javascript)?[ \t]*\r?\n?/i);
    let body = fenceStart ? trimmed.slice(fenceStart[0].length) : trimmed;
    // Chỉ cắt fence cuối nếu body kết thúc bằng ```
    body = body.replace(/\r?\n?```\s*$/i, "");
    return body.trim();
}

/** Làm sạch token JS: bỏ comment (//, /* *\/) và string ('"`), giữ code để cân bằng ngoặc. */
export function stripCommentsAndStrings(code) {
    const s = String(code ?? "");
    let out = "";
    let i = 0;
    const n = s.length;
    while (i < n) {
        const c = s[i];
        const next = s[i + 1];
        // comment dòng //
        if (c === "/" && next === "/") {
            while (i < n && s[i] !== "\n") i += 1;
            continue;
        }
        // comment khối
        if (c === "/" && next === "*") {
            i += 2;
            while (i < n && !(s[i] === "*" && s[i + 1] === "/")) i += 1;
            i += 2;
            continue;
        }
        // string ' ... '
        if (c === "'" || c === '"') {
            const quote = c;
            i += 1;
            while (i < n) {
                if (s[i] === "\\") { i += 2; continue; }
                if (s[i] === quote) { i += 1; break; }
                i += 1;
            }
            out += " "; // thay bằng space
            continue;
        }
        // template literal ` ... `
        if (c === "`") {
            i += 1;
            while (i < n) {
                if (s[i] === "\\") { i += 2; continue; }
                if (s[i] === "`") { i += 1; break; }
                i += 1;
            }
            out += " ";
            continue;
        }
        out += c;
        i += 1;
    }
    return out;
}

/** Kiểm tra cân bằng ngoặc { } ( ) [ ]. */
export function isBalanced(code) {
    const stripped = stripCommentsAndStrings(code);
    const stack = [];
    const open = { ")": "(", "}": "{", "]": "[" };
    for (const ch of stripped) {
        if (ch === "(" || ch === "{" || ch === "[") stack.push(ch);
        else if (ch === ")" || ch === "}" || ch === "]") {
            if (stack.pop() !== open[ch]) return false;
        }
    }
    return stack.length === 0;
}

/** Có ít nhất một `test(`. */
export function hasTestDeclaration(code) {
    return /\btest\s*\(/.test(String(code ?? ""));
}

/** Callback test được đóng: sau `test('...', async ({page}) => {` có `});` đóng khối. */
export function hasClosedTestBlock(code) {
    const s = String(code ?? "");
    // Tìm từng test(...) và kiểm tra ngoặc của nó.
    const re = /\btest\s*\(/g;
    let m;
    let found = false;
    while ((m = re.exec(s)) !== null) {
        const start = m.index + m[0].length - 1; // vị trí '('
        let depth = 0;
        let inString = null;
        let inTemplate = false;
        for (let i = start; i < s.length; i++) {
            const c = s[i];
            if (inString) {
                if (c === "\\") { i += 1; continue; }
                if (c === inString) inString = null;
                continue;
            }
            if (inTemplate) {
                if (c === "\\") { i += 1; continue; }
                if (c === "`") inTemplate = false;
                continue;
            }
            if (c === "'" || c === '"') { inString = c; continue; }
            if (c === "`") { inTemplate = true; continue; }
            if (c === "(" || c === "{" || c === "[") depth += 1;
            else if (c === ")" || c === "}" || c === "]") {
                depth -= 1;
                if (depth <= 0) { found = true; break; }
            }
        }
        if (found) break;
    }
    return found;
}

/** Kiểm tra mojibake: chuỗi Unicode bị mã hoá sai kiểu latin1/binary. */
export function hasMojibake(text) {
    const s = String(text ?? "");
    // Các dãy phổ biến của tiếng Việt khi bị mojibake.
    const patterns = [
        /Ã[a-zA-Z]/g,     // Đ -> Ã? (Ã )
        /Ä[a-zA-Z]/g,     // Ä
        /áº/g,            // áº (ả/ạ...)
        /á»/g,            // á»
        /Ä|Äƒ|Ä©|Ã³|Ã¡|Ã©|Ã­|Ã´|Ãµ|Ã½|Ä/g,
        /TÃ i|Máº­t|MÃ£|Nháº­p|ÄÄng/,
        /kháº£|chá»©|háº¿t|Äá»/g
    ];
    return patterns.some(re => re.test(s));
}

/** Kiểm tra code kết thúc hợp lệ (dòng cuối không phải comment treo / bị cắt giữa). */
export function endsWithClosing(code) {
    const s = String(code ?? "").trimEnd();
    if (!s) return false;
    const lastLine = s.split("\n").pop().trim();
    // Không được kết thúc bằng comment dòng (// Navigation...) vì có thể bị cắt.
    if (/^\/\//.test(lastLine)) return false;
    return true;
}

/** Chạy `node --check` trên code (viết file tạm) để xác minh syntax. */
export function syntaxCheck(code, { execPath = process.execPath } = {}) {
    let tmp = null;
    try {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cgcheck-"));
        // Dùng .mjs để ép chế độ ESM (dự án type:module) — node --check trên .js có import
        // bị Node auto-detect bỏ qua một số lỗi cú pháp.
        const file = path.join(tmp, "check.mjs");
        fs.writeFileSync(file, code, "utf8");
        const r = spawnSync(execPath, ["--check", file], { encoding: "utf8" });
        return { ok: r.status === 0, error: r.status === 0 ? null : (r.stderr || "syntax error").slice(0, 300) };
    } catch (e) {
        return { ok: false, error: `Không thể chạy node --check: ${String(e?.message ?? e)}` };
    } finally {
        try { if (tmp) fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* ignore */ }
    }
}

/**
 * Kiểm tra toàn diện trước khi ghi file.
 * @returns {{ok:boolean, code:string|null, errorCode:string|null, reason:string}}
 */
export function validateGeneratedCode({ code, testCaseId = "", runSyntax = true }) {
    const s = String(code ?? "");
    const hasTest = hasTestDeclaration(s);
    const balanced = isBalanced(s);
    const closed = hasClosedTestBlock(s);
    const ends = endsWithClosing(s);

    // 1. Cắt cụt: thiếu test / không cân bằng / không đóng callback / không kết thúc hợp lệ.
    if (!hasTest || !balanced || !closed || !ends) {
        return {
            ok: false,
            code: null,
            errorCode: "AI_CODEGEN_TRUNCATED",
            reason: "Mã AI sinh ra chưa hoàn chỉnh. Hãy sinh lại."
        };
    }

    // 2. Mojibake / hỏng UTF-8.
    if (hasMojibake(s)) {
        return {
            ok: false,
            code: null,
            errorCode: "GENERATED_CODE_ENCODING_ERROR",
            reason: "Mã sinh ra bị lỗi mã hoá (mojibake). Hãy sinh lại."
        };
    }

    // 3. node --check.
    if (runSyntax) {
        const syn = syntaxCheck(s);
        if (!syn.ok) {
            return {
                ok: false,
                code: null,
                errorCode: "AI_CODEGEN_SYNTAX_ERROR",
                reason: `Mã sinh ra không hợp lệ cú pháp: ${syn.error || ""}`
            };
        }
    }

    return { ok: true, code: s, errorCode: null, reason: "" };
}
