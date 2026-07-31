import assert from "node:assert/strict";
import TestDataFactory from "../src/factories/TestDataFactory.js";

const factory = new TestDataFactory();
const deviceInputs = [
    { name: "Mã thiết bị", required: true, controlType: "TextBox" },
    { name: "Tên thiết bị", required: true, controlType: "TextBox" },
    {
        name: "Loại thiết bị",
        required: true,
        controlType: "Dropdown",
        options: ["Máy in", "Máy quét"]
    },
    { name: "Số lượng", required: true, controlType: "Number" }
];

const positive = factory.create({
    scenario: { feature: "Thêm thiết bị", type: "POSITIVE" },
    inputDefinitions: deviceInputs
});
assert.deepEqual(positive.fields, {
    "Mã thiết bị": { value: "TB001", purpose: "VALID" },
    "Tên thiết bị": { value: "Máy in văn phòng", purpose: "VALID" },
    "Loại thiết bị": { value: "Máy in", purpose: "VALID" },
    "Số lượng": { value: 10, purpose: "VALID" }
});

const required = factory.create({
    source: { inputs: { "Mã thiết bị": "TB001" }, invalid: { "Tên thiết bị": "" } },
    scenario: {
        feature: "Thêm thiết bị",
        type: "NEGATIVE",
        ruleClassification: "REQUIRED",
        sourceItem: { fieldName: "Tên thiết bị" }
    },
    inputDefinitions: deviceInputs
});
assert.equal(required.fields["Tên thiết bị"].value, "");
assert.equal(required.fields["Tên thiết bị"].purpose, "EMPTY");
assert.equal(required.fields["Mã thiết bị"].value, "TB001");

const duplicate = factory.create({
    source: { invalid: { "Mã thiết bị": "TB001" } },
    scenario: {
        feature: "Thêm thiết bị",
        ruleClassification: "DUPLICATE",
        sourceItem: { fieldName: "Mã thiết bị" }
    },
    inputDefinitions: deviceInputs
});
assert.equal(duplicate.fields["Mã thiết bị"].purpose, "DUPLICATE");
assert.equal(duplicate.fields["Mã thiết bị"].value, "TB001");
assert.equal(duplicate.dataState, "TB001 đã tồn tại");

const update = factory.create({
    scenario: { feature: "Sửa thiết bị", type: "POSITIVE" },
    inputDefinitions: deviceInputs
});
assert.equal(update.existing["Mã thiết bị"], "TB001");
assert.equal(update.updated["Tên thiết bị"], "Máy in tầng 2");
assert.equal(update.fields["Tên thiết bị"].purpose, "UPDATED_VALUE");

const deleteRestriction = factory.create({
    source: { inputs: { "Mã thiết bị": "TB001" }, expected: { entityState: "IN_USE" } },
    scenario: {
        feature: "Xóa thiết bị",
        ruleClassification: "STATE_RESTRICTION",
        sourceItem: { content: "Thiết bị đang được sử dụng" }
    },
    inputDefinitions: deviceInputs
});
assert.equal(deleteRestriction.record, "TB001");
assert.match(deleteRestriction.recordState, /đang được sử dụng/i);

const search = factory.create({
    source: { inputs: { "Mã thiết bị": "TB001" } },
    scenario: {
        feature: "Tìm kiếm thiết bị",
        ruleClassification: "SEARCH_SINGLE",
        sourceItem: { fieldName: "Mã thiết bị" }
    },
    inputDefinitions: deviceInputs
});
assert.equal(search.fields["Mã thiết bị"].purpose, "SEARCH_CRITERIA");
assert.equal(search.fields["Mã thiết bị"].value, "TB001");

const textBoundary = factory.create({
    source: { invalid: { "Tên thiết bị": 51 } },
    scenario: {
        feature: "Thêm thiết bị",
        ruleClassification: "BOUNDARY_CONCRETE",
        sourceItem: {
            fieldName: "Tên thiết bị",
            boundaryCase: "MAX_PLUS_ONE",
            boundaryValue: 51,
            content: "Tên thiết bị tối đa 50 ký tự"
        }
    },
    inputDefinitions: deviceInputs
});
assert.equal(textBoundary.fields["Tên thiết bị"].purpose, "ABOVE_MAX");
assert.equal(textBoundary.fields["Tên thiết bị"].value.length, 51);

