import assert from "node:assert/strict";
import RequirementKnowledge from "../src/models/RequirementKnowledge.js";
import ScenarioRecommendationEngine from "../src/recommenders/ScenarioRecommendationEngine.js";

const knowledge = new RequirementKnowledge({
    module: { id: "MOD001", name: "Generic Module" },
    functions: [{ id: "FUNC001", name: "Create record", description: "Create a record" }],
    confirmedFacts: ["The system shows the tester-confirmed result"],
    knowledgeSources: {
        confirmedFacts: {
            "the system shows the tester-confirmed result": [
                { sourceType: "CLARIFICATION", sourceId: "CQ-001" }
            ]
        }
    }
});
const scenarios = new ScenarioRecommendationEngine().generate(knowledge, {
    module: "Generic Module",
    features: [{ id: "FUNC001", name: "Create record", expectedResults: [] }]
});
assert.ok(scenarios.some(item => item.expectedResults.includes("The system shows the tester-confirmed result")));
assert.ok(scenarios.some(item => item.sourceReferences?.some(ref => ref.sourceId === "CQ-001")));
console.log("Scenario recommendation confirmed facts test: PASS");
