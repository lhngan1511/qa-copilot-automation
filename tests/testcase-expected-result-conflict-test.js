import assert from "node:assert/strict";
import fs from "node:fs";
import { findExpectedResultConflicts } from "../web-ui/src/utils/testCaseReview.js";

/* Bug thật đã gặp (2026-09-04): TC004 (Xóa đợt nhập học, expected result từ assertion ghi được:
   'Hệ thống hiển thị: "Đã xóa thành công"') và TC005 (CONFIRMED_FACT, từ câu trả lời clarification:
   "xóa thông tin thành công") cùng mô tả 1 sự kiện (thông báo xác nhận xóa) nhưng expected result
   KHÁC NHAU — cả 2 cùng "Chờ duyệt" như không có gì bất thường. Ngân yêu cầu: phải cảnh báo xung đột
   khi phát hiện trường hợp này, không để tester tự vô tình duyệt cả 2. */

const tc004 = {
    id: "TC004",
    testcaseId: "TC004",
    module: "DM đợt nhập học",
    function: "Xóa đợt nhập học",
    feature: "Xóa đợt nhập học",
    type: "POSITIVE",
    expectedResult: 'Hệ thống hiển thị: "Đã xóa thành công"'
};
const tc005 = {
    id: "TC005",
    testcaseId: "TC005",
    module: "DM đợt nhập học",
    function: "DM đợt nhập học", // CONFIRMED_FACT: fact đứng riêng, feature = tên MODULE không phải function cụ thể
    feature: "DM đợt nhập học",
    type: "CONFIRMED_FACT",
    expectedResult: "xóa thông tin thành công"
};

const conflicts = findExpectedResultConflicts([tc004, tc005]);
assert.ok(conflicts.has("TC004"), "TC004 phải được đánh dấu xung đột");
assert.ok(conflicts.has("TC005"), "TC005 phải được đánh dấu xung đột");
assert.equal(conflicts.get("TC004")[0].withId, "TC005");
assert.equal(conflicts.get("TC005")[0].withId, "TC004");

// Testcase KHÁC module -> không được coi là cùng sự kiện, dù chữ giống nhau.
{
    const otherModule = { ...tc005, id: "TC099", module: "DM lớp học" };
    const result = findExpectedResultConflicts([tc004, otherModule]);
    assert.equal(result.size, 0, "khác module -> không xung đột");
}

// 2 testcase THƯỜNG (không CONFIRMED_FACT) khác function trong CÙNG module, chỉ trùng từ chung
// chung "thành công" -> KHÔNG được báo xung đột (false positive nếu chỉ so nguyên câu).
{
    const create = {
        id: "TC001",
        module: "DM đợt nhập học",
        function: "Thêm mới đợt nhập học",
        feature: "Thêm mới đợt nhập học",
        type: "POSITIVE",
        expectedResult: "Hệ thống hiển thị: Đã thêm dữ liệu thành công"
    };
    const del = {
        id: "TC004",
        module: "DM đợt nhập học",
        function: "Xóa đợt nhập học",
        feature: "Xóa đợt nhập học",
        type: "POSITIVE",
        expectedResult: 'Hệ thống hiển thị: "Đã xóa thành công"'
    };
    const result = findExpectedResultConflicts([create, del]);
    assert.equal(result.size, 0, "2 function khác nhau, không CONFIRMED_FACT -> không được báo xung đột chỉ vì trùng từ 'thành công'");
}

// Expected result GIỐNG HỆT nhau (đã dedupe ở tầng sinh testcase) -> không phải xung đột.
{
    const a = { ...tc004, id: "TC010" };
    const b = { ...tc004, id: "TC011" };
    const result = findExpectedResultConflicts([a, b]);
    assert.equal(result.size, 0, "expected result giống hệt -> không phải xung đột");
}

