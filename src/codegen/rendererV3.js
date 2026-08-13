import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
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
    // P0 TC001 — UNRESOLVED: chưa xác định data source/intent cho input → chặn Generate
    // (KHÔNG âm thầm dùng recorded literal — recorded chỉ là RECORDED_SAMPLE/evidence).
    TESTDATA_UNRESOLVED: "TESTDATA_UNRESOLVED",
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
 *   4. [CHỈ single-input] ĐÚNG 1 business field (non-setup, KHÁC target) có data
 *      → business field đó. P0 TC001: heuristic KHÔNG áp dụng cho multi-input
 *      (không được map nhiều unresolved input vào 1 field — VD Mã→Kg, Ghi chú→Kg).
 *   5. Confirmed có data theo chính target (legacy keyfix — không có business field khác)
 *      → target.
 *   6. Còn lại → target (sẽ thành UNRESOLVED → chặn Generate, KHÔNG fallback recorded).
 * @param {boolean} singleInput — testcase chỉ có ĐÚNG 1 non-setup FILL target.
 */
export function resolveBusinessFieldForFill(target, { testDataBindings = {}, confirmedTestData = {}, approvedTestData = {} } = {}, singleInput = false) {
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
    // Rule 4 — unique business candidate (CHỈ single-input — P0 TC001 cấm multi-input).
    if (singleInput) {
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
    }
    // Rule 5 — legacy confirmed keyed theo target (keyfix).
    if (hasDataAt(conf, t)) return t;
    return t;
}

/** Đọc entry confirmed theo shape cũ (string) hoặc mới ({value, intent}). */
function confirmedEntry(entry) {
    if (entry && typeof entry === "object" && !Array.isArray(entry)) {
        return {
            value: entry.value === undefined || entry.value === null ? "" : String(entry.value),
            intent: String(entry.intent ?? "").toUpperCase() === "EMPTY" ? "EMPTY" : "VALUE"
        };
    }
    const v = entry === undefined || entry === null ? "" : String(entry);
    // P0 TC001 backward compat: string cũ non-empty = VALUE; "" cũ KHÔNG tự động EMPTY
    // (không explicit intent → UNRESOLVED / review required).
    return { value: v, intent: v.trim() !== "" ? "VALUE" : "" };
}

/**
 * P0 TC001 — canonical FILL status (model tối thiểu VALUE/EMPTY/UNRESOLVED + SETUP/RECORDED_SAMPLE).
 * Deterministic, không đoán:
 *   - SETUP       → input env-bound (LOGIN_*) — dùng env, không cần testcase data.
 *   - VALUE       → tester/business value đã xác nhận → fill.
 *   - EMPTY       → tester xác nhận để trống (confirmed intent EMPTY | approved purpose EMPTY)
 *                   → SKIP fill, TUYỆT ĐỐI không fallback recorded.
 *   - UNRESOLVED  → chưa xác định data source/intent → CHẶN Generate (không âm thầm dùng
 *                   recorded literal — recorded chỉ là RECORDED_SAMPLE/evidence).
 * @returns {{status:string, businessField:string, value:(string|null), source:(string|null), bound:boolean}}
 */
