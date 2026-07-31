import assert from "node:assert/strict";
import RequirementAnalysisPromptBuilder from "../src/prompts/RequirementAnalysisPromptBuilder.js";

const requirement = {
    module: "Khách hàng",
    features: [
        {
            name: "Tạo khách hàng",
            businessRules: [{ code: "BR01", content: "Email phải là duy nhất." }]
        }
    ]
};
const snapshot = JSON.stringify(requirement);
const prompt = new RequirementAnalysisPromptBuilder().build(requirement);

assert.match(prompt, /"purpose": "string"/);
assert.match(prompt, /"functions": \[/);
assert.match(prompt, /"clarificationQuestions": \[/);
assert.match(prompt, /YES_NO \| SINGLE_CHOICE \| FREE_TEXT \| CONFIRM_ASSUMPTION/);
assert.match(prompt, /"targetField":/);
assert.match(prompt, /"targetRule":/);
assert.match(prompt, /"allowNotSpecified": false/);
assert.match(prompt, /materially change testcase/i);
assert.match(prompt, /one question for one missing decision/i);
assert.match(prompt, /never invent maximum or minimum lengths/i);
assert.match(prompt, /Do not ask generic questions/i);
assert.match(prompt, /Do not produce duplicate/i);
assert.match(prompt, /tester can understand immediately/i);
assert.match(prompt, /Never expose internal IDs such as BR01, FUNC001, MOD001, or Rule-15/i);
assert.match(prompt, /Mã thiết bị có bắt buộc phải duy nhất không/);
assert.match(prompt, /Do not describe internal testcase processing/i);
assert.match(prompt, /Use only if those alternatives are present/i);
assert.match(
    prompt,
    /For FREE_TEXT, YES_NO, and CONFIRM_ASSUMPTION, options must be an empty array/
);
assert.match(prompt, /at most 5 highest-impact/i);
assert.match(prompt, /Return only valid JSON/i);
assert.match(prompt, /REQUIREMENT DATA:/);
assert.match(prompt, /"module": "Khách hàng"/);
assert.doesNotMatch(prompt, /"suggestedScenarios":/);
assert.doesNotMatch(prompt, /"featureUnderstanding":/);
assert.doesNotMatch(prompt, /"testFocus":/);
assert.equal(JSON.stringify(requirement), snapshot);

console.log("RequirementAnalysisPromptBuilder test PASSED");
