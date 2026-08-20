import assert from "node:assert/strict";
import RequirementKnowledgeMapper from "../src/mappers/RequirementKnowledgeMapper.js";
import ScenarioRecommendationEngine from "../src/recommenders/ScenarioRecommendationEngine.js";
import IntelligenceScenarioGenerator from "../src/generators/IntelligenceScenarioGenerator.js";
import TestCaseGenerator from "../src/generators/TestCaseGenerator.js";

const requirement = {
    module: { id: "MOD-WAREHOUSE", name: "Danh mục Kho" },
    features: [
        {
            id: "SEARCH",
            name: "Tìm kiếm kho",
            inputs: [
                {
                    name: "Từ khóa tìm kiếm",
                    required: false,
                    description: "Tìm theo mã hoặc tên kho"
                }
            ],
            flow: ["Người dùng nhập từ khóa", "Người dùng nhấn nút Tìm"],
            expectedResults: ["Danh sách hiển thị các kho khớp với từ khóa tìm kiếm"]
        },
        {
            id: "CREATE",
            name: "Thêm mới kho",
            inputs: [
                {
                    name: "Mã kho",
                    required: false,
                    description: "Hệ thống tự sinh nếu để trống"
                },
                { name: "Tên kho", required: true, description: "Không được để trống" }
            ],
            flow: ["Người dùng nhập thông tin", "Người dùng nhấn nút Thêm mới"],
            expectedResults: ["Kho mới được thêm vào danh sách"]
        },
        {
            id: "UPDATE",
            name: "Cập nhật kho",
            inputs: [
                { name: "Mã kho", required: false, description: "Có thể chỉnh sửa" },
                { name: "Tên kho", required: true, description: "Không được để trống" }
            ],
            flow: ["Người dùng thay đổi thông tin", "Người dùng nhấn nút Cập nhật"],
            expectedResults: ["Thông tin kho được cập nhật thành công"]
        },
        {
            id: "DELETE",
            name: "Xóa kho",
            inputs: [],
            flow: ["Người dùng nhấn nút xóa", "Người dùng nhấn nút Xóa để xác nhận"],
            expectedResults: ["Kho bị loại bỏ khỏi danh sách"]
        }
    ]
};

// Mô phỏng AI chỉ trả tên chức năng, còn bảng Input chuẩn nằm trong requirement đã duyệt.
const approvedArtifact = {
    approvalStatus: "approved",
    requirement,
    aiAnalysis: {
        functions: requirement.features.map(feature => ({
            id: feature.id,
            name: feature.name,
            description: feature.name
        }))
    },
    questions: [
        {
            id: "CQ-MA-KHO",
            question: "Nếu để trống Mã kho thì hệ thống có tự sinh không?",
            targetField: "Mã kho",
            answer: "Có, hệ thống tự sinh Mã kho",
            status: "answered"
        },
        {
            id: "CQ-TEN-KHO",
            question: "Tên kho có bắt buộc không?",
            targetField: "Tên kho",
            answer: "Có",
            status: "answered"
        }
    ]
};

const knowledge = new RequirementKnowledgeMapper().map({ approvedArtifact });
const recommendations = new ScenarioRecommendationEngine().generate(knowledge, requirement);
const scenarios = new IntelligenceScenarioGenerator().generate(recommendations, requirement);
const testCases = new TestCaseGenerator().generate(scenarios);

assert.ok(testCases.length > requirement.features.length, "không được dừng ở 1 testcase/feature");

const requiredNameCases = testCases.filter(
    testCase =>
        testCase.ruleClassification === "REQUIRED" &&
        testCase.sourceItem?.fieldName === "Tên kho"
);
assert.equal(requiredNameCases.length, 2, "Create và Update đều phải kiểm tra Tên kho bắt buộc");
assert.ok(
    requiredNameCases.every(testCase => testCase.testData.fields["Tên kho"]?.value === ""),
    "test data phải thể hiện rõ Tên kho để trống"
);

const generatedCodeCase = testCases.find(
    testCase =>
        testCase.ruleClassification === "AUTO_GENERATED" &&
        testCase.sourceItem?.fieldName === "Mã kho"
);
assert.ok(generatedCodeCase, "phải có testcase Mã kho để trống thì hệ thống tự sinh");
assert.equal(generatedCodeCase.testData.fields["Mã kho"]?.value, "");
assert.match(generatedCodeCase.expectedResult, /tự sinh Mã kho/i);
assert.ok(
    generatedCodeCase.sourceReferences.some(reference => reference.sourceId === "CQ-MA-KHO"),
    "câu trả lời làm rõ phải còn truy vết được"
);

console.log("Warehouse clarification coverage test: PASS");
