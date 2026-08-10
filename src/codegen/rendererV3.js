import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { resolveTestValue, TESTDATA_SOURCES } from "../automation/ai/testDataBinding.js";
import { isSensitiveField } from "./recordingParser.js";
import { hashRecording } from "./CurrentRecordingSession.js";

/*
 rendererV3 — Renderer THUẦN (Architecture V3). Chỉ RENDER, KHÔNG ghi file.

 Renderer KHÔNG biết filesystem (ngoài node --check dùng file tạm).
 Việc ghi outputs/generated-tests/TC001.spec.js để GenerateService làm.

 Input (chỉ nhận):
   { testCase, setupRecording?, testcaseRecording, confirmedTestData, confirmedAssertions, approvedTestData }

 Output contract (RendererResult):
   {
     code,
     runtimeEnv: { "<ENV>": { value, source } },
     validation: {
       recording: { approved, hashValid, versionValid },
       spec: { syntaxValid, assertionValid, bindingValid }
     },
     metadata: { recording: { id, version, hash, approvedBy, approvedAt } }
   }

 Nguyên tắc:
   - Recording là nguồn sự thật cho locator/action/thứ tự. Không AI/segment/heuristic.
   - Chỉ latest APPROVED recording. Chỉ assertion TESTER_CONFIRMED.
   - Data resolve: EMPTY>USER_CONFIRMED>APPROVED_JSON>CODEGEN_RECORDED>ENV_FALLBACK>MISSING.
   - renderStep stateless: step → { line, runtimeEnv, diagnostics }. Không filesystem/workspace.
*/

export const RENDERER_ERRORS = {
    RECORDING_APPROVAL_REQUIRED: "RECORDING_APPROVAL_REQUIRED",
    RECORDING_CHANGED_AFTER_APPROVAL: "RECORDING_CHANGED_AFTER_APPROVAL",
    TESTDATA_BINDING_REQUIRED: "TESTDATA_BINDING_REQUIRED",
    ASSERTION_CONFIRMATION_REQUIRED: "ASSERTION_CONFIRMATION_REQUIRED"
};

/** Chọn latest APPROVED recording (version cao nhất). */
export function pickLatestApproved(recordings) {
    const approved = (Array.isArray(recordings) ? recordings : []).filter(r => r.status === "APPROVED");
    if (approved.length === 0) return null;
    approved.sort((a, b) => (b.recordingVersion || 0) - (a.recordingVersion || 0));
    return approved[0];
}

/** Map field credential/sensitive → runtime env key. */
export function envKeyFor(target) {
    const t = String(target ?? "").toLowerCase();
    if (/tài khoản|username/.test(t)) return "TESTDATA_USERNAME";
    if (/mật khẩu|password/.test(t)) return "TESTDATA_PASSWORD";
    if (/mã xác nhận|captcha/.test(t)) return "TESTDATA_CAPTCHA";
    return null;
}

/** Trích giá trị approved cho target từ nhiều dạng testData. */
function pickApprovedValue(approvedTestData, target) {
    if (!approvedTestData || typeof approvedTestData !== "object") return undefined;
    if (approvedTestData.fields && typeof approvedTestData.fields === "object") {
        const f = approvedTestData.fields[target];
        if (f && typeof f === "object") return f.value;
    }
    if (approvedTestData.inputs && typeof approvedTestData.inputs === "object") {
        return approvedTestData.inputs[target];
    }
    const direct = approvedTestData[target];
    if (direct != null && typeof direct === "object") return direct.value;
    return direct;
}

