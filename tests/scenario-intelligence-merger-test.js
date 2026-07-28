import assert from "node:assert/strict";
import ScenarioQualityPolicy from "../src/intelligence/ScenarioQualityPolicy.js";
import ScenarioIntelligenceMerger from "../src/intelligence/ScenarioIntelligenceMerger.js";

const base = {
    id: "SC001", moduleId: "MOD001", functionId: "FUNC001", function: "Action",
    title: "Invalid data", type: "NEGATIVE", expectedResults: ["Rejected"],
    requirementReferences: ["REF"], coveredRules: ["RULE"], source: "rule"
};
const merged = new ScenarioIntelligenceMerger(new ScenarioQualityPolicy()).merge(
    [base],
    [{ ...base, id: "AI1", description: "AI detail", source: "gemini" }],
    { functions: [{ id: "FUNC001", name: "Action" }] }
);
assert.equal(merged.scenarios.length, 1);
assert.equal(merged.scenarios[0].id, "SC001");
assert.equal(merged.scenarios[0].description, "AI detail");
assert.equal(merged.scenarios[0].source, "rule+gemini");
assert.equal(base.description, undefined);
console.log("ScenarioIntelligenceMerger test PASSED");
