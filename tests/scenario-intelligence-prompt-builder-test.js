import assert from "node:assert/strict";
import ScenarioIntelligencePromptBuilder from "../src/prompts/ScenarioIntelligencePromptBuilder.js";

const prompt = new ScenarioIntelligencePromptBuilder().build({
    module: { id: "MOD001" },
    functions: [{ id: "FUNC001" }],
    clarificationAnswers: [{ questionId: "CL001", answer: "Approved answer" }]
});
assert.match(prompt, /Senior QA Analyst/);
assert.match(prompt, /Approved answer/);
assert.match(prompt, /functionId/);
assert.match(prompt, /coveredRules/);
assert.match(prompt, /JSON only/);
console.log("ScenarioIntelligencePromptBuilder test PASSED");
