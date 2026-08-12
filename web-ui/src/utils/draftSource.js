/*
 P0 — DRAFT REVIEW: xóa step khỏi Draft bằng cách rewrite raw source an toàn.

 Evidence: parser gán sourceStart/sourceEnd (index trong source) + sourceLine;
 CodeGen output 1 statement/dòng. removeStepFromSource xóa CẢ DÒNG chứa step
 (từ đầu dòng đến hết dòng + newline) rồi parse lại → UI và raw source ĐỒNG BỘ.

 GUARD: nếu dòng chứa NHIỀU HƠN 1 statement (2 action cùng dòng, hoặc action +
 expect cùng dòng) → trả null (KHÔNG xóa — không invent rewrite; UI disable nút).
*/

const STATEMENT_RE = /\bpage\d*\s*\.\s*(?:getBy[A-Za-z]+\([^)]*\)|locator\([^)]*\))\s*\.\s*(?:fill|click|selectOption|press|check|uncheck|dblclick|hover)\s*\(|page\d*\s*\.\s*goto\s*\(|expect\s*\(/g;

export function removeStepFromSource(source, step) {
    const s = String(source ?? "");
    const start = step?.sourceStart;
    const end = step?.sourceEnd;
    if (!Number.isInteger(start) || !Number.isInteger(end)) return null;
    if (start < 0 || end > s.length || end <= start) return null;

    // Đầu dòng chứa step; cuối dòng (vị trí '\n' hoặc hết file).
    const lineStart = s.lastIndexOf("\n", start - 1) + 1;
    const lineEndIdx = s.indexOf("\n", end);
    const lineEnd = lineEndIdx === -1 ? s.length : lineEndIdx;
    const line = s.slice(lineStart, lineEnd);

    // Guard: dòng chỉ được chứa ĐÚNG 1 statement → mới xóa an toàn.
    const matches = line.match(STATEMENT_RE) ?? [];
    if (matches.length !== 1) return null;

    const next = s.slice(0, lineStart) + s.slice(lineEnd + (lineEndIdx === -1 ? 0 : 1));
    return next;
}
