import assert from "node:assert/strict";
import RequirementFunctionKnowledge from "../src/models/RequirementFunctionKnowledge.js";

const defaults = new RequirementFunctionKnowledge();
assert.equal(defaults.isValid(), false);
assert.deepEqual(defaults.actors, []);

const input = {
    id: " FUNC001 ",
    moduleId: " MOD001 ",
    name: " Thêm thiết bị ",
    description: " Thêm mới ",
    actors: [" User ", "User", ""],
    preconditions: ["Đăng nhập", "Đăng nhập"],
    businessRules: ["BR01"],
    validationRules: ["VR01"],
    permissions: ["CREATE"],
    boundaries: ["MAX"],
    exceptions: ["EX01"],
    risks: ["Duplicate"],
    requirementReferences: ["REQ01", "REQ01"]
};
const functionKnowledge = new RequirementFunctionKnowledge(input);
assert.equal(functionKnowledge.isValid(), true);
assert.deepEqual(functionKnowledge.actors, ["User"]);
assert.deepEqual(functionKnowledge.preconditions, ["Đăng nhập"]);
assert.deepEqual(functionKnowledge.requirementReferences, ["REQ01"]);
assert.equal(new RequirementFunctionKnowledge({ moduleId: "MOD001", name: "F" }).isValid(), false);
assert.equal(new RequirementFunctionKnowledge({ id: "FUNC001", name: "F" }).isValid(), false);
assert.equal(new RequirementFunctionKnowledge({ id: "FUNC001", moduleId: "MOD001" }).isValid(), false);

const legacy = RequirementFunctionKnowledge.from(" Thêm thiết bị ", {
    fallbackId: "FUNC002",
    fallbackModuleId: "MOD001"
});
assert.equal(legacy.name, "Thêm thiết bị");
assert.equal(legacy.id, "FUNC002");
assert.equal(legacy.moduleId, "MOD001");

const aliases = RequirementFunctionKnowledge.from(
    {
        feature: "Sửa thiết bị",
        module: "MOD001",
        rules: ["BR02"],
        validations: ["VR02"],
        permissionRules: ["UPDATE"],
        boundaryCases: ["MIN"],
        exceptionCases: ["EX02"],
        riskAreas: ["Conflict"],
        references: ["REQ02"]
    },
    { fallbackId: "FUNC003" }
);
assert.deepEqual(aliases.businessRules, ["BR02"]);
assert.deepEqual(aliases.validationRules, ["VR02"]);
assert.deepEqual(aliases.permissions, ["UPDATE"]);
assert.deepEqual(aliases.boundaries, ["MIN"]);
assert.deepEqual(aliases.exceptions, ["EX02"]);
assert.deepEqual(aliases.risks, ["Conflict"]);
assert.deepEqual(aliases.requirementReferences, ["REQ02"]);
assert.equal(aliases.moduleId, "MOD001");

const moduleName = RequirementFunctionKnowledge.from(
    { feature: "Tìm kiếm", module: "Thiết bị" },
    { fallbackId: "FUNC004" }
);
assert.equal(moduleName.moduleId, "");
assert.equal(moduleName.isValid(), false);
assert.equal(RequirementFunctionKnowledge.from(null), null);
assert.equal(RequirementFunctionKnowledge.from([]), null);
assert.deepEqual(input.actors, [" User ", "User", ""]);
assert.equal(Object.getPrototypeOf(functionKnowledge.toJSON()), Object.prototype);

console.log("RequirementFunctionKnowledge test PASSED");
