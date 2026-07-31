import assert from "node:assert/strict";
import ProductionTestCaseQualityGate from "../src/quality/ProductionTestCaseQualityGate.js";

const requirement = {
    module: "Hồ sơ",
    features: [
        {
            name: "Tạo hồ sơ",
            description: "Cho phép tạo hồ sơ.",
            businessRules: ["Mã hồ sơ phải duy nhất."],
            validationRules: ["Tên hồ sơ không được để trống."]
        },
        {
            name: "Cập nhật hồ sơ",
            description: "Cho phép cập nhật hồ sơ."
        }
    ]
};
const knowledge = {
    module: { name: "Hồ sơ" },
    functions: [
        { name: "Tạo hồ sơ", permissions: [] },
        { name: "Cập nhật hồ sơ", permissions: [] }
    ]
};
const base = {
    id: "TC001",
    testcaseId: "TC001",
    module: "Hồ sơ",
    function: "Tạo hồ sơ",
    feature: "Tạo hồ sơ",
    title: "BR01: Tạo hồ sơ với dữ liệu hợp lệ",
    scenario: "BR01: Tạo hồ sơ với dữ liệu hợp lệ",
    type: "POSITIVE",
    ruleClassification: "",
    sourceItem: { content: "Cho phép tạo hồ sơ.", source: "BUSINESS_RULE" },
    requirementReferences: ["Tạo hồ sơ"],
    coveredRules: [],
    businessRuleIds: ["BR01"],
    testData: {
        fields: { "Tên hồ sơ": { value: "Hồ sơ mẫu", purpose: "VALID" } },
        requirement: "",
        value: "",
        requiresTesterInput: false
    },
    steps: [
        { order: 1, action: "Mở chức năng Tạo hồ sơ" },
        { order: 2, action: "Lưu thông tin hồ sơ" }
    ],
    expectedResult: "Hệ thống tạo hồ sơ thành công."
};
const duplicate = { ...structuredClone(base), id: "TC002", testcaseId: "TC002" };
const conflict = {
    ...structuredClone(base),
    id: "TC003",
    testcaseId: "TC003",
    function: "Cập nhật hồ sơ",
    feature: "Cập nhật hồ sơ",
    title: "Để trống Tên hồ sơ",
    scenario: "Để trống Tên hồ sơ",
    type: "DATA_INTEGRITY",
    ruleClassification: "REQUIRED",
    sourceItem: {
        content: "Tên hồ sơ không được để trống.",
        source: "REQUIRED_VALIDATION",
        fieldName: "Tên hồ sơ"
    },
    testData: {
        fields: {
            "Tên hồ sơ": { value: "Hồ sơ mẫu", purpose: "VALID" },
            "tên hồ sơ": { value: "", purpose: "EMPTY" }
        }
    },
    steps: [
        { action: "Mở chức năng Cập nhật hồ sơ" },
        { action: "Để trống Tên hồ sơ" },
        { action: "Lưu thông tin hồ sơ" }
    ],
    expectedResult: "Hệ thống không cho phép hoàn tất cập nhật hồ sơ. Trường Tên hồ sơ được đánh dấu bắt buộc."
};
const unsupportedPermission = {
    ...structuredClone(base),
    id: "TC004",
    testcaseId: "TC004",
    type: "PERMISSION",
    ruleClassification: "PERMISSION_DENIED",
    sourceItem: { content: "Cho phép tạo hồ sơ.", source: "BUSINESS_RULE" },
    expectedResult: "Hệ thống từ chối thao tác."
};
const unsupportedBoundary = {
    ...structuredClone(base),
    id: "TC005",
    testcaseId: "TC005",
    type: "BOUNDARY",
    ruleClassification: "BOUNDARY_UNKNOWN",
    sourceItem: { content: "Tên hồ sơ có giới hạn theo hệ thống.", source: "BOUNDARY" },
    needsClarification: true
};
const vague = {
    ...structuredClone(base),
    id: "TC006",
    testcaseId: "TC006",
    steps: [{ action: "Thực hiện chức năng" }]
};

const gate = new ProductionTestCaseQualityGate();
const result = gate.apply(
    [base, duplicate, conflict, unsupportedPermission, unsupportedBoundary, vague],
    { requirement, knowledge }
);

assert.equal(result.summary.generatedCount, 6);
assert.equal(result.testCases.length, 2);
assert.equal(result.summary.excluded.some(item => item.code === "DUPLICATE_TESTCASE"), true);
assert.equal(result.summary.excluded.some(item => item.code === "UNSUPPORTED_PERMISSION"), true);
assert.equal(result.summary.excluded.some(item => item.code === "TESTER_INFORMATION_REQUIRED"), true);
assert.equal(result.summary.excluded.some(item => item.code === "VAGUE_STEPS"), true);
assert.equal(result.testCases[0].title, "Tạo hồ sơ với dữ liệu hợp lệ");
assert.deepEqual(result.testCases[0].businessRuleIds, ["BR01"]);
assert.equal(result.testCases[1].type, "VALIDATION");
assert.deepEqual(Object.keys(result.testCases[1].testData.fields), ["Tên hồ sơ"]);
assert.equal(result.testCases[1].testData.fields["Tên hồ sơ"].purpose, "EMPTY");
assert.equal(
    JSON.stringify(
        result.testCases.map(testCase => ({
            title: testCase.title,
            scenario: testCase.scenario,
            steps: testCase.steps,
            expectedResult: testCase.expectedResult
        }))
    ).includes("BR01"),
    false
);
assert.deepEqual(
    result.testCases.map(testCase => testCase.id),
    ["TC001", "TC002"]
);

console.log("Production testcase quality gate test PASSED");
