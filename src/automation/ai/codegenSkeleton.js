/**
 * codegenSkeleton — Deterministic code builder cho Playwright spec (Contract P0 FINAL).
 *
 * Khi AI vẫn trả code bị cắt cụt sau tối đa 1 retry, dựng spec từ dữ liệu ĐÃ XÁC NHẬN:
 *   - Giữ nguyên mọi action đã record trong CodeGen (không bỏ fill Mã xác nhận...).
 *   - Giá trị fill resolve theo thứ tự ưu tiên (EMPTY > USER_CONFIRMED > APPROVED_JSON > CODEGEN_RECORDED > ENV_FALLBACK).
 *   - Credential dùng runtime env: process.env.TESTDATA_X ?? "" (không literal, không nằm trong nháy).
 *   - Assertion chỉ dùng nguồn thật (assertionMappings / expectedResult+codegen); không tự bịa.
 *   - Không hardcode business Login — hoạt động tổng quát từ mapping.
 * Thuần ESM, không phụ thuộc Runner.
 */
import {
    resolveTestValue,
    resolveFieldKey,
    renderFillExpression,
    resolveAssertion,
    approvedJsonValue,
    savedDrawerValue,
    fieldPurpose,
    envValueForField,
    envKeyForFieldKey,
    TESTDATA_SOURCES,
    traceAction,
    renderGotoStatement
} from "./testDataBinding.js";
import { extractCodegenActions, matchCodegenAction } from "./codegenActions.js";

/** Render 1 step (auth/nav/business). @returns {null|string} */
export function renderStepLine(st, { testCase = null, codegenAction = null, envValues = {} } = {}) {
    const loc = String(st?.locator ?? "").trim();
    if (!loc) return null;
    const action = String(st?.actionType ?? codegenAction?.sourceAction ?? "CLICK").toUpperCase();
    const target = String(st?.target ?? st?.businessStep ?? "");

    switch (action) {
        case "FILL": {
            // Resolve value theo thứ tự ưu tiên.
            const bind = renderFillExpression({
                fieldName: target,
                purpose: fieldPurpose(testCase, target),
                savedDrawerValue: savedDrawerValue(testCase, target),
                approvedJsonValue: approvedJsonValue(testCase, target),
                recordedCodeGenValue: codegenAction?.sourceValueKind === "LITERAL" ? codegenAction.recordedValue : undefined,
                envValue: envValueForField(target, envValues)
            });
            traceAction({
                testCaseId: st?.testCaseId ?? testCase?.id ?? "?",
                sourceStep: codegenAction?.sourceStep ?? st?.stepOrder,
                sourceLocator: codegenAction?.sourceLocator ?? target,
                sourceAction: "fill",
                sourceValueKind: codegenAction?.sourceValueKind ?? "?",
                mappedFieldKey: bind?.fieldKey ?? null,
                resolvedValueSource: bind?.source ?? "?",
                generatedStatementType: bind?.generatedStatementType ?? "?"
            });
            if (bind.generatedStatementType === "skip-empty") return null; // purpose EMPTY -> không điền.
            if (bind.expression == null) return `/* BINDING_REQUIRED: ${target} */`;
            return `  await ${loc}.fill(${bind.expression});`;
        }
        case "PRESS":
            return `  await ${loc}.press('Enter');`;
        case "SELECT": {
            const bind = renderFillExpression({
                fieldName: target,
                purpose: fieldPurpose(testCase, target),
                savedDrawerValue: savedDrawerValue(testCase, target),
                approvedJsonValue: approvedJsonValue(testCase, target),
                recordedCodeGenValue: codegenAction?.sourceValueKind === "OPTION" ? codegenAction.recordedValue : undefined,
                envValue: envValueForField(target, envValues)
            });
            if (bind.expression == null) return `/* BINDING_REQUIRED: ${target} */`;
            return `  await ${loc}.selectOption(${bind.expression});`;
        }
        case "CHECK":
            return `  await ${loc}.check();`;
        case "UNCHECK":
            return `  await ${loc}.uncheck();`;
        case "CLICK":
        default:
            return `  await ${loc}.click();`;
    }
}

/** Render setup prefix: entryRoute + authenticationSetup + navigationChain (giữ action CodeGen). */
export function setupPrefixLines(mapping, { testCase = null, codegenActions = [], envValues = {} } = {}) {
    const lines = [];
    const entryRoute = mapping?.entryRoute?.value;
    const goto = renderGotoStatement(entryRoute);
    if (goto) lines.push(goto);
    for (const st of mapping?.authenticationSetup?.steps ?? []) {
        const cg = matchCodegenAction(codegenActions, st);
        const line = renderStepLine(st, { testCase, codegenAction: cg, envValues });
        if (line) lines.push(line);
    }
    for (const st of mapping?.navigationChain?.steps ?? []) {
        const cg = matchCodegenAction(codegenActions, st);
        const line = renderStepLine(st, { testCase, codegenAction: cg, envValues });
        if (line) lines.push(line);
    }
    return lines;
}

