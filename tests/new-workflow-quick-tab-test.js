import assert from "node:assert/strict";
import fs from "node:fs";

/* Ngân báo lại 2026-09-03: đã chọn tab "Nhập nhanh testcase" mà còn phải bấm thêm 1 nút "Bắt đầu
   nhập nhanh" nữa là thừa — chọn tab phải chuyển thẳng sang trang Duyệt testcase luôn. */

const pageSource = fs.readFileSync("./web-ui/src/pages/NewWorkflowPage.jsx", "utf8");

// 1. Tab "Nhập nhanh testcase" gọi thẳng handleQuickStart khi bấm — không còn màn hình trung gian
// với nút "Bắt đầu nhập nhanh" riêng.
assert.doesNotMatch(pageSource, /Bắt đầu nhập nhanh/, "không còn nút xác nhận thừa sau khi đã chọn tab");
assert.match(
    pageSource,
    /role="tab" disabled=\{quickBusy\} onClick=\{handleQuickStart\}/,
    "bấm tab 'Nhập nhanh testcase' phải gọi thẳng handleQuickStart"
);

// 2. handleQuickStart vẫn tạo session bypass + điều hướng thẳng sang trang Duyệt testcase (không đổi logic).
assert.match(
    pageSource,
    /const handleQuickStart = async \(\) => \{[\s\S]*?createDirectTestCaseDesign\(\{\}\)[\s\S]*?navigate\(`\/workflows\/\$\{encodeURIComponent\(result\.workflowId\)\}`\);/,
    "handleQuickStart phải tạo session rồi điều hướng thẳng, không cần bước xác nhận nào khác"
);

console.log("New Workflow Page - Quick Tab (no double-click) test: PASS");
