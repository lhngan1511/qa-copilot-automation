import assert from "node:assert/strict";
import TestStepNormalizer from "../src/normalizers/TestStepNormalizer.js";
import TestCaseReviewValidator from "../src/validators/TestCaseReviewValidator.js";

const scenario = {
    id: "SC006",
    module: "Thiết bị",
    feature: "Chức năng chưa xác định",
    title: "Ngoại lệ khi lưu dữ liệu",
    type: "EXCEPTION"
};
const generated = {
    id: "TC006",
    testcaseId: "TC006",
    module: scenario.module,
    feature: scenario.feature,
    scenario: scenario.title,
    type: scenario.type,
    preconditions: ["Người dùng đã đăng nhập."],
    testData: { fields: {}, requirement: "", value: "", requiresTesterInput: false },
    steps: [
        { order: 1, action: "Thiết lập điều kiện trước" },
        { order: 2, action: "Thực hiện lưu dữ liệu" },
        { order: 3, action: "Kiểm tra kết quả" }
    ],
    expectedResult: "Hệ thống không lưu dữ liệu.",
    reviewStatus: "PENDING"
};

const normalized = new TestStepNormalizer().normalize(generated.steps, {
    ...generated,
    preserveManualSteps: true
});
assert.deepEqual(
    normalized.map(step => step.action),
    ["Lưu thông tin chức năng chưa xác định"]
);

const persisted = new TestCaseReviewValidator().normalize(generated);
assert.equal(persisted.steps.length, 1);
assert.equal(persisted.steps[0].order, 1);
assert.doesNotThrow(() => new TestCaseReviewValidator().validateBatch([persisted]));

console.log("TC006 step lifecycle regression test PASSED");
