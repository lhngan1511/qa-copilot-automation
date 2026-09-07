import TestCaseReviewStatus, {
    FINAL_TEST_CASE_REVIEW_STATUSES,
    TEST_CASE_REVIEW_STATUSES
} from "../constants/TestCaseReviewStatus.js";
import TestStepNormalizer from "../normalizers/TestStepNormalizer.js";
import TestDataFactory from "../factories/TestDataFactory.js";
import ExpectedResultBuilder from "../builders/ExpectedResultBuilder.js";

export default class TestCaseReviewValidator {
    constructor({
        stepNormalizer = new TestStepNormalizer(),
        testDataFactory = new TestDataFactory(),
        expectedResultBuilder = new ExpectedResultBuilder()
    } = {}) {
        this.stepNormalizer = stepNormalizer;
        this.testDataFactory = testDataFactory;
        this.expectedResultBuilder = expectedResultBuilder;
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
        source.testData = this.testDataFactory.normalizeLegacy(source.testData, source);
        source.expectedResult = this.expectedResultBuilder.normalizeLegacy(
            source.expectedResult,
            source
        );
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
            ["type", testCase.type]
        ];
        // expectedResult chỉ bắt buộc khi testcase đã APPROVED — bug thật đã gặp (2026-09-04):
        // validateBatch() chạy trên MỌI lần lưu/gộp (kể cả merge "+ Tạo testcase từ CodeGen" vào
        // session đang mở), nên 1 testcase PENDING còn thiếu oracle (thường do requirement/bản ghi
        // chưa có bước kiểm tra kết quả — xem hasMissingOracle() ở web-ui) chặn đứng CẢ BATCH, kể cả
        // các testcase khác hoàn toàn hợp lệ — tester mất trắng, "Thử lại" lặp lại lỗi y hệt vì
        // nguyên nhân không đổi. Ý định ban đầu (xem web-ui/src/utils/testCaseReview.js#hasMissingOracle
        // + TestCaseList "⚠ Chưa có oracle") là CHO PHÉP lưu/hiển thị testcase thiếu oracle kèm cảnh
        // báo, chỉ CHẶN lúc DUYỆT (reviewStatus APPROVED) — không chặn lúc lưu/gộp.
        if (testCase.reviewStatus === "APPROVED") {
            required.push(["expectedResult", testCase.expectedResult]);
        }
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
        const unresolved = testCases.filter(
            testCase => !FINAL_TEST_CASE_REVIEW_STATUSES.has(testCase.reviewStatus)
        );
        if (unresolved.length > 0) {
            throw this.error(
                "TEST_CASE_REVIEW_UNRESOLVED",
                "Every testcase must have an APPROVED or REMOVED final decision.",
                { testcaseIds: unresolved.map(testCase => testCase.id) }
            );
        }
    }

    error(code, message, details = null) {
        return Object.assign(new Error(message), { code, statusCode: 422, details });
    }
}