/** Kiểm tra mọi action cần dữ liệu (FILL/SELECT) có bind value được không (VIII). */
export function validateDataBinding({ testCase, mapping, codegenActions = [], envValues = {} }) {
    const missing = [];
    const allSteps = [
        ...(mapping?.authenticationSetup?.steps ?? []),
        ...(mapping?.navigationChain?.steps ?? []),
        ...(mapping?.stepMappings ?? [])
    ];
    for (const st of allSteps) {
        const action = String(st?.actionType ?? "").toUpperCase();
        if (action !== "FILL" && action !== "SELECT") continue;
        const target = String(st?.target ?? st?.businessStep ?? "");
        const purpose = fieldPurpose(testCase, target);
        if (purpose === "EMPTY") continue; // EMPTY hợp lệ, không cần data.
        const bind = renderFillExpression({
            fieldName: target,
            purpose,
            savedDrawerValue: savedDrawerValue(testCase, target),
            approvedJsonValue: approvedJsonValue(testCase, target),
            recordedCodeGenValue: undefined,
            envValue: envValueForField(target, envValues)
        });
        if (bind.source === TESTDATA_SOURCES.MISSING || bind.value == null || String(bind.value).trim() === "") {
            missing.push({ fieldKey: target, reason: "TESTDATA_BINDING_REQUIRED" });
        }
    }
    return { ok: missing.length === 0, missing, errorCode: "TESTDATA_BINDING_REQUIRED" };
}

/**
 * Dựng spec Playwright hoàn chỉnh từ mapping + testcase (deterministic).
 * @returns {{code:string, ok:boolean, errorCode:string|null, reason:string}}
 */
export function buildSpecFromMapping({ testCase, mapping, codegenText = "", envValues = {} }) {
    const id = String(testCase?.id ?? testCase?.testcaseId ?? "TC");
    const title = `${id} - ${testCase?.title || testCase?.testScenario || "Automation"}`;

    // 1. Extract codegen actions (bảo toàn action đã record).
    const codegenActions = extractCodegenActions(codegenText);

    // 2. Validate data binding (mọi fill cần data phải resolve được).
    const binding = validateDataBinding({ testCase, mapping, codegenActions, envValues });
    if (!binding.ok) {
        return { code: "", ok: false, errorCode: "TESTDATA_BINDING_REQUIRED", reason: `Thiếu dữ liệu cho: ${binding.missing.map(m => m.fieldKey).join(", ")}` };
    }

    // 3. Assertion chỉ dùng nguồn thật.
    const assertion = resolveAssertion({
        assertionMappings: mapping?.assertionMappings ?? [],
        expectedResult: testCase?.expectedResult || testCase?.expectedResults?.[0] || "",
        codegenText,
        mapping,
        testCaseId: testCase?.id ?? testCase?.testcaseId ?? "",
        testCaseType: testCase?.type || ""
    });
    if (!assertion.ok) {
        return { code: "", ok: false, errorCode: "ASSERTION_MAPPING_REQUIRED", reason: assertion.reason };
    }

    // 4. Dựng spec.
    const lines = [];
    lines.push(`import { test, expect } from '@playwright/test';`);
    lines.push(`test(${JSON.stringify(title)}, async ({ page }) => {`);

    lines.push(...setupPrefixLines(mapping, { testCase, codegenActions, envValues }));

    // Business steps.
    for (const st of mapping?.stepMappings ?? []) {
        const cg = matchCodegenAction(codegenActions, st);
        const line = renderStepLine(st, { testCase, codegenAction: cg, envValues });
        if (line) lines.push(line);
    }

    // Assertion thật.
    lines.push(`  await ${String(assertion.playwrightAssertion).replace(/;\s*$/, "")};`);

    lines.push(`});`);
    return { code: lines.join("\n"), ok: true, errorCode: null, reason: "" };
}

/** Runtime env tối thiểu cho Runner (TESTDATA_*) — từ các value đã resolve, không log. */
export function runtimeEnvFor({ testCase, mapping, codegenText = "" }) {
    const env = {};
    const codegenActions = extractCodegenActions(codegenText);
    const allSteps = [
        ...(mapping?.authenticationSetup?.steps ?? []),
        ...(mapping?.navigationChain?.steps ?? []),
        ...(mapping?.stepMappings ?? [])
    ];
    for (const st of allSteps) {
        const action = String(st?.actionType ?? "").toUpperCase();
        if (action !== "FILL" && action !== "SELECT") continue;
        const target = String(st?.target ?? st?.businessStep ?? "");
        const fieldKey = resolveFieldKey(target);
        const envKey = envKeyForFieldKey(fieldKey);
        if (!envKey) continue;
        const bind = renderFillExpression({
            fieldName: target,
            purpose: fieldPurpose(testCase, target),
            savedDrawerValue: savedDrawerValue(testCase, target),
            approvedJsonValue: approvedJsonValue(testCase, target),
            recordedCodeGenValue: undefined,
            envValue: undefined
        });
        if (bind.value != null && String(bind.value).trim() !== "") env[envKey] = bind.value;
    }
    return env;
}