/** Render MỘT step — stateless: step → { line?, runtimeEnv?, diagnostics? }. */
export function renderStep(step, { purposeMap = {}, confirmedTestData = {}, approvedTestData = {} } = {}) {
    const diagnostics = [];
    const runtimeEnv = {};
    const action = String(step?.actionType ?? "").toUpperCase();
    let loc = String(step?.locator ?? "").trim().replace(/\.\s*$/, "").replace(/^page\d*\s*\.\s*/, "");
    loc = loc ? `page.${loc}` : "";

    // GOTO có thể không locator — dùng recordedValue (URL).
    if (!loc && action !== "GOTO") return { line: null, runtimeEnv, diagnostics };

    switch (action) {
        case "GOTO": {
            const url = String(step?.recordedValue ?? loc ?? "");
            const line = /^https?:\/\//i.test(url)
                ? `  await page.goto(${JSON.stringify(url)});`
                : `  await page.goto(process.env.BASE_URL + ${JSON.stringify(url)});`;
            return { line, runtimeEnv, diagnostics };
        }
        case "FILL": {
            const target = String(step?.target ?? "");
            const resolved = resolveTestValue({
                purpose: purposeMap[target],
                savedDrawerValue: confirmedTestData?.[target],
                approvedJsonValue: pickApprovedValue(approvedTestData, target),
                recordedCodeGenValue: step?.recordedValue,
                envValue: undefined
            });
            if (resolved.source === TESTDATA_SOURCES.MISSING || resolved.value == null) {
                diagnostics.push({ code: "TESTDATA_BINDING_REQUIRED", field: target });
                return { line: null, runtimeEnv, diagnostics };
            }
            if (String(purposeMap[target] ?? "").toUpperCase() === "EMPTY") {
                return { line: null, runtimeEnv, diagnostics }; // EMPTY -> không điền
            }
            const envKey = envKeyFor(target);
            if (envKey) {
                runtimeEnv[envKey] = { value: resolved.value, source: resolved.source };
                return { line: `  await ${loc}.fill(process.env.${envKey} ?? "");`, runtimeEnv, diagnostics };
            }
            return { line: `  await ${loc}.fill(${JSON.stringify(resolved.value)});`, runtimeEnv, diagnostics };
        }
        case "CLICK": return { line: `  await ${loc}.click();`, runtimeEnv, diagnostics };
        case "CHECK": return { line: `  await ${loc}.check();`, runtimeEnv, diagnostics };
        case "UNCHECK": return { line: `  await ${loc}.uncheck();`, runtimeEnv, diagnostics };
        case "SELECT": return { line: `  await ${loc}.selectOption(${JSON.stringify(String(step?.recordedValue ?? ""))});`, runtimeEnv, diagnostics };
        case "PRESS": return { line: `  await ${loc}.press(${JSON.stringify(String(step?.recordedValue ?? "Enter"))});`, runtimeEnv, diagnostics };
        case "ASSERT": return { line: null, runtimeEnv, diagnostics }; // assertion xử lý riêng từ confirmedAssertions
        default:
            diagnostics.push({ code: "UNKNOWN_ACTION", action });
            return { line: null, runtimeEnv, diagnostics };
    }
}

/** Render assertion từ automationAssertions TESTER_CONFIRMED. */
export function renderAssertion(a) {
    const matcher = String(a?.matcher ?? "");
    const expected = a?.expected;
    const loc = a?.locator;
    switch (matcher) {
        case "toHaveURL": return `  await expect(page).toHaveURL(${JSON.stringify(expected)});`;
        case "toBeVisible":
            return loc ? `  await expect(${loc}).toBeVisible();` : `  await expect(page.getByText(${JSON.stringify(expected)})).toBeVisible();`;
        case "toBeHidden":
            return loc ? `  await expect(${loc}).toBeHidden();` : `  await expect(page.getByText(${JSON.stringify(expected)})).toBeHidden();`;
        case "toHaveValue":
            return `  await expect(${loc ?? `page.getByLabel(${JSON.stringify(a.target)})`}).toHaveValue(${JSON.stringify(expected)});`;
        case "toBeDisabled":
            return `  await expect(${loc ?? `page.getByLabel(${JSON.stringify(a.target)})`}).toBeDisabled();`;
        case "toHaveCount":
            return `  await expect(${loc ?? "page.locator('*')"}).toHaveCount(${JSON.stringify(expected)});`;
        default: return null;
    }
}

