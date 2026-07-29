import assert from "node:assert/strict";
import RequirementKnowledgeSchema from "../src/contracts/RequirementKnowledgeSchema.js";

assert.equal(typeof RequirementKnowledgeSchema, "object");

assert.deepEqual(Object.keys(RequirementKnowledgeSchema), [
    "purpose",
    "functions",
    "risks",
    "clarificationQuestions",
    "requirementComplete"
]);

assert.equal(Array.isArray(RequirementKnowledgeSchema.functions), true);
assert.equal(RequirementKnowledgeSchema.functions.length, 1);
assert.deepEqual(Object.keys(RequirementKnowledgeSchema.functions[0]), [
    "name",
    "description",
    "businessRules",
    "validationRules",
    "permissions",
    "dependencies",
    "assumptions",
    "requirementReferences"
]);

for (const legacyField of ["suggestedScenarios", "featureUnderstanding", "testFocus"]) {
    assert.equal(Object.hasOwn(RequirementKnowledgeSchema, legacyField), false);
}

console.log("RequirementKnowledgeSchema test PASSED");
