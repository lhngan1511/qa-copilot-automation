import assert from "node:assert/strict";
import RequirementKnowledgeMapper from "../src/mappers/RequirementKnowledgeMapper.js";
import ScenarioRecommendationEngine from "../src/recommenders/ScenarioRecommendationEngine.js";
import IntelligenceScenarioGenerator from "../src/generators/IntelligenceScenarioGenerator.js";
import TestCaseGenerator from "../src/generators/TestCaseGenerator.js";

/* Bug thật báo lại 2026-09-03 (SỬA LẦN 2, mục 5.2): Requirement Review hỏi đúng "Các trường thông
   tin như Mã đợt nhập học, Tên đợt nhập học, Số quyết định có bắt buộc nhập hay không?", tester
   chọn "Có" — nhưng testcase Validation sinh ra KHÔNG phản ánh câu trả lời đó (Expected Result/Input
   Data chung chung, không có testcase kiểm tra bỏ trống trường).

   Nguyên nhân thật (đã trace bằng code, KHÁC dự đoán ban đầu "generateTestcases() thiếu tham số
   clarificationAnswers"): clarificationAnswers ĐÃ được truyền vào, nhưng RequirementKnowledgeMapper
   ghi fact vào knowledge.validationRules (mảng cấp TOÀN CỤC) — mảng này KHÔNG được
   ScenarioRecommendationEngine đọc để sinh scenario mới, nó chỉ đọc functions[i].validationRules
   (mảng RIÊNG theo từng function, tính xong TRƯỚC khi merge clarification chạy). Câu trả lời "rơi
   mất" giữa 2 mảng không liên kết với nhau.

   Test này mô phỏng ĐÚNG tình huống thật: 1 function có 3 input CHƯA được đánh dấu required (giống
   hệt input dựng từ bản ghi CodeGen — "Chưa xác định" cho tới khi tester xác nhận), 1 câu hỏi liệt
   kê CẢ 3 trường cùng lúc (không có targetField dùng được — đúng giới hạn AI chỉ hỗ trợ 1
   trường/câu hỏi), trả lời "Có" — rồi chạy hết pipeline thật (Mapper -> ScenarioRecommendationEngine
   -> IntelligenceScenarioGenerator -> TestCaseGenerator) để xác nhận CẢ 3 trường đều sinh ra
   testcase Validation "không được để trống" tương ứng. */

const requirement = {
    module: { id: "MOD-NHAPHOC", name: "Đợt nhập học" },
    features: [
        {
            id: "CREATE",
            name: "Thêm mới đợt nhập học",
            inputs: [
                { name: "Mã đợt nhập học", required: false, description: "" },
                { name: "Tên đợt nhập học", required: false, description: "" },
                { name: "Số quyết định", required: false, description: "" }
            ],
            flow: ["Người dùng nhập thông tin", "Người dùng nhấn nút Thực hiện"],
            expectedResults: ["Đợt nhập học mới được thêm vào danh sách"]
        }
    ]
};

const approvedArtifact = {
    approvalStatus: "approved",
    requirement,
    aiAnalysis: {
        functions: requirement.features.map(feature => ({ id: feature.id, name: feature.name, description: feature.name }))
    },
    questions: [
        {
            id: "CQ-REQUIRED-FIELDS",
            category: "Validation",
            question: "Các trường thông tin như Mã đợt nhập học, Tên đợt nhập học, Số quyết định có bắt buộc nhập hay không?",
            targetField: "",
            answer: "Có",
            status: "answered"
        }
    ]
};

const knowledge = new RequirementKnowledgeMapper().map({ approvedArtifact });

// 1. functions[i].validationRules (mảng ScenarioRecommendationEngine THẬT SỰ đọc — RequirementFunctionKnowledge
// không giữ lại inputs[] thô, chỉ giữ validationRules đã tính xong) phải có câu "không được để trống"
// cho cả 3 trường — không chỉ nằm ở knowledge.validationRules cấp toàn cục (đó chính là bug cũ).
const createFunction = knowledge.functions.find(f => f.id === "CREATE");
assert.ok(createFunction, "phải tìm thấy function CREATE trong knowledge");
for (const name of ["Mã đợt nhập học", "Tên đợt nhập học", "Số quyết định"]) {
    assert.ok(
        createFunction.validationRules.some(rule => rule.includes(name) && /không được để trống/.test(rule)),
        `functions[CREATE].validationRules phải có rule "không được để trống" cho ${name}`
    );
}

// 3. Chạy hết pipeline thật -> phải sinh testcase Validation "bỏ trống" cho cả 3 trường, Expected
// Result/Input Data phải phản ánh đúng câu trả lời (không còn chung chung/trống).
const recommendations = new ScenarioRecommendationEngine().generate(knowledge, requirement);
const scenarios = new IntelligenceScenarioGenerator().generate(recommendations, requirement);
const testCases = new TestCaseGenerator().generate(scenarios);

for (const name of ["Mã đợt nhập học", "Tên đợt nhập học", "Số quyết định"]) {
    const requiredCase = testCases.find(
        testCase => testCase.ruleClassification === "REQUIRED" && testCase.sourceItem?.fieldName === name
    );
    assert.ok(requiredCase, `phải sinh testcase Validation kiểm tra bỏ trống "${name}" (trước khi sửa: KHÔNG sinh ra, đây chính là bug đã báo)`);
    assert.equal(requiredCase.testData.fields[name]?.value, "", `test data phải thể hiện rõ "${name}" để trống`);
    assert.ok(String(requiredCase.expectedResult ?? "").trim(), `Expected Result không được để trống chung chung cho "${name}"`);
}

console.log("Clarification required-field generates Validation testcase test: PASS");
