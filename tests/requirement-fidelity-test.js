import assert from "node:assert/strict";
import TestDataFactory from "../src/factories/TestDataFactory.js";
import TestStepNormalizer from "../src/normalizers/TestStepNormalizer.js";
import IntelligenceScenarioGenerator from "../src/generators/IntelligenceScenarioGenerator.js";
import ExpectedResultBuilder from "../src/builders/ExpectedResultBuilder.js";
import ProductionTestCaseQualityGate from "../src/quality/ProductionTestCaseQualityGate.js";

const factory = new TestDataFactory();
const generated = factory.create({
    scenario: { feature: "Tạo hồ sơ", type: "POSITIVE" },
    inputDefinitions: [
        { name: "Mã hồ sơ", required: true, controlType: "TextBox" },
        {
            name: "Trạng thái",
            required: true,
            controlType: "Dropdown",
            options: ["Đang xử lý", "Hoàn tất"]
        }
    ]
});
assert.equal(generated.fields["Mã hồ sơ"].value, null);
assert.equal(generated.fields["Mã hồ sơ"].requiresTesterInput, true);
assert.match(generated.fields["Mã hồ sơ"].instruction, /theo requirement/);
assert.equal(generated.fields["Trạng thái"].value, "Đang xử lý");
assert.doesNotMatch(JSON.stringify(generated), /TB001|sample|mẫu|tester@example.com|0901234567/);

const explicit = factory.create({
    source: { inputs: { "Mã hồ sơ": "HS-REQUIREMENT-01" } },
    scenario: { feature: "Tạo hồ sơ", type: "POSITIVE" },
    inputDefinitions: [{ name: "Mã hồ sơ", required: true, controlType: "TextBox" }]
});
assert.equal(explicit.fields["Mã hồ sơ"].value, "HS-REQUIREMENT-01");

const steps = new TestStepNormalizer().normalize(
    [{ action: "Mở khu vực quản lý hồ sơ" }],
    { feature: "Tạo hồ sơ", operation: "CREATE" }
);
assert.deepEqual(steps.map(step => step.action), ["Mở khu vực quản lý hồ sơ"]);

const scenarios = new IntelligenceScenarioGenerator().generate(
    [
        {
            id: "SC001",
            module: "Hồ sơ",
            feature: "Xử lý hồ sơ",
            title: "Xử lý hồ sơ",
            type: "POSITIVE",
            requirementReferences: ["Xử lý hồ sơ"]
        }
    ],
    { module: "Hồ sơ", features: [] }
);
assert.deepEqual(scenarios[0].steps, []);
assert.deepEqual(scenarios[0].expectedResults, []);

const confirmedExpected = "Hồ sơ được chuyển sang trạng thái đã xác nhận.";
assert.equal(
    new ExpectedResultBuilder().build({
        testCase: { feature: "Xử lý hồ sơ", type: "POSITIVE" },
        scenario: {},
        testData: { fields: {} },
        existing: confirmedExpected
    }),
    confirmedExpected
);

const quality = new ProductionTestCaseQualityGate().apply(
    [
        {
            id: "TC001",
            module: "Hồ sơ",
            function: "Xử lý hồ sơ",
            feature: "Xử lý hồ sơ",
            title: "Xử lý hồ sơ",
            scenario: "Xử lý hồ sơ",
            type: "POSITIVE",
            requirementReferences: ["Xử lý hồ sơ"],
            businessRuleIds: ["BR01"],
            testData: generated,
            steps: [{ action: "Mở khu vực quản lý hồ sơ" }],
            expectedResult: confirmedExpected
        }
    ],
    {
        requirement: { module: "Hồ sơ", features: [{ name: "Xử lý hồ sơ" }] },
        knowledge: { module: { name: "Hồ sơ" }, functions: [{ name: "Xử lý hồ sơ" }] }
    }
);
assert.equal(quality.testCases.length, 0);
assert.equal(quality.summary.held[0].code, "MISSING_MAIN_ACTION");

console.log("Requirement fidelity test PASSED");
