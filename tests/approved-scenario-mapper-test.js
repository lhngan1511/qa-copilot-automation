import assert from "node:assert/strict";
import ApprovedScenarioMapper from "../src/mappers/ApprovedScenarioMapper.js";
const m = new ApprovedScenarioMapper();
assert.throws(
    () => m.map({ artifactType: "SCENARIO_REVIEW", approvalStatus: "pending" }),
    /approved/
);
assert.throws(
    () => m.map({ artifactType: "SCENARIO_REVIEW", approvalStatus: "rejected" }),
    /approved/
);
const artifact = {
    artifactType: "SCENARIO_REVIEW",
    approvalStatus: "approved",
    scenarios: [
        {
            id: "SC001",
            moduleId: "MOD001",
            functionId: "FUNC001",
            feature: "Action",
            title: "Title",
            expectedResults: ["Result"],
            requirementReference: "REF"
        }
    ]
};
const out = m.map(artifact);
assert.equal(out[0].function, "Action");
assert.deepEqual(out[0].requirementReferences, ["REF"]);
out[0].title = "X";
assert.equal(artifact.scenarios[0].title, "Title");
assert.throws(
    () => m.map({ ...artifact, scenarios: [{ id: "", functionId: "", title: "" }] }),
    /requires/
);
console.log("ApprovedScenarioMapper test PASSED");