export function resolveFillStatus({ target, testDataBindings = {}, confirmedTestData = {}, approvedTestData = {}, purposeMap = {}, singleInput = false } = {}) {
    const t = String(target ?? "").trim();
    if (!t) return { status: "SKIP", businessField: "", value: null, source: null, bound: false };
    if (envKeyFor(t)) return { status: "SETUP", businessField: t, value: null, source: "SETUP_ENV", bound: false };
    const rawBinding = testDataBindings && String(testDataBindings[t] ?? "").trim();
    const businessField = rawBinding
        ? rawBinding
        : resolveBusinessFieldForFill(t, { testDataBindings, confirmedTestData, approvedTestData }, singleInput);
    const confEntry = confirmedEntry(confirmedTestData?.[businessField]);
    const purpose = String(purposeMap?.[businessField] ?? "").toUpperCase();
    // EMPTY — intent tester (confirmed) hoặc purpose approved.
    if (confEntry.intent === "EMPTY" || purpose === "EMPTY") {
        return { status: "EMPTY", businessField, value: null, source: "TESTCASE_EMPTY", bound: Boolean(rawBinding) };
    }
    // VALUE — confirmed (USER_CONFIRMED) > approved (APPROVED_JSON).
    if (confEntry.intent === "VALUE" && confEntry.value.trim() !== "") {
        return { status: "VALUE", businessField, value: confEntry.value, source: "USER_CONFIRMED", bound: Boolean(rawBinding) };
    }
    const apprVal = pickApprovedValue(approvedTestData, businessField);
    if (apprVal !== undefined && apprVal !== null && String(apprVal).trim() !== "") {
        return { status: "VALUE", businessField, value: String(apprVal), source: "APPROVED_JSON", bound: Boolean(rawBinding) };
    }
    // UNRESOLVED — chưa xác định: "" cũ / null / missing KHÔNG fallback recorded.
    return { status: "UNRESOLVED", businessField, value: null, source: null, bound: Boolean(rawBinding) };
}

/** Render MỘT step — stateless: step → { line?, runtimeEnv?, diagnostics? }.
 *  P0-A — testDataMap: map target → value (từ approved/confirmed testcase data).
 *  Khi có mapping evidence → `fill(testData["<target>"])` (dễ sửa về sau);
 *  KHÔNG có (recorded/fallback) → inline như cũ. KHÔNG invent mapping. */
