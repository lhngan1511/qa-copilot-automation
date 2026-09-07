import assert from "node:assert/strict";
import TestCaseReviewValidator from "../src/validators/TestCaseReviewValidator.js";

/* Bug thật đã gặp (2026-09-04): "+ Tạo testcase từ CodeGen" cho module "DM đợt nhập học" ném lỗi
   cứng "Testcase TC003 is missing: expectedResult. Mã lỗi: INCOMPLETE_TEST_CASE" chặn đứng TOÀN BỘ
   batch merge — kể cả các testcase khác hoàn toàn hợp lệ. Bấm "Thử lại" lặp lại lỗi y hệt (nguyên
   nhân không đổi) và tester mất trắng (quay về 0 testcase). Nguyên nhân: validateTestCase() coi
   expectedResult là bắt buộc cho MỌI testcase bất kể reviewStatus, trong khi ý định ban đầu của hệ
   thống (xem hasMissingOracle()/"⚠ Chưa có oracle" ở web-ui/src/utils/testCaseReview.js) là CHO
   PHÉP lưu/hiển thị testcase PENDING còn thiếu oracle kèm cảnh báo, chỉ chặn ở bước DUYỆT (APPROVED).
   Ngân yêu cầu: "cho phép merge, chỉ đánh dấu cảnh báo, không chặn cả batch". */

const validator = new TestCaseReviewValidator();

function testCase(overrides = {}) {
    return validator.normalize({
        id: "TC001",
        module: "DM đợt nhập học",
        feature: "Sửa đợt nhập học",
        scenario: "Sửa đợt nhập học thành công với dữ liệu hợp lệ",
        type: "POSITIVE",
        testData: { requirement: "Tên đợt nhập học", value: "Ngân_test_1" },
        steps: [{ action: "Mở chức năng Sửa" }, { action: "Thực hiện" }],
        expectedResult: "",
        ...overrides
    });
}

// PENDING (mặc định) thiếu expectedResult -> KHÔNG được chặn (đúng ý định: hiển thị được, cảnh báo
// riêng ở UI, không chặn lưu/gộp).
{
    const pending = testCase({ reviewStatus: "PENDING" });
    assert.equal(validator.validateBatch([pending]), true, "PENDING thiếu expectedResult phải được LƯU, không throw INCOMPLETE_TEST_CASE");
}

// NEEDS_CHANGES thiếu expectedResult -> cũng không chặn (đang chờ tester sửa, không phải trạng thái
// cuối cùng).
{
    const needsChanges = testCase({ reviewStatus: "NEEDS_CHANGES" });
    assert.equal(validator.validateBatch([needsChanges]), true);
}

// REMOVED thiếu expectedResult -> không chặn (đã loại bỏ, nội dung không còn quan trọng).
{
    const removed = testCase({ reviewStatus: "REMOVED" });
    assert.equal(validator.validateBatch([removed]), true);
}

// Batch TRỘN: 1 testcase PENDING thiếu oracle + nhiều testcase khác hợp lệ -> CẢ BATCH phải lưu
// được, không rơi mất các testcase hợp lệ chỉ vì 1 cái còn thiếu nội dung (đúng bug thật đã gặp khi
// merge "+ Tạo testcase từ CodeGen" vào session đang mở).
{
    const incomplete = testCase({ id: "TC003", testcaseId: "TC003", reviewStatus: "PENDING" });
    const valid1 = testCase({ id: "TC001", testcaseId: "TC001", reviewStatus: "PENDING", expectedResult: "Hệ thống lưu thay đổi thành công." });
    const valid2 = testCase({ id: "TC002", testcaseId: "TC002", reviewStatus: "PENDING", expectedResult: "Hệ thống hiển thị: \"Đã xóa thành công\"" });
    assert.equal(validator.validateBatch([valid1, valid2, incomplete]), true, "batch trộn 1 testcase thiếu oracle + nhiều testcase hợp lệ phải lưu được TOÀN BỘ");
}

// APPROVED thiếu expectedResult -> VẪN PHẢI CHẶN (đây là ranh giới đúng: không được duyệt 1
// testcase không có oracle — giữ nguyên an toàn gốc, chỉ dời điểm chặn từ "lưu" sang "duyệt").
// Dùng feature/type KHÔNG đoán được operation (ExpectedResultBuilder tự sinh text cho CREATE/
// UPDATE/DELETE/SEARCH + POSITIVE — phải tránh các trường hợp đó để expectedResult THẬT SỰ giữ
// nguyên rỗng qua normalize(), đúng tình huống thật gây lỗi).
{
    const approved = testCase({
        reviewStatus: "APPROVED",
        feature: "Thao tác khác",
        type: "OTHER",
        expectedResult: ""
    });
    assert.throws(
        () => validator.validateBatch([approved]),
        error => error.code === "INCOMPLETE_TEST_CASE" && /expectedResult/.test(error.message),
        "APPROVED vẫn phải bắt buộc có expectedResult — không được nới lỏng luôn cả bước duyệt"
    );
}

// APPROVED có expectedResult đầy đủ -> hợp lệ.
{
    const approved = testCase({ reviewStatus: "APPROVED", expectedResult: "Hệ thống lưu thay đổi thành công." });
    assert.equal(validator.validateBatch([approved]), true);
}

// module/feature/scenario/type vẫn PHẢI bắt buộc bất kể reviewStatus (không nới lỏng quá tay —
// chỉ đúng field expectedResult được dời điểm chặn).
{
    const missingModule = testCase({ reviewStatus: "PENDING", module: "" });
    assert.throws(
        () => validator.validateBatch([missingModule]),
        error => error.code === "INCOMPLETE_TEST_CASE" && /module/.test(error.message)
    );
}

console.log("TestCase incomplete-expected-result not blocking (PENDING) test: PASS");
