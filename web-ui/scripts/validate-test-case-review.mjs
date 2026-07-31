import assert from "node:assert/strict";
import {
    buildTestCaseBatchPayload,
    canApproveTestCaseBatch,
    filterTestCases,
    formatTestData,
    parseTestCaseReview,
    reviewCompletionMessage,
    summarizeReview,
    testCaseWarnings
} from "../src/utils/testCaseReview.js";

const baseCase = {
    id: "TC001",
    testcaseId: "TC001",
    module: "Thiết bị",
    feature: "Thêm thiết bị",
    scenario: "Mã thiết bị bắt buộc",
    type: "VALIDATION",
    expectedResult: "Không lưu dữ liệu",
    steps: [{ order: 1, action: "Mở chức năng", expected: "Màn hình hiển thị" }],
    testData: { requirement: "Để trống Mã thiết bị", value: "" },
    executionReadiness: "DATA_REQUIRED",
    reviewStatus: "PENDING",
    hiddenMetadata: { keep: true }
};
const review = parseTestCaseReview({
    workflowId: "SESSION-001",
    artifactId: "ART-001",
    approvalStatus: "pending",
    testCases: [
        baseCase,
        { ...baseCase, id: "TC002", testcaseId: "TC002", type: "POSITIVE", reviewStatus: "REMOVED" }
    ],
    allowedActions: ["UPDATE_TEST_CASES", "APPROVE_TEST_CASES"]
});

assert.equal(review.testCases[0].reviewStatus, "PENDING");
assert.equal(
    formatTestData({
        fields: {
            "Mã thiết bị": { value: "", purpose: "EMPTY" },
            "Tên thiết bị": { value: "Thiết bị mẫu", purpose: "VALID" }
        }
    }),
    "Mã thiết bị: Để trống (Để trống)\nTên thiết bị: Thiết bị mẫu (Hợp lệ)"
);
assert.doesNotMatch(formatTestData(review.testCases[0].testData), /VALID|EMPTY|DUPLICATE/);
assert.equal(summarizeReview(review.testCases).removed, 1);
assert.equal(filterTestCases(review.testCases, { type: "VALIDATION" }).length, 1);
assert.equal(filterTestCases(review.testCases, { search: "mã thiết bị" }).length, 2);
assert.equal(canApproveTestCaseBatch({ review, testCases: review.testCases }), false);

const casesByStatus = statuses =>
    statuses.map((reviewStatus, index) => ({
        ...baseCase,
        id: `TC00${index + 1}`,
        testcaseId: `TC00${index + 1}`,
        reviewStatus
    }));
const allApproved = casesByStatus(["APPROVED", "APPROVED", "APPROVED"]);
const approvedAndRemoved = casesByStatus(["APPROVED", "APPROVED", "REMOVED"]);
const pendingDecision = casesByStatus(["APPROVED", "REMOVED", "PENDING"]);
const allRemoved = casesByStatus(["REMOVED", "REMOVED", "REMOVED"]);

assert.equal(canApproveTestCaseBatch({ review, testCases: allApproved }), true);
assert.equal(canApproveTestCaseBatch({ review, testCases: approvedAndRemoved }), true);
assert.equal(canApproveTestCaseBatch({ review, testCases: pendingDecision }), false);
assert.equal(canApproveTestCaseBatch({ review, testCases: allRemoved }), true);
assert.equal(canApproveTestCaseBatch({ review, dirty: true, testCases: allApproved }), false);
assert.equal(
    reviewCompletionMessage(summarizeReview(pendingDecision)),
    "Còn 1 test case chưa có quyết định."
);
assert.equal(
    reviewCompletionMessage(summarizeReview(approvedAndRemoved)),
    "Đã review toàn bộ 3 test case. 2 đã duyệt · 1 đã loại bỏ."
);
const resolved = review.testCases.map(testCase =>
    testCase.reviewStatus === "REMOVED" ? testCase : { ...testCase, reviewStatus: "APPROVED" }
);
assert.ok(testCaseWarnings(review.testCases[0]).some(item => item.includes("tester")));
assert.ok(
    testCaseWarnings({ ...review.testCases[0], steps: [] }).some(item => item.includes("bước"))
);

const payload = buildTestCaseBatchPayload([
    { ...resolved[0], _uiKey: "local-only", _dirty: true, _selected: true },
    resolved[1]
]);
assert.equal("_uiKey" in payload[0], false);
assert.equal("_dirty" in payload[0], false);
assert.equal("_selected" in payload[0], false);
assert.equal(payload[0].reviewStatus, "APPROVED");
assert.equal(payload[1].reviewStatus, "REMOVED");
assert.deepEqual(payload[0].hiddenMetadata, { keep: true });

assert.throws(
    () => parseTestCaseReview({ testCases: [{ title: "Missing ID" }], allowedActions: [] }),
    /thiếu ID/
);
assert.throws(() => parseTestCaseReview(null), /không hợp lệ/);

console.log("TestCase Review frontend validation PASSED");
