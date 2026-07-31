import assert from "node:assert/strict";
import ClarificationQuestion from "../src/models/ClarificationQuestion.js";
import TestCase from "../src/models/TestCase.js";
import PublicAIAnalysisReviewMapper from "../src/web/mappers/PublicAIAnalysisReviewMapper.js";

const source = {
    id: "CL020",
    category: "Business Rule",
    priority: "High",
    question: "BR05: Mã thiết bị có bắt buộc phải duy nhất không?",
    type: "SINGLE_CHOICE",
    reason: "Rule-15: Expected result mismatch.",
    targetField: "Mã thiết bị",
    targetRule: "BR05 - Tính duy nhất của Mã thiết bị",
    options: ["Bắt buộc duy nhất", "Cho phép trùng"],
    requirementReferences: ["BR05", "FUNC001", "MOD001"]
};
const snapshot = structuredClone(source);
const clarification = ClarificationQuestion.from(source);
const json = clarification.toJSON();

assert.deepEqual(source, snapshot, "Source requirement content must not be mutated");
assert.equal(json.question, "Mã thiết bị có bắt buộc phải duy nhất không?");
assert.equal(json.reason, "Kết quả mong đợi chưa phù hợp với tình huống kiểm thử.");
assert.match(json.question, /Mã thiết bị|bắt buộc|duy nhất/);
assert.deepEqual(json.options, source.options);
assert.equal(json.targetField, source.targetField);
assert.equal(json.targetRule, source.targetRule);
assert.deepEqual(json.requirementReferences, source.requirementReferences);

const answer = "Bắt buộc duy nhất - tester đã xác nhận";
const publicReview = new PublicAIAnalysisReviewMapper().map({
    review: {
        artifact: {
            artifactId: "AI-REVIEW-001",
            artifactType: "AI_ANALYSIS_REVIEW",
            approvalStatus: "pending",
            aiAnalysis: {},
            questions: [
                {
                    ...json,
                    questionId: json.id,
                    answer,
                    status: "answered"
                }
            ]
        }
    },
    workflow: { id: "WORKFLOW-001", allowedActions: [] }
});
assert.equal(publicReview.clarifications[0].answer, answer);

const testCase = new TestCase();
testCase.title = "BR05 - Không cho phép lưu mã thiết bị trùng";
assert.equal(testCase.title, "BR05 - Không cho phép lưu mã thiết bị trùng");

console.log("Tester-facing AI communication scope test PASSED");
