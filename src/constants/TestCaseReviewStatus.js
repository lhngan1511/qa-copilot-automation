const TestCaseReviewStatus = Object.freeze({
    PENDING: "PENDING",
    APPROVED: "APPROVED",
    NEEDS_CHANGES: "NEEDS_CHANGES",
    REMOVED: "REMOVED"
});

export const TEST_CASE_REVIEW_STATUSES = new Set(Object.values(TestCaseReviewStatus));

export default TestCaseReviewStatus;
