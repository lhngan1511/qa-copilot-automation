import assert from "node:assert/strict";
import TestCaseQualityPolicy from "../src/intelligence/TestCaseQualityPolicy.js";
import TestCaseIntelligenceMerger from "../src/intelligence/TestCaseIntelligenceMerger.js";
const s = { id: "SC1", moduleId: "M", functionId: "F" };
const base = {
    id: "TC001",
    scenarioId: "SC1",
    moduleId: "M",
    functionId: "F",
    title: "TC",
    objective: "O",
    type: "POSITIVE",
    steps: [{ stepNumber: 1, action: "Submit", expectedResult: "Saved" }],
    expectedResult: "Saved",
    requirementReferences: ["R"]
};
const r = new TestCaseIntelligenceMerger(new TestCaseQualityPolicy()).merge(
    [base],
    [{ ...base, id: "AI", automationNotes: "Good", source: "gemini" }],
    { scenarios: [s] }
);
assert.equal(r.testCases[0].id, "TC001");
assert.equal(r.testCases[0].source, "rule+gemini");
console.log("TestCaseIntelligenceMerger test PASSED");
