import assert from "node:assert/strict";
import ScenarioIntelligenceInputMapper from "../src/mappers/ScenarioIntelligenceInputMapper.js";

const mapper = new ScenarioIntelligenceInputMapper();
assert.equal(mapper.map({ moduleArtifact: { approvalStatus: "pending" } }).isValid(), false);
const input = mapper.map({
    moduleArtifact: {
        artifactType: "MODULE_REVIEW",
        approvalStatus: "approved",
        module: { id: "MOD001", name: "Domain" },
        functions: [{ id: "FUNC001", moduleId: "MOD001", name: "Action" }]
    },
    knowledge: {
        module: { id: "MOD001", name: "Domain" },
        functions: [{ id: "FUNC001", moduleId: "MOD001", name: "Action" }],
        clarificationAnswers: [{ questionId: "CL001", answer: "Answer" }]
    },
    ruleScenarios: [{ title: "Rule" }],
    executionContext: {
        moduleReview: { sessionId: "SES", artifactId: "ART" }
    }
});
assert.equal(input.isValid(), true);
assert.equal(input.clarificationAnswers[0].answer, "Answer");
assert.equal(input.requirementReference.moduleArtifactId, "ART");
console.log("ScenarioIntelligenceInputMapper test PASSED");
