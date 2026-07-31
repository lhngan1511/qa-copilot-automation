import assert from "node:assert/strict";
import TestCaseReviewValidator from "../src/validators/TestCaseReviewValidator.js";

const validator = new TestCaseReviewValidator();
const base = validator.normalize({
    id: "TC001",
    module: "Thiết bị",
    feature: "Thêm thiết bị",
    scenario: "Thêm thiết bị hợp lệ",
    type: "POSITIVE",
    testData: { requirement: "Mã duy nhất", value: "TB001" },
    steps: [{ action: "Mở chức năng" }, { action: "Thêm thiết bị" }],
    expectedResult: "Thiết bị được tạo"
});

assert.equal(base.reviewStatus, "PENDING");
assert.equal(validator.validateBatch([base]), true);
assert.throws(
    () => validator.validateBatch([{ ...base, steps: [] }]),
    error => error.code === "INVALID_TEST_STEPS"
);
assert.throws(
    () => validator.validateBatch([{ ...base, reviewStatus: "REJECTED" }]),
    error => error.code === "INVALID_TEST_CASE_REVIEW_STATUS"
);
assert.throws(
    () => validator.validateBatch([base], { requireResolved: true }),
    error => error.code === "TEST_CASE_REVIEW_UNRESOLVED"
);
assert.throws(
    () =>
        validator.validateBatch([{ ...base, reviewStatus: "NEEDS_CHANGES" }], {
            requireResolved: true
        }),
    error => error.code === "TEST_CASE_REVIEW_UNRESOLVED"
);
assert.throws(
    () =>
        validator.validateBatch([{ ...base, reviewStatus: "REMOVED" }], {
            requireResolved: true
        }),
    error => error.code === "NO_APPROVED_TEST_CASES"
);
assert.equal(
    validator.validateBatch(
        [
            { ...base, reviewStatus: "APPROVED" },
            { ...base, id: "TC002", testcaseId: "TC002", reviewStatus: "REMOVED" }
        ],
        { requireResolved: true }
    ),
    true
);

console.log("TestCase Review validator test PASSED");
