#!/usr/bin/env node
/**
 * Sprint 0c — Validation Report.
 * Xác nhận Behavior Tree hợp lệ so với Action List:
 *  1. Mọi action trong Behavior Tree tồn tại trong Action List.
 *  2. Mọi locator/value/sourceReference truy ngược được Codegen gốc.
 *  3. Không segment nào làm mất hoặc tự thêm action.
 *  4. UNKNOWN/REDUNDANT vẫn giữ sourceReference.
 *  5. Gemini không tự sửa Codegen.
 *  6. Tổng action đã phân loại khớp tổng action đầu vào (trừ ignored có lý do).
 *
 * Usage: node validate.mjs [actionsFile] [treeFile] [codegenFile]
 */
import fs from "node:fs";
import path from "node:path";

const __dirname = path.dirname(new URL(import.meta.url).pathname);

export function validate(actionsJson, tree, codegenText) {
    const totalActions = actionsJson.count;
    const actionByIndex = new Map(actionsJson.actions.map((a) => [a.index, a]));

    const checks = {
        allActionsExistInActionList: true,
        locatorsTraceToCodegen: true,
        noActionLostOrAdded: true,
        unknownRedundantKeepSourceRef: true,
        geminiDidNotModifyCodegen: true,
        countMatches: true
    };
    const issues = [];

    // Thu thập mọi index trong tree (segment + pattern)
    const usedIndexes = new Set();
    for (const seg of tree.segments ?? []) {
        for (const i of seg.actions ?? []) {
            usedIndexes.add(i);
            // 1. tồn tại trong action list
            if (!actionByIndex.has(i)) {
                checks.allActionsExistInActionList = false;
                issues.push(`Action index ${i} trong segment ${seg.id} KHÔNG tồn tại trong Action List.`);
            }
            // 4. UNKNOWN/REDUNDANT giữ sourceReference
            if ((seg.type === "UNKNOWN" || seg.type === "REDUNDANT") && (!seg.sourceReferences || seg.sourceReferences.length === 0)) {
                checks.unknownRedundantKeepSourceRef = false;
                issues.push(`Segment ${seg.id} (${seg.type}) thiếu sourceReference.`);
            }
            // 2. locator truy ngược codegen
            const act = actionByIndex.get(i);
            if (act && act.locator && !codegenText.includes(act.locator.replace(/^page\./, "").split("(")[0])) {
                checks.locatorsTraceToCodegen = false;
                issues.push(`Action ${i} locator "${act.locator}" không truy ngược Codegen.`);
            }
        }
    }

    // 3 & 6. không mất/thêm, tổng khớp
    const missing = [];
    for (let i = 1; i <= totalActions; i++) {
        if (!usedIndexes.has(i)) missing.push(i);
    }
    if (missing.length > 0) {
        checks.noActionLostOrAdded = false;
        checks.countMatches = false;
        issues.push(`Action bị mất (không thuộc segment nào): [${missing.join(",")}]`);
    }
    const classified = usedIndexes.size;
    const extra = usedIndexes.size - totalActions;
    if (extra !== 0) {
        checks.countMatches = false;
        issues.push(`Số action phân loại (${classified}) khác tổng đầu vào (${totalActions}).`);
    }

    // 5. Gemini không sửa codegen — đối chiếu rawSource trong action list với codegen gốc
    for (const a of actionsJson.actions) {
        const trimmed = a.rawSource.trim();
        if (trimmed && !codegenText.includes(trimmed)) {
            checks.geminiDidNotModifyCodegen = false;
            issues.push(`Action ${a.index} rawSource không khớp Codegen gốc.`);
        }
    }

    // tổng hợp
    const ignoredActions = totalActions - usedIndexes.size;
    return {
        sourceFile: actionsJson.sourceFile,
        totalActions,
        classifiedActions: usedIndexes.size,
        ignoredActions: ignoredActions > 0 ? ignoredActions : 0,
        ignoredReasons: ignoredActions > 0 ? ["action không thuộc segment nào (cần xem xét)"] : [],
        checks,
        issues,
        generatedAt: new Date().toISOString()
    };
}

// CLI
const actionsFile = process.argv[2] || path.join(process.cwd(), "outputs", "research", "codegen-behavior", "actions.json");
const treeFile = process.argv[3] || path.join(process.cwd(), "outputs", "research", "codegen-behavior", "behavior-tree.json");
const codegenFile = process.argv[4] || path.join(process.cwd(), "research", "codegen-behavior", "codegen-don-vi-tinh.js");

const actionsJson = JSON.parse(fs.readFileSync(actionsFile, "utf8"));
const tree = JSON.parse(fs.readFileSync(treeFile, "utf8"));
const codegenText = fs.readFileSync(codegenFile, "utf8");

const report = validate(actionsJson, tree, codegenText);
const outputFile = path.join(process.cwd(), "outputs", "research", "codegen-behavior", "validation-report.json");
fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, JSON.stringify(report, null, 2));

console.log("=== VALIDATION REPORT ===");
console.log(`total=${report.totalActions} classified=${report.classifiedActions} ignored=${report.ignoredActions}`);
console.log("checks:", JSON.stringify(report.checks, null, 1));
if (report.issues.length) console.log("issues:", report.issues);
else console.log("OK: không có issue.");
