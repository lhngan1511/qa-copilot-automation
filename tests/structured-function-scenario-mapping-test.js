import assert from "node:assert/strict";
import RequirementKnowledge from "../src/models/RequirementKnowledge.js";
import ScenarioRecommendationEngine from "../src/recommenders/ScenarioRecommendationEngine.js";
import IntelligenceScenarioGenerator from "../src/generators/IntelligenceScenarioGenerator.js";

const knowledge = new RequirementKnowledge({
    module: { id: "MOD001", name: "Customer" },
    functions: [
        {
            id: "FUNC001",
            moduleId: "MOD001",
            name: "Create customer",
            preconditions: ["Logged in"],
            businessRules: ["Customer code is unique"],
            validationRules: ["Name is required"],
            permissions: ["Create permission"],
            boundaries: ["Maximum name length"],
            exceptions: ["Duplicate customer"],
            risks: ["Concurrent creation"],
            requirementReferences: ["BR01"]
        },
        {
            id: "FUNC002",
            moduleId: "MOD001",
            name: "Search customer",
            businessRules: ["Search by keyword"],
            requirementReferences: ["BR02"]
        }
    ],
    source: "reviewed"
});
const recommended = new ScenarioRecommendationEngine().generate(knowledge, {});
assert.ok(recommended.length > 2);
assert.ok(recommended.some(item => item.functionId === "FUNC001"));
assert.ok(recommended.some(item => item.functionId === "FUNC002"));
assert.ok(recommended.every(item => item.moduleId === "MOD001"));
assert.ok(
    recommended
        .filter(item => item.functionId === "FUNC001")
        .every(item => item.feature === "Create customer")
);
const scenarios = new IntelligenceScenarioGenerator().generate(recommended, {});
assert.ok(scenarios.every(item => item.moduleId && item.functionId));
assert.ok(scenarios.every(item => Array.isArray(item.requirementReferences)));

console.log("Structured function scenario mapping test PASSED");
