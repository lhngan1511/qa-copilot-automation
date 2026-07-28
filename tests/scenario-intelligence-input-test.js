import assert from "node:assert/strict";
import ScenarioIntelligenceInput from "../src/models/ScenarioIntelligenceInput.js";

const source = {
    module: { id: "MOD001", name: "Domain" },
    functions: [{ id: "FUNC001", moduleId: "MOD001", name: "Action" }],
    ruleScenarios: [{ title: "Rule" }],
    clarificationAnswers: [{ questionId: "CL001", answer: "Answer" }],
    constraints: { maxScenariosPerFunction: 5, preferredTypes: ["negative"] }
};
const input = new ScenarioIntelligenceInput(source);
assert.equal(input.isValid(), true);
source.functions[0].name = "Changed";
assert.equal(input.functions[0].name, "Action");
const json = input.toJSON();
json.module.name = "Changed";
assert.equal(input.module.name, "Domain");
assert.equal(new ScenarioIntelligenceInput().isValid(), false);
console.log("ScenarioIntelligenceInput test PASSED");
