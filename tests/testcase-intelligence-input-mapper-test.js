import assert from "node:assert/strict";
import TestCaseIntelligenceInputMapper from "../src/mappers/TestCaseIntelligenceInputMapper.js";
const input = new TestCaseIntelligenceInputMapper().map({
    scenarios: [{ id: "SC1", moduleId: "M", functionId: "F", title: "T", description: "O" }],
    moduleArtifact: { module: { id: "M" }, functions: [{ id: "F" }] },
    knowledge: { clarificationAnswers: [{ answer: "A" }] }
});
assert.equal(input.isValid(), true);
assert.equal(input.clarificationAnswers[0].answer, "A");
console.log("TestCaseIntelligenceInputMapper test PASSED");
