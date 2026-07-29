import assert from "node:assert/strict";

import RequirementAnalysisPromptBuilder from "../src/prompts/RequirementAnalysisPromptBuilder.js";

const requirement = {
    module: "Khách hàng",
    features: [
        {
            name: "Tạo khách hàng",
            businessRules: [
                {
                    code: "BR01",
                    content: "Email phải là duy nhất."
                }
            ]
        }
    ]
};
const snapshot = JSON.stringify(requirement);
const builder = new RequirementAnalysisPromptBuilder();
const prompt = builder.build(requirement);

assert.equal(typeof prompt, "string");
assert.match(prompt, /"purpose": "string"/);
assert.match(prompt, /"functions": \[/);
assert.match(prompt, /"businessRules": \["string"\]/);
assert.match(prompt, /"validationRules": \["string"\]/);
assert.match(prompt, /"permissions": \["string"\]/);
assert.match(prompt, /"dependencies": \["string"\]/);
assert.match(prompt, /"assumptions": \["string"\]/);
assert.match(prompt, /"requirementReferences": \["string"\]/);
assert.match(prompt, /"risks": \["string"\]/);
assert.match(prompt, /"clarificationQuestions": \[\s*\{\s*"id": "CL001"/);
assert.match(prompt, /"requirementComplete": false/);
assert.match(prompt, /"category":/);
assert.match(prompt, /"priority":/);
assert.match(prompt, /"reason":/);
assert.match(prompt, /"options":/);
assert.match(prompt, /no more than 5 clarification questions/i);
assert.match(prompt, /Chưa xác định/);
assert.match(prompt, /directly affects testcase design/i);
assert.match(prompt, /Return only valid JSON/i);
assert.match(prompt, /Do not return Markdown/i);
assert.match(prompt, /REQUIREMENT DATA:/);
assert.match(prompt, /"module": "Khách hàng"/);
assert.match(prompt, /Khách hàng/);
assert.doesNotMatch(prompt, /thiet-bi\.md/i);
assert.doesNotMatch(prompt, /"suggestedScenarios":/);
assert.doesNotMatch(prompt, /"featureUnderstanding":/);
assert.doesNotMatch(prompt, /"testFocus":/);
assert.equal(JSON.stringify(requirement), snapshot);

console.log("RequirementAnalysisPromptBuilder test PASSED");