// Bug thật đã gặp (2026-09-04, báo cáo THỨ 2 — bản đầu của conflict detector còn coi "cùng function"
// là đủ điều kiện so sánh): nhiều testcase VALIDATION của CÙNG 1 function ("Đăng nhập") — thiếu Tài
// khoản/thiếu Mật khẩu/thiếu Mã xác nhận — và cả testcase POSITIVE cùng function đó bị báo xung đột
// NHẦM với nhau, dù đây là các testcase HỢP LỆ, khác nhau CÓ CHỦ ĐÍCH (khác field/khác luồng) —
// không phải mâu thuẫn. Nguyên nhân: chúng tự nhiên chia sẻ tên hàm ("đăng nhập") + câu chữ khuôn
// mẫu ("Hệ thống không cho phép hoàn tất đăng nhập khi ... để trống"), độ trùng token đủ cao vượt
// ngưỡng dù nội dung THỰC SỰ khác nhau ở phần quan trọng nhất (tên field). Sửa: KHÔNG so sánh 2
// testcase THƯỜNG (không CONFIRMED_FACT) nữa, dù cùng function — chỉ so khi có CONFIRMED_FACT.
{
    const positive = {
        id: "TC001", module: "UIIS_Sinh viên nhập học", function: "Đăng nhập", feature: "Đăng nhập",
        type: "POSITIVE",
        expectedResult: "Người dùng đăng nhập thành công khi tài khoản và mật khẩu hợp lệ."
    };
    const missingAccount = {
        id: "TC002", module: "UIIS_Sinh viên nhập học", function: "Đăng nhập", feature: "Đăng nhập",
        type: "VALIDATION",
        expectedResult: "Hệ thống không cho phép hoàn tất đăng nhập khi Tài khoản để trống."
    };
    const missingPassword = {
        id: "TC003", module: "UIIS_Sinh viên nhập học", function: "Đăng nhập", feature: "Đăng nhập",
        type: "VALIDATION",
        expectedResult: "Hệ thống không cho phép hoàn tất đăng nhập khi Mật khẩu để trống."
    };
    const missingOtp = {
        id: "TC004", module: "UIIS_Sinh viên nhập học", function: "Đăng nhập", feature: "Đăng nhập",
        type: "VALIDATION",
        expectedResult: "Hệ thống không cho phép hoàn tất đăng nhập khi Mã xác nhận để trống."
    };
    const result = findExpectedResultConflicts([positive, missingAccount, missingPassword, missingOtp]);
    assert.equal(
        result.size,
        0,
        `4 testcase hợp lệ cùng function "Đăng nhập" (khác field/khác luồng) KHÔNG được báo xung đột, thấy: ${JSON.stringify([...result.entries()])}`
    );
}

// Testcase đã REMOVED không được tính vào so sánh.
{
    const removed = { ...tc005, id: "TC005", reviewStatus: "REMOVED" };
    const result = findExpectedResultConflicts([tc004, removed]);
    assert.equal(result.size, 0, "testcase đã loại bỏ (REMOVED) không được tính vào phát hiện xung đột");
}

// Wiring: TestCaseReviewPanel loại testcase xung đột khỏi "Duyệt tất cả đủ điều kiện"; TestCaseList
// và TestCaseEditor phải hiển thị cảnh báo (kiểm bằng source-text, đúng convention repo cho .jsx).
{
    const panelSource = fs.readFileSync("./web-ui/src/components/TestCaseReviewPanel.jsx", "utf8");
    assert.match(panelSource, /findExpectedResultConflicts/, "TestCaseReviewPanel.jsx phải dùng findExpectedResultConflicts");
    const approveAllBlock = panelSource.match(/const approveAllEligible = \(\) =>[\s\S]{0,600}?;/)?.[0] ?? "";
    assert.match(
        approveAllBlock,
        /!expectedResultConflicts\.has\(testCaseId\(testCase\)\)/,
        "approveAllEligible phải lọc bỏ testcase đang xung đột trước khi duyệt hàng loạt"
    );

    const listSource = fs.readFileSync("./web-ui/src/components/TestCaseList.jsx", "utf8");
    assert.match(listSource, /testcase-conflict-warning/, "TestCaseList.jsx phải hiển thị nhãn cảnh báo xung đột");

    const editorSource = fs.readFileSync("./web-ui/src/components/TestCaseEditor.jsx", "utf8");
    assert.match(editorSource, /expectedResultConflicts/, "TestCaseEditor.jsx phải nhận và hiển thị cảnh báo xung đột");
}

console.log("TestCase expected-result conflict detection test: PASS");
