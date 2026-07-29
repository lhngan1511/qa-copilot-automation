import assert from "node:assert/strict";
import AIAnalysisEngine from "../src/engines/AIAnalysisEngine.js";

const requirement = {
    purpose: "Quản lý khách hàng",
    features: [
        {
            name: "Thêm khách hàng",
            description: "Tạo khách hàng mới",
            inputs: [{ name: "Email", description: "Email phải đúng định dạng" }],
            businessRules: [{ code: "BR01", content: "Mã khách hàng là duy nhất" }],
            preconditions: ["Người dùng có quyền thêm khách hàng"]
        }
    ],
    questions: ["Có cho phép trùng email không?"]
};

const canonicalProvider = {
    async generate() {
        return JSON.stringify({
            purpose: "Quản lý khách hàng",
            functions: [
                {
                    name: "Thêm khách hàng",
                    description: "Tạo khách hàng mới",
                    businessRules: ["Mã khách hàng là duy nhất"],
                    validationRules: ["Email phải đúng định dạng"],
                    permissions: ["Người dùng có quyền thêm khách hàng"],
                    dependencies: [],
                    assumptions: [],
                    requirementReferences: ["BR01"]
                }
            ],
            risks: ["Trùng mã khách hàng"],
            clarificationQuestions: [
                {
                    id: "CL001",
                    category: "Business Rule",
                    priority: "High",
                    question: "Có cho phép trùng email không?",
                    reason: "Xác định uniqueness.",
                    options: ["Có", "Không", "Chưa xác định"],
                    requirementReferences: ["BR01"]
                }
            ],
            requirementComplete: false
        });
    }
};

const canonical = await new AIAnalysisEngine(canonicalProvider).analyze(requirement);
assert.equal(canonical.analysisStatus, "SUCCESS");
assert.equal(canonical.analysisSource, "ai");
assert.equal(canonical.purpose, "Quản lý khách hàng");
assert.equal(canonical.functions.length, 1);
assert.deepEqual(canonical.risks, ["Trùng mã khách hàng"]);
assert.equal(canonical.clarificationQuestions[0].id, "CL001");
assert.deepEqual(canonical.clarificationQuestions[0].requirementReferences, ["BR01"]);
assert.equal(Object.hasOwn(canonical, "suggestedScenarios"), false);
assert.equal(Object.hasOwn(canonical, "featureUnderstanding"), false);
assert.equal(Object.hasOwn(canonical, "testFocus"), false);

const legacyProvider = {
    async generate() {
        return JSON.stringify({
            riskAreas: ["Legacy risk"],
            questions: ["Legacy question"],
            suggestedScenarios: [{ title: "Ignored scenario" }]
        });
    }
};
const legacy = await new AIAnalysisEngine(legacyProvider).analyze(requirement);
assert.deepEqual(legacy.risks, ["Legacy risk"]);
assert.equal(legacy.clarificationQuestions[0].question, "Legacy question");
assert.equal(Object.hasOwn(legacy, "suggestedScenarios"), false);

const failingProvider = {
    async generate() {
        throw new Error("Provider unavailable");
    }
};
const fallback = await new AIAnalysisEngine(failingProvider).analyze(requirement);
assert.equal(fallback.analysisStatus, "FALLBACK");
assert.equal(fallback.analysisSource, "rule-engine");
assert.equal(fallback.functions.length, 1);
assert.deepEqual(fallback.functions[0].businessRules, ["BR01: Mã khách hàng là duy nhất"]);
assert.deepEqual(fallback.functions[0].permissions, ["Người dùng có quyền thêm khách hàng"]);
assert.deepEqual(fallback.functions[0].dependencies, []);
assert.equal(Object.hasOwn(fallback, "suggestedScenarios"), false);

const noEvidenceFallback = new AIAnalysisEngine(failingProvider).fallbackAnalysis({
    purpose: "Tra cứu dữ liệu",
    features: [{ name: "Tra cứu", description: "Hiển thị dữ liệu" }]
});
assert.deepEqual(noEvidenceFallback.functions[0].permissions, []);
assert.deepEqual(noEvidenceFallback.functions[0].dependencies, []);
assert.equal(Object.hasOwn(noEvidenceFallback, "suggestedScenarios"), false);

console.log("AI Requirement Knowledge contract test PASSED");
