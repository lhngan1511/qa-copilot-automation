import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/*
 P0 UI STATE — derived readiness + automation lifecycle label (trace & fix).

 Lỗi browser thật:
  1) Test Data đã đủ (VALUE + EMPTY + technical resolved) nhưng tab Chạy thử vẫn
     "⚠ Cần review trước khi sinh" — actionPrepStatus không biết stepDecisions
     (EXCLUDE step / technical mapped) → tính nhầm UNRESOLVED.
  2) Playwright đã sinh + Run Passed nhưng tab Thông tin vẫn "Automation: Đang
     thiết lập" — label chỉ dựa segCount, không xét generateStatus/runStatus.

 Fix:
  - actionPrepStatus nhận {steps (có order), segmentId, stepDecisions} → SKIP step
    EXCLUDE; technical mapped + resolved → READY.
  - automationDisplayStatus(testCase) canonical (helper CHUNG card + drawer):
    UNDECIDED+chưa action → "Chưa thiết lập"; AUTOMATED+chưa generated →
    "Đang thiết lập"; generated+NOT_RUN → "Đã sinh automation"; generated+PASSED
    → "Automation sẵn sàng"; generated+FAILED → "Có automation · Chạy thử thất bại".

 Regression R1-R9.
*/

const testDir = path.dirname(fileURLToPath(import.meta.url));

const { actionPrepStatus, runTestcaseDataRows } = await import("../web-ui/src/utils/testDataView.js");
const { automationDisplayStatus, drawerResultForTestCase, drawerDraftForTestCase, displayedRunResultForTestCase, isPendingRunResult, pendingRunMessage } = await import("../web-ui/src/utils/automationV3.js");

const approvedFields = {
    "Mã đơn vị tính": { value: "" },
    "Tên đơn vị tính": { value: "Kg" },
    "Ghi chú": { value: "" }
};
const confirmedFull = {
    "Mã đơn vị tính": { value: "", intent: "EMPTY" },
    "Tên đơn vị tính": { value: "Kg", intent: "VALUE" },
    "Ghi chú": { value: "", intent: "EMPTY" }
};
// Segment TC001: steps FILL TextInput(6)/Mã(7)/Tên(8)/Ghi chú(9) — như DTO segment.steps.
const segSteps = [
    { order: 6, actionType: "FILL", target: "TextInput", recordedValue: "BBC", locator: "getByRole('textbox', { name: 'TextInput' })." },
    { order: 7, actionType: "FILL", target: "Mã đơn vị tính", recordedValue: "BBC", locator: "getByLabel('Mã đơn vị tính')." },
    { order: 8, actionType: "FILL", target: "Tên đơn vị tính", recordedValue: "Tên mẫu", locator: "getByLabel('Tên đơn vị tính')." },
    { order: 9, actionType: "FILL", target: "Ghi chú", recordedValue: "ghi chú", locator: "getByLabel('Ghi chú')." }
];
const SEG_ID = "LIB-1";
const prepBase = { inputs: [], steps: segSteps, segmentId: SEG_ID, bindings: {}, confirmedTestData: confirmedFull, approvedFields, singleInput: false };

// ===== R1 — VALUE + EMPTY đủ (technical đã xử lý) → READY (không review warning) =====
// Tester đã review xong: TextInput EXCLUDE (hoặc mapped+resolved), Mã EMPTY, Tên VALUE, Ghi chú EMPTY.
const r1 = actionPrepStatus({ ...prepBase, stepDecisions: { [`${SEG_ID}:6`]: { status: "EXCLUDE" } } });
assert.deepEqual(r1, { status: "ok", text: "✓ Sẵn sàng" }, "R1: VALUE+EMPTY đủ + technical đã xử lý -> ✓ Sẵn sàng (không 'Cần review')");
assert.ok(!r1.text.includes("Cần review"), "R1: không còn review warning");

