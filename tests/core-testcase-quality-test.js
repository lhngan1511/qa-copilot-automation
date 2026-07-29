import assert from "node:assert/strict";

import RequirementKnowledge from "../src/models/RequirementKnowledge.js";
import ScenarioRecommendationEngine from "../src/recommenders/ScenarioRecommendationEngine.js";
import ScenarioEnrichmentEngine from "../src/engines/ScenarioEnrichmentEngine.js";
import IntelligenceScenarioGenerator from "../src/generators/IntelligenceScenarioGenerator.js";
import TestCaseGenerator from "../src/generators/TestCaseGenerator.js";
import SemanticTestCaseOverlapResolver from "../src/resolvers/SemanticTestCaseOverlapResolver.js";
import CoreTestCaseCoverageValidator from "../src/validators/CoreTestCaseCoverageValidator.js";

function generate({ withPermission = true, withBoundary = true } = {}) {
    const requirement = {
        module: "Quản lý hồ sơ",
        features: [
            {
                name: "Tạo hồ sơ",
                inputs: [
                    { name: "Mã hồ sơ", description: "Mã hồ sơ không được để trống" },
                    { name: "Tên hồ sơ", description: "Tên hồ sơ không được để trống" }
                ],
                preconditions: ["Người dùng đã đăng nhập"],
                expectedResults: ["Hồ sơ mới được lưu và hiển thị trong danh sách"]
            },
            {
                name: "Cập nhật hồ sơ",
                inputs: [{ name: "Ngày bắt đầu" }, { name: "Ngày kết thúc" }],
                expectedResults: ["Thông tin hồ sơ được cập nhật và hiển thị giá trị mới"]
            }
        ]
    };
    const knowledge = new RequirementKnowledge({
        module: { id: "MOD001", name: "Quản lý hồ sơ" },
        functions: [
            {
                id: "FUNC001",
                moduleId: "MOD001",
                name: "Tạo hồ sơ",
                businessRules: [
                    "BR01 Mã hồ sơ không được trùng",
                    ...(withPermission ? ["BR02 Người dùng phải có quyền tạo hồ sơ"] : [])
                ],
                validationRules: ["Mã hồ sơ không được để trống", "Tên hồ sơ không được để trống"],
                permissions: withPermission ? ["Người dùng phải có quyền tạo hồ sơ"] : [],
                boundaries: withBoundary ? ["Độ dài Mã hồ sơ tối thiểu 3 và tối đa 10 ký tự"] : [],
                requirementReferences: ["BR01", "BR02"]
            },
            {
                id: "FUNC002",
                moduleId: "MOD001",
                name: "Cập nhật hồ sơ",
                validationRules: ["Ngày bắt đầu <= Ngày kết thúc"],
                boundaries: withBoundary ? ["Ngày bắt đầu <= Ngày kết thúc"] : [],
                requirementReferences: ["VR03"]
            }
        ],
        approved: true
    });

    const recommender = new ScenarioRecommendationEngine();
    const recommended = recommender
        .generate(knowledge, requirement)
        .map(scenario => ({ ...scenario }));
    const enriched = new ScenarioEnrichmentEngine().enrich({
        scenarios: recommended,
        requirement,
        knowledge
    });
    const scenarios = new IntelligenceScenarioGenerator().generate(enriched, requirement);
    const generated = new TestCaseGenerator().generate(scenarios);
    const resolver = new SemanticTestCaseOverlapResolver();
    const testCases = resolver.resolve(generated, { approvedFunctions: knowledge.functions });

    return { knowledge, recommended, scenarios, generated, testCases, resolver };
}

const result = generate();

assert.deepEqual(
    [...new Set(result.testCases.map(item => item.module))],
    ["Quản lý hồ sơ"],
    "Module ownership must remain separate from function ownership."
);
assert.deepEqual(
    [...new Set(result.testCases.map(item => item.function))].sort(),
    ["Cập nhật hồ sơ", "Tạo hồ sơ"].sort()
);

for (const functionName of ["Tạo hồ sơ", "Cập nhật hồ sơ"]) {
    const positive = result.testCases.find(
        item => item.function === functionName && item.type === "POSITIVE"
    );
    assert.ok(positive, `${functionName} must have a positive testcase.`);
    assert.ok(positive.expectedResult.includes("được"), "Positive result must be observable.");
}

const required = result.testCases.find(
    item =>
        item.ruleClassification === "REQUIRED" && item.testData?.requirement?.includes("Mã hồ sơ")
);
assert.ok(required, "Required validation must identify the field and its concrete invalid value.");
assert.equal(required.testData.value, "");

const duplicate = result.testCases.find(item => item.ruleClassification === "DUPLICATE");
assert.match(
    duplicate?.testData?.requirement ?? "",
    /đã tồn tại/,
    "Unique rule must describe the existing-value requirement."
);

const permissions = result.testCases.filter(item => item.type === "PERMISSION");
assert.equal(permissions.length, 1, "Permission evidence must not create duplicate rule types.");
assert.ok(
    permissions[0].requirementReferences.length > 0,
    "Permission testcase must retain traceability."
);

const boundaries = result.testCases.filter(item => item.type === "BOUNDARY");
assert.equal(
    boundaries.length,
    7,
    "Numeric range and date relationship must produce boundary sets."
);
assert.deepEqual(
    boundaries.filter(item => item.function === "Tạo hồ sơ").map(item => item.testData.requirement),
    [
        "Nhập giá trị nhỏ hơn min một đơn vị theo giới hạn: Độ dài Mã hồ sơ tối thiểu 3 và tối đa 10 ký tự",
        "Nhập giá trị bằng min theo giới hạn: Độ dài Mã hồ sơ tối thiểu 3 và tối đa 10 ký tự",
        "Nhập giá trị bằng max theo giới hạn: Độ dài Mã hồ sơ tối thiểu 3 và tối đa 10 ký tự",
        "Nhập giá trị lớn hơn max một đơn vị theo giới hạn: Độ dài Mã hồ sơ tối thiểu 3 và tối đa 10 ký tự"
    ]
);

const noEvidence = generate({ withPermission: false, withBoundary: false });
assert.equal(
    noEvidence.testCases.filter(item => item.type === "PERMISSION").length,
    0,
    "Login precondition alone must not create permission cases."
);
assert.equal(
    noEvidence.testCases.filter(item => item.type === "BOUNDARY").length,
    0,
    "Field types without explicit limits must not create boundary cases."
);

const coverage = new CoreTestCaseCoverageValidator().validate(result.knowledge, result.testCases);
assert.equal(coverage.uncoveredRuleCount, 0);
assert.equal(coverage.boundaryWithoutEvidence.length, 0);

const uncovered = new CoreTestCaseCoverageValidator().validate(result.knowledge, []);
assert.ok(uncovered.uncoveredRuleCount > 0, "Uncovered approved rules must be reported.");

assert.equal(
    result.testCases.some(
        item =>
            item.type === "DATA_INTEGRITY" && /quyền tạo hồ sơ/i.test(item.sourceItem?.text ?? "")
    ),
    false,
    "Permission rules must not also be emitted as business-rule testcases."
);

console.log("Core TestCase Quality: PASS");
