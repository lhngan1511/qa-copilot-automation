import assert from "node:assert/strict";
import {
    isReady,
    missingFields,
    fieldResolution,
    dataRows,
    dataRowState,
    TESTDATA_SOURCE,
    testdataResolutionLog
} from "../web-ui/src/utils/automationDerived.js";

/* P0 — Save Data → Readiness → Generate/Run synchronization.
   JSON thiếu Mã xác nhận; nhập trong Drawer; bấm Lưu -> confirmed.captcha, READY, không mutate gốc. */

// Testcase gốc (từ approved-testcases.json) — thiếu Mã xác nhận.
const original = {
    id: "TC001",
    title: "Đăng nhập thành công",
    testData: {
        requirement: "Nhập tài khoản và mật khẩu hợp lệ",
        fields: {
            "Tài khoản": { value: "admin", purpose: "VALID" },
            "Mật khẩu": { value: "Admin@123", purpose: "VALID" },
            "Mã xác nhận": { value: "", purpose: "VALID" }
        }
    },
    executionReadiness: "DATA_REQUIRED"
};

// 1. Trước Save: thiếu Mã xác nhận -> DATA_REQUIRED.
assert.deepEqual(missingFields(original), ["Mã xác nhận"], "thiếu Mã xác nhận");
assert.equal(isReady(original), false);

// 2. Tester gõ vào draft (chưa lưu) -> vẫn không READY (chỉ confirmed mới thắng).
const typing = { ...original, testData: { ...original.testData, draft: { "Mã xác nhận": "999999" } } };
assert.equal(isReady(typing), false, "đang gõ chưa lưu -> chưa READY (draft không tính)");

// 3. Bấm Save: merge draft vào confirmed, giữ fields, clear draft, không mutate original.
const confirmed = { ...(original.testData.confirmed ?? {}), ...(typing.testData.draft ?? {}) };
const saved = {
    ...original,
    testData: { ...original.testData, confirmed, draft: {} },
    executionReadiness: "READY"
};
// original KHÔNG bị mutate (fields vẫn rỗng Mã xác nhận).
assert.equal(original.testData.fields["Mã xác nhận"].value, "", "không mutate original JSON");
assert.equal(original.testData.confirmed, undefined, "không thêm confirmed vào original");
assert.equal(saved.testData.confirmed["Mã xác nhận"], "999999", "confirmed.captcha tồn tại");
assert.equal(saved.testData.fields["Mã xác nhận"].value, "", "fields JSON giữ nguyên");
assert.deepEqual(saved.testData.draft, {}, "draft cleared");
assert.deepEqual(missingFields(saved), [], "missingCount=0");
assert.equal(isReady(saved), true, "isReady=true");
assert.equal(saved.executionReadiness, "READY");

// 4. fieldResolution: Mã xác nhận = USER_CONFIRMED (thắng JSON rỗng).
const cap = fieldResolution(saved, "Mã xác nhận");
assert.equal(cap.source, TESTDATA_SOURCE.USER_CONFIRMED);
assert.equal(cap.present, true);
// Tài khoản/Mật khẩu = APPROVED_JSON.
assert.equal(fieldResolution(saved, "Tài khoản").source, TESTDATA_SOURCE.APPROVED_JSON);

// 5. dataRows: display = confirmed (đã lưu) khi không còn draft.
const rows = dataRows(saved);
const capRow = rows.find(r => r.name === "Mã xác nhận");
assert.equal(capRow.value, "999999", "display confirmed");
assert.equal(capRow.present, true);
assert.equal(dataRowState(capRow).missing, false, "không còn 'Thiếu'");

// 6. "0" là hợp lệ (không dùng truthy đơn giản).
const zero = { ...saved, testData: { ...saved.testData, fields: { ...saved.testData.fields, "Số lượng": { value: "0", purpose: "VALID" } } } };
assert.equal(fieldResolution(zero, "Số lượng").present, true, "'0' hợp lệ");
assert.equal(isReady(zero), true);

// 7. purpose=EMPTY hợp lệ, rỗng vẫn READY.
const empty = { ...saved, testData: { ...saved.testData, fields: { ...saved.testData.fields, "Ghi chú": { value: "", purpose: "EMPTY" } } } };
assert.equal(fieldResolution(empty, "Ghi chú").present, true, "EMPTY hợp lệ");
assert.equal(fieldResolution(empty, "Ghi chú").source, TESTDATA_SOURCE.EMPTY);
assert.equal(isReady(empty), true);

// 8. testdataResolutionLog không log giá trị.
const log = testdataResolutionLog(saved);
assert.ok(log.includes("field=Mã xác nhận source=USER_CONFIRMED status=RESOLVED"));
assert.ok(log.includes("missingCount=0 isReady=true"));
assert.ok(!log.includes("999999"), "không log giá trị");

// 9. Đóng/mở Drawer vẫn giữ confirmed (state mới chứa confirmed).
const reopen = { ...saved };
assert.equal(reopen.testData.confirmed["Mã xác nhận"], "999999");

console.log("Automation Save/Readiness test: PASS");
