import assert from "node:assert/strict";
import TestCaseIntelligencePromptBuilder from "../src/prompts/TestCaseIntelligencePromptBuilder.js";
const p = new TestCaseIntelligencePromptBuilder().build({
    scenarios: [{ id: "SC001", moduleId: "M", functionId: "F" }]
});
assert.match(p, /SC001/);
assert.match(p, /functionId/);
assert.match(p, /Do not create scenarios/);
assert.match(p, /Playwright/);
assert.match(p, /actualResult/);
console.log("TestCaseIntelligencePromptBuilder test PASSED");