const numericBoundary = factory.create({
    source: { invalid: { "Số lượng": 11 } },
    scenario: {
        feature: "Thêm thiết bị",
        ruleClassification: "BOUNDARY_CONCRETE",
        sourceItem: {
            fieldName: "Số lượng",
            boundaryCase: "MAX_PLUS_ONE",
            boundaryValue: 11,
            content: "Số lượng tối đa 10"
        }
    },
    inputDefinitions: deviceInputs
});
assert.equal(numericBoundary.fields["Số lượng"].value, 11);

const clarificationBoundary = factory.create({
    scenario: {
        feature: "Thêm thiết bị",
        ruleClassification: "BOUNDARY_CONCRETE",
        sourceItem: { fieldName: "Tên thiết bị", boundaryCase: "MAX" }
    },
    inputDefinitions: deviceInputs,
    clarificationAnswers: [
        {
            targetField: "Tên thiết bị",
            question: "Độ dài tối đa của Tên thiết bị là bao nhiêu ký tự?",
            answer: "20"
        }
    ]
});
assert.equal(clarificationBoundary.fields["Tên thiết bị"].value.length, 20);

const dateBoundary = factory.create({
    scenario: {
        feature: "Tìm kiếm thiết bị",
        ruleClassification: "BOUNDARY_CONCRETE",
        sourceItem: { fieldName: "Ngày bắt đầu", boundaryCase: "MAX_PLUS_ONE" }
    },
    inputDefinitions: [{ name: "Ngày bắt đầu", required: true, controlType: "Date" }],
    clarificationAnswers: [
        {
            targetField: "Ngày bắt đầu",
            question: "Ngày tối đa là ngày nào?",
            answer: "01/08/2026"
        }
    ]
});
assert.equal(dateBoundary.fields["Ngày bắt đầu"].value, "02/08/2026");

const defaultStatus = factory.create({
    scenario: { feature: "Thêm thiết bị", type: "POSITIVE" },
    inputDefinitions: [{ name: "Trạng thái", required: true, controlType: "TextBox" }],
    clarificationAnswers: [
        { targetField: "Trạng thái", question: "Trạng thái mặc định là gì?", answer: "Hoạt động" },
        {
            targetField: "Tên thiết bị",
            question: "Tên mặc định là gì?",
            answer: "Requirement không đề cập"
        }
    ]
});
assert.equal(defaultStatus.fields["Trạng thái"].value, "Hoạt động");

const unknownSelect = factory.create({
    scenario: { feature: "Thêm thiết bị", type: "POSITIVE" },
    inputDefinitions: [{ name: "Loại thiết bị", required: true, controlType: "Dropdown" }]
});
assert.equal(unknownSelect.fields["Loại thiết bị"].value, null);
assert.equal(unknownSelect.fields["Loại thiết bị"].requiresTesterInput, true);
assert.match(unknownSelect.fields["Loại thiết bị"].instruction, /Chọn một Loại thiết bị hợp lệ/);
assert.equal(unknownSelect.requiresTesterInput, true);

const manual = factory.normalizeLegacy({
    fields: { "Mã thiết bị": { value: "CUSTOM-01", purpose: "VALID" } },
    requirement: "",
    value: "",
    requiresTesterInput: false
});
assert.equal(manual.fields["Mã thiết bị"].value, "CUSTOM-01");

const legacyObject = factory.normalizeLegacy(
    { "Mã thiết bị": "LEGACY-01" },
    {
        feature: "Thêm thiết bị",
        inputDefinitions: [{ name: "Mã thiết bị", required: true, controlType: "TextBox" }]
    }
);
assert.equal(legacyObject.fields["Mã thiết bị"].value, "LEGACY-01");
const legacyArray = factory.normalizeLegacy([{ field: "Email", value: "manual@example.com" }]);
assert.equal(legacyArray.fields.Email.value, "manual@example.com");

console.log("Test data factory test PASSED");
