import assert from "node:assert/strict";
import {
    buildTestCaseBatchPayload,
    canApproveTestCaseBatch,
    groupTestCases,
    parseTestCaseReview,
    testCaseWarnings
} from "../src/utils/testCaseReview.js";

const baseCase = {
    id: "TC001",
    testcaseId: "TC001",
    module: "Thiết bị",
    function: "Thêm thiết bị",
    type: "VALIDATION",
    title: "Mã thiết bị bắt buộc",
    expectedResult: "Không lưu dữ liệu",
    testData: { requirement: "Để trống Mã thiết bị", value: "" },
    executionReadiness: "DATA_REQUIRED",
    hiddenMetadata: { keep: true }
};
const review = parseTestCaseReview({
    workflowId: "SESSION-001",
    artifactId: "ART-001",
    approvalStatus: "pending",
    testCases: [baseCase],
    allowedActions: ["UPDATE_TEST_CASES", "APPROVE_TEST_CASES"]
});

assert.equal(review.testCases.length, 1);
assert.equal(review.testCases[0].executionReadiness, "DATA_REQUIRED");
assert.equal(groupTestCases(review.testCases)["Thiết bị"]["Thêm thiết bị"].VALIDATION.length, 1);
assert.equal(
    canApproveTestCaseBatch({ review, dirty: true, pending: false, testCases: review.testCases }),
    false
);
assert.equal(
    canApproveTestCaseBatch({ review, dirty: false, pending: false, testCases: review.testCases }),
    true,
    "DATA_REQUIRED must not block approval under the production contract"
);
assert.equal(
    canApproveTestCaseBatch({
        review: { ...review, allowedActions: ["UPDATE_TEST_CASES"] },
        dirty: false,
        testCases: review.testCases
    }),
    false
);
assert.ok(testCaseWarnings(review.testCases[0]).some(item => item.includes("tester")));

const payload = buildTestCaseBatchPayload([
    { ...review.testCases[0], _uiKey: "local-only", _dirty: true }
]);
assert.equal("_uiKey" in payload[0], false);
assert.equal("_dirty" in payload[0], false);
assert.deepEqual(payload[0].hiddenMetadata, { keep: true });

assert.throws(
    () =>
        parseTestCaseReview({
            testCases: [{ title: "Missing ID" }],
            allowedActions: []
        }),
    /thiếu ID/
);
assert.throws(() => parseTestCaseReview(null), /không hợp lệ/);

console.log("TestCase Review frontend validation PASSED");
