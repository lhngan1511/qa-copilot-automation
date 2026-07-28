import assert from "node:assert/strict";
import RequirementIntelligenceInput from "../src/models/RequirementIntelligenceInput.js";

const source = {
    requirement: { module: "Customer" },
    approvedRequirement: { approvalStatus: "approved", requirement: { module: "Customer" } },
    clarifications: [
        {
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
        }
    ],
    requirementReference: {
        requirementReviewSessionId: " SES ",
        requirementArtifactId: " REQ "
    }
};
const input = new RequirementIntelligenceInput(source);
assert.equal(input.isValid(), true);
assert.equal(input.requirementReference.requirementReviewSessionId, "SES");
assert.equal(input.clarifications[0].reason, "Reason");
source.clarifications[0].answer = "Changed";
assert.equal(input.clarifications[0].answer, "Yes");
const json = input.toJSON();
json.requirement.module = "Changed";
assert.equal(input.requirement.module, "Customer");
assert.equal(
    new RequirementIntelligenceInput({
        requirement: {},
        approvedRequirement: { approvalStatus: "pending" }
    }).isValid(),
    false
);
assert.equal(
    new RequirementIntelligenceInput({
        requirement: {},
        approvedRequirement: { approvalStatus: "approved" },
        clarifications: [{ answer: " " }]
    }).isValid(),
    false
);

console.log("RequirementIntelligenceInput test PASSED");
