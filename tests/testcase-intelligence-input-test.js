import assert from "node:assert/strict";
import TestCaseIntelligenceInput from "../src/models/TestCaseIntelligenceInput.js";
const source = {
    scenarios: [{ id: "SC1", moduleId: "M", functionId: "F", title: "T", expectedResults: ["R"] }],
    constraints: { maxStepsPerTestCase: 5 }
};
const input = new TestCaseIntelligenceInput(source);
assert.equal(input.isValid(), true);
source.scenarios[0].title = "X";
assert.equal(input.scenarios[0].title, "T");
assert.equal(new TestCaseIntelligenceInput().isValid(), false);
console.log("TestCaseIntelligenceInput test PASSED");
