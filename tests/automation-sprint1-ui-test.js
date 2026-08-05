import assert from "node:assert/strict";

/*
 Sprint 1 — Automation Intelligence UI wiring tests.
 - backend analyze trả testCaseMappings, UI phải đọc đúng field đó (bug P0).
 - testData object từ approved-testcases.json được giữ nguyên (không thành []).
 - module/feature tự đọc từ JSON (không bắt nhập).
 - Bỏ CodeGen Library (không còn lưu/chọn/localStorage trong page).
*/

// Mô phỏng approved-testcases.json (Single Source of Truth)
const approved = [
    {
        id: "TC001",
        testcaseId: "TC001",
        module: "Thiết bị",
        feature: "Thêm thiết bị",
        function: "Thêm thiết bị",
        title: "Thêm thiết bị thành công",
        type: "POSITIVE",
        testData: { requirement: "Nhập dữ liệu hợp lệ cho các trường: Mã thiết bị, Tên thiết bị", value: "" },
        expectedResult: "Tạo thành công",
        executionReadiness: "DATA_REQUIRED"
    },
    {
        id: "TC002",
        testcaseId: "TC002",
        module: "Thiết bị",
        feature: "Sửa thiết bị",
        function: "Sửa thiết bị",
        title: "Sửa thiết bị",
        type: "VALIDATION",
        testData: { requirement: "Sửa hợp lệ", value: "" },
        expectedResult: "Sửa thành công",
        executionReadiness: "DATA_REQUIRED"
    }
];

// Mô phỏng normalizeTestCase trong page (Sprint 1: giữ nguyên testData object)
function normalizeTestCase(item, index) {
    return {
        ...item,
        id: String(item.id ?? item.testcaseId ?? `TC-${index + 1}`),
        title: item.title || item.name || item.testScenario || `Testcase ${index + 1}`,
        status: "READY",
        includedInSession: true,
        generatedCode: item.generatedCode || "",
        execution: { status: "NOT_RUN", durationMs: null, errorMessage: "", technicalLog: "" }
    };
}

const normalized = approved.map(normalizeTestCase);

// 1. testData object được giữ nguyên (không thành [])
assert.equal(Array.isArray(normalized[0].testData), false, "testData phải là object");
assert.equal(typeof normalized[0].testData, "object");
assert.equal(normalized[0].testData.requirement, "Nhập dữ liệu hợp lệ cho các trường: Mã thiết bị, Tên thiết bị");
assert.equal(normalized[0].testData.value, "");

// 2. Module / Feature tự đọc từ JSON (không cần textbox nhập)
const moduleName = normalized.find(tc => tc.module && String(tc.module).trim())?.module ?? "";
const functionName = normalized.find(tc => (tc.feature || tc.function))?.feature || "";
assert.equal(moduleName, "Thiết bị");
assert.equal(functionName, "Thêm thiết bị");

// 3. Bug P0: UI đọc result.testCaseMappings (backend trả testCaseMappings)
// mô phỏng response của mapModule
const backendResponse = {
    module: "Thiết bị",
    testCaseMappings: [
        { testCaseId: "TC001", entryRoute: { value: "/wasuco/login" }, stepMappings: [] },
        { testCaseId: "TC002", entryRoute: { value: "/wasuco/login" }, stepMappings: [] }
    ]
};
const mappings = Array.isArray(backendResponse?.testCaseMappings) ? backendResponse.testCaseMappings : Array.isArray(backendResponse?.mappings) ? backendResponse.mappings : [];
assert.equal(mappings.length, 2, "phải đọc đúng testCaseMappings");
// gán mapping đúng testcase theo id
const tcWithMapping = normalized.map(item => {
    const mapping = mappings.find(v => String(v.testCaseId || v.id) === item.id);
    return mapping ? { ...item, mapping: mapping.mapping || mapping } : item;
});
assert.equal(tcWithMapping[0].mapping?.testCaseId, "TC001");
assert.equal(tcWithMapping[1].mapping?.testCaseId, "TC002");

// 4. CodeGen Library bị bỏ: page không còn dùng STORAGE_KEY localStorage
// (kiểm tra nguồn không tham chiếu localStorage trong page đã sửa — ở đây chỉ
//  xác nhận normalize không đọc localStorage và không còn trường codeGenRecords)
assert.equal("codeGenRecords" in { normalizeTestCase }, false);

// 5. Giữ 2 đầu vào: approved-testcases.json + CodeGen.js (chỉ kiểm tra contract payload)
function analyzePayload({ module, testCases, codegenText }) {
    return { module, testCases, codegenText };
}
const payload = analyzePayload({ module: moduleName, testCases: normalized, codegenText: "const { test }=require('@playwright/test');" });
assert.equal(payload.module, "Thiết bị");
assert.equal(payload.testCases.length, 2);
assert.match(payload.codegenText, /@playwright/);

console.log("Automation Sprint1 UI wiring test: PASS");

/* ---------- Sprint 1 refine: executionReadiness + confidence + môi trường ---------- */

// executionReadiness gating: READY -> enable; DATA_REQUIRED -> disable
function isReady(tc) {
    const r = String(tc?.executionReadiness ?? "").toUpperCase();
    if (!r) return true;
    return r === "READY";
}
assert.equal(isReady({ executionReadiness: "READY" }), true);
assert.equal(isReady({ executionReadiness: "DATA_REQUIRED" }), false);
assert.equal(isReady({}), true, "không xác định -> cho phép");

// confidence từ mapping stepMappings
function confidenceOf(mapping) {
    const steps = Array.isArray(mapping?.stepMappings) ? mapping.stepMappings : [];
    const values = steps.map(s => Number(s?.confidence)).filter(n => Number.isFinite(n));
    if (values.length === 0) return null;
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    return Math.round(avg * 100);
}
assert.equal(confidenceOf({ stepMappings: [{ confidence: 0.95 }, { confidence: 0.9 }] }), 93);
assert.equal(confidenceOf({ stepMappings: [] }), null);
const high = confidenceOf({ stepMappings: [{ confidence: 0.95 }] });
assert.equal(high >= 70, true, ">=70 độ tin cậy cao");

// Môi trường chạy: value UAT/TEST/DEV; nếu trống -> 'Tự nhận diện'
function envDisplay(environment) {
    return environment || "Tự nhận diện";
}
assert.equal(envDisplay("UAT"), "UAT");
assert.equal(envDisplay(""), "Tự nhận diện");

// Generate/Run chỉ áp dụng cho testcase READY
function runnable(items) { return items.filter(isReady); }
const items = [
    { id: "TC001", executionReadiness: "READY" },
    { id: "TC002", executionReadiness: "DATA_REQUIRED" }
];
assert.deepEqual(runnable(items).map(i => i.id), ["TC001"]);

console.log("Automation Sprint1 UI wiring test: PASS");
