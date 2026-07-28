import assert from "node:assert/strict";
import RequirementKnowledge from "../src/models/RequirementKnowledge.js";
import ScenarioRecommendationEngine from "../src/recommenders/ScenarioRecommendationEngine.js";

const knowledge = new RequirementKnowledge({
    module: { id: "MOD001", name: "Domain" },
    functions: [
        {
            id: "FUNC001",
            moduleId: "MOD001",
            name: "First action",
            businessRules: ["First rule"],
            requirementReferences: ["REF1"]
        },
        {
            id: "FUNC002",
            moduleId: "MOD001",
            name: "Second action",
            businessRules: ["Second rule"],
            requirementReferences: ["REF2"]
        }
    ],
    suggestedScenarios: [
        { title: "Owned suggestion", feature: "Second action", type: "NEGATIVE" },
        { title: "Ownerless suggestion", type: "NEGATIVE" }
    ]
});
const scenarios = new ScenarioRecommendationEngine().generate(knowledge, {});
assert.ok(
    scenarios.some(
        item => item.functionId === "FUNC001" && item.coveredRules.includes("First rule")
    )
);
assert.ok(
    scenarios.some(
        item => item.functionId === "FUNC002" && item.coveredRules.includes("Second rule")
    )
);
assert.ok(
    scenarios.some(item => item.title === "Owned suggestion" && item.functionId === "FUNC002")
);
assert.equal(scenarios.some(item => item.title === "Ownerless suggestion"), false);

console.log("Scenario ownership test PASSED");
