import assert from "node:assert/strict";
import AITestCaseIntelligenceEngine from "../src/engines/AITestCaseIntelligenceEngine.js";
import TestCaseIntelligenceInput from "../src/models/TestCaseIntelligenceInput.js";
class FakeProvider {
    constructor(v) {
        this.v = v;
    }
    async generate() {
        return this.v;
    }
}
const input = new TestCaseIntelligenceInput({
    scenarios: [{ id: "SC1", moduleId: "M", functionId: "F", title: "T", description: "O" }]
});
const valid = {
    testCases: [
        {
            scenarioId: "SC1",
            moduleId: "M",
            functionId: "F",
            title: "TC",
            objective: "O",
            type: "POSITIVE",
            steps: [{ stepNumber: 1, action: "Submit valid data", expectedResult: "Saved" }],
            expectedResult: "Saved",
            requirementReferences: ["REF"]
        },
        {
            scenarioId: "BAD",
            moduleId: "M",
            functionId: "F",
            steps: [{}],
            expectedResult: "X",
            requirementReferences: ["R"]
        }
    ]
};
const r = await new AITestCaseIntelligenceEngine(new FakeProvider(JSON.stringify(valid))).analyze(
    input
);
assert.equal(r.status, "SUCCESS");
assert.equal(r.testCases.length, 1);
assert.equal(r.source, "fake");
assert.equal(
    (await new AITestCaseIntelligenceEngine(new FakeProvider("{bad")).analyze(input)).status,
    "FAILED"
);
console.log("AITestCaseIntelligenceEngine test PASSED");
