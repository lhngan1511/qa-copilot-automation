import assert from "node:assert/strict";
import RequirementIntelligenceInput from "../src/models/RequirementIntelligenceInput.js";
import RequirementIntelligencePromptBuilder from "../src/prompts/RequirementIntelligencePromptBuilder.js";

const input = new RequirementIntelligenceInput({
    requirement: { module: "Customer" },
    approvedRequirement: { approvalStatus: "approved" },
    clarifications: [{ questionId: "CL001", answer: "Do not allow deletion" }]
});
const prompt = new RequirementIntelligencePromptBuilder().build(input);
assert.match(prompt, /Senior Business Analyst/);
assert.match(prompt, /Do not allow deletion/);
assert.match(prompt, /"module"/);
assert.match(prompt, /"functions"/);
assert.match(prompt, /"validationRules"/);
assert.match(prompt, /JSON only/);
assert.doesNotMatch(prompt, /Thêm thiết bị|Sửa thiết bị/);

console.log("RequirementIntelligencePromptBuilder test PASSED");
