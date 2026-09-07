import assert from "node:assert/strict";
import QACopilot from "../src/QACopilot.js";
import RequirementKnowledgeMapper from "../src/mappers/RequirementKnowledgeMapper.js";

/* Bug thật đã gặp (2026-09-04): TC005 (positive "Xóa DM đợt nhập học thành công", văn bản mẫu chung
   do catalog/native builder tự sinh) và TC006 (CONFIRMED_FACT "DM đợt nhập học: Đã xóa thành công
   thông tin", từ câu trả lời clarification "Thông báo chính xác khi xóa thành công là gì?") gần như
   trùng lặp — cùng mô tả 1 sự kiện, viết khác nhau, tồn tại song song như 2 testcase riêng biệt.
   Ngân chốt 2026-09-04: câu trả lời clarification xác nhận nội dung thông báo phải THAY THẾ
   expectedResults mẫu chung của feature, không sinh thêm CONFIRMED_FACT đứng riêng — "không dư". */

const qaCopilot = new QACopilot();

const requirement = {
    features: [
        {
            id: "8",
            name: "Xóa DM đợt nhập học",
            automation: { operation: "DELETE" },
            expectedResults: ['Hệ thống hiển thị: "Đã xóa thành công"']
        },
        {
            id: "7",
            name: "Sửa DM đợt nhập học",
            automation: { operation: "UPDATE" },
            expectedResults: [
                "Chưa xác định — cần tester xác nhận kết quả mong đợi cụ thể (bản ghi chưa có bước kiểm tra kết quả nào cho thao tác này)"
            ]
        }
    ]
};

// 1. isOracleConfirmationQuestion: nhận diện đúng câu hỏi "... là gì?" xin văn bản thật, KHÔNG nhận
// nhầm câu hỏi Yes/No hay business rule khác.
{
    assert.equal(
        qaCopilot.isOracleConfirmationQuestion({ question: "Thông báo chính xác khi xóa thành công là gì?" }),
        true
    );
    assert.equal(
        qaCopilot.isOracleConfirmationQuestion({
            question: 'Kết quả mong đợi chính xác khi thực hiện "Sửa DM đợt nhập học" là gì?'
        }),
        true
    );
    assert.equal(
        qaCopilot.isOracleConfirmationQuestion({ question: "Mã đợt nhập học có bắt buộc phải là duy nhất không?" }),
        false
    );
}

// 2. findOracleConfirmationTargetFeature: ưu tiên requirementReferences (câu hỏi tự sinh); fallback
// khớp từ khoá operation khi không có requirementReferences (câu hỏi AI tự đặt).
{
    const byRef = qaCopilot.findOracleConfirmationTargetFeature(
        { question: "Bất kỳ", requirementReferences: ["7"] },
        requirement.features
    );
    assert.equal(byRef?.id, "7");

    const byKeyword = qaCopilot.findOracleConfirmationTargetFeature(
        { question: "Thông báo chính xác khi xóa thành công là gì?", requirementReferences: [] },
        requirement.features
    );
    assert.equal(byKeyword?.id, "8");
}

// 3. applyOracleConfirmationAnswers: THAY THẾ expectedResults, không tạo entry mới song song.
{
    const artifact = {
        approvalStatus: "approved",
        requirement,
        questions: [
            {
                questionId: "CL002",
                category: "Exception",
                question: "Thông báo chính xác khi xóa thành công là gì?",
                answer: "xóa thông tin thành công",
                status: "answered",
                requirementReferences: []
            }
        ]
    };
    const updated = qaCopilot.applyOracleConfirmationAnswers(requirement, artifact);
    const deleteFeature = updated.features.find(f => f.id === "8");
    assert.deepEqual(deleteFeature.expectedResults, ["xóa thông tin thành công"]);
    // requirement GỐC không bị mutate (an toàn khi được tham chiếu ở nơi khác trong cùng lượt chạy).
    assert.deepEqual(requirement.features.find(f => f.id === "8").expectedResults, [
        'Hệ thống hiển thị: "Đã xóa thành công"'
    ]);
}

// 4. mergeApprovedClarifications (RequirementKnowledgeMapper) phải BỎ QUA câu hỏi đã được áp dụng ở
// bước applyOracleConfirmationAnswers — không sinh thêm confirmedFacts trùng lặp.
{
    const mapper = new RequirementKnowledgeMapper();
    const artifact = {
        approvalStatus: "approved",
        requirement: {
            features: [
                { id: "8", name: "Xóa DM đợt nhập học", expectedResults: ["xóa thông tin thành công"] }
            ]
        },
        questions: [
            {
                questionId: "CL002",
                category: "Exception",
                question: "Thông báo chính xác khi xóa thành công là gì?",
                answer: "xóa thông tin thành công",
                status: "answered"
            }
        ]
    };
    const knowledge = { confirmedFacts: [], knowledgeSources: {} };
    mapper.mergeApprovedClarifications(knowledge, artifact);
    assert.deepEqual(knowledge.confirmedFacts, [], "câu hỏi đã áp dụng vào expectedResults không được sinh thêm confirmedFact trùng");
}

// 5. Câu hỏi oracle-confirmation KHÔNG khớp được feature nào (vd nhiều feature cùng operation, mơ
// hồ) -> vẫn phải rơi về confirmedFacts như cũ, KHÔNG được mất dữ liệu.
{
    const mapper = new RequirementKnowledgeMapper();
    const artifact = {
        approvalStatus: "approved",
        requirement: { features: [{ id: "8", name: "Xóa DM đợt nhập học", expectedResults: ["Chưa xác định"] }] },
        questions: [
            {
                questionId: "CL099",
                category: "Exception",
                question: "Thông báo lỗi khi mất kết nối mạng là gì?",
                answer: "Không thể kết nối máy chủ, vui lòng thử lại",
                status: "answered"
            }
        ]
    };
    const knowledge = { confirmedFacts: [], knowledgeSources: {} };
    mapper.mergeApprovedClarifications(knowledge, artifact);
    assert.deepEqual(knowledge.confirmedFacts, ["Không thể kết nối máy chủ, vui lòng thử lại"], "câu hỏi KHÔNG khớp được feature nào vẫn phải giữ làm confirmedFact, không được rơi mất");
}

console.log("Clarification oracle-confirmation consolidation test: PASS");
