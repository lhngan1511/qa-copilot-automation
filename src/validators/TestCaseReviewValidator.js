import TestCaseReviewStatus, {
    TEST_CASE_REVIEW_STATUSES
} from "../constants/TestCaseReviewStatus.js";
import TestStepNormalizer from "../normalizers/TestStepNormalizer.js";

export default class TestCaseReviewValidator {
    constructor({ stepNormalizer = new TestStepNormalizer() } = {}) {
        this.stepNormalizer = stepNormalizer;
    }

    normalize(testCase, { defaultStatus = TestCaseReviewStatus.PENDING } = {}) {
        const source =
            testCase && typeof testCase === "object" && !Array.isArray(testCase)
                ? structuredClone(testCase)
                : {};
        const id = String(source.testcaseId ?? source.testCaseId ?? source.id ?? "").trim();
        const scenario = String(
            source.scenario ??
                source.testScenario ??
                source.objective ??
                source.testObjective ??
                source.title ??
                ""
        ).trim();
        const reviewStatus = String(source.reviewStatus ?? defaultStatus)
            .trim()
            .toUpperCase();

        source.id = id;
        source.testcaseId = id;
        source.scenario = scenario;
        source.testScenario = String(source.testScenario ?? scenario).trim();
        source.reviewStatus = reviewStatus;
        source.steps = this.stepNormalizer.normalize(source.steps, {
            ...source,
            preserveManualSteps: true
        });
        return source;
    }

    normalizeBatch(testCases, options) {
        return (Array.isArray(testCases) ? testCases : []).map(testCase =>
            this.normalize(testCase, options)
        );
    }

    validateBatch(testCases, { requireResolved = false } = {}) {
        if (!Array.isArray(testCases) || testCases.length === 0) {
            throw this.error("INVALID_TEST_CASE_BATCH", "Test Case Review must contain testcases.");
        }

        const seen = new Set();
        testCases.forEach((testCase, index) => {
            this.validateTestCase(testCase, index);
            if (seen.has(testCase.id)) {
                throw this.error("DUPLICATE_TEST_CASE_ID", `Duplicate testcase ID: ${testCase.id}`);
            }
            seen.add(testCase.id);
        });

        if (requireResolved) this.validateFinalApproval(testCases);
        return true;
    }

    validateTestCase(testCase, index = 0) {
        const label = testCase?.id || `#${index + 1}`;
        if (!testCase?.id) {
            throw this.error("INVALID_TEST_CASE_ID", `Testcase ${label} is missing an ID.`);
        }
        if (!TEST_CASE_REVIEW_STATUSES.has(testCase.reviewStatus)) {
            throw this.error(
                "INVALID_TEST_CASE_REVIEW_STATUS",
                `Testcase ${label} has unsupported reviewStatus '${testCase.reviewStatus}'.`
            );
        }

        const required = [
            ["module", testCase.module],
            ["feature", testCase.feature ?? testCase.function],
            ["scenario", testCase.scenario ?? testCase.testScenario],
            ["type", testCase.type],
            ["expectedResult", testCase.expectedResult]
        ];
        const missing = required
            .filter(([, value]) => !String(value ?? "").trim())
            .map(([name]) => name);
        if (missing.length > 0) {
            throw this.error(
                "INCOMPLETE_TEST_CASE",
                `Testcase ${label} is missing: ${missing.join(", ")}.`
            );
        }
        if (
            !testCase.testData ||
            typeof testCase.testData !== "object" ||
            Array.isArray(testCase.testData)
        ) {
            throw this.error("INVALID_TEST_DATA", `Testcase ${label} has invalid testData.`);
        }
        if (!Array.isArray(testCase.steps) || testCase.steps.length === 0) {
            throw this.error(
                "INVALID_TEST_STEPS",
                `Testcase ${label} must contain execution steps.`
            );
        }
        if (testCase.steps.some(step => !String(step?.action ?? "").trim())) {
            throw this.error(
                "INVALID_TEST_STEPS",
                `Testcase ${label} contains an execution step without an action.`
            );
        }
    }

    validateFinalApproval(testCases) {
        const active = testCases.filter(
            testCase => testCase.reviewStatus !== TestCaseReviewStatus.REMOVED
        );
        if (active.length === 0) {
            throw this.error(
                "NO_APPROVED_TEST_CASES",
                "At least one active testcase is required for final approval."
            );
        }

        const unresolved = active.filter(
            testCase => testCase.reviewStatus !== TestCaseReviewStatus.APPROVED
        );
        if (unresolved.length > 0) {
            throw this.error(
                "TEST_CASE_REVIEW_UNRESOLVED",
                "All active testcases must be APPROVED before final approval.",
                { testcaseIds: unresolved.map(testCase => testCase.id) }
            );
        }
    }

    error(code, message, details = null) {
        return Object.assign(new Error(message), { code, statusCode: 422, details });
    }
}
