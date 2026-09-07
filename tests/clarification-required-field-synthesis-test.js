import assert from "node:assert/strict";
import QACopilot from "../src/QACopilot.js";

/* Bug thật đã gặp (2026-09-04): module "DM đợt nhập học" chỉ có 3 câu hỏi thật, KHÔNG câu nào hỏi
   "trường X có bắt buộc nhập không?" cho Thêm mới/Cập nhật -> không field nào có required=true ->
   KHÔNG sinh được testcase "Thêm/Cập nhật KHÔNG THÀNH CÔNG" nào (thiếu N trong công thức 1+N+M).
   Ngân báo: "TC thêm không thành công ở đâu? Cập nhật không thành công ở đâu". Field CodeGen-derived
   luôn bắt đầu CHƯA XÁC ĐỊNH bắt buộc hay không — quét bằng RULE CỐ ĐỊNH, không phụ thuộc AI. */

const qaCopilot = new QACopilot();

const requirement = {
    features: [
        {
            id: "2",
            name: "Thêm mới DM đợt nhập học",
            automation: { operation: "CREATE" },
            inputs: [
                { name: "#txt_ma", required: false, description: "Chưa xác định" },
                { name: "#txt_ten", required: true, description: "Chưa xác định" } // đã confirm bắt buộc -> không hỏi lại
            ]
        },
        {
            id: "3",
            name: "Sửa DM đợt nhập học",
            automation: { operation: "UPDATE" },
            inputs: [{ name: "#txt_ten", required: false, description: "Chưa xác định" }]
        },
        {
            id: "4",
            name: "Xóa DM đợt nhập học",
            automation: { operation: "DELETE" },
            inputs: []
        }
    ]
};

// 1. Sinh câu hỏi cho field CHƯA XÁC ĐỊNH (#txt_ma của Thêm mới, #txt_ten của Sửa) — KHÔNG hỏi lại
// field ĐÃ confirm bắt buộc (#txt_ten của Thêm mới, required=true) — KHÔNG hỏi cho operation DELETE
// (không có N trong công thức 1+K).
{
    const synthesized = qaCopilot.synthesizeRequiredFieldQuestions(requirement, []);
    const questions = synthesized.map(q => q.question);
    assert.ok(questions.some(q => /#txt_ma.*Thêm mới DM đợt nhập học/.test(q)), "phải hỏi field #txt_ma của Thêm mới");
    assert.ok(questions.some(q => /#txt_ten.*Sửa DM đợt nhập học/.test(q)), "phải hỏi field #txt_ten của Sửa");
    assert.equal(questions.length, 2, `chỉ 2 field CHƯA XÁC ĐỊNH thật sự cần hỏi (Thêm mới #txt_ten đã required=true), thấy: ${JSON.stringify(questions)}`);
}

// 2. Field đến từ requirement .md tải tay (description KHÔNG phải "Chưa xác định" — có nội dung thật)
// -> KHÔNG được hỏi lại, dù required=false (đây là optional CÓ CHỦ ĐÍCH theo tài liệu thật).
{
    const manualRequirement = {
        features: [
            {
                id: "1",
                name: "Thêm thiết bị",
                automation: { operation: "CREATE" },
                inputs: [{ name: "Ghi chú", required: false, description: "Cho phép nhập nội dung mô tả bổ sung" }]
            }
        ]
    };
    const synthesized = qaCopilot.synthesizeRequiredFieldQuestions(manualRequirement, []);
    assert.equal(synthesized.length, 0, "field .md tải tay có description thật (không phải 'Chưa xác định') không được hỏi lại");
}

// 3. Không hỏi trùng nếu ĐÃ có câu hỏi (AI tự hỏi hoặc synthesize trước đó) nhắm đúng field đó.
{
    const existing = [
        {
            category: "Validation",
            question: 'Trường "#txt_ma" có bắt buộc phải nhập không?',
            targetField: "#txt_ma",
            status: "answered",
            answer: "Có"
        }
    ];
    const synthesized = qaCopilot.synthesizeRequiredFieldQuestions(requirement, existing);
    assert.ok(!synthesized.some(q => /#txt_ma/.test(q.question)), "field đã có câu hỏi nhắm đúng -> không được hỏi trùng");
    assert.ok(synthesized.some(q => /#txt_ten.*Sửa/.test(q.question)), "field khác chưa hỏi vẫn phải được hỏi bình thường");
}

// 4. buildClarificationQuestions phải lồng câu hỏi tự sinh vào danh sách cuối cùng.
{
    const built = qaCopilot.buildClarificationQuestions({ questions: [] }, { questions: [] }, requirement);
    assert.ok(
        built.some(q => /#txt_ma.*Thêm mới DM đợt nhập học/.test(q.question)),
        "câu hỏi field bắt buộc tự sinh phải xuất hiện trong danh sách câu hỏi cuối cùng gửi cho tester"
    );
}

console.log("Clarification required-field force-injection test: PASS");
