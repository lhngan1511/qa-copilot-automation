import assert from "node:assert/strict";
import RequirementKnowledge from "../src/models/RequirementKnowledge.js";
import RequirementKnowledgeMerger from "../src/intelligence/RequirementKnowledgeMerger.js";

const rule = new RequirementKnowledge({
    module: { id: "MOD001", name: "Customer" },
    functions: [
        {
            id: "FUNC001",
            moduleId: "MOD001",
            name: "Create customer",
            businessRules: ["Rule A"],
            requirementReferences: ["REF-A"]
        }
    ],
    clarificationAnswers: [{ questionId: "CL001", answer: "Approved" }],
    confidence: 0.6,
    source: "rule-engine"
});
const ai = new RequirementKnowledge({
    module: { id: "MOD999", name: "Wrong" },
    functions: [
        {
            id: "AI-1",
            moduleId: "MOD001",
            name: "Create customer",
            description: "Description",
            businessRules: ["Rule A", "Rule B"],
            risks: ["Risk"],
            requirementReferences: ["REF-A", "REF-B"]
        },
        {
            id: "AI-2",
            moduleId: "MOD001",
            name: "Unsupported",
            requirementReferences: []
        }
    ],
    notes: ["AI note"],
    confidence: 2,
    source: "gemini"
});
const merged = new RequirementKnowledgeMerger().merge(rule, ai);
assert.equal(merged.module.id, "MOD001");
assert.equal(merged.functions[0].id, "FUNC001");
assert.equal(merged.functions[0].description, "Description");
assert.deepEqual(merged.functions[0].businessRules, ["Rule A", "Rule B"]);
assert.equal(merged.functions.length, 1);
assert.equal(merged.clarificationAnswers[0].answer, "Approved");
assert.equal(merged.confidence, 1);
assert.equal(merged.source, "rule+gemini");
assert.deepEqual(rule.functions[0].businessRules, ["Rule A"]);

console.log("RequirementKnowledgeMerger test PASSED");