// ===== R2 — EXCLUDE step (TextInput chưa map) → READY =====
const r2 = actionPrepStatus({
    ...prepBase,
    stepDecisions: { [`${SEG_ID}:6`]: { status: "EXCLUDE" } }, // TextInput EXCLUDE, không binding
    bindings: {}
});
assert.deepEqual(r2, { status: "ok", text: "✓ Sẵn sàng" }, "R2: EXCLUDE step không làm prep pending");
// Nếu KHÔNG skip EXCLUDE (lỗi cũ): TextInput -> UNRESOLVED -> review
const r2old = actionPrepStatus({ ...prepBase, stepDecisions: null, steps: null, inputs: [{ field: "TextInput", recordedValue: "BBC" }, { field: "Mã đơn vị tính", recordedValue: "BBC" }, { field: "Tên đơn vị tính", recordedValue: "Tên mẫu" }, { field: "Ghi chú", recordedValue: "ghi chú" }] });
assert.ok(r2old.text.includes("Cần review"), "R2: KHÔNG skip EXCLUDE (fallback inputs) vẫn review — chứng minh fix cần steps+decisions");

// ===== R3 — mapped technical + resolved value → READY =====
const r3 = actionPrepStatus({
    ...prepBase,
    stepDecisions: {},
    bindings: { "TextInput": "Mã đơn vị tính" },
    confirmedTestData: { "Mã đơn vị tính": { value: "M1", intent: "VALUE" }, "Tên đơn vị tính": { value: "Kg", intent: "VALUE" }, "Ghi chú": { value: "", intent: "EMPTY" } }
});
assert.deepEqual(r3, { status: "ok", text: "✓ Sẵn sàng" }, "R3: mapped technical + resolved -> READY");

// ===== R4-R6 — automationDisplayStatus canonical =====
const tc = (over = {}) => ({ generateStatus: "NOT_GENERATED", runStatus: "NOT_RUN", automationDecision: "UNDECIDED", selectedForAutomation: false, segmentSummary: { total: 0, confirmed: 0 }, assertionStatus: { confirmed: 0 }, segments: [], ...over });
assert.equal(automationDisplayStatus(tc()), "Chưa quyết định", "R4: chưa có binding -> Chưa quyết định");
assert.equal(automationDisplayStatus(tc({ automationDecision: "AUTOMATED", segmentSummary: { total: 2 } })), "Đang thiết lập", "R4: AUTOMATED + chưa generated -> Đang thiết lập");
assert.equal(automationDisplayStatus(tc({ selectedForAutomation: true, segmentSummary: { total: 2, confirmed: 2 }, assertionStatus: { confirmed: 1 }, segments: [{ role: "PRECONDITION", status: "CONFIRMED" }, { role: "ACTION_UNDER_TEST", status: "CONFIRMED" }] })), "Automation sẵn sàng", "R4: binding canonical đủ -> Automation sẵn sàng");
assert.equal(automationDisplayStatus(tc({ generateStatus: "GENERATED", runStatus: "NOT_RUN" })), "Đã sinh Playwright", "R4: generated + NOT_RUN -> Đã sinh Playwright");
assert.equal(automationDisplayStatus(tc({ generateStatus: "GENERATED", runStatus: "PASSED" })), "Passed", "R5: generated + PASSED -> Passed");
assert.equal(automationDisplayStatus(tc({ generateStatus: "GENERATED", runStatus: "FAILED" })), "Failed", "R6: generated + FAILED -> Failed");
assert.ok(!automationDisplayStatus(tc({ generateStatus: "GENERATED", runStatus: "PASSED" })).includes("Đang thiết lập"), "R5: không 'Đang thiết lập' khi đã PASSED");

