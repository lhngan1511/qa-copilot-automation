#!/usr/bin/env node
/**
 * Sprint 0 — Prototype test (chỉ cho research, KHÔNG phải production test).
 * Chạy: node prototype.test.mjs
 * Kiểm tra: lexer -> actions, segment -> tree, validate -> report.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { lex } from "./lexer.mjs";
import { segment } from "./segment-fallback.mjs";
import { validate } from "./validate.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const codegenFile = path.join(__dirname, "codegen-don-vi-tinh.js");
const codegenText = fs.readFileSync(codegenFile, "utf8");

let failures = 0;
function test(name, fn) {
    try {
        fn();
        console.log(`  ✔ ${name}`);
    } catch (e) {
        failures++;
        console.error(`  ✘ ${name}`);
        console.error(`    ${e.message}`);
    }
}

console.log("\n=== SPRINT 0 PROTOTYPE TEST ===\n");

// 1. Lexer
const actions = lex(codegenText, { sourceFile: "codegen-don-vi-tinh.js" });
test("lexer tạo action list có thứ tự, mỗi action có index + sourceReference", () => {
    if (actions.length === 0) throw new Error("không có action");
    actions.forEach((a, i) => {
        if (a.index !== i + 1) throw new Error(`index sai tại ${a.index}`);
        if (!a.sourceReference) throw new Error(`thiếu sourceReference tại ${a.index}`);
    });
});
test("lexer phân loại actionType (có CLICK/FILL/ASSERT/GOTO)", () => {
    const types = new Set(actions.map((a) => a.actionType));
    for (const t of ["CLICK", "FILL", "ASSERT", "GOTO"]) {
        if (!types.has(t)) throw new Error(`thiếu type ${t}`);
    }
});
test("lexer giữ hành động lặp/redundant (không tự xoá)", () => {
    const pressCaps = actions.filter((a) => a.actionType === "PRESS");
    if (pressCaps.length === 0) throw new Error("phải giữ PRESS CapsLock");
});

// 2. Segment
const tree = { sourceFile: "codegen-don-vi-tinh.js", segments: segment(actions), patternsProposed: [] };
test("segment tạo Behavior Tree có segment AUTHENTICATION + BUSINESS + ASSERTION", () => {
    const types = new Set(tree.segments.map((s) => s.type));
    for (const t of ["AUTHENTICATION", "BUSINESS", "ASSERTION"]) {
        if (!types.has(t)) throw new Error(`thiếu segment ${t}`);
    }
});
test("mọi segment có status DRAFT + sourceReferences", () => {
    tree.segments.forEach((s) => {
        if (s.status !== "DRAFT") throw new Error(`segment ${s.id} không DRAFT`);
        if (!s.sourceReferences || s.sourceReferences.length === 0) throw new Error(`segment ${s.id} thiếu sourceReferences`);
    });
});

// 3. Validate
const actionsJson = { sourceFile: "codegen-don-vi-tinh.js", count: actions.length, actions };
const report = validate(actionsJson, tree, codegenText);
test("validation: 6/6 checks đạt, tổng action khớp", () => {
    const allOk = Object.values(report.checks).every(Boolean);
    if (!allOk) throw new Error(JSON.stringify(report.checks));
    if (report.classifiedActions !== actions.length) throw new Error("classified != total");
    if (report.issues.length) throw new Error(report.issues.join("; "));
});

console.log(`\n========================================`);
if (failures === 0) console.log(" SPRINT 0 PROTOTYPE PASSED ✔");
else console.log(` ${failures} FAILURE(S) ✘`);
console.log("========================================\n");
process.exit(failures === 0 ? 0 : 1);
