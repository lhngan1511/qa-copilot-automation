import assert from "node:assert/strict";
import ScenarioQualityPolicy from "../src/intelligence/ScenarioQualityPolicy.js";

const policy = new ScenarioQualityPolicy({ caps: { NEGATIVE: 1, BOUNDARY: 1, RISK: 1 } });
const owner = { id: "FUNC001", name: "Action" };
const base = {
    moduleId: "MOD001", functionId: "FUNC001", feature: "Action",
    type: "NEGATIVE", expectedResults: ["Rejected"], requirementReferences: ["REF"], source: "rule"
};
const result = policy.apply([
    { ...base, title: "Invalid data" },
    { ...base, title: " Invalid   data! " },
    { ...base, title: "Another invalid", priority: "High" },
    { ...base, title: "Critical invalid", priority: "Critical" },
    { ...base, type: "BOUNDARY", title: "Generic boundary" },
    { ...base, type: "RISK", title: "Risk", riskReason: "" }
], { functions: [owner] });
assert.equal(result.scenarios.some(item => item.title.includes("Generic")), false);
assert.equal(result.scenarios.some(item => item.title === "Critical invalid"), true);
assert.ok(result.summary.duplicateRemovedCount > 0);
assert.ok(result.summary.rejectedCount > 0);
console.log("ScenarioQualityPolicy test PASSED");
