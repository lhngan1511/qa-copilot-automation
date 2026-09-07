import assert from "node:assert/strict";
import RequirementKnowledgeMapper from "../src/mappers/RequirementKnowledgeMapper.js";
import QACopilot from "../src/QACopilot.js";

/* Bug thật đã gặp (2026-09-04, log server thật): synthesizeRequiredFieldQuestions() sinh câu hỏi
   "Trường X có bắt buộc phải nhập khi thực hiện Y không?" nhưng KHÔNG gắn type/options YES_NO — UI
   hiển thị thành ô nhập tự do thay vì nút Có/Không. Tester (thật, log: CL007/CL008/CL009) trả lời tự
   nhiên "bắt buộc"/"không bắt buộc" thay vì đúng "Có"/"Không". isYes()/isNo() so khớp CHÍNH XÁC nên
   KHÔNG NHẬN RA -> required KHÔNG BAO GIỜ được set -> 0 testcase VALIDATION nào được sinh (log thật:
   "sinh 11, giữ lại 5" — không testcase VALIDATION nào), dù tester ĐÃ trả lời đầy đủ. */

const mapper = new RequirementKnowledgeMapper();

// 1. Câu hỏi tự sinh (QACopilot) phải có type/options YES_NO -> UI ép chọn nút, không cho gõ tự do.
{
    const qaCopilot = new QACopilot();
    const requirement = {
        features: [
            {
                id: "5",
                name: "Thêm mới DM đợt nhập học",
                automation: { operation: "CREATE" },
                inputs: [{ name: "#txt_tddotnhaphoc_ten_dot_nhap_hoc", required: false, description: "Chưa xác định" }]
            }
        ]
    };
    const [question] = qaCopilot.synthesizeRequiredFieldQuestions(requirement, []);
    assert.equal(question.type, "YES_NO");
    assert.deepEqual(question.options, ["Có", "Không"]);
}

// 2. Dữ liệu THẬT đã trả lời tự do TRƯỚC bản vá (CL007/CL008/CL009 trong log thật) vẫn phải được
// cứu — không bắt tester trả lời lại.
{
    const inputs = [
        { name: "#txt_tddotnhaphoc_ten_dot_nhap_hoc", required: false, description: "Chưa xác định" },
        { name: "#txt_tddotnhaphoc_so_qd_dot_nhap_hoc", required: false, description: "Chưa xác định" },
        { name: "#txta_tddotnhaphoc_ghi_chu_dot_nhap_hoc", required: false, description: "Chưa xác định" }
    ];
    const artifact = {
        approvalStatus: "approved",
        questions: [
            {
                questionId: "CL007",
                category: "Validation",
                question:
                    'Trường "#txt_tddotnhaphoc_ten_dot_nhap_hoc" có bắt buộc phải nhập khi thực hiện "Thêm mới DM đợt nhập học" không?',
                targetField: "#txt_tddotnhaphoc_ten_dot_nhap_hoc",
                answer: "bắt buộc",
                status: "answered"
            },
            {
                questionId: "CL008",
                category: "Validation",
                question:
                    'Trường "#txt_tddotnhaphoc_so_qd_dot_nhap_hoc" có bắt buộc phải nhập khi thực hiện "Thêm mới DM đợt nhập học" không?',
                targetField: "#txt_tddotnhaphoc_so_qd_dot_nhap_hoc",
                answer: "bắt buộc",
                status: "answered"
            },
            {
                questionId: "CL009",
                category: "Validation",
                question:
                    'Trường "#txta_tddotnhaphoc_ghi_chu_dot_nhap_hoc" có bắt buộc phải nhập khi thực hiện "Thêm mới DM đợt nhập học" không?',
                targetField: "#txta_tddotnhaphoc_ghi_chu_dot_nhap_hoc",
                answer: "không bắt buộc",
                status: "answered"
            }
        ]
    };
    mapper.applyRequiredFieldClarifications(inputs, artifact);
    assert.equal(inputs[0].required, true, 'CL007 "bắt buộc" phải được hiểu là required=true');
    assert.equal(inputs[1].required, true, 'CL008 "bắt buộc" phải được hiểu là required=true');
    assert.equal(inputs[2].required, false, 'CL009 "không bắt buộc" phải được hiểu là required=false');
}

// 3. Câu trả lời "Có"/"Không" chuẩn (từ câu hỏi Gemini thật, hoặc câu hỏi mới đã có type YES_NO) vẫn
// phải hoạt động bình thường như trước — không bị ảnh hưởng bởi bản vá chuẩn hoá thêm.
{
    const inputs = [{ name: "#txt_ma", required: false, description: "Chưa xác định" }];
    const artifact = {
        approvalStatus: "approved",
        questions: [
            {
                questionId: "CL001",
                question: 'Trường "#txt_ma" có bắt buộc phải nhập không?',
                targetField: "#txt_ma",
                answer: "Có",
                status: "answered"
            }
        ]
    };
    mapper.applyRequiredFieldClarifications(inputs, artifact);
    assert.equal(inputs[0].required, true);
}

console.log("Clarification required-field answer rescue test: PASS");
