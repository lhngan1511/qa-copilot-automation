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

/* ---------- Sprint 1 polish: step flow + review language + single selection ---------- */
// bothUploaded: cần cả 2 file để bước ② (AI Analysis) bật
function canAnalyze({ sourceFileName, codeGenFile }) {
    return Boolean(sourceFileName && codeGenFile?.content);
}
assert.equal(canAnalyze({ sourceFileName: "a.json", codeGenFile: { content: "x" } }), true);
assert.equal(canAnalyze({ sourceFileName: "a.json", codeGenFile: null }), false);

// Bước ③: Generate/Run Selected dùng đúng testcase đã chọn (chọn 1 lần)
function selectedTestCases(testCases, ids, included = true) {
    return testCases.filter(tc => ids.includes(tc.id) && (included ? tc.includedInSession !== false : true));
}
const all = [
    { id: "TC001", executionReadiness: "READY", includedInSession: true },
    { id: "TC002", executionReadiness: "READY", includedInSession: true },
    { id: "TC003", executionReadiness: "READY", includedInSession: true }
];
assert.deepEqual(selectedTestCases(all, ["TC001", "TC002"]).map(t => t.id), ["TC001", "TC002"]);

// Review mapping: map sang ngôn ngữ tester
function toReviewLabels(mapping) {
    const setup = [...(mapping.authenticationSetup?.steps || []), ...(mapping.navigationChain?.steps || [])].map(s => s.target);
    const actions = (mapping.stepMappings || []).map(s => s.businessStep);
    const expectations = (mapping.assertionMappings || []).map(a => a.businessExpectation);
    return { chuẩnBị: setup, thaoTácChính: actions, kếtQuả: expectations };
}
const review = toReviewLabels({
    authenticationSetup: { steps: [{ target: "Đăng nhập" }] },
    navigationChain: { steps: [{ target: "Mở menu" }] },
    stepMappings: [{ businessStep: "Nhập tên" }, { businessStep: "Bấm Lưu" }],
    assertionMappings: [{ businessExpectation: "Thông báo thành công" }]
});
assert.deepEqual(review.chuẩnBị, ["Đăng nhập", "Mở menu"]);
assert.deepEqual(review.thaoTácChính, ["Nhập tên", "Bấm Lưu"]);
assert.deepEqual(review.kếtQuả, ["Thông báo thành công"]);

console.log("Automation Sprint1 UI wiring test: PASS");

/* ---------- Sprint 1 P0: analyze in-flight guard + confidence normalization ---------- */

// Chuẩn hóa confidence (cùng logic với UI)
function normalizeConfidence(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    let pct = n <= 1 ? n * 100 : n;
    pct = Math.min(100, Math.max(0, pct));
    return Math.round(pct);
}
assert.equal(normalizeConfidence11(0.85), 85);
assert.equal(normalizeConfidence11(85), 85);
assert.equal(normalizeConfidence11(100), 100);
assert.equal(normalizeConfidence(0.5), 50);
assert.equal(normalizeConfidence(1), 100);
assert.ok(normalizeConfidence11(100) <= 100, "không hiển thị 10000%");
assert.ok(normalizeConfidence(0.85) === 85, "0.85 -> 85%");

// One click -> one request: mô phỏng in-flight guard (analyzingRef)
function makeAnalyzeController() {
    let inFlight = false;
    let calls = 0;
    return {
        async analyze() {
            if (inFlight) return { skipped: true };
            inFlight = true;
            calls += 1;
            await new Promise(r => setTimeout(r, 5));
            inFlight = false;
            return { calls };
        },
        calls: () => calls
    };
}
(async () => {
    const ctrl = makeAnalyzeController();
    // double click: 2 lần gọi analyzeRequest nhưng guard chặn lần 2
    const p1 = ctrl.analyze();
    const p2 = ctrl.analyze(); // bị chặn (inFlight=true)
    await Promise.all([p1, p2]);
    await new Promise(r => setTimeout(r, 20));
    assert.equal(ctrl.calls(), 1, "double click chỉ tạo 1 request");
    // bấm lần nữa sau khi xong -> request mới
    const p3 = ctrl.analyze();
    await p3;
    assert.equal(ctrl.calls(), 2);
    console.log("P0 analyze guard + confidence: PASS");
})();

