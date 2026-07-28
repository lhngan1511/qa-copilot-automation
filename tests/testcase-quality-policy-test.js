import assert from "node:assert/strict";
import TestCaseQualityPolicy from "../src/intelligence/TestCaseQualityPolicy.js";
const s = { id: "SC1", moduleId: "M", functionId: "F" };
const base = {
    scenarioId: "SC1",
    moduleId: "M",
    functionId: "F",
    title: "TC",
    objective: "Objective",
    type: "POSITIVE",
    steps: [{ stepNumber: 1, action: "Submit data", expectedResult: "Saved" }],
    expectedResult: "Saved",
    requirementReferences: ["REF"]
};
const r = new TestCaseQualityPolicy({ caps: { POSITIVE: 1 } }).apply(
    [
        base,
        { ...base, title: "Other", objective: "Other" },
        {
            ...base,
            title: "Vague",
            objective: "Vague",
            steps: [{ stepNumber: 1, action: "Kiểm tra hệ thống", expectedResult: "X" }]
        }
    ],
    { scenarios: [s] }
);
assert.equal(r.testCases.length, 1);
assert.ok(r.summary.rejectedCount >= 2);
console.log("TestCaseQualityPolicy test PASSED");
