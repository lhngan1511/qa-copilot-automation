import assert from "node:assert/strict";
import TestCaseGenerator from "../src/generators/TestCaseGenerator.js";

const generator = new TestCaseGenerator();
const baseScenario = {
    moduleId: "MOD001",
    module: "Khách hàng",
    functionId: "FUNC001",
    function: "Thêm khách hàng",
    feature: "Thêm khách hàng",
    preconditions: ["Người dùng đã đăng nhập", "Người dùng có quyền thêm khách hàng"],
    priority: "HIGH",
    severity: "HIGH",
    steps: [{ order: 1, action: "Existing step" }],
    requirementReferences: ["REQ001"]
};

const requiredScenario = {
    ...baseScenario,
    id: "SC-REQUIRED",
    title: "Kiểm tra các trường bắt buộc",
    type: "NEGATIVE",
    sourceItems: [
        { content: "Mã khách hàng không được để trống", source: "REQUIRED_VALIDATION" },
        { content: "Tên khách hàng không được để trống", source: "REQUIRED_VALIDATION" },
        { content: "Loại khách hàng không được để trống", source: "REQUIRED_VALIDATION" }
    ]
};

const requiredCases = generator.generate([requiredScenario]);
assert.equal(requiredCases.length, 3);
assert.equal(new Set(requiredCases.map(testCase => testCase.id)).size, 3);
assert.ok(requiredCases.every(testCase => testCase.scenarioId === "SC-REQUIRED"));
assert.ok(requiredCases.every(testCase => testCase.coveredRules.length === 1));
assert.deepEqual(
    requiredCases.map(testCase => testCase.sourceItem.fieldName),
    ["Mã khách hàng", "Tên khách hàng", "Loại khách hàng"]
);
assert.ok(
    requiredCases.every(testCase => {
        const field = testCase.sourceItem.fieldName;
        return (
            testCase.testData.fields[field].value === "" &&
            testCase.testData.fields[field].purpose === "EMPTY"
        );
    })
);
assert.ok(requiredCases.every(testCase => testCase.executionReadiness === "READY"));
assert.equal(new Set(requiredCases.map(testCase => testCase.expectedResult)).size, 3);

const businessRuleScenario = {
    ...baseScenario,
    id: "SC-BUSINESS",
    title: "Kiểm tra quy tắc nghiệp vụ",
    type: "DATA_INTEGRITY",
    sourceItems: [
        { content: "Mã khách hàng phải là duy nhất", source: "BUSINESS_RULE" },
        { content: "Loại khách hàng phải tồn tại", source: "BUSINESS_RULE" }
    ]
};

const businessRuleCases = generator.generate([businessRuleScenario]);
assert.equal(businessRuleCases.length, 2);
assert.deepEqual(
    businessRuleCases.map(testCase => testCase.coveredRules),
    [["Mã khách hàng phải là duy nhất"], ["Loại khách hàng phải tồn tại"]]
);
assert.ok(
    businessRuleCases.every(
        testCase =>
            Object.keys(testCase.testData.fields).length > 0 &&
            testCase.executionReadiness === "READY"
    )
);

const positiveCases = generator.generate([
    {
        ...baseScenario,
        id: "SC-POSITIVE",
        title: "Thêm khách hàng thành công",
        type: "POSITIVE",
        expectedResult: "Khách hàng được tạo",
        expectedResults: ["Khách hàng được tạo"],
        coveredRules: ["REQ001"]
    }
]);
assert.equal(positiveCases.length, 1);

const permissionCases = generator.generate([
    {
        ...baseScenario,
        id: "SC-PERMISSION",
        title: "Kiểm tra quyền thêm khách hàng",
        type: "PERMISSION",
        sourceItems: [
            {
                content: "Người dùng không có quyền thêm khách hàng",
                source: "PERMISSION"
            }
        ]
    }
]);
assert.equal(permissionCases.length, 1);
assert.equal(
    permissionCases[0].preconditions.some(
        value => /có quyền/i.test(value) && !/không có quyền/i.test(value)
    ),
    false
);
assert.equal(
    permissionCases[0].preconditions.some(value => /không có quyền/i.test(value)),
    true
);

const approvedScenarios = [
    {
        ...baseScenario,
        id: "SC-KEPT",
        title: "Scenario được giữ",
        type: "POSITIVE",
        expectedResult: "Scenario được giữ",
        coveredRules: ["REQ001"]
    },
    {
        ...baseScenario,
        id: "SC-USER",
        title: "Scenario do người dùng thêm",
        type: "POSITIVE",
        expectedResult: "Nội dung được người dùng duyệt",
        coveredRules: ["USER-EDIT-001"]
    }
];
const reviewCases = generator.generate(approvedScenarios);
assert.deepEqual(
    reviewCases.map(testCase => testCase.scenarioId),
    ["SC-KEPT", "SC-USER"]
);
assert.equal(
    reviewCases.some(testCase => testCase.scenarioId === "SC-DELETED"),
    false
);

console.log("TestCase atomic expansion test PASSED");