// ===== R7 — card và drawer cùng helper (static) =====
const drawerSource = fs.readFileSync(path.join(testDir, "..", "web-ui", "src", "components", "automationV3", "V3ReviewDrawer.jsx"), "utf8");
const cardSource = fs.readFileSync(path.join(testDir, "..", "web-ui", "src", "components", "automationV3", "V3TestCaseCard.jsx"), "utf8");
const utilsSource = fs.readFileSync(path.join(testDir, "..", "web-ui", "src", "utils", "automationV3.js"), "utf8");
assert.ok(drawerSource.includes("automationDisplayStatus"), "R7: drawer dùng automationDisplayStatus");
assert.ok(cardSource.includes("automationDisplayStatus"), "R7: card dùng automationDisplayStatus (cùng contract)");
assert.ok(!drawerSource.includes("segCount > 0 ? \"Đang thiết lập\""), "R7: drawer KHÔNG còn label cũ theo segCount");
assert.ok(drawerSource.includes("bindingRole(seg) === \"PRECONDITION\"") && drawerSource.includes("bindingRoleLabel(s)"), "R7: run tab chỉ coi PRECONDITION là dữ liệu chuẩn bị và hiển thị role thực thi");
assert.ok(!cardSource.includes("type=\"checkbox\""), "R7: card không còn checkbox selection legacy");
assert.ok(drawerSource.includes("drawerResultForTestCase(generateResult, testCase?.testCaseId)") && drawerSource.includes("displayedRunResultForTestCase(testCase, runResult)"), "R7: response Generate/Run chỉ hợp lệ cho testcase hiện tại");
assert.ok(utilsSource.includes("testCase?.lastRun") && drawerSource.includes("displayedRunResultForTestCase"), "R7: lịch sử Run hiển thị từ canonical testcase, không từ drawer state cũ");
assert.ok(drawerSource.includes("tdContextId") && drawerSource.includes("drawerDraftForTestCase"), "R7: draft Test Data bị cô lập theo testcase context");

// ===== R8 — reopen giữ đúng state (helper pure: cùng dữ liệu → cùng label) =====
const sameState = tc({ generateStatus: "GENERATED", runStatus: "PASSED" });
assert.equal(automationDisplayStatus(sameState), automationDisplayStatus({ ...sameState }), "R8: reopen (cùng state) -> cùng label");

// ===== R9 — Generate/Run logic không đổi: run rows vẫn đúng (business-only) =====
const rows = runTestcaseDataRows({
    approvedBusinessValues: { "Mã đơn vị tính": "", "Tên đơn vị tính": "Kg", "Ghi chú": "" },
    approvedPurpose: {},
    confirmedTestData: confirmedFull,
    bindings: {},
    actionInputs: {},
    loginTestCase: false
});
assert.deepEqual(rows.map(r => r.state), ["EMPTY", "VALUE", "EMPTY"], "R9: run rows state đúng (EMPTY/VALUE/EMPTY)");

// ===== R10 — Drawer context isolation =====
const passedA = { testCaseId: "TC-A", ok: true, runStatus: "PASSED", passed: true, durationMs: 8700 };
const failedA = { testCaseId: "TC-A", ok: false, error: "failed" };
const generatedA = { testCaseId: "TC-A", ok: true, code: "test('A')", fileName: "TC-A.spec.js" };
const noAutomationB = tc({ testCaseId: "TC-B", confirmedTestData: {}, generateStatus: "NOT_GENERATED", runStatus: "NOT_RUN", lastRun: null });
const canonicalPassedA = tc({ testCaseId: "TC-A", generateStatus: "GENERATED", runStatus: "PASSED", lastRun: { status: "PASSED", passed: true, durationMs: 8700 } });
assert.equal(displayedRunResultForTestCase(noAutomationB, passedA), null, "R10 CASE 1: PASS A không rò sang B chưa automation");
assert.deepEqual(drawerDraftForTestCase({ "Dữ liệu A": { value: "A", intent: "VALUE" } }, "TC-A", "TC-B"), {}, "R10 CASE 2: Test Data draft A không rò sang B");
assert.equal(drawerResultForTestCase(null, "TC-B"), null, "R10 CASE 3: testcase chưa automation không có run artifact");
assert.equal(displayedRunResultForTestCase(noAutomationB, failedA), null, "R10 CASE 5: FAIL A không rò sang B");
assert.equal(drawerResultForTestCase(generatedA, "TC-B"), null, "R10 CASE 6: Generate response A không rò sang B chưa generate");
assert.deepEqual(displayedRunResultForTestCase(canonicalPassedA, null), { ok: true, runStatus: "PASSED", passed: true, error: null, durationMs: 8700, exitCode: null, stdout: null, stderr: null }, "R10 CASE 4: mở lại A dùng canonical PASS");

