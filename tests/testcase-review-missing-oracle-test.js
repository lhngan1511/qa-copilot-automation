import assert from "node:assert/strict";
import fs from "node:fs";
import { hasMissingOracle, testCaseWarnings } from "../web-ui/src/utils/testCaseReview.js";

/* Bug thật đã gặp (2026-09-04, TC003 flow Sửa): placeholder "Chưa xác định — cần tester xác nhận
   kết quả mong đợi cụ thể..." (do CodeGenRequirementDocumentBuilder tự chèn khi bản ghi không có
   bước kiểm tra kết quả) lọt THẲNG ra testcase mà AI Analysis không bắt được thành câu hỏi
   clarification (khác flow Xóa — CÙNG loại thiếu sót nhưng được bắt đúng thành CL003). Interim
   safety net (Ngân yêu cầu, trong lúc chưa sửa được gốc ở AI Analysis): testcase còn placeholder
   này phải (1) bị loại khỏi "Duyệt tất cả đủ điều kiện" và (2) có nhãn cảnh báo riêng để tester
   không vô tình duyệt 1 testcase không có oracle. */

assert.equal(hasMissingOracle({ expectedResult: "Chưa xác định — cần tester xác nhận kết quả mong đợi cụ thể" }), true);
assert.equal(hasMissingOracle({ expectedResult: "CHƯA XÁC ĐỊNH" }), true);
assert.equal(hasMissingOracle({ expectedResult: "Đợt nhập học mới được thêm vào danh sách" }), false);
// RỖNG cũng phải tính là thiếu oracle (bug thật đã gặp 2026-09-04: sau khi backend nới lỏng
// validateTestCase() không chặn cứng lúc lưu, testcase PENDING expectedResult rỗng phải bị loại
// khỏi "Duyệt tất cả đủ điều kiện" ở tầng FE — nếu không sẽ lọt qua rồi bị backend chặn lại y hệt
// lúc bulk-approve chuyển nó sang APPROVED, vì APPROVED vẫn bắt buộc có expectedResult).
assert.equal(hasMissingOracle({ expectedResult: "" }), true);
assert.equal(hasMissingOracle({ expectedResult: "   " }), true);
assert.equal(hasMissingOracle({}), true);

const warnings = testCaseWarnings({
    expectedResult: "Chưa xác định — cần tester xác nhận kết quả mong đợi cụ thể",
    steps: [{ action: "Bấm Thực hiện" }]
});
assert.ok(
    warnings.some(w => /chưa xác định/i.test(w)),
    "testCaseWarnings phải cảnh báo riêng cho testcase thiếu oracle"
);

// approveAllEligible (TestCaseReviewPanel.jsx) phải loại testcase thiếu oracle khỏi "Duyệt tất cả
// đủ điều kiện" — kiểm bằng source-text (đúng convention test file này đã dùng cho các file .jsx
// khác trong repo, vd automation-v3-library-test.js), tin cậy hơn test hành vi runtime vì không cần
// dựng React: đảm bảo hasMissingOracle THỰC SỰ được import và dùng để lọc trong approveAllEligible.
{
    const panelSource = fs.readFileSync("./web-ui/src/components/TestCaseReviewPanel.jsx", "utf8");
    assert.match(panelSource, /hasMissingOracle/, "TestCaseReviewPanel.jsx phải import/dùng hasMissingOracle");
    const approveAllBlock = panelSource.match(/const approveAllEligible = \(\) =>[\s\S]{0,800}?;/)?.[0] ?? "";
    assert.match(
        approveAllBlock,
        /!hasMissingOracle\(testCase\)/,
        "approveAllEligible phải lọc bỏ testcase thiếu oracle trước khi duyệt hàng loạt"
    );
}

// TestCaseList.jsx phải hiển thị nhãn cảnh báo riêng trên danh sách (không chỉ trong Chi tiết) để
// tester thấy NGAY mà không cần mở từng testcase.
{
    const listSource = fs.readFileSync("./web-ui/src/components/TestCaseList.jsx", "utf8");
    assert.match(listSource, /hasMissingOracle/, "TestCaseList.jsx phải import/dùng hasMissingOracle");
    assert.match(listSource, /testcase-oracle-warning/, "TestCaseList.jsx phải hiển thị nhãn cảnh báo riêng cho testcase thiếu oracle");
}

console.log("TestCase review missing-oracle safety net test: PASS");
