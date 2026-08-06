import path from "node:path";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import {
    resolveTestValue,
    TESTDATA_SOURCES
} from "../automation/ai/testDataBinding.js";
import { isSensitiveField } from "./recordingParser.js";
import { hashRecording } from "./CurrentRecordingSession.js";

/*
 rendererV3 — Render Playwright spec từ Workspace + latest APPROVED recording (Architecture V3).

 Input (chỉ nhận):
   {
     workspace,
     testCase,            // approved testcase snapshot (TC001)
     setupRecording?,     // latest APPROVED SETUP (optional)
     testcaseRecording,   // latest APPROVED của đúng testCaseId (bắt buộc)
     confirmedTestData,   // testData đã resolve (USER_CONFIRMED > APPROVED_JSON ...)
     confirmedAssertions  // automationAssertions status=TESTER_CONFIRMED
   }

 Output contract:
   { testCaseId, recordingId, recordingVersion, recordingHash, source:"RECORD_BY_TESTCASE",
     code, runtimeEnv, outputPath, validation:{syntaxValid,dataBindingValid,assertionValid,recordingApproved} }

 Nguyên tắc:
   - Recording là nguồn sự thật cho locator/action/thứ tự. Không dùng AI/segment/heuristic.
   - Chỉ dùng latest APPROVED recording (không RECORDED/REVIEW_REQUIRED).
   - Chỉ dùng assertion TESTER_CONFIRMED.
   - Data resolve theo: EMPTY > USER_CONFIRMED > APPROVED_JSON > CODEGEN_RECORDED > ENV_FALLBACK > MISSING.
   - Không hardcode sensitive; dùng process.env.TESTDATA_*.
   - Không sử dụng fallback cũ. Không import AI provider.
*/

export const RENDERER_ERRORS = {
    RECORDING_APPROVAL_REQUIRED: "RECORDING_APPROVAL_REQUIRED",
    RECORDING_CHANGED_AFTER_APPROVAL: "RECORDING_CHANGED_AFTER_APPROVAL",
    TESTDATA_BINDING_REQUIRED: "TESTDATA_BINDING_REQUIRED",
    ASSERTION_CONFIRMATION_REQUIRED: "ASSERTION_CONFIRMATION_REQUIRED",
    SETUP_TESTCASE_OVERLAP_REVIEW_REQUIRED: "SETUP_TESTCASE_OVERLAP_REVIEW_REQUIRED"
};

/** Chọn latest APPROVED recording (version cao nhất) trong list. */
export function pickLatestApproved(recordings) {
    const approved = (Array.isArray(recordings) ? recordings : []).filter(r => r.status === "APPROVED");
    if (approved.length === 0) return null;
    approved.sort((a, b) => (b.recordingVersion || 0) - (a.recordingVersion || 0));
    return approved[0];
}

/** Kiểm tra testcase là Login (self-contained) — KHÔNG dùng keyword, dựa trên recording chứa full login. */
function isSelfContainedLogin(testcaseRecording) {
    const steps = testcaseRecording?.steps ?? [];
    const targets = steps.map(s => String(s.target ?? "").toLowerCase());
    return targets.includes("tài khoản") && targets.includes("mật khẩu") && targets.some(t => t.includes("đăng nhập"));
}

