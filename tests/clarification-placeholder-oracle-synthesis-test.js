import assert from "node:assert/strict";
import QACopilot from "../src/QACopilot.js";

/* Bug thật đã gặp (2026-09-04): module "DM đợt nhập học" có 4 chức năng (Thêm/Sửa/Xóa/Tìm), AI hỏi
   đúng về placeholder "Chưa xác định" của flow Xóa (CL003 kiểu) nhưng BỎ SÓT flow Sửa — CÙNG loại
   thiếu sót, không đoán trước được flow nào bị rơi (phụ thuộc AI, không phải rule cố định). Tăng cap
   số câu hỏi (clarification-question-cap-scales-test.js) chỉ giải quyết trường hợp AI CÓ Ý ĐỊNH hỏi
   nhưng bị cắt do cap — KHÔNG giải quyết việc AI vốn dĩ không nhận ra đây là điểm cần hỏi. Ngân chốt
   2026-09-04: "chắc chắn cần làm, không phải tùy chọn nữa" — quét TẤT CẢ feature còn placeholder
   bằng RULE CỐ ĐỊNH (synthesizePlaceholderOracleQuestions), không phụ thuộc AI có nhận ra hay không. */

const qaCopilot = new QACopilot();

const requirement = {
    features: [
        {
            id: "1",
            name: "Thêm mới DM đợt nhập học",
            automation: { operation: "CREATE" },
            expectedResults: ["Hệ thống lưu DM đợt nhập học thành công."]
        },
        {
            id: "7",
            name: "Sửa DM đợt nhập học",
            automation: { operation: "UPDATE" },
            expectedResults: [
                "Chưa xác định — cần tester xác nhận kết quả mong đợi cụ thể (bản ghi chưa có bước kiểm tra kết quả nào cho thao tác này)"
            ]
        },
        {
            id: "8",
            name: "Xóa DM đợt nhập học",
            automation: { operation: "DELETE" },
            expectedResults: ['Hệ thống hiển thị: "Đã xóa thành công"']
        },
        {
            id: "0",
            name: "Thao tác DM đợt nhập học",
            automation: { operation: "OTHER" },
            expectedResults: [
                "Chưa xác định — cần tester xác nhận kết quả mong đợi cụ thể (bản ghi chưa có bước kiểm tra kết quả nào cho thao tác này)"
            ]
        }
    ]
};

// 1. AI đã hỏi đúng về Xóa (đủ từ khoá operation + "thông báo") -> KHÔNG được hỏi lại (tránh trùng
// lặp câu hỏi với chính câu AI đã hỏi).
{
    const aiQuestions = [
        { id: "CL001", category: "Exception", question: "Thông báo chính xác khi xóa thành công là gì?" }
    ];
    const synthesized = qaCopilot.synthesizePlaceholderOracleQuestions(requirement, aiQuestions);
    const names = synthesized.map(q => q.question);
    assert.ok(!names.some(q => /xóa/i.test(q)), "Xóa đã được AI hỏi đúng -> không được hỏi trùng");
    assert.ok(names.some(q => /Sửa DM đợt nhập học/.test(q)), "Sửa CHƯA được hỏi -> PHẢI tự sinh câu hỏi");
}

// 2. Feature "OTHER" (login/setup, không phải nghiệp vụ thật) -> KHÔNG được tự hỏi (tránh spam câu
// hỏi vô nghĩa "kết quả mong đợi khi đăng nhập là gì?" ở MỌI bản ghi CodeGen).
{
    const synthesized = qaCopilot.synthesizePlaceholderOracleQuestions(requirement, []);
    assert.ok(
        !synthesized.some(q => /Thao tác DM đợt nhập học/.test(q.question)),
        "feature operation OTHER (login/setup) không được tự sinh câu hỏi oracle"
    );
}

// 3. Feature không còn placeholder (Thêm mới, Xóa đã có expectedResult thật) -> không được hỏi.
{
    const synthesized = qaCopilot.synthesizePlaceholderOracleQuestions(requirement, []);
    assert.ok(!synthesized.some(q => /Thêm mới DM đợt nhập học/.test(q.question)));
    assert.ok(!synthesized.some(q => /"Xóa DM đợt nhập học"/.test(q.question)));
}

// 4. buildClarificationQuestions(knowledge, aiResult, requirement) phải LỒNG câu hỏi tự sinh vào
// đúng pipeline chuẩn hoá (có questionId CLxxx, status pending, đi qua đúng cap động).
{
    const built = qaCopilot.buildClarificationQuestions(
        { questions: [] },
        { questions: [{ category: "Exception", question: "Thông báo chính xác khi xóa thành công là gì?" }] },
        requirement
    );
    const sua = built.find(q => /Sửa DM đợt nhập học/.test(q.question));
    assert.ok(sua, "câu hỏi tự sinh cho Sửa phải xuất hiện trong danh sách câu hỏi cuối cùng gửi cho tester");
    assert.match(sua.questionId, /^CL\d{3,}$/);
    assert.equal(sua.status, "pending");
    assert.equal(sua.answer, "");
}

console.log("Clarification placeholder-oracle force-injection test: PASS");
