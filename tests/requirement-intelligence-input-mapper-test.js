import assert from "node:assert/strict";
import RequirementIntelligenceInputMapper from "../src/mappers/RequirementIntelligenceInputMapper.js";

const mapper = new RequirementIntelligenceInputMapper();
const context = {
    requirementReview: { sessionId: "SES-REQ", artifactId: "REQ-001" },
    clarificationReview: { sessionId: "SES-CL", artifactId: "CL-001" }
};
const question = {
    questionId: "CL001",
    category: "Rule",
    priority: "High",
    question: "Question?",
    reason: "Reason",
    options: ["Yes", "No"],
    answer: "Yes",
    status: "answered",
    answeredAt: "now",
    answeredBy: "user"
};
const result = mapper.map({
    requirement: { module: "Customer" },
    requirementReviewArtifact: { approvalStatus: "approved" },
    clarificationArtifact: { approvalStatus: "approved", questions: [question] },
    executionContext: context
});
assert.equal(result.isValid(), true);
assert.deepEqual(result.clarifications[0], question);
assert.equal(result.requirementReference.clarificationArtifactId, "CL-001");

const pending = mapper.map({
    requirement: {},
    requirementReviewArtifact: { approvalStatus: "pending" },
    clarificationArtifact: { approvalStatus: "pending", questions: [question] },
    executionContext: context
});
assert.equal(pending.isValid(), false);
assert.deepEqual(pending.clarifications, []);

console.log("RequirementIntelligenceInputMapper test PASSED");
