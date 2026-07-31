import { normalizeTestData, resolveExecutionReadiness } from "../utils/TestDataReadiness.js";
import TestCaseReviewStatus from "../constants/TestCaseReviewStatus.js";

export default class ApprovedTestCaseMapper {
    map(testCaseArtifact) {
        if (testCaseArtifact?.artifactType !== "TEST_CASE_REVIEW") {
            throw new Error("Artifact must be a TEST_CASE_REVIEW artifact.");
        }

        if (testCaseArtifact?.approvalStatus !== "approved") {
            throw new Error("TestCase Artifact must be approved.");
        }

        if (!Array.isArray(testCaseArtifact.testCases)) return [];

        const unresolved = testCaseArtifact.testCases.filter(testCase =>
            [TestCaseReviewStatus.PENDING, TestCaseReviewStatus.NEEDS_CHANGES].includes(
                testCase.reviewStatus
            )
        );
        if (unresolved.length > 0) {
            throw new Error("Approved TestCase Artifact contains unresolved testcases.");
        }

        return testCaseArtifact.testCases
            .filter(
                testCase =>
                    testCase.reviewStatus === undefined ||
                    testCase.reviewStatus === TestCaseReviewStatus.APPROVED
            )
            .map(testCase => {
                const clone = this.clone(testCase);
                const id = clone?.testcaseId ?? clone?.testCaseId ?? clone?.id ?? "";
                clone.testData = normalizeTestData(clone.testData, clone);
                clone.executionReadiness = resolveExecutionReadiness(clone.testData);
                clone.reviewStatus = TestCaseReviewStatus.APPROVED;
                return { ...clone, id, testcaseId: id };
            });
    }

    clone(value) {
        if (Array.isArray(value)) return value.map(item => this.clone(item));
        if (value && typeof value === "object") {
            return Object.fromEntries(
                Object.entries(value).map(([key, item]) => [key, this.clone(item)])
            );
        }
        return value;
    }
}
