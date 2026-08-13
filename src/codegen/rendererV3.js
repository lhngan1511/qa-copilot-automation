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
    // P0-C runtime bug — Login là REUSABLE/setup Action: credential từ SHARED runtime config
    // (LOGIN_USERNAME / LOGIN_PASSWORD / LOGIN_CAPTCHA), KHÔNG phải TESTDATA_* (không tồn tại
    // trong runtime). KHÔNG copy credentials vào business Test Data của testcase.
    const t = String(target ?? "").toLowerCase();
    if (/tài khoản|username|account/.test(t)) return "LOGIN_USERNAME";
    if (/mật khẩu|password/.test(t)) return "LOGIN_PASSWORD";
    if (/mã xác nhận|captcha/.test(t)) return "LOGIN_CAPTCHA";
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

/** Có data (non-empty) tại key trong confirmed (dạng {key: value})? */
function hasDataAt(confirmedTestData, key) {
    const v = confirmedTestData?.[key];
    return v !== undefined && v !== null && String(v).trim() !== "";
}

/** Có data (non-empty) tại key trong approved (fields/inputs/direct)? */
function hasApprovedDataAt(approvedTestData, key) {
    if (!approvedTestData || typeof approvedTestData !== "object") return false;
    if (approvedTestData.fields && typeof approvedTestData.fields === "object") {
        const f = approvedTestData.fields[key];
        const v = f && typeof f === "object" ? f.value : f;
        if (v !== undefined && v !== null && String(v).trim() !== "") return true;
    }
    if (approvedTestData.inputs && typeof approvedTestData.inputs === "object") {
        const v = approvedTestData.inputs[key];
        if (v !== undefined && v !== null && String(v).trim() !== "") return true;
    }
    const direct = approvedTestData[key];
    const dv = direct != null && typeof direct === "object" ? direct.value : direct;
    return dv !== undefined && dv !== null && String(dv).trim() !== "";
}

/**
 * P0 RUNTIME FIX (canonical) — businessField cho 1 FILL target. Deterministic, KHÔNG đoán:
 *   1. Setup env-bound (LOGIN_*)  → target (giữ `process.env.LOGIN_*` path — KHÔNG bao giờ
 *      map input Login sang business field khác).
 *   2. Có binding canonical      → binding (tester-owned/evidence).
 *   3. Target ∈ approved keys (approved ĐỊNH NGHĨA business field, VD 'Mã đơn vị tính')
 *      và có data (approved/confirmed) → target.
 *   4. ĐÚNG 1 business field (non-setup, KHÁC target) có data (confirmed/approved)
 *      → business field đó. (Bất biến: recorded KHÔNG được thắng current business data —
 *      kể cả khi auto-bind chưa kịp tạo binding — nhưng chỉ khi KHÔNG mơ hồ.)
 *   5. Confirmed có data theo chính target (legacy keyfix — không có business field khác)
 *      → target.
 *   6. Còn lại → target (contract: recorded fallback chỉ khi không có testcase data).
 */
export function resolveBusinessFieldForFill(target, { testDataBindings = {}, confirmedTestData = {}, approvedTestData = {} } = {}) {
    const t = String(target ?? "").trim();
    if (!t) return t;
    if (envKeyFor(t)) return t; // setup env-bound — LOGIN_*, không phải business data
    const rawBinding = testDataBindings && String(testDataBindings[t] ?? "").trim();
    if (rawBinding) return rawBinding;
    const conf = confirmedTestData && typeof confirmedTestData === "object" ? confirmedTestData : {};
    const approved = approvedTestData && typeof approvedTestData === "object" ? approvedTestData : {};
    // Approved keys = định nghĩa business field names.
    const approvedKeys = new Set();
    if (approved.fields && typeof approved.fields === "object") for (const k of Object.keys(approved.fields)) approvedKeys.add(k);
    if (approved.inputs && typeof approved.inputs === "object") for (const k of Object.keys(approved.inputs)) approvedKeys.add(k);
    for (const k of Object.keys(approved)) if (k !== "fields" && k !== "inputs" && k !== "requirement") approvedKeys.add(k);
    // Rule 3 — target LÀ business field (approved định nghĩa) và có data.
    if (approvedKeys.has(t) && (hasApprovedDataAt(approved, t) || hasDataAt(conf, t))) return t;
    // Rule 4 — unique business candidate (non-setup, non-empty data, KHÁC target).
    const candidates = new Set();
    const consider = (k, v) => {
        const name = String(k ?? "").trim();
        if (!name || name === t || envKeyFor(name)) return;
        const val = v == null ? "" : (typeof v === "object" ? (v?.value ?? "") : v);
        if (String(val).trim() !== "") candidates.add(name);
    };
    for (const [k, v] of Object.entries(conf)) consider(k, v);
    if (approved.fields && typeof approved.fields === "object") {
        for (const [k, f] of Object.entries(approved.fields)) consider(k, f);
    }
    if (approved.inputs && typeof approved.inputs === "object") {
        for (const [k, v] of Object.entries(approved.inputs)) consider(k, v);
    }
    for (const [k, v] of Object.entries(approved)) {
        if (k === "fields" || k === "inputs" || k === "requirement") continue; // meta
        consider(k, v);
    }
    if (candidates.size === 1) return [...candidates][0];
    // Rule 5 — legacy confirmed keyed theo target (keyfix).
    if (hasDataAt(conf, t)) return t;
    return t;
}

/** Render MỘT step — stateless: step → { line?, runtimeEnv?, diagnostics? }.
 *  P0-A — testDataMap: map target → value (từ approved/confirmed testcase data).
 *  Khi có mapping evidence → `fill(testData["<target>"])` (dễ sửa về sau);
 *  KHÔNG có (recorded/fallback) → inline như cũ. KHÔNG invent mapping. */
