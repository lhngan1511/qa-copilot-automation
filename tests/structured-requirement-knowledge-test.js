import assert from "node:assert/strict";
import RequirementKnowledge from "../src/models/RequirementKnowledge.js";
import RequirementIntelligenceEngine from "../src/engines/RequirementIntelligenceEngine.js";

const legacy = new RequirementKnowledge();
[
    "validationRules",
    "riskAreas",
    "boundaryCases",
    "negativeCases",
    "positiveCases",
    "securityCases",
    "permissionCases",
    "dataIntegrityCases",
    "suggestedScenarios",
    "questions"
].forEach(field => assert.ok(Array.isArray(legacy[field])));
assert.equal(legacy.confidence, 0);
assert.equal(legacy.source, "Requirement Intelligence Engine");
assert.equal(legacy.version, "1.0");

const input = {
    module: { id: "MOD001", name: "Thiết bị", purpose: "Quản lý" },
    functions: [
        { id: "FUNC010", moduleId: "MOD001", name: "Thêm" },
        { id: "FUNC010", moduleId: "MOD001", name: "Sửa" },
        { moduleId: "MOD001", name: "Thêm" },
        "Xóa"
    ],
    purpose: " Quản lý thiết bị ",
    actors: [" User ", "User"],
    businessRules: [" BR01 "],
    permissions: [" ADMIN "],
    exceptions: [" EX01 "],
    notes: [" Note "],
    clarificationAnswers: [{ questionId: "CL001", answer: { value: "Có" } }],
    positiveCases: [{ title: "Positive" }]
};
const knowledge = new RequirementKnowledge(input);
assert.deepEqual(knowledge.module, {
    id: "MOD001",
    name: "Thiết bị",
    purpose: "Quản lý",
    requirementReferences: []
});
assert.equal(knowledge.functions.length, 3);
assert.deepEqual(
    knowledge.functions.map(item => item.id),
    ["FUNC010", "FUNC001", "FUNC002"]
);
assert.deepEqual(
    knowledge.functions.map(item => item.name),
    ["Thêm", "Sửa", "Xóa"]
);
assert.deepEqual(knowledge.actors, ["User"]);
assert.deepEqual(knowledge.businessRules, ["BR01"]);
assert.deepEqual(knowledge.permissions, ["ADMIN"]);
assert.deepEqual(knowledge.exceptions, ["EX01"]);
assert.deepEqual(knowledge.notes, ["Note"]);
assert.deepEqual(knowledge.positiveCases, [{ title: "Positive" }]);

const legacyModule = new RequirementKnowledge();
legacyModule.setModule("Khách hàng");
legacyModule.setFunctions(["Thêm khách hàng"]);
assert.equal(legacyModule.module.id, "MOD001");
assert.equal(legacyModule.functions[0].id, "FUNC001");
assert.equal(legacyModule.functions[0].moduleId, "MOD001");

const differentModules = new RequirementKnowledge({
    module: { id: "MOD001", name: "One" }
});
assert.ok(
    differentModules.addFunction({ id: "FUNC001", moduleId: "MOD001", name: "Search" })
);
assert.equal(
    differentModules.addFunction({ id: "FUNC002", moduleId: "MOD001", name: "search" }),
    null
);
assert.ok(
    differentModules.addFunction({ id: "FUNC002", moduleId: "MOD002", name: "Search" })
);
assert.equal(differentModules.addFunction(null), null);

const json = knowledge.toJSON();
json.module.name = "Changed";
json.functions[0].actors.push("Changed");
json.clarificationAnswers[0].answer.value = "Không";
assert.equal(knowledge.module.name, "Thiết bị");
assert.deepEqual(knowledge.functions[0].actors, []);
assert.equal(knowledge.clarificationAnswers[0].answer.value, "Có");
assert.equal(input.module.name, "Thiết bị");
assert.equal(input.clarificationAnswers[0].answer.value, "Có");

const engineKnowledge = new RequirementIntelligenceEngine().analyze({
    module: "Thiết bị",
    features: []
});
assert.ok(engineKnowledge instanceof RequirementKnowledge);
assert.ok(Array.isArray(engineKnowledge.positiveCases));

console.log("Structured RequirementKnowledge test PASSED");
