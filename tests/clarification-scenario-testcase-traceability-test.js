import assert from "node:assert/strict";
import RequirementKnowledge from "../src/models/RequirementKnowledge.js";
import ScenarioRecommendationEngine from "../src/recommenders/ScenarioRecommendationEngine.js";
import IntelligenceScenarioGenerator from "../src/generators/IntelligenceScenarioGenerator.js";
import TestCaseGenerator from "../src/generators/TestCaseGenerator.js";

const fact = "The system shows the tester-confirmed result";
const knowledge = new RequirementKnowledge({
    module: { id: "MOD001", name: "Generic Module" },
    functions: [{ id: "FUNC001", name: "Create record", description: "Create a record" }],
    confirmedFacts: [fact],
    knowledgeSources: { confirmedFacts: { [fact.toLowerCase()]: [{ sourceType: "CLARIFICATION", sourceId: "CQ-001" }] } }
});
const requirement = { module: "Generic Module", features: [{ id: "FUNC001", name: "Create record", expectedResults: [] }] };
const recommended = new ScenarioRecommendationEngine().generate(knowledge, requirement);
const scenarios = new IntelligenceScenarioGenerator().generate(recommended, requirement);
const testCases = new TestCaseGenerator().generate(scenarios);
const result = testCases.find(item => item.expectedResults.includes(fact));
assert.ok(result, "confirmed fact must reach final testcase");
assert.ok(result.sourceReferences.some(ref => ref.sourceId === "CQ-001"));
assert.equal(new Set(testCases.map(item => item.title)).size, testCases.length);
console.log("Clarification scenario testcase traceability test: PASS");
