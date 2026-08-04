#!/usr/bin/env node
/**
 * Sprint 0a — Action List (lexer hành vi).
 * Tách Playwright Codegen thật thành danh sách hành động có thứ tự.
 * KHÔNG hiểu nghiệp vụ. KHÔNG tự xoá wait/back/redundant — chỉ ghi nhận.
 *
 * Usage: node lexer.mjs <codegenFile> [outputFile]
 */
import fs from "node:fs";
import path from "node:path";

const ACTION_METHODS = new Set([
    "goto", "click", "fill", "press", "dblclick", "selectOption", "check", "uncheck",
    "hover", "focus", "waitFor", "waitForTimeout", "goBack", "goForward", "screenshot",
    "type", "clear"
]);

function extractLocator(expr) {
    // tìm page.getByRole(...) / page.locator(...) / page.getByText(...) / page.getByPlaceholder...
    const m = /page\.(getByRole|getByText|getByPlaceholder|getByTestId|getByLabel|locator)\([^;]*?\)/.exec(expr);
    return m ? m[0].trim() : null;
}

function actionTypeFromMethod(method) {
    switch (method) {
        case "goto": return "GOTO";
        case "click": return "CLICK";
        case "dblclick": return "DBLCLICK";
        case "fill": return "FILL";
        case "type": return "TYPE";
        case "press": return "PRESS";
        case "clear": return "CLEAR";
        case "selectOption": return "SELECT";
        case "check": return "CHECK";
        case "uncheck": return "UNCHECK";
        case "hover": return "HOVER";
        case "goBack": return "GO_BACK";
        case "goForward": return "GO_FORWARD";
        case "waitForTimeout": return "WAIT";
        case "waitFor": return "WAIT_FOR";
        case "screenshot": return "SCREENSHOT";
        default: return "ACTION";
    }
}

function isAssertion(line) {
    return /^\s*await\s+expect\(/.test(line) || /^\s*expect\(/.test(line);
}

function splitTopLevelCalls(line) {
    // chia theo ';' nhưng giữ chuỗi có ';' bên trong? Playwright không có ; trong chuỗi thường.
    return [line];
}

/**
 * Phân tích một dòng codegen -> action | assertion | comment.
 */
function lexLine(line, lineNo, fileRef) {
    const trimmed = line.trim();
    const sourceReference = `${fileRef}#L${lineNo}`;
    if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("import ") || trimmed.startsWith("test(") || trimmed.startsWith("});")) {
        return null;
    }
    if (isAssertion(trimmed)) {
        // expect(expr).toBeVisible() | toContainText(...)
        const assertMatch = /expect\(([\s\S]*?)\)\.(\w+)\(([\s\S]*?)\)/.exec(trimmed);
        const locator = assertMatch ? extractLocator(assertMatch[1]) : extractLocator(trimmed);
        return {
            index: null, // gán sau
            rawSource: trimmed,
            actionType: "ASSERT",
            locator,
            value: assertMatch ? assertMatch[3].trim() : null,
            assertion: assertMatch ? assertMatch[2] : null,
            sourceReference
        };
    }
    // action: page.<locator-chain>.<method>(...)
    // Bắt METHOD CUỐI CÙNG (vd getByRole(...).click() -> click; getByText(...).dblclick() -> dblclick)
    const methodMatch = /\.(goto|click|fill|press|dblclick|selectOption|check|uncheck|hover|focus|waitForTimeout|waitFor|goBack|goForward|type|clear|screenshot)\s*\(([^)]*)\)\s*;?\s*$/.exec(trimmed);
    if (methodMatch) {
        const method = methodMatch[1];
        const locator = extractLocator(trimmed);
        let value = null;
        if (method === "fill" || method === "press" || method === "type" || method === "goto") {
            value = methodMatch[2].trim();
        }
        return {
            index: null,
            rawSource: trimmed,
            actionType: ACTION_METHODS.has(method) ? actionTypeFromMethod(method) : "ACTION",
            locator,
            value,
            assertion: null,
            sourceReference
        };
    }
    // dòng khác (vd await page.getByText(...).click() đã bắt ở trên; hoặc dòng lạ)
    return {
        index: null,
        rawSource: trimmed,
        actionType: "UNKNOWN_LINE",
        locator: extractLocator(trimmed),
        value: null,
        assertion: null,
        sourceReference
    };
}

export function lex(codegenText, { sourceFile = "codegen" } = {}) {
    const lines = codegenText.split("\n");
    const actions = [];
    let count = 0;
    lines.forEach((line, i) => {
        const parsed = lexLine(line, i + 1, sourceFile);
        if (!parsed) return;
        count += 1;
        actions.push({ ...parsed, index: count });
    });
    return actions;
}

// CLI
const __dirname = path.dirname(new URL(import.meta.url).pathname);
const codegenFile = process.argv[2] || path.join(__dirname, "codegen-don-vi-tinh.js");
const outputFile = process.argv[3] || path.join(process.cwd(), "outputs", "research", "codegen-behavior", "actions.json");

const codegenText = fs.readFileSync(codegenFile, "utf8");
const actions = lex(codegenText, { sourceFile: path.basename(codegenFile) });
const payload = {
    sourceFile: path.basename(codegenFile),
    generatedAt: new Date().toISOString(),
    count: actions.length,
    actions
};
fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, JSON.stringify(payload, null, 2));
console.log(`Lexer: ${actions.length} actions -> ${outputFile}`);
