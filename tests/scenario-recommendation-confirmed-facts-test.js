import assert from "node:assert/strict";
import RequirementKnowledge from "../src/models/RequirementKnowledge.js";
import ScenarioRecommendationEngine from "../src/recommenders/ScenarioRecommendationEngine.js";

const knowledge = new RequirementKnowledge({
    module: { id: "MOD001", name: "Generic Module" },
    functions: [{ id: "FUNC001", name: "Create record", description: "Create a record" }],
    confirmedFacts: ["The system shows the tester-confirmed result"],
    knowledgeSources: {
        confirmedFacts: {
            "the system shows the tester-confirmed result": [
                { sourceType: "CLARIFICATION", sourceId: "CQ-001" }
            ]
        }
    }
});
const scenarios = new ScenarioRecommendationEngine().generate(knowledge, {
    module: "Generic Module",
    features: [{ id: "FUNC001", name: "Create record", expectedResults: [] }]
});
assert.ok(scenarios.some(item => item.expectedResults.includes("The system shows the tester-confirmed result")));
assert.ok(scenarios.some(item => item.sourceReferences?.some(ref => ref.sourceId === "CQ-001")));

/*
 Semantic classification: each confirmed fact that is not covered by an
 existing scenario becomes its own business scenario with a concrete test
 type, never one generic group and never a raw fact as title.
 */
const loginKnowledge = new RequirementKnowledge({
    module: { id: "MOD001", name: "Đăng nhập" },
    functions: [
        { id: "FUNC001", name: "Đăng nhập", description: "Đăng nhập", expectedResults: [] }
    ],
    businessRules: [
        "Hiển thị lỗi và cho nhập lại",
        "5 lần"
    ],
    validationRules: ["Che dấu (masking)"],
    knowledgeSources: {
        businessRules: {
            "hiển thị lỗi và cho nhập lại": [
                { sourceType: "CLARIFICATION", sourceId: "CL001" }
            ],
            "5 lần": [{ sourceType: "CLARIFICATION", sourceId: "CL003" }]
        },
        validationRules: {
            "che dấu (masking)": [
                { sourceType: "CLARIFICATION", sourceId: "CL002" }
            ]
        }
    }
});
const loginScenarios = new ScenarioRecommendationEngine().generate(loginKnowledge, {
    module: "Đăng nhập",
    features: [{ id: "FUNC001", name: "Đăng nhập", expectedResults: [] }]
});
const confirmed = loginScenarios.filter(item =>
    (item.sourceReferences ?? []).some(ref => ref.sourceType === "CLARIFICATION")
);
assert.equal(confirmed.length, 3, "each confirmed fact must become its own scenario");
assert.ok(
    confirmed.some(item => item.type === "NEGATIVE"),
    "wrong-password fact should be a NEGATIVE business scenario"
);
assert.ok(
    confirmed.some(item => item.type === "VALIDATION" && /che dấu|masking/i.test(item.title)),
    "masking fact should be a VALIDATION business scenario"
);
assert.ok(
    confirmed.some(
        item => item.type === "BUSINESS_RULE" && /5 lần|giới hạn/i.test(item.title)
    ),
    "attempt-limit fact should be a BUSINESS_RULE business scenario"
);
assert.ok(
    confirmed.every(item => !/Kiểm tra hành vi đã được tester xác nhận/.test(item.title)),
    "no generic grouped title"
);

/*
 Confirmation-only answers (yes/no / N-A / not applicable / not mentioned)
 confirm the existing requirement without adding a business behaviour, so
 they must not produce confirmed-fact scenarios.
 */
const confirmOnlyKnowledge = new RequirementKnowledge({
    module: { id: "MOD001", name: "Đăng nhập" },
    functions: [
        { id: "FUNC001", name: "Đăng nhập", description: "Đăng nhập", expectedResults: [] }
    ],
    businessRules: ["Đúng", "Không", "Có", "Không áp dụng", "Requirement không đề cập", "N/A"],
    knowledgeSources: {
        businessRules: {
            "đúng": [{ sourceType: "CLARIFICATION", sourceId: "CL-Y1" }],
            "không": [{ sourceType: "CLARIFICATION", sourceId: "CL-N1" }],
            "có": [{ sourceType: "CLARIFICATION", sourceId: "CL-Y2" }],
            "không áp dụng": [{ sourceType: "CLARIFICATION", sourceId: "CL-NA1" }],
            "requirement không đề cập": [{ sourceType: "CLARIFICATION", sourceId: "CL-NM1" }],
            "n/a": [{ sourceType: "CLARIFICATION", sourceId: "CL-NA2" }]
        }
    }
});
const confirmOnlyScenarios = new ScenarioRecommendationEngine().generate(confirmOnlyKnowledge, {
    module: "Đăng nhập",
    features: [{ id: "FUNC001", name: "Đăng nhập", expectedResults: [] }]
});
const confirmOnlyConfirmed = confirmOnlyScenarios.filter(item =>
    (item.sourceReferences ?? []).some(ref => ref.sourceType === "CLARIFICATION")
);
assert.equal(
    confirmOnlyConfirmed.length,
    0,
    "confirmation-only answers must not generate confirmed-fact scenarios"
);
console.log("Scenario recommendation confirmed facts test: PASS");
