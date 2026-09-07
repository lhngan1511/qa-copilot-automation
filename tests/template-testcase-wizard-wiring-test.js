import assert from "node:assert/strict";
import fs from "node:fs";

/* "Tạo testcase nhanh theo khuôn mẫu" — kiểm tra wiring bằng source-text (đúng convention repo cho
   .jsx, không có React testing library). Logic sinh testcase (công thức số lượng) đã kiểm kỹ ở
   tests/template-testcase-generator-formula-test.js — file này CHỈ kiểm phần TÍCH HỢP: (1) trang
   riêng (không phải modal — bug thật đã gặp 2026-09-04, bản đầu render popup, Ngân yêu cầu sửa lại
   giống Requirement Review), (2) cơ chế merge ID tiếp nối, (3) bước Sửa tự load từ Thêm ĐÚNG THỜI
   ĐIỂM (không phải lúc rời Bước 1 — bug thật đã gặp: copy giá trị rỗng vì Thêm chưa kịp nhập). */

// 1. Phải là TRANG RIÊNG có route, KHÔNG phải modal/overlay trong TestCaseReviewPanel.jsx.
{
    const panelSource = fs.readFileSync("./web-ui/src/components/TestCaseReviewPanel.jsx", "utf8");
    assert.doesNotMatch(
        panelSource,
        /TemplateTestCaseWizard/,
        "TestCaseReviewPanel.jsx không được render TemplateTestCaseWizard trực tiếp (phải điều hướng sang trang riêng, không phải modal)"
    );
    assert.match(
        panelSource,
        /navigate\(`\/workflows\/\$\{encodeURIComponent\(workflowId\)\}\/template-testcases`\)/,
        "nút '+ Tạo testcase nhanh theo khuôn mẫu' phải điều hướng sang trang riêng"
    );

    const routerSource = fs.readFileSync("./web-ui/src/app/router.jsx", "utf8");
    assert.match(routerSource, /workflows\/:workflowId\/template-testcases/);
    assert.match(routerSource, /TemplateTestCaseWizardPage/);

    const pageSource = fs.readFileSync("./web-ui/src/pages/TemplateTestCaseWizardPage.jsx", "utf8");
    assert.match(pageSource, /back-link/, "trang phải có back-link (giống Requirement Review), không phải nút Đóng của modal");
    assert.doesNotMatch(pageSource, /Đóng/, "không được có nút 'Đóng' kiểu modal — thoát bằng back-link");
}

// 2. Merge phải dùng ĐÚNG nextStableTestCaseId() (ID tiếp nối, không reset TC001).
{
    const pageSource = fs.readFileSync("./web-ui/src/pages/TemplateTestCaseWizardPage.jsx", "utf8");
    assert.match(pageSource, /nextStableTestCaseId\(cursor\)/);
    assert.match(pageSource, /update\.mutateAsync/);
}

// 3. Bước Sửa tự load từ Thêm phải chạy khi VÀO bước Sửa (useEffect theo currentOperation), KHÔNG
// phải lúc rời Bước 1 (startWizard) — đúng bug thật đã gặp: chạy quá sớm sẽ copy giá trị RỖNG vì
// Thêm chưa được nhập gì.
{
    const wizardSource = fs.readFileSync("./web-ui/src/components/TemplateTestCaseWizard.jsx", "utf8");
    assert.match(
        wizardSource,
        /useEffect\(\(\) => \{\s*if \(phase !== "OPERATION" \|\| currentOperation !== "UPDATE"\) return;/,
        "phải tự load lại field Sửa từ Thêm bằng effect theo dõi currentOperation === UPDATE"
    );
    const startWizardBlock = wizardSource.match(/const startWizard = \(\) => \{[\s\S]{0,400}?\n    \};/)?.[0] ?? "";
    assert.doesNotMatch(
        startWizardBlock,
        /UPDATE/,
        "startWizard() (chạy lúc rời Bước 1) không được đụng tới UPDATE nữa — quá sớm, Thêm chưa có dữ liệu"
    );
    // Không ghi đè nếu Sửa đã được tự nhập/sửa tay.
    assert.match(wizardSource, /isUntouchedAddOrUpdateConfig/);
}

// 4. Không còn nút "tải thủ công" gây hiểu lầm (đã bỏ hẳn — auto-load, không cần thao tác gì thêm),
// và bỏ bớt các khung ghi chú/giải thích dài dòng lặp lại mỗi bước.
{
    const wizardSource = fs.readFileSync("./web-ui/src/components/TemplateTestCaseWizard.jsx", "utf8");
    assert.doesNotMatch(wizardSource, /nút bên dưới/, "không được còn text nhắc tới nút thủ công (auto-load, không có nút này)");
    assert.doesNotMatch(wizardSource, /Sẽ sinh:/, "phải bỏ khung 'Sẽ sinh: X testcase' lặp lại mỗi bước — công thức đã có test riêng đối chiếu, không cần lặp lại trên UI");
}

// 5. Style tái dùng chung của app (.testcase-detail-form/.testcase-list-editor/.button), không dựng
// bộ class/font riêng cho toàn bộ form.
{
    const wizardSource = fs.readFileSync("./web-ui/src/components/TemplateTestCaseWizard.jsx", "utf8");
    assert.match(wizardSource, /className="testcase-detail-form"/);
    assert.doesNotMatch(wizardSource, /className="template-wizard__form"/, "không được còn class form riêng — đã thay bằng testcase-detail-form dùng chung");
}

console.log("Template testcase wizard wiring test: PASS");
