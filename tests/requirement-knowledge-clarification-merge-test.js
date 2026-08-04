import assert from "node:assert/strict";
import RequirementKnowledgeMapper from "../src/mappers/RequirementKnowledgeMapper.js";
import RequirementKnowledge from "../src/models/RequirementKnowledge.js";

const mapper = new RequirementKnowledgeMapper();
const base = { artifactType: "AI_ANALYSIS_REVIEW", approvalStatus: "approved", questions: [] };

const approved = mapper.map({ approvedArtifact: { ...base, questions: [
    { questionId: "CQ-1", category: "Business Rule", status: "answered", answer: "Mã phải là duy nhất" },
    { questionId: "CQ-2", category: "General", status: "answered", answer: "Thông báo phải hiển thị rõ ràng" },
    { questionId: "CQ-3", category: "Other", status: "answered", answer: "Thông báo phải hiển thị rõ ràng" },
    { questionId: "CQ-4", category: "Validation", status: "pending", answer: "Không được để trống" },
    { questionId: "CQ-5", category: "Permission", status: "rejected", answer: "Cần quyền quản trị" }
] } });

assert.ok(approved instanceof RequirementKnowledge);
assert.deepEqual(approved.businessRules, ["Mã phải là duy nhất"]);
assert.deepEqual(approved.confirmedFacts, ["Thông báo phải hiển thị rõ ràng"]);
assert.deepEqual(approved.validationRules, []);
assert.deepEqual(approved.permissions, []);
assert.equal(typeof approved.businessRules[0], "string");
assert.equal(typeof approved.confirmedFacts[0], "string");
assert.deepEqual(approved.knowledgeSources.businessRules["mã phải là duy nhất"], [
    { sourceType: "CLARIFICATION", sourceId: "CQ-1" }
]);
assert.deepEqual(approved.knowledgeSources.confirmedFacts["thông báo phải hiển thị rõ ràng"], [
    { sourceType: "CLARIFICATION", sourceId: "CQ-2" },
    { sourceType: "CLARIFICATION", sourceId: "CQ-3" }
]);

const roundTrip = new RequirementKnowledge(JSON.parse(JSON.stringify(approved)));
assert.deepEqual(roundTrip.confirmedFacts, approved.confirmedFacts);
assert.deepEqual(roundTrip.knowledgeSources, approved.knowledgeSources);

const rejected = mapper.map({ approvedArtifact: { ...base, approvalStatus: "rejected", questions: [
    { questionId: "CQ-6", category: "General", status: "answered", answer: "Không được merge" }
] } });
assert.deepEqual(rejected.confirmedFacts, []);

console.log("RequirementKnowledge clarification merge test: PASS");
