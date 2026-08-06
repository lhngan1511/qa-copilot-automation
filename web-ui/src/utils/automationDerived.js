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

/** Sẵn sàng chạy khi đủ dữ liệu (fields đủ / executionReadiness READY / không rõ). */
export function isReady(tc) {
    const fields = tc?.testData?.fields;
    if (fields && typeof fields === "object" && !Array.isArray(fields)) {
        const entries = Object.entries(fields);
        if (entries.length > 0) {
            return entries.every(([, f]) => {
                if (!f || typeof f !== "object") return true;
                if (f.requiresTesterInput === true) return false;
                if (String(f.purpose ?? "").toUpperCase() === "EMPTY") return true;
                return String(f.value ?? "").trim() !== "";
            });
        }
    }
    const r = String(tc?.executionReadiness ?? "").toUpperCase();
    if (!r) return true;
    return r === "READY";
}

/** Trích dữ liệu đầu vào testcase thành mảng {name, value, requiresTesterInput, purpose}. */
export function dataRows(testCase) {
    const td = testCase?.testData;
    if (!td || typeof td !== "object") return [];
    if (td.fields && typeof td.fields === "object" && !Array.isArray(td.fields)) {
        return Object.entries(td.fields).map(([name, field]) => ({
            name,
            value: field?.value ?? "",
            requiresTesterInput: field?.requiresTesterInput === true,
            instruction: field?.instruction ?? "",
            purpose: field?.purpose ?? "VALID"
        }));
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

/** Trạng thái 1 field dữ liệu: trống theo kịch bản (EMPTY) ≠ thiếu dữ liệu. */
export function dataRowState(row) {
    const value = String(row?.value ?? "").trim();
    const empty = String(row?.purpose ?? "").toUpperCase() === "EMPTY";
    const missing = !empty && (!value || row?.requiresTesterInput === true);
    return {
        empty,
        missing,
        value: String(row?.value ?? ""),
        note: empty
            ? "Để trống theo kịch bản kiểm thử — đây là dữ liệu hợp lệ."
            : missing && row?.requiresTesterInput
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
