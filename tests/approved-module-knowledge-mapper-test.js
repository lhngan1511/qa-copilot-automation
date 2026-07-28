import assert from "node:assert/strict";
import ApprovedModuleKnowledgeMapper from "../src/mappers/ApprovedModuleKnowledgeMapper.js";

const mapper = new ApprovedModuleKnowledgeMapper();
assert.throws(() => mapper.map(null), /required/);
assert.throws(
    () => mapper.map({ artifactType: "MODULE_REVIEW", approvalStatus: "pending" }),
    /approved/
);
assert.throws(
    () => mapper.map({ artifactType: "MODULE_REVIEW", approvalStatus: "rejected" }),
    /approved/
);
assert.throws(
    () => mapper.map({ artifactType: "OTHER", approvalStatus: "approved" }),
    /MODULE_REVIEW/
);

const artifact = {
    artifactType: "MODULE_REVIEW",
    approvalStatus: "approved",
    module: { id: "MOD001", name: "Approved Module", purpose: "Approved purpose" },
    functions: [
        {
            id: "FUNC001",
            moduleId: "MOD001",
            name: "Approved Function",
            actors: ["User"],
            businessRules: ["Approved rule"],
            requirementReferences: ["REF-APPROVED"]
        }
    ],
    notes: ["Approved note"],
    confidence: 0.9,
    source: "reviewed",
    knowledge: {
        module: { id: "DRAFT", name: "Draft Module" },
        functions: [{ id: "DRAFT-F", moduleId: "DRAFT", name: "Draft Function" }],
        clarificationAnswers: [{ questionId: "CL001", answer: "Approved answer" }]
    }
};
const snapshot = JSON.stringify(artifact);
const knowledge = mapper.map(artifact);
assert.equal(knowledge.module.name, "Approved Module");
assert.equal(knowledge.functions[0].name, "Approved Function");
assert.equal(knowledge.functions[0].businessRules[0], "Approved rule");
assert.equal(knowledge.clarificationAnswers[0].answer, "Approved answer");
assert.equal(knowledge.source, "reviewed");
knowledge.functions[0].name = "Changed";
assert.equal(artifact.functions[0].name, "Approved Function");
assert.equal(JSON.stringify(artifact), snapshot);

const legacy = mapper.map({
    artifactType: "MODULE_REVIEW",
    approvalStatus: "approved",
    modules: [{ module: "Legacy Module", features: ["Legacy Function"] }]
});
assert.equal(legacy.module.name, "Legacy Module");
assert.equal(legacy.functions[0].name, "Legacy Function");

console.log("ApprovedModuleKnowledgeMapper test PASSED");
