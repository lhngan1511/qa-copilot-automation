import assert from "node:assert/strict";
import RequirementModuleKnowledge from "../src/models/RequirementModuleKnowledge.js";

const defaults = new RequirementModuleKnowledge();
assert.deepEqual(defaults.toJSON(), {
    id: "",
    name: "",
    purpose: "",
    requirementReferences: []
});
assert.equal(defaults.isValid(), false);

const input = {
    id: " MOD001 ",
    name: " Thiết bị ",
    purpose: " Quản lý thiết bị ",
    requirementReferences: [" REQ01 ", "", "REQ01", 1, "REQ02"]
};
const moduleKnowledge = new RequirementModuleKnowledge(input);
assert.deepEqual(moduleKnowledge.toJSON(), {
    id: "MOD001",
    name: "Thiết bị",
    purpose: "Quản lý thiết bị",
    requirementReferences: ["REQ01", "REQ02"]
});
assert.equal(moduleKnowledge.isValid(), true);
assert.equal(new RequirementModuleKnowledge({ name: "Module" }).isValid(), false);
assert.equal(new RequirementModuleKnowledge({ id: "MOD001" }).isValid(), false);
assert.deepEqual(RequirementModuleKnowledge.from(" Thiết bị ", "MOD001").toJSON(), {
    id: "MOD001",
    name: "Thiết bị",
    purpose: "",
    requirementReferences: []
});
assert.deepEqual(
    RequirementModuleKnowledge.from(
        { module: "Khách hàng", references: ["REQ02"] },
        "MOD002"
    ).toJSON(),
    {
        id: "MOD002",
        name: "Khách hàng",
        purpose: "",
        requirementReferences: ["REQ02"]
    }
);
assert.equal(RequirementModuleKnowledge.from(null), null);
assert.equal(RequirementModuleKnowledge.from(42), null);
assert.deepEqual(input.requirementReferences, [" REQ01 ", "", "REQ01", 1, "REQ02"]);
assert.equal(Object.getPrototypeOf(moduleKnowledge.toJSON()), Object.prototype);

console.log("RequirementModuleKnowledge test PASSED");