/** Resolve value cho 1 FILL step theo thứ tự ưu tiên. */
function resolveFillValue({ target, purpose, confirmedTestData, approvedTestData, recordedValue }) {
    // approvedTestData có thể là {fields:{name:{value}}}, {inputs:{name:val}}, hoặc {name:{value}}.
    const approved = pickApprovedValue(approvedTestData, target);
    const resolved = resolveTestValue({
        purpose,
        savedDrawerValue: confirmedTestData?.[target],
        approvedJsonValue: approved,
        recordedCodeGenValue: recordedValue,
        envValue: undefined
    });
    return resolved;
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

/** Render 1 step recording thành dòng Playwright. */
export function renderStep(step, { purposeMap, confirmedTestData, approvedTestData }) {
    // Locator từ parser có thể thiếu 'page.' và thừa dấu chấm đuôi -> chuẩn hóa.
    let loc = String(step?.locator ?? "").trim().replace(/\.\s*$/, "").replace(/^page\d*\s*\.\s*/, "");
    loc = loc ? `page.${loc}` : "";
    const action = String(step?.actionType ?? "").toUpperCase();
    const target = String(step?.target ?? "");
    // GOTO có thể không có locator (loc rỗng) — dùng recordedValue là URL; cho qua.
    if (!loc && action !== "GOTO") return null;

    switch (action) {
        case "GOTO": {
            // goto: locator chứa URL đầy đủ hoặc path
            const url = String(step?.recordedValue ?? loc ?? "");
            if (/^https?:\/\//i.test(url)) return { line: `  await page.goto(${JSON.stringify(url)});` };
            return { line: `  await page.goto(process.env.BASE_URL + ${JSON.stringify(url)});` };
        }
        case "FILL": {
            const r = resolveFillValue({ target, purpose: purposeMap[target], confirmedTestData, approvedTestData, recordedValue: step?.recordedValue });
            if (r.source === TESTDATA_SOURCES.MISSING || r.value == null) {
                return { bindingError: target };
            }
            if (String(purposeMap[target] ?? "").toUpperCase() === "EMPTY") return null; // EMPTY -> không điền
            // Credential/sensitive field -> runtime env; không hardcode.
            const envKey = envKeyFor(target);
            if (envKey) {
                return { line: `  await ${loc}.fill(process.env.${envKey} ?? "");`, envKey, value: r.value };
            }
            return { line: `  await ${loc}.fill(${JSON.stringify(r.value)});`, value: r.value };
        }
        case "CLICK":
            return { line: `  await ${loc}.click();` };
        case "CHECK":
            return { line: `  await ${loc}.check();` };
        case "UNCHECK":
            return { line: `  await ${loc}.uncheck();` };
        case "SELECT":
            return { line: `  await ${loc}.selectOption(${JSON.stringify(String(step?.recordedValue ?? ""))});` };
        case "PRESS":
            return { line: `  await ${loc}.press(${JSON.stringify(String(step?.recordedValue ?? "Enter"))});` };
        case "ASSERT":
            return null; // assertion xử lý riêng từ confirmedAssertions
        default:
            return null;
    }
}

/** Map field nhạy cảm → runtime env key. */
function envKeyFor(target) {
    const t = String(target ?? "").toLowerCase();
    if (/tài khoản|username/.test(t)) return "TESTDATA_USERNAME";
    if (/mật khẩu|password/.test(t)) return "TESTDATA_PASSWORD";
    if (/mã xác nhận|captcha/.test(t)) return "TESTDATA_CAPTCHA";
    return null;
}

/** Render assertion từ automationAssertions TESTER_CONFIRMED. */
export function renderAssertion(a) {
    const matcher = String(a?.matcher ?? "");
    const expected = a?.expected;
    const loc = a?.locator;
    switch (matcher) {
        case "toHaveURL": return `  await expect(page).toHaveURL(${JSON.stringify(expected)});`;
        case "toBeVisible":
            return loc
                ? `  await expect(${loc}).toBeVisible();`
                : `  await expect(page.getByText(${JSON.stringify(expected)})).toBeVisible();`;
        case "toHaveValue":
            return `  await expect(${loc ?? `page.getByLabel(${JSON.stringify(a.target)})`}).toHaveValue(${JSON.stringify(expected)});`;
        case "toBeDisabled":
            return `  await expect(${loc ?? `page.getByLabel(${JSON.stringify(a.target)})`}).toBeDisabled();`;
        case "toHaveCount":
            return `  await expect(${loc ?? "page.locator('*')"}).toHaveCount(${JSON.stringify(expected)});`;
        default:
            return null;
    }
}

/**
 * Render spec TCxxx.
 * @returns {object} output contract hoặc {ok:false,errorCode}
 */
export function renderV3Spec({
    workspaceId,
    testCase,
    testcaseRecording,
    setupRecording = null,
    confirmedTestData = {},
    confirmedAssertions = [],
    approvedTestData = {},
    outputDir = path.resolve("outputs", "generated-tests")
}) {
    const testCaseId = String(testCase?.id ?? testCase?.testcaseId ?? "");
    const errors = { syntaxValid: false, dataBindingValid: false, assertionValid: false, recordingApproved: false };

    // 1. latest APPROVED testcase recording.
    if (!testcaseRecording || testcaseRecording.status !== "APPROVED") {
        return { ok: false, errorCode: RENDERER_ERRORS.RECORDING_APPROVAL_REQUIRED, errors, reason: "Chưa có recording APPROVED cho testcase." };
    }
    // Hash thay đổi sau approval → reject (source bị sửa sau khi duyệt).
    if (testcaseRecording.recordingHash && String(testcaseRecording.scriptContent ?? "").trim()) {
        const currentHash = hashRecording(testcaseRecording.scriptContent);
        if (currentHash !== testcaseRecording.recordingHash) {
            return { ok: false, errorCode: RENDERER_ERRORS.RECORDING_CHANGED_AFTER_APPROVAL, errors, reason: "Recording bị thay đổi sau khi APPROVED." };
        }
    }
    errors.recordingApproved = true;

    // 2. SETUP APPROVED nếu có.
    if (setupRecording && setupRecording.status !== "APPROVED") {
        return { ok: false, errorCode: RENDERER_ERRORS.RECORDING_APPROVAL_REQUIRED, errors, reason: "SETUP chưa APPROVED." };
    }

    // 3. Assertion confirmed (TESTER_CONFIRMED).
    const confirmed = (Array.isArray(confirmedAssertions) ? confirmedAssertions : []).filter(a => a.status === "TESTER_CONFIRMED");
    if (confirmed.length === 0) {
        errors.assertionValid = false;
        return { ok: false, errorCode: RENDERER_ERRORS.ASSERTION_CONFIRMATION_REQUIRED, errors, reason: "Chưa có assertion TESTER_CONFIRMED." };
    }
    errors.assertionValid = true;

    // 4. Render steps (SETUP + TESTCASE) — giữ thứ tự.
    const purposeMap = {};
    for (const [k, f] of Object.entries(approvedTestData?.fields ?? {})) purposeMap[k] = f?.purpose ?? "VALID";
    const runtimeEnv = {};

    const renderRecording = rec => {
        const lines = [];
        const stepResults = [];
        for (const step of rec?.steps ?? []) {
            const r = renderStep(step, { purposeMap, confirmedTestData, approvedTestData });
            if (!r) continue;
            if (r.bindingError) return { bindingError: r.bindingError };
            if (r.line) lines.push(r.line);
            if (r.envKey && r.value != null) runtimeEnv[r.envKey] = r.value;
        }
        return { lines, stepResults };
    };

    const setupOut = setupRecording ? renderRecording(setupRecording) : null;
    if (setupOut?.bindingError) {
        errors.dataBindingValid = false;
        return { ok: false, errorCode: RENDERER_ERRORS.TESTDATA_BINDING_REQUIRED, errors, reason: `Thiếu dữ liệu: ${setupOut.bindingError}` };
    }
    const tcOut = renderRecording(testcaseRecording);
    if (tcOut?.bindingError) {
        errors.dataBindingValid = false;
        return { ok: false, errorCode: RENDERER_ERRORS.TESTDATA_BINDING_REQUIRED, errors, reason: `Thiếu dữ liệu: ${tcOut.bindingError}` };
    }
    errors.dataBindingValid = true;

    // 5. Ghép spec.
    const title = `${testCaseId} - ${testCase?.title || "Automation"}`;
    const lines = [
        `import { test, expect } from '@playwright/test';`,
        `test(${JSON.stringify(title)}, async ({ page }) => {`
    ];
    if (setupOut) lines.push(...setupOut.lines);
    lines.push(...tcOut.lines);
    for (const a of confirmed) {
        const line = renderAssertion(a);
        if (line) lines.push(line);
    }
    lines.push(`});`);
    const code = lines.join("\n");

    // 6. node --check + ghi file.
    const syntax = syntaxCheck(code);
    errors.syntaxValid = syntax;
    if (!syntax) {
        return { ok: false, errorCode: "SYNTAX_ERROR", errors, reason: "node --check thất bại.", code };
    }

    fs.mkdirSync(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, `${testCaseId}.spec.js`);
    fs.writeFileSync(outputPath, code, "utf8");

    return {
        ok: true,
        testCaseId,
        recordingId: testcaseRecording.recordingId,
        recordingVersion: testcaseRecording.recordingVersion,
        recordingHash: testcaseRecording.recordingHash,
        source: "RECORD_BY_TESTCASE",
        code,
        runtimeEnv,
        outputPath,
        validation: errors
    };
}

/** node --check (file .mjs để ép ESM). */
function syntaxCheck(code) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "v3-"));
    const file = path.join(tmp, "check.mjs");
    fs.writeFileSync(file, code, "utf8");
    const r = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
    fs.rmSync(tmp, { recursive: true, force: true });
    return r.status === 0;
}