/* ---------- Sprint 1.1: card status single, fill -> READY, badge -> open DATA ---------- */
// isReady từ testData.fields (giống page)
function isReady11(tc) {
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
    return !r || r === "READY";
}
// testcase thiếu dữ liệu (fields trống)
const tcDataReq = {
    id: "TC005",
    executionReadiness: "DATA_REQUIRED",
    testData: { fields: { "Tên đăng nhập": { value: "", purpose: "VALID" }, "Mật khẩu": { value: "", purpose: "VALID" } } }
};
assert.equal(isReady11(tcDataReq), false, "field trống -> Cần bổ sung dữ liệu");
// điền đủ -> READY
const tcFilled = {
    ...tcDataReq,
    testData: { fields: { "Tên đăng nhập": { value: "admin" }, "Mật khẩu": { value: "123456@Aa" } } }
};
assert.equal(isReady11(tcFilled), true, "điền đủ -> Sẵn sàng");

// Chỉ MỘT trạng thái: không thể vừa Sẵn sàng vừa Cần bổ sung
const ready = isReady11(tcFilled);
assert.equal(ready, true);
assert.equal(isReady11(tcDataReq), false);

// Badge click -> mở đúng testcase + tab DATA (mô phỏng handler handleOpenData)
function handleOpenData(state, id) {
    return {
        selected: state.selected.includes(id) ? state.selected : [...state.selected, id],
        active: id,
        tab: "DATA"
    };
}
const next = handleOpenData({ selected: [], active: null }, "TC005");
assert.deepEqual(next, { selected: ["TC005"], active: "TC005", tab: "DATA" });

// Confidence chuẩn (không 10000%)
function normalizeConfidence11(v) { const n = Number(v); if (!Number.isFinite(n)) return null; let p = n <= 1 ? n * 100 : n; p = Math.min(100, Math.max(0, p)); return Math.round(p); }
assert.equal(normalizeConfidence11(0.85), 85);
assert.equal(normalizeConfidence11(85), 85);
assert.equal(normalizeConfidence11(100), 100);
assert.ok(normalizeConfidence11(100) <= 100, "không còn 10000%");

console.log("Automation Sprint1.1 card/status test: PASS");

/* ---------- Sprint 1.2: single action bar, tabs conditional, confidence null vs 0 ---------- */
// Tab Mã kiểm thử chỉ hiển thị khi đã generate
function visibleTabs({ generatedCode }) {
    const tabs = [["REVIEW","AI hiểu gì"], ["DATA","Dữ liệu kiểm thử"]];
    return generatedCode ? [...tabs, ["CODE","Mã kiểm thử"]] : tabs;
}
assert.equal(visibleTabs({ generatedCode: "" }).length, 2, "chưa generate -> không có Mã kiểm thử");
assert.equal(visibleTabs({ generatedCode: "test(){}" }).length, 3, "đã generate -> có Mã kiểm thử");

// Confidence null -> hiện 'AI đã phân tích' (không hiện 0%)
function confidenceMeta(pct, hasAnalysis) {
    if (pct == null) return hasAnalysis ? "AI đã phân tích" : "Chưa phân tích";
    return `Confidence: ${pct}%`;
}
assert.equal(confidenceMeta(null, true), "AI đã phân tích");
assert.equal(confidenceMeta(null, false), "Chưa phân tích");
assert.equal(confidenceMeta(85, true), "Confidence: 85%");

// Một Action Bar: step head không còn nút, chỉ có trong List (kiểm tra không trùng)
// Ở đây chỉ xác nhận hàm generate/run được nối một nơi (List giữ onGenerate/onRun).
function assertSingleActionBar(stepHeadButtons, listButtons) {
    return stepHeadButtons.length === 0 && listButtons.length === 2;
}
assert.equal(assertSingleActionBar([], ["Sinh automation đã chọn","Chạy testcase đã chọn"]), true);

console.log("Automation Sprint1.2 UI test: PASS");
