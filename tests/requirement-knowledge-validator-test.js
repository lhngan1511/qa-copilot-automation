import assert from "node:assert/strict";
import RequirementKnowledgeValidator from "../src/validators/RequirementKnowledgeValidator.js";

const validator = new RequirementKnowledgeValidator();
const validKnowledge = {
    module: { id: "MOD001", name: "Thiết bị", purpose: "Quản lý" },
    functions: [
        {
            id: "FUNC001",
            moduleId: "MOD001",
            name: "Thêm",
            businessRules: ["BR01"],
            validationRules: [],
            requirementReferences: ["REQ01"]
        }
    ],
    confidence: 0.9
};
assert.deepEqual(validator.validate(validKnowledge), {
    valid: true,
    errors: [],
    warnings: []
});
assert.equal(validator.validate(null).valid, false);
assert.equal(validator.validate([]).valid, false);

const malformed = {
    module: { id: "", name: "", purpose: "" },
    functions: [
        {
            id: "",
            moduleId: "",
            name: "",
            requirementReferences: "invalid",
            businessRules: "invalid",
            validationRules: null
        },
        {
            id: "FUNC002",
            moduleId: "MOD999",
            name: "Sửa",
            requirementReferences: []
        },
        {
            id: "FUNC002",
            moduleId: "MOD001",
            name: "Xóa"
        },
        null
    ],
    confidence: 2
};
const snapshot = JSON.stringify(malformed);
const malformedResult = validator.validate(malformed);
assert.equal(malformedResult.valid, false);
assert.ok(malformedResult.errors.some(error => error.includes("Module id")));
assert.ok(malformedResult.errors.some(error => error.includes("Module name")));
assert.ok(malformedResult.errors.some(error => error.includes("id is required")));
assert.ok(malformedResult.errors.some(error => error.includes("moduleId is required")));
assert.ok(malformedResult.errors.some(error => error.includes("name is required")));
assert.ok(malformedResult.errors.some(error => error.includes("Duplicate function id")));
assert.ok(malformedResult.warnings.some(warning => warning.includes("Module purpose")));
assert.ok(malformedResult.warnings.some(warning => warning.includes("requirementReferences")));
assert.ok(malformedResult.warnings.some(warning => warning.includes("businessRules")));
assert.ok(malformedResult.warnings.some(warning => warning.includes("Confidence")));
assert.equal(JSON.stringify(malformed), snapshot);

const mismatchResult = validator.validate({
    module: { id: "MOD001", name: "Module", purpose: "Purpose" },
    functions: [
        {
            id: "FUNC001",
            moduleId: "MOD999",
            name: "Function",
            businessRules: ["BR01"],
            requirementReferences: ["REQ01"]
        }
    ]
});
assert.equal(mismatchResult.valid, false);
assert.ok(mismatchResult.errors.some(error => error.includes("does not match module")));

const duplicateModuleResult = validator.validate({
    modules: [{ id: "MOD001" }, { id: "MOD001" }]
});
assert.equal(duplicateModuleResult.valid, false);
assert.ok(duplicateModuleResult.errors.some(error => error.includes("Duplicate module id")));

const legacyResult = validator.validate({ confidence: 0 });
assert.equal(legacyResult.valid, true);
assert.ok(legacyResult.warnings.some(warning => warning.includes("structured module")));
assert.ok(legacyResult.warnings.some(warning => warning.includes("structured functions")));

const malformedArrays = validator.validate({
    module: { id: "MOD001", name: "Module" },
    functions: "invalid"
});
assert.equal(malformedArrays.valid, true);
assert.ok(malformedArrays.warnings.length > 0);

console.log("RequirementKnowledgeValidator test PASSED");