export function renderStep(step, { purposeMap = {}, confirmedTestData = {}, approvedTestData = {}, testDataMap = null, testDataBindings = null } = {}) {
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
            // P0 RUNTIME FIX — canonical resolution: binding > unique business field (có data)
            // > target (legacy keyfix) > recorded fallback. Recorded KHÔNG được thắng business data.
            const rawBinding = testDataBindings && String(testDataBindings[target] ?? "").trim();
            const hasBinding = Boolean(rawBinding);
            const businessField = hasBinding
                ? rawBinding
                : resolveBusinessFieldForFill(target, { testDataBindings, confirmedTestData, approvedTestData });
            const resolved = resolveTestValue({
                purpose: purposeMap[businessField],
                savedDrawerValue: confirmedTestData?.[businessField],
                approvedJsonValue: pickApprovedValue(approvedTestData, businessField),
                // P0 — CÓ binding => KHÔNG fallback recorded (business value thiếu -> báo lỗi rõ);
                // không binding => recorded là fallback theo contract.
                recordedCodeGenValue: hasBinding ? undefined : step?.recordedValue,
                envValue: undefined
            });
            if (resolved.source === TESTDATA_SOURCES.MISSING || resolved.value == null) {
                diagnostics.push({ code: "TESTDATA_BINDING_REQUIRED", field: businessField });
                return { line: null, runtimeEnv, diagnostics };
            }
            if (String(purposeMap[businessField] ?? "").toUpperCase() === "EMPTY") {
                return { line: null, runtimeEnv, diagnostics }; // EMPTY -> không điền
            }
            const envKey = envKeyFor(businessField);
            if (envKey) {
                runtimeEnv[envKey] = { value: resolved.value, source: resolved.source };
                return { line: `  await ${loc}.fill(process.env.${envKey} ?? "");`, runtimeEnv, diagnostics };
            }
            // P0-A — testcase-confirmed data (approved/confirmed) đi qua testData object (key = businessField).
            if (testDataMap && Object.prototype.hasOwnProperty.call(testDataMap, businessField)) {
                return { line: `  await ${loc}.fill(testData[${JSON.stringify(businessField)}]);`, runtimeEnv, diagnostics };
            }
            return { line: `  await ${loc}.fill(${JSON.stringify(resolved.value)});`, runtimeEnv, diagnostics };
        }
        case "CLICK": return { line: `  await ${loc}.click();`, runtimeEnv, diagnostics };
        case "CHECK": return { line: `  await ${loc}.check();`, runtimeEnv, diagnostics };
        case "UNCHECK": return { line: `  await ${loc}.uncheck();`, runtimeEnv, diagnostics };
        case "SELECT": return { line: `  await ${loc}.selectOption(${JSON.stringify(String(step?.recordedValue ?? ""))});`, runtimeEnv, diagnostics };
        case "PRESS": {
            // P0-C — guard dữ liệu cũ: block persist trước fix có thể chứa "REDACTED"
            // (redact sai cho PRESS) → fallback "Enter" (an toàn, không crash Unknown key).
            const key = String(step?.recordedValue ?? "Enter");
            const safe = key === "REDACTED" ? "Enter" : key;
            return { line: `  await ${loc}.press(${JSON.stringify(safe)});`, runtimeEnv, diagnostics };
        }
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
    testDataBindings = {},
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

    // P0-A — xây testDataMap: field có value từ APPROVED_JSON/USER_CONFIRMED (testcase data)
    // → đưa vào const testData; recorded chỉ là fallback (inline, không vào map).
    const testDataMap = {};
    const collectTestData = rec => {
        for (const step of rec?.steps ?? []) {
            if (String(step?.actionType ?? "").toUpperCase() !== "FILL") continue;
            const target = String(step?.target ?? "").trim();
            if (!target) continue;
            // P0 RUNTIME FIX — canonical resolution (cùng rule với renderStep):
            // binding > unique business field (có data) > target (legacy keyfix).
            const businessField = resolveBusinessFieldForFill(target, { testDataBindings, confirmedTestData, approvedTestData });
            if (Object.prototype.hasOwnProperty.call(testDataMap, businessField)) continue;
            if (isSensitiveField(businessField)) continue;
            const resolved = resolveTestValue({
                purpose: purposeMap[businessField],
                savedDrawerValue: confirmedTestData?.[businessField],
                approvedJsonValue: pickApprovedValue(approvedTestData, businessField),
                recordedCodeGenValue: step?.recordedValue,
                envValue: undefined
            });
            if (resolved.source === TESTDATA_SOURCES.APPROVED_JSON || resolved.source === TESTDATA_SOURCES.USER_CONFIRMED) {
                testDataMap[businessField] = resolved.value;
            }
        }
    };
    if (setupRecording) collectTestData(setupRecording);
    collectTestData(testcaseRecording);

    const renderRecording = rec => {
        const lines = [];
        for (const step of rec?.steps ?? []) {
            const r = renderStep(step, { purposeMap, confirmedTestData, approvedTestData, testDataMap, testDataBindings });
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
        `import { test, expect } from '@playwright/test';`
    ];
    // P0-A — khai báo const testData (chỉ khi có field từ testcase; KHÔNG invent).
    const testDataEntries = Object.entries(testDataMap);
    if (testDataEntries.length > 0) {
        specLines.push(`const testData = {`);
        for (const [k, v] of testDataEntries) specLines.push(`  ${JSON.stringify(k)}: ${JSON.stringify(v)},`);
        specLines.push(`};`);
        specLines.push(``);
    }
    specLines.push(`test(${JSON.stringify(title)}, async ({ page }) => {`);
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