export function renderStep(step, { purposeMap = {}, confirmedTestData = {}, approvedTestData = {}, testDataMap = null, testDataBindings = null, fillStatus = null } = {}) {
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
            // P0 TC001 — canonical FILL status (VALUE/EMPTY/UNRESOLVED/SETUP).
            // fillStatus từ renderV3Spec pre-pass (có singleInput); standalone renderStep
            // tự resolve với singleInput=false (an toàn: không heuristic multi-input).
            const fs = fillStatus ?? resolveFillStatus({
                target,
                testDataBindings,
                confirmedTestData,
                approvedTestData,
                purposeMap,
                singleInput: false
            });
            if (fs.status === "SKIP" || fs.status === "EMPTY") {
                return { line: null, runtimeEnv, diagnostics }; // EMPTY — xác nhận để trống, KHÔNG fallback recorded
            }
            if (fs.status === "SETUP") {
                const envKey = envKeyFor(fs.businessField);
                runtimeEnv[envKey] = { value: null, source: "SETUP_ENV" };
                return { line: `  await ${loc}.fill(process.env.${envKey} ?? "");`, runtimeEnv, diagnostics };
            }
            if (fs.status !== "VALUE") {
                diagnostics.push({ code: "TESTDATA_UNRESOLVED", field: fs.businessField });
                return { line: null, runtimeEnv, diagnostics };
            }
            // P0-A — testcase-confirmed data (approved/confirmed) đi qua testData object (key = businessField).
            if (testDataMap && Object.prototype.hasOwnProperty.call(testDataMap, fs.businessField)) {
                return { line: `  await ${loc}.fill(testData[${JSON.stringify(fs.businessField)}]);`, runtimeEnv, diagnostics };
            }
            return { line: `  await ${loc}.fill(${JSON.stringify(fs.value)});`, runtimeEnv, diagnostics };
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

    // P0 TC001 — canonical FILL semantics (VALUE/EMPTY/UNRESOLVED/SETUP).
    // Pre-pass: resolve status cho TỪNG FILL target (một nguồn sự thật cho cả collectTestData,
    // renderStep và chặn Generate). Recorded literal = RECORDED_SAMPLE — KHÔNG bao giờ là
    // runtime value nếu chưa được tester xác nhận (VALUE) hoặc để trống (EMPTY).
    const allSteps = [...(setupRecording?.steps ?? []), ...(testcaseRecording?.steps ?? [])];
    const fillTargets = new Set(
        allSteps
            .filter(s => String(s?.actionType ?? "").toUpperCase() === "FILL")
            .map(s => String(s?.target ?? "").trim())
            .filter(t => t && !envKeyFor(t)) // bỏ setup env-bound
    );
    const singleInput = fillTargets.size === 1;
    const fillStatuses = new Map();
    const unresolved = [];
    for (const step of allSteps) {
        if (String(step?.actionType ?? "").toUpperCase() !== "FILL") continue;
        const target = String(step?.target ?? "").trim();
        if (!target || fillStatuses.has(target)) continue;
        const fs = resolveFillStatus({ target, testDataBindings, confirmedTestData, approvedTestData, purposeMap, singleInput });
        fillStatuses.set(target, fs);
        if (fs.status === "UNRESOLVED") unresolved.push({ field: fs.businessField, bound: fs.bound });
    }
    if (unresolved.length > 0) {
        // UNRESOLVED (chưa xác định data source/intent) → CHẶN Generate, yêu cầu review.
        // Bound + thiếu data giữ code TESTDATA_BINDING_REQUIRED (compat contract cũ).
        // P0 422-LIFECYCLE — response structured: unresolvedFields [{field, mapped}] để UI/API
        // biết CHÍNH XÁC field nào gây block (không bắt tester đoán).
        validation.spec.bindingValid = false;
        const hasBound = unresolved.some(u => u.bound);
        const uniqueFields = [...new Set(unresolved.map(u => u.field))];
        const unresolvedFields = uniqueFields.map(f => {
            const u = unresolved.find(x => x.field === f);
            return { field: f, mapped: Boolean(u?.bound) };
        });
        const fields = uniqueFields.map(f => {
            const u = unresolved.find(x => x.field === f);
            // Input chưa map business field (technical target) — nói rõ, không để tester đoán.
            return u && !u.bound ? `${JSON.stringify(f)} (input chưa map business field)` : JSON.stringify(f);
        }).join(", ");
        return {
            ok: false,
            errorCode: hasBound ? RENDERER_ERRORS.TESTDATA_BINDING_REQUIRED : RENDERER_ERRORS.TESTDATA_UNRESOLVED,
            validation,
            metadata,
            runtimeEnv,
            unresolvedFields,
            reason: hasBound
                ? `Thiếu dữ liệu: ${fields}. Xác nhận giá trị hoặc chọn 'Để trống' trong Test Data.`
                : `Chưa xác định dữ liệu cho: ${fields}. Xác nhận giá trị hoặc chọn 'Để trống' trong Test Data trước khi Sinh.`
        };
    }
    validation.spec.bindingValid = true;

    // P0-A — xây testDataMap: CHỈ VALUE (APPROVED_JSON/USER_CONFIRMED) đi vào const testData.
    const testDataMap = {};
    const collectTestData = rec => {
        for (const step of rec?.steps ?? []) {
            if (String(step?.actionType ?? "").toUpperCase() !== "FILL") continue;
            const target = String(step?.target ?? "").trim();
            const fs = target ? fillStatuses.get(target) : null;
            if (!fs || fs.status !== "VALUE") continue;
            if (Object.prototype.hasOwnProperty.call(testDataMap, fs.businessField)) continue;
            if (isSensitiveField(fs.businessField)) continue;
            testDataMap[fs.businessField] = fs.value;
        }
    };
    if (setupRecording) collectTestData(setupRecording);
    collectTestData(testcaseRecording);

    const renderRecording = rec => {
        const lines = [];
        for (const step of rec?.steps ?? []) {
            const r = renderStep(step, {
                purposeMap,
                confirmedTestData,
                approvedTestData,
                testDataMap,
                testDataBindings,
                fillStatus: String(step?.actionType ?? "").toUpperCase() === "FILL"
                    ? fillStatuses.get(String(step?.target ?? "").trim()) ?? null
                    : null
            });
            if (r.line) lines.push(r.line);
            for (const [k, v] of Object.entries(r.runtimeEnv || {})) runtimeEnv[k] = v;
        }
        return lines;
    };

    const lines = [];
    if (setupRecording) lines.push(...renderRecording(setupRecording));
    lines.push(...renderRecording(testcaseRecording));

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