// ===== R11 — Remote QUEUED là pending, completion canonical mới là kết quả cuối =====
const queuedRemote = { testCaseId: "TC-A", ok: true, runStatus: "QUEUED", jobId: "JOB-1", agentId: "TESTER-PC-01" };
assert.equal(isPendingRunResult(queuedRemote), true, "R11: QUEUED không phải lỗi/final result");
assert.match(pendingRunMessage(queuedRemote), /Đang chờ TESTER-PC-01 thực thi/, "R11: QUEUED hiển thị trạng thái chờ runner");
assert.equal(isPendingRunResult({ runStatus: "RUNNING" }), true, "R11: RUNNING là trạng thái chuyển tiếp");
assert.equal(isPendingRunResult({ runStatus: "PASSED" }), false, "R11: PASSED là terminal");
assert.ok(drawerSource.includes("runPending ? \"ĐANG CHỜ\"") && drawerSource.includes("v3-run-result--pending"), "R11: drawer không render QUEUED thành lỗi");
assert.ok(drawerSource.includes("displayedRunResult.stderr") && drawerSource.includes("v3-run-result__output"), "R11: FAILED hiển thị diagnostic stdout/stderr canonical");
const pageSource = fs.readFileSync(path.join(testDir, "..", "web-ui", "src", "pages", "AutomationV3Page.jsx"), "utf8");
assert.ok(pageSource.includes("[\"QUEUED\", \"RUNNING\"].includes(status)") && pageSource.includes("window.setTimeout(poll, 1500)"), "R11: remote pending poll canonical workspace tới terminal");
assert.ok(pageSource.includes("slowMo: runnerSlowMo") && !pageSource.includes("Tốc độ chạy"), "R11: page chỉ giữ execution payload, không để cấu hình Run trên header Workspace");
assert.ok(drawerSource.includes("MÔI TRƯỜNG CHẠY") && drawerSource.includes("Địa chỉ hệ thống") && drawerSource.includes("Tốc độ chạy") && drawerSource.includes("Rất chậm") && drawerSource.includes("onRunnerSlowMoChange"), "R11: URL, Runner và tốc độ nằm trong tab Chạy thử");
assert.ok(pageSource.includes("BASE_URL: runBaseUrl.trim()") && pageSource.includes("RUN_BASE_URL_KEY"), "R11: địa chỉ tester nhập đi theo request Run, không phụ thuộc ngầm vào .env");
assert.ok(drawerSource.includes("useState(true)") && drawerSource.includes("v3-run-actions__toggle") && drawerSource.includes("aria-expanded={runActionsExpanded}"), "R11: thao tác chạy mặc định mở và có control thu gọn/mở rộng");
assert.ok(pageSource.includes("v3-workspace-controls") && pageSource.includes("Workspace context luôn ở hàng trên cùng"), "R11: chọn/tạo Workspace được nhóm ở hàng header trên cùng");
const canonicalRemotePassed = tc({ testCaseId: "TC-A", generateStatus: "GENERATED", runStatus: "PASSED", lastRun: { status: "PASSED", passed: true, durationMs: 1200, exitCode: 0 } });
const terminalRemote = displayedRunResultForTestCase(canonicalRemotePassed, null);
assert.equal(terminalRemote.runStatus, "PASSED", "R11: runner complete ghi canonical PASSED");
assert.equal(terminalRemote.passed, true, "R11: UI cuối cùng render PASS từ canonical lastRun");

console.log("Automation V3 UI State (readiness + lifecycle label) test: PASS");
