import assert from "node:assert/strict";
import TestCaseGenerator from "../src/generators/TestCaseGenerator.js";

const generator = new TestCaseGenerator();
const createCase = generator.generate([
    {
        id: "SC-CREATE",
        module: "Thiết bị",
        feature: "Thêm thiết bị",
        title: "Thêm mới thiết bị thành công với dữ liệu hợp lệ",
        type: "POSITIVE",
        inputDefinitions: [
            { name: "Mã thiết bị", required: true, controlType: "TextBox" },
            { name: "Tên thiết bị", required: true, controlType: "TextBox" },
            { name: "Trạng thái", required: true, controlType: "TextBox" }
        ],
        clarificationAnswers: [
            {
                targetField: "Trạng thái",
                question: "Trạng thái mặc định là gì?",
                answer: "Hoạt động"
            }
        ],
        testData: {},
        steps: [
            { action: "Mở chức năng Thêm thiết bị", target: "Thêm thiết bị" },
            { action: "Thực hiện Thêm thiết bị" }
        ]
    }
])[0];

assert.equal(createCase.testData.fields["Mã thiết bị"].value, "TB001");
assert.equal(createCase.testData.fields["Tên thiết bị"].value, "Máy in văn phòng");
assert.equal(createCase.testData.fields["Trạng thái"].value, "Hoạt động");
assert.ok(createCase.steps.some(step => step.action === "Nhập Mã thiết bị là TB001"));
assert.ok(createCase.steps.some(step => step.action === "Nhập Tên thiết bị là Máy in văn phòng"));
assert.ok(createCase.steps.some(step => step.action === "Nhập Trạng thái là Hoạt động"));
assert.match(createCase.expectedResult, /Mã thiết bị TB001/);

const boundaryCase = generator.generate([
    {
        id: "SC-BOUNDARY",
        module: "Thiết bị",
        feature: "Thêm thiết bị",
        title: "Tên thiết bị vượt quá giới hạn",
        type: "BOUNDARY",
        ruleClassification: "BOUNDARY_CONCRETE",
        sourceItem: {
            fieldName: "Tên thiết bị",
            boundaryCase: "MAX_PLUS_ONE",
            content: "Tên thiết bị có giới hạn được tester xác nhận"
        },
        inputDefinitions: [{ name: "Tên thiết bị", required: true, controlType: "TextBox" }],
        clarificationAnswers: [
            {
                targetField: "Tên thiết bị",
                question: "Độ dài tối đa của Tên thiết bị là bao nhiêu ký tự?",
                answer: "20"
            },
            {
                targetField: "Tên thiết bị",
                question: "Tên mặc định là gì?",
                answer: "Requirement không đề cập"
            }
        ],
        testData: {},
        steps: [
            { action: "Mở chức năng Thêm thiết bị" },
            { action: "Nhập giá trị tại điểm biên", target: "Tên thiết bị", value: 21 },
            { action: "Thực hiện Thêm thiết bị" }
        ]
    }
])[0];

assert.equal(boundaryCase.testData.fields["Tên thiết bị"].value.length, 21);
assert.equal(boundaryCase.testData.fields["Tên thiết bị"].purpose, "ABOVE_MAX");
assert.ok(boundaryCase.steps.some(step => /A{21}/.test(step.action)));
assert.match(boundaryCase.expectedResult, /không được vượt quá 20 ký tự/);
assert.doesNotMatch(boundaryCase.expectedResult, /Requirement không đề cập/);

console.log("Canonical testcase content integration test PASSED");
