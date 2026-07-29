import assert from "node:assert/strict";
import RequirementKnowledgeMapper from "../src/mappers/RequirementKnowledgeMapper.js";
import RequirementKnowledge from "../src/models/RequirementKnowledge.js";

const mapper = new RequirementKnowledgeMapper();
const requirement = {
    module: {
        id: "MOD-CUSTOMER",
        name: "Khách hàng",
        purpose: "Quản lý khách hàng",
        requirementReferences: ["REQ-001"]
    },
    purpose: " Quản lý khách hàng ",
    features: [
        {
            id: "FUNC-CREATE",
            moduleId: "MOD-CUSTOMER",
            name: "Thêm khách hàng",
            businessRules: ["Mã khách hàng là duy nhất"],
            validationRules: [{ code: "VAL01", content: "Email đúng định dạng" }]
        }
    ],
    businessRules: [{ code: "BR01", content: "Mã khách hàng là duy nhất" }],
    permissions: ["CUSTOMER_CREATE"],
    dependencies: ["CRM"],
    assumptions: ["Người dùng đã đăng nhập"]
};
const aiAnalysis = {
    questions: [{ id: "CL001", question: "Có cho phép trùng email?" }],
    riskAreas: [{ code: "RISK01", content: "Trùng dữ liệu" }]
};
const approvedArtifact = {
    approvalStatus: "approved",
    detectedFunctions: [
        {
            id: "FUNC-CREATE",
            moduleId: "MOD-CUSTOMER",
            name: "Thêm khách hàng",
            description: "Tạo khách hàng mới"
        }
    ],
    validation: [{ code: "VAL02", content: "Tên khách hàng bắt buộc" }],
    questions: [
        {
            id: "CL002",
            question: "Email có bắt buộc không?",
            answer: "Có",
            status: "answered"
        }
    ],
    risks: [{ code: "RISK02", content: "Email không hợp lệ" }]
};

const originalRequirement = structuredClone(requirement);
const originalAnalysis = structuredClone(aiAnalysis);
const originalArtifact = structuredClone(approvedArtifact);

const result = mapper.map({
    requirement,
    aiAnalysis,
    clarificationQuestions: ["  Câu hỏi bổ sung?  ", "", null],
    clarificationAnswers: [{ questionId: "CL001", answer: "Không" }, undefined],
    approvedArtifact
});

assert.ok(result instanceof RequirementKnowledge);
assert.deepEqual(result.module, requirement.module);
assert.equal(result.purpose, "Quản lý khách hàng");
assert.equal(result.functions.length, 1);
assert.equal(result.functions[0].id, "FUNC-CREATE");
assert.equal(result.functions[0].name, "Thêm khách hàng");
assert.deepEqual(result.businessRules, requirement.businessRules);
assert.deepEqual(result.validationRules, [{ code: "VAL02", content: "Tên khách hàng bắt buộc" }]);
assert.deepEqual(result.permissions, ["CUSTOMER_CREATE"]);
assert.deepEqual(result.dependencies, ["CRM"]);
assert.deepEqual(result.assumptions, ["Người dùng đã đăng nhập"]);
assert.deepEqual(result.clarificationQuestions, [
    "Câu hỏi bổ sung?",
    approvedArtifact.questions[0],
    aiAnalysis.questions[0]
]);
assert.deepEqual(result.clarificationAnswers, [
    { questionId: "CL001", answer: "Không" },
    approvedArtifact.questions[0]
]);
assert.deepEqual(result.risks, [aiAnalysis.riskAreas[0]]);
assert.equal(result.isApproved(), true);

assert.deepEqual(requirement, originalRequirement);
assert.deepEqual(aiAnalysis, originalAnalysis);
assert.deepEqual(approvedArtifact, originalArtifact);
assert.notStrictEqual(result.module, requirement.module);
assert.notStrictEqual(result.functions, requirement.features);
assert.notStrictEqual(result.businessRules, requirement.businessRules);
assert.notStrictEqual(result.clarificationQuestions, approvedArtifact.questions);
assert.notStrictEqual(result.risks, approvedArtifact.risks);

requirement.businessRules[0].content = "Changed";
approvedArtifact.questions[0].question = "Changed";
aiAnalysis.riskAreas[0].content = "Changed";
assert.equal(result.businessRules[0].content, "Mã khách hàng là duy nhất");
assert.equal(result.clarificationQuestions[1].question, "Email có bắt buộc không?");
assert.equal(result.risks[0].content, "Trùng dữ liệu");

const legacy = mapper.map({
    aiResult: {
        questions: ["Legacy question"],
        riskAreas: ["Legacy risk"]
    }
});
assert.deepEqual(legacy.clarificationQuestions, ["Legacy question"]);
assert.deepEqual(legacy.risks, ["Legacy risk"]);
assert.equal(legacy.isApproved(), false);

const canonicalArtifact = mapper.map({
    approvedArtifact: {
        approvalStatus: "approved",
        requirement: {
            module: { id: "MOD-CUSTOMER", name: "Khách hàng" },
            purpose: "Parsed purpose must not win",
            features: [{ name: "Parsed function must not win" }]
        },
        aiAnalysis: {
            purpose: "Reviewed AI purpose",
            functions: [
                {
                    name: "Tạo khách hàng",
                    description: "Tạo mới",
                    businessRules: ["Mã là duy nhất"],
                    validationRules: ["Email hợp lệ"],
                    permissions: ["Có quyền tạo"],
                    dependencies: ["Danh mục khu vực"],
                    assumptions: ["Khách hàng chưa tồn tại"],
                    requirementReferences: ["BR01"]
                }
            ],
            risks: ["Trùng khách hàng"],
            clarificationQuestions: ["AI question"],
            suggestedScenarios: [{ title: "Must be ignored" }]
        },
        questions: [{ id: "CL001", question: "Reviewed question", answer: "Có" }]
    }
});
assert.equal(canonicalArtifact.purpose, "Reviewed AI purpose");
assert.equal(canonicalArtifact.functions[0].name, "Tạo khách hàng");
assert.deepEqual(canonicalArtifact.businessRules, ["Mã là duy nhất"]);
assert.deepEqual(canonicalArtifact.validationRules, ["Email hợp lệ"]);
assert.deepEqual(canonicalArtifact.permissions, ["Có quyền tạo"]);
assert.deepEqual(canonicalArtifact.dependencies, ["Danh mục khu vực"]);
assert.deepEqual(canonicalArtifact.assumptions, ["Khách hàng chưa tồn tại"]);
assert.deepEqual(canonicalArtifact.risks, ["Trùng khách hàng"]);
assert.equal(canonicalArtifact.suggestedScenarios.length, 0);
assert.equal(canonicalArtifact.isApproved(), true);

const explicitNotApproved = mapper.map({
    approvedArtifact: {
        approvalStatus: "pending",
        approved: false
    }
});
assert.equal(explicitNotApproved.isApproved(), false);

const empty = mapper.map();
assert.ok(empty instanceof RequirementKnowledge);
assert.equal(empty.module, null);
assert.deepEqual(empty.functions, []);
assert.deepEqual(empty.clarificationQuestions, []);
assert.equal(empty.isApproved(), false);

console.log("RequirementKnowledgeMapper test: PASS");
