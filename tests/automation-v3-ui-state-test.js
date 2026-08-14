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
const { automationDisplayStatus } = await import("../web-ui/src/utils/automationV3.js");

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
const tc = (over = {}) => ({ generateStatus: "NOT_GENERATED", runStatus: "NOT_RUN", automationDecision: "UNDECIDED", segmentSummary: { total: 0 }, ...over });
assert.equal(automationDisplayStatus(tc()), "Chưa thiết lập", "R4: UNDECIDED + chưa action -> Chưa thiết lập");
assert.equal(automationDisplayStatus(tc({ automationDecision: "AUTOMATED", segmentSummary: { total: 2 } })), "Đang thiết lập", "R4: AUTOMATED + chưa generated -> Đang thiết lập");
assert.equal(automationDisplayStatus(tc({ generateStatus: "GENERATED", runStatus: "NOT_RUN" })), "Đã sinh automation", "R4: generated + NOT_RUN -> Đã sinh automation");
assert.equal(automationDisplayStatus(tc({ generateStatus: "GENERATED", runStatus: "PASSED" })), "Automation sẵn sàng", "R5: generated + PASSED -> Automation sẵn sàng");
assert.equal(automationDisplayStatus(tc({ generateStatus: "GENERATED", runStatus: "FAILED" })), "Có automation · Chạy thử thất bại", "R6: generated + FAILED -> không quay về 'Đang thiết lập'");
assert.ok(!automationDisplayStatus(tc({ generateStatus: "GENERATED", runStatus: "PASSED" })).includes("Đang thiết lập"), "R5: không 'Đang thiết lập' khi đã PASSED");

// ===== R7 — card và drawer cùng helper (static) =====
const drawerSource = fs.readFileSync(path.join(testDir, "..", "web-ui", "src", "components", "automationV3", "V3ReviewDrawer.jsx"), "utf8");
const cardSource = fs.readFileSync(path.join(testDir, "..", "web-ui", "src", "components", "automationV3", "V3TestCaseCard.jsx"), "utf8");
assert.ok(drawerSource.includes("automationDisplayStatus"), "R7: drawer dùng automationDisplayStatus");
assert.ok(cardSource.includes("automationDisplayStatus"), "R7: card dùng automationDisplayStatus (cùng contract)");
assert.ok(!drawerSource.includes("segCount > 0 ? \"Đang thiết lập\""), "R7: drawer KHÔNG còn label cũ theo segCount");

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

console.log("Automation V3 UI State (readiness + lifecycle label) test: PASS");
