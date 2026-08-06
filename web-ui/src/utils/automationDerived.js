/**
 * automationDerived — Các hàm suy diễn trạng thái/testcase cho màn hình
 * Automation Workspace (Giai đoạn 2). Thuần ESM, không phụ thuộc React/JSX
 * để node test có thể import trực tiếp, tránh logic bị "sao chép" lệch nhau.
 */

/** Chuẩn hóa confidence: <=1 -> *100; giữ nguyên nếu >1; clamp 0..100. */
export function normalizeConfidence(value) {
    if (value == null || value === "") return null;
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    let pct = n <= 1 ? n * 100 : n;
    pct = Math.min(100, Math.max(0, pct));
    return Math.round(pct);
}

/** Confidence trung bình của mapping (từ stepMappings). */
export function confidenceOf(mapping) {
    const steps = Array.isArray(mapping?.stepMappings) ? mapping.stepMappings : [];
    const values = steps.map(s => normalizeConfidence(s?.confidence)).filter(n => n != null);
    if (values.length === 0) return null;
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

/** Nguồn dữ liệu (khớp backend testDataBinding.js). */
export const TESTDATA_SOURCE = {
    EMPTY: "TESTCASE_EMPTY",
    USER_CONFIRMED: "USER_CONFIRMED",
    APPROVED_JSON: "APPROVED_JSON",
    CODEGEN_RECORDED: "CODEGEN_RECORDED",
    ENV_FALLBACK: "ENV_FALLBACK",
    MISSING: "MISSING"
};

/**
 * Resolve giá trị field theo thứ tự ưu tiên duy nhất (giống backend resolveTestValue):
 * EMPTY > USER_CONFIRMED > APPROVED_JSON > CODEGEN_RECORDED > ENV_FALLBACK > MISSING.
 * @returns {{value:string|null, source:string, present:boolean}}
 */
export function resolveFieldValue({ purpose, confirmed, approved, recorded, env }) {
    if (String(purpose ?? "").toUpperCase() === "EMPTY") {
        return { value: "", source: TESTDATA_SOURCE.EMPTY, present: true };
    }
    if (confirmed !== undefined && confirmed !== null && String(confirmed).trim() !== "") {
        return { value: String(confirmed), source: TESTDATA_SOURCE.USER_CONFIRMED, present: true };
    }
    if (approved !== undefined && approved !== null && String(approved).trim() !== "") {
        return { value: String(approved), source: TESTDATA_SOURCE.APPROVED_JSON, present: true };
    }
    if (recorded !== undefined && recorded !== null && String(recorded).trim() !== "") {
        return { value: String(recorded), source: TESTDATA_SOURCE.CODEGEN_RECORDED, present: true };
    }
    if (env !== undefined && env !== null && String(env).trim() !== "") {
        return { value: String(env), source: TESTDATA_SOURCE.ENV_FALLBACK, present: true };
    }
    return { value: null, source: TESTDATA_SOURCE.MISSING, present: false };
}

/** Resolve một field của testcase (dùng cấu trúc testData: fields/draft/confirmed). */
export function fieldResolution(testCase, fieldName) {
    const td = testCase?.testData || {};
    const fields = td.fields || {};
    const field = fields[fieldName] || {};
    const purpose = String(field?.purpose ?? "").toUpperCase() || "VALID";
    const confirmed = td.confirmed?.[fieldName];
    const approved = field?.value ?? td.inputs?.[fieldName];
    const recorded = td.recordedValues?.[fieldName];
    const env = td.envFallback?.[fieldName];
    return resolveFieldValue({ purpose, confirmed, approved, recorded, env });
}

/** Danh sách field chưa có đủ dữ liệu (không tính EMPTY). */
export function missingFields(testCase) {
    const td = testCase?.testData;
    const fields = td?.fields;
    if (!fields || typeof fields !== "object" || Array.isArray(fields)) {
        return [];
    }
    const missing = [];
    for (const name of Object.keys(fields)) {
        if (String(fields[name]?.purpose ?? "").toUpperCase() === "EMPTY") continue;
        const r = fieldResolution(testCase, name);
        if (!r.present) missing.push(name);
    }
    return missing;
}

/** Dựng chuỗi log resolution cho Generate (không log giá trị). */
export function testdataResolutionLog(testCase) {
    const td = testCase?.testData;
    const fields = td?.fields;
    if (!fields || typeof fields !== "object" || Array.isArray(fields)) {
        return `[GENERATE_TESTDATA_RESOLUTION] testCaseId=${testCase?.id ?? "?"} noFields missingCount=0 isReady=true`;
    }
    const parts = [];
    let missingCount = 0;
    for (const name of Object.keys(fields)) {
        const r = fieldResolution(testCase, name);
        parts.push(`field=${name} source=${r.source} status=${r.present ? "RESOLVED" : "MISSING"}`);
        if (!r.present) missingCount += 1;
    }
    return `[GENERATE_TESTDATA_RESOLUTION] testCaseId=${testCase?.id ?? "?"} ${parts.join(" ")} missingCount=${missingCount} isReady=${missingCount === 0}`;
}

/** Sẵn sàng chạy khi đủ dữ liệu theo resolution (EMPTY/confirmed/approved/recorded/env) — không chỉ fields.value. */
export function isReady(tc) {
    const missing = missingFields(tc);
    if (missing.length > 0) return false;
    const r = String(tc?.executionReadiness ?? "").toUpperCase();
    if (!r) return true;
    return r === "READY";
}

/** Trích dữ liệu đầu vào testcase thành mảng {name, value, requiresTesterInput, purpose}. */
export function dataRows(testCase) {
    const td = testCase?.testData;
    if (!td || typeof td !== "object") return [];
    if (td.fields && typeof td.fields === "object" && !Array.isArray(td.fields)) {
        const draft = td.draft && typeof td.draft === "object" ? td.draft : {};
        const confirmed = td.confirmed && typeof td.confirmed === "object" ? td.confirmed : {};
        return Object.entries(td.fields).map(([name, field]) => {
            const res = fieldResolution({ testData: td }, name);
            // Display: draft (đang gõ) > confirmed (đã lưu) > approved.
            const displayValue = draft[name] !== undefined ? String(draft[name]) : confirmed[name] !== undefined ? String(confirmed[name]) : (field?.value ?? "");
            return {
                name,
                value: displayValue,
                resolvedValue: res.value,
                source: res.source,
                present: res.present,
                requiresTesterInput: field?.requiresTesterInput === true,
                instruction: field?.instruction ?? "",
                purpose: field?.purpose ?? "VALID"
            };
        });
    }
    if (Array.isArray(td)) {
        return td
            .filter(item => item && typeof item === "object" && String(item.name ?? "").trim())
            .map(item => ({
                name: String(item.name),
                value: String(item.value ?? ""),
                requiresTesterInput: item.requiresTesterInput === true,
                instruction: item.instruction ?? item.description ?? "",
                purpose: item.purpose ?? "VALID"
            }));
    }
    if (td.inputs && typeof td.inputs === "object") {
        return Object.entries(td.inputs).map(([name, value]) => ({
            name,
            value: String(value ?? ""),
            requiresTesterInput: false,
            instruction: "",
            purpose: "VALID"
        }));
    }
    return [];
}

/** Trạng thái 1 field dữ liệu: trống theo kịch bản (EMPTY) ≠ thiếu dữ liệu; dùng resolution source. */
export function dataRowState(row) {
    const empty = String(row?.purpose ?? "").toUpperCase() === "EMPTY";
    // present từ resolution (confirmed/approved/recorded/env); "0" hợp lệ; rỗng chỉ hợp lệ khi EMPTY.
    // Nếu row chưa có present (gọi trực tiếp), fallback theo value (không empty).
    const present = row?.present !== undefined
        ? (empty || row.present === true)
        : (empty || String(row?.value ?? "").trim() !== "");
    const missing = !empty && !present;
    const displayValue = row?.value != null ? String(row.value) : "";
    return {
        empty,
        missing,
        value: displayValue,
        source: row?.source ?? null,
        present,
        note: empty
            ? "Để trống theo kịch bản kiểm thử — đây là dữ liệu hợp lệ."
            : missing
                ? "Cần dữ liệu"
                : ""
    };
}

/** Có dữ liệu dùng được (cho badge JSON trên card). */
export function hasUsableData(testCase) {
    const rows = dataRows(testCase);
    if (rows.length > 0) return true;
    return Boolean(
        testCase?.testData?.value ||
        testCase?.testData?.requirement ||
        (Array.isArray(testCase?.steps) && testCase.steps.length > 0)
    );
}

/** Có mapping dùng locator từ Codegen (badge CODEGEN trên card). */
export function hasCodegenMapping(mapping) {
    if (!mapping || typeof mapping !== "object") return false;
    const steps = Array.isArray(mapping.stepMappings) ? mapping.stepMappings : [];
    const chains = [
        ...(Array.isArray(mapping.authenticationSetup?.steps) ? mapping.authenticationSetup.steps : []),
        ...(Array.isArray(mapping.navigationChain?.steps) ? mapping.navigationChain.steps : [])
    ];
    const all = [...steps, ...chains];
    if (all.length === 0) return false;
    return all.every(s => String(s?.codegenSource ?? "").toUpperCase() === "PLAYWRIGHT_CODEGEN");
}

/** Trạng thái chạy hiển thị gọn trên card. */
export function runLabel(tc) {
    const status = String(tc?.execution?.status ?? tc?.status ?? "NOT_RUN").toUpperCase();
    if (status === "PASSED") return { label: "Đạt", tone: "pass", done: true };
    if (status === "FAILED") return { label: "Thất bại", tone: "fail", done: true };
    if (status === "RUNNING") return { label: "Đang chạy…", tone: "run", done: false };
    return { label: "Chưa chạy", tone: "idle", done: false };
}

/** Mapping status tổng hợp: Locator / Data / Expected / Assertion. */
export function mappingStatus(testCase) {
    const m = testCase?.mapping;
    const locatorOk = hasCodegenMapping(m);
    const dataOk = isReady(testCase);
    const assertionMappings = Array.isArray(m?.assertionMappings) ? m.assertionMappings : [];
    const assertionOk = assertionMappings.length > 0;
    const expectedOk = Boolean(
        testCase?.expectedResult ||
        testCase?.expectedResults?.length ||
        (Array.isArray(testCase?.assertions) && testCase.assertions.length > 0)
    );
    return {
        locator: locatorOk,
        data: dataOk,
        expected: expectedOk,
        assertion: assertionOk
    };
}

/** Ghép các step mapping (auth + nav + business) thành danh sách để hiển thị chi tiết. */
export function allMappingSteps(mapping) {
    if (!mapping || typeof mapping !== "object") return [];
    const toRow = (kind) => (s, i) => ({
        kind,
        stepOrder: s?.stepOrder ?? i + 1,
        businessStep: s?.businessStep ?? s?.target ?? "Bước",
        actionType: s?.actionType ?? (kind === "auth" || kind === "nav" ? "CLICK" : ""),
        locator: s?.locator ?? "",
        codegenSource: s?.codegenSource ?? "",
        confidence: normalizeConfidence(s?.confidence),
        status: s?.status ?? ""
    });
    const auth = (Array.isArray(mapping.authenticationSetup?.steps) ? mapping.authenticationSetup.steps : []).map(toRow("auth"));
    const nav = (Array.isArray(mapping.navigationChain?.steps) ? mapping.navigationChain.steps : []).map(toRow("nav"));
    const business = (Array.isArray(mapping.stepMappings) ? mapping.stepMappings : []).map(toRow("business"));
    return [...auth, ...nav, ...business];
}
