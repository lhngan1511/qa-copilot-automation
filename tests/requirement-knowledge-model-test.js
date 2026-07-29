import assert from "node:assert/strict";
import RequirementKnowledge from "../src/models/RequirementKnowledge.js";

const defaults = new RequirementKnowledge();

assert.equal(defaults.module, null);
assert.equal(defaults.purpose, "");
assert.deepEqual(defaults.functions, []);
assert.deepEqual(defaults.businessRules, []);
assert.deepEqual(defaults.validationRules, []);
assert.deepEqual(defaults.permissions, []);
assert.deepEqual(defaults.dependencies, []);
assert.deepEqual(defaults.assumptions, []);
assert.deepEqual(defaults.clarificationQuestions, []);
assert.deepEqual(defaults.clarificationAnswers, []);
assert.deepEqual(defaults.risks, []);
assert.equal(defaults.approved, false);
assert.equal(defaults.isApproved(), false);

const knowledge = new RequirementKnowledge({
    module: "  Khách hàng  ",
    purpose: "  Quản lý khách hàng  ",
    functions: ["  Thêm khách hàng  "],
    businessRules: ["  Mã khách hàng là duy nhất  "],
    validationRules: [{ content: "Email hợp lệ" }],
    permissions: ["  CUSTOMER_CREATE  "],
    dependencies: ["  CRM  ", "CRM"],
    assumptions: ["  Người dùng đã đăng nhập  "],
    clarificationQuestions: [{ id: "CL001", question: "Có cho phép trùng email?" }],
    clarificationAnswers: [{ questionId: "CL001", answer: "Không" }],
    risks: [{ content: "Trùng dữ liệu" }],
    approved: false
});

assert.equal(knowledge.module.name, "Khách hàng");
assert.equal(knowledge.purpose, "Quản lý khách hàng");
assert.equal(knowledge.functions[0].name, "Thêm khách hàng");
assert.deepEqual(knowledge.businessRules, ["Mã khách hàng là duy nhất"]);
assert.deepEqual(knowledge.validationRules, [{ content: "Email hợp lệ" }]);
assert.deepEqual(knowledge.permissions, ["CUSTOMER_CREATE"]);
assert.deepEqual(knowledge.dependencies, ["CRM"]);
assert.deepEqual(knowledge.assumptions, ["Người dùng đã đăng nhập"]);
assert.equal(knowledge.clarificationQuestions[0].id, "CL001");
assert.equal(knowledge.clarificationAnswers[0].answer, "Không");
assert.equal(knowledge.risks[0].content, "Trùng dữ liệu");

assert.strictEqual(knowledge.clarificationQuestions, knowledge.questions);
assert.strictEqual(knowledge.risks, knowledge.riskAreas);

assert.strictEqual(knowledge.approve(), knowledge);
assert.equal(knowledge.isApproved(), true);

const json = knowledge.toJSON();
assert.equal(json.approved, true);
assert.deepEqual(json.dependencies, ["CRM"]);
assert.deepEqual(json.clarificationQuestions, json.questions);
assert.deepEqual(json.risks, json.riskAreas);

json.dependencies.push("Changed");
json.risks[0].content = "Changed";
assert.deepEqual(knowledge.dependencies, ["CRM"]);
assert.equal(knowledge.risks[0].content, "Trùng dữ liệu");

assert.strictEqual(knowledge.reset(), knowledge);
assert.equal(knowledge.module, null);
assert.equal(knowledge.purpose, "");
assert.deepEqual(knowledge.functions, []);
assert.deepEqual(knowledge.businessRules, []);
assert.deepEqual(knowledge.validationRules, []);
assert.deepEqual(knowledge.permissions, []);
assert.deepEqual(knowledge.dependencies, []);
assert.deepEqual(knowledge.assumptions, []);
assert.deepEqual(knowledge.clarificationQuestions, []);
assert.deepEqual(knowledge.clarificationAnswers, []);
assert.deepEqual(knowledge.risks, []);
assert.equal(knowledge.isApproved(), false);
assert.strictEqual(knowledge.clarificationQuestions, knowledge.questions);
assert.strictEqual(knowledge.risks, knowledge.riskAreas);

console.log("RequirementKnowledge model test: PASS");
