import assert from "node:assert/strict";
import TestCaseGenerator from "../src/generators/TestCaseGenerator.js";
import PublicTestCaseReviewMapper from "../src/web/mappers/PublicTestCaseReviewMapper.js";

/* Hiển thị nguồn gốc + độ tin cậy của testcase suy từ clarification ngay trên UI chi tiết testcase
   (Ngân chốt 2026-09-04: "để tôi tự kiểm tra được mà không cần đợi bug lộ ra sau nhiều vòng").
   sourceId trên scenario.sourceReferences (do ScenarioRecommendationEngine#attachClarificationEvidence
   gắn vào từ trước) phải được TestCaseGenerator tra cứu trong knowledge.knowledgeSources.clarificationMeta
   (do RequirementKnowledgeMapper#correlateClarificationAnswers tính) để bổ sung method/confidence/
   question/answer ngay trên testCase.sourceReferences — rồi phải sống sót qua PublicTestCaseReviewMapper
   (API trả về cho UI) không bị lọc mất. */

const clarificationMeta = {
    "CL001": {
        method: "FIELD_MATCH",
        confidence: 1,
        question: "Quy tắc nghiệp vụ kiểm tra tính trùng lặp của 'Mã đợt nhập học' khi thêm mới là gì?",
        answer: "không cho phép thêm mới"
    },
    "CL005": {
        method: "OPERATION_MATCH",
        question: "Người dùng có quyền hạn gì để thực hiện các thao tác Thêm, Sửa, Xóa?",
        answer: "quyền admin"
    }
};

const scenario = {
    id: "SC-1",
    title: "Kiểm tra trùng mã đợt nhập học khi thêm mới",
    type: "BUSINESS_RULE",
    feature: "Thêm mới đợt nhập học",
    sourceReferences: [
        { sourceType: "CLARIFICATION", sourceId: "CL001" },
        { sourceType: "CLARIFICATION", sourceId: "CL005" },
        { sourceType: "CLARIFICATION", sourceId: "CL999" }, // không có trong meta -> giữ nguyên, không throw
        { sourceType: "REQUIREMENT", sourceId: "REQ-1" } // khác loại -> không đụng vào
    ]
};

const testCases = new TestCaseGenerator().generate([scenario], { clarificationMeta });
assert.equal(testCases.length, 1);
const [testCase] = testCases;

const byId = id => testCase.sourceReferences.find(reference => reference.sourceId === id);

assert.equal(byId("CL001").method, "FIELD_MATCH", "CL001 phải mang method FIELD_MATCH");
assert.equal(byId("CL001").confidence, 1, "CL001 phải mang confidence từ clarificationMeta");
assert.equal(byId("CL001").question, clarificationMeta.CL001.question);
assert.equal(byId("CL001").answer, clarificationMeta.CL001.answer);

assert.equal(byId("CL005").method, "OPERATION_MATCH", "CL005 phải mang method OPERATION_MATCH");
assert.equal(byId("CL005").confidence, undefined, "CL005 không có confidence trong meta -> không được bịa ra");

assert.equal(byId("CL999").method, undefined, "CL999 không có trong meta -> giữ nguyên reference gốc");
assert.equal(byId("REQ-1").method, undefined, "reference không phải CLARIFICATION -> không bị đụng vào");
assert.equal(byId("REQ-1").sourceType, "REQUIREMENT");

// Không truyền clarificationMeta -> vẫn chạy được (mặc định {}), không throw, giữ nguyên reference gốc.
const withoutMeta = new TestCaseGenerator().generate([scenario]);
assert.equal(withoutMeta[0].sourceReferences.find(r => r.sourceId === "CL001").method, undefined);

// PublicTestCaseReviewMapper (API trả cho UI) phải giữ lại nguyên vẹn sourceReferences đã enrich —
// không bị lọc mất vì thiếu trong ARRAY_FIELDS (bug thật trước bản vá này).
const mapped = new PublicTestCaseReviewMapper().mapTestCase(testCase, 0);
assert.ok(Array.isArray(mapped.sourceReferences), "PublicTestCaseReviewMapper phải trả về sourceReferences");
const mappedCL001 = mapped.sourceReferences.find(r => r.sourceId === "CL001");
assert.equal(mappedCL001.method, "FIELD_MATCH");
assert.equal(mappedCL001.confidence, 1);
assert.equal(mappedCL001.question, clarificationMeta.CL001.question);

console.log("TestCase clarification provenance test: PASS");
