import assert from "node:assert/strict";
import RequirementKnowledgeMapper from "../src/mappers/RequirementKnowledgeMapper.js";

const mapper = new RequirementKnowledgeMapper();
const knowledge = mapper.map({
    approvedArtifact: {
        approvalStatus: "approved",
        questions: [
            {
                questionId: "CL001",
                category: "Business Rule",
                question: "Mã đơn vị tính có bắt buộc phải duy nhất trong hệ thống không?",
                targetField: "Mã đơn vị tính",
                answer: "Có",
                status: "answered"
            },
            {
                questionId: "CL002",
                category: "Business Rule",
                question: "Có được phép xóa đơn vị tính đang được sử dụng không?",
                answer: "Không",
                status: "answered"
            },
            {
                questionId: "CL003",
                category: "Validation",
                question: "Tên đơn vị tính có được phép trùng lặp không?",
                answer: "Có",
                status: "answered"
            },
            {
                questionId: "CL004",
                category: "Permission",
                question: "Những vai trò nào được quyền thực hiện thêm, sửa, xóa?",
                answer: "Quản trị",
                status: "answered"
            }
        ]
    }
});

assert.ok(knowledge.businessRules.includes("Mã đơn vị tính phải là duy nhất trong hệ thống"));
assert.ok(knowledge.businessRules.includes("Không được phép xóa bản ghi đang được sử dụng"));
assert.ok(knowledge.validationRules.includes("Tên được phép trùng lặp"));
assert.ok(knowledge.permissions.includes("Chỉ Quản trị được quyền thực hiện thêm, sửa, xóa"));
assert.equal(
    knowledge.businessRules.includes("Có"),
    false,
    "không được lưu trần 'Có' thành rule"
);
assert.equal(knowledge.businessRules.includes("Không"), false);

console.log("Clarification yes/no fact test: PASS");