/** Render spec (chỉ render — KHÔNG ghi file). */
export function renderV3Spec({
    testCase,
    testcaseRecording,
    setupRecording = null,
    confirmedTestData = {},
    confirmedAssertions = [],
    approvedTestData = {},
    approvedBy = null,
    approvedAt = null
}) {
    const testCaseId = String(testCase?.id ?? testCase?.testcaseId ?? "");
    const validation = {
        recording: { approved: false, hashValid: false, versionValid: false },
        spec: { syntaxValid: false, assertionValid: false, bindingValid: false }
    };
    const metadata = { recording: null };

    // 1. latest APPROVED testcase recording.
    if (!testcaseRecording || testcaseRecording.status !== "APPROVED") {
        return { ok: false, errorCode: RENDERER_ERRORS.RECORDING_APPROVAL_REQUIRED, validation, metadata, reason: "Chưa có recording APPROVED." };
    }
    validation.recording.approved = true;
    validation.recording.versionValid = Number.isInteger(testcaseRecording.recordingVersion) && testcaseRecording.recordingVersion > 0;
    metadata.recording = {
        id: testcaseRecording.recordingId,
        version: testcaseRecording.recordingVersion,
        hash: testcaseRecording.recordingHash,
        approvedBy: approvedBy ?? testcaseRecording.approvedBy ?? null,
        approvedAt: approvedAt ?? testcaseRecording.approvedAt ?? null
    };

    // 2. Hash valid: source không đổi sau approval.
    if (testcaseRecording.recordingHash && String(testcaseRecording.scriptContent ?? "").trim()) {
        validation.recording.hashValid = hashRecording(testcaseRecording.scriptContent) === testcaseRecording.recordingHash;
        if (!validation.recording.hashValid) {
            return { ok: false, errorCode: RENDERER_ERRORS.RECORDING_CHANGED_AFTER_APPROVAL, validation, metadata, reason: "Recording đổi sau APPROVED." };
        }
    } else {
        validation.recording.hashValid = true; // không có source để so → mặc định ok
    }

    // 3. Assertion confirmed (TESTER_CONFIRMED).
    const confirmed = (Array.isArray(confirmedAssertions) ? confirmedAssertions : []).filter(a => a.status === "TESTER_CONFIRMED");
    if (confirmed.length === 0) {
        validation.spec.assertionValid = false;
        return { ok: false, errorCode: RENDERER_ERRORS.ASSERTION_CONFIRMATION_REQUIRED, validation, metadata, reason: "Chưa có assertion TESTER_CONFIRMED." };
    }
    validation.spec.assertionValid = true;

    // 4. Render steps (SETUP + TESTCASE) — stateless renderStep.
    const purposeMap = {};
    for (const [k, f] of Object.entries(approvedTestData?.fields ?? {})) purposeMap[k] = f?.purpose ?? "VALID";
    const runtimeEnv = {};
    const bindingDiag = [];

    const renderRecording = rec => {
        const lines = [];
        for (const step of rec?.steps ?? []) {
            const r = renderStep(step, { purposeMap, confirmedTestData, approvedTestData });
            if (r.line) lines.push(r.line);
            for (const [k, v] of Object.entries(r.runtimeEnv || {})) runtimeEnv[k] = v;
            for (const d of r.diagnostics || []) if (d.code === "TESTDATA_BINDING_REQUIRED") bindingDiag.push(d.field);
        }
        return lines;
    };

    const lines = [];
    if (setupRecording) lines.push(...renderRecording(setupRecording));
    lines.push(...renderRecording(testcaseRecording));

    if (bindingDiag.length > 0) {
        validation.spec.bindingValid = false;
        return { ok: false, errorCode: RENDERER_ERRORS.TESTDATA_BINDING_REQUIRED, validation, metadata, runtimeEnv, reason: `Thiếu dữ liệu: ${bindingDiag.join(", ")}` };
    }
    validation.spec.bindingValid = true;

    // 5. Ghép spec.
    const title = `${testCaseId} - ${testCase?.title || "Automation"}`;
    const specLines = [
        `import { test, expect } from '@playwright/test';`,
        `test(${JSON.stringify(title)}, async ({ page }) => {`
    ];
    specLines.push(...lines);
    for (const a of confirmed) {
        const line = renderAssertion(a);
        if (line) specLines.push(line);
    }
    specLines.push(`});`);
    const code = specLines.join("\n");

    // 6. node --check (dùng file tạm, không phải ghi spec).
    validation.spec.syntaxValid = syntaxCheck(code);
    if (!validation.spec.syntaxValid) {
        return { ok: false, errorCode: "SYNTAX_ERROR", validation, metadata, runtimeEnv, reason: "node --check thất bại.", code };
    }

    return { ok: true, code, runtimeEnv, validation, metadata };
}

/** node --check (file .mjs để ép ESM) — dùng file tạm. */
function syntaxCheck(code) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "v3-"));
    const file = path.join(tmp, "check.mjs");
    fs.writeFileSync(file, code, "utf8");
    const r = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
    fs.rmSync(tmp, { recursive: true, force: true });
    return r.status === 0;
}
