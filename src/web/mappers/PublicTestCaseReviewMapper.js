import PublicTestCaseReviewDto from "../dtos/PublicTestCaseReviewDto.js";

const TEXT_FIELDS = [
    "id",
    "testcaseId",
    "testCaseId",
    "scenarioId",
    "moduleId",
    "module",
    "functionId",
    "function",
    "feature",
    "title",
    "testScenario",
    "scenario",
    "type",
    "testObjective",
    "objective",
    "expectedResult",
    "priority",
    "severity",
    "source",
    "automationNotes",
    "executionReadiness",
    "reviewStatus"
];

const ARRAY_FIELDS = [
    "preconditions",
    "steps",
    "expectedResults",
    "assertions",
    "requirementReferences",
    "coveredRules",
    "businessRuleIds"
];

export default class PublicTestCaseReviewMapper {
    map({ review, workflow } = {}) {
        const artifact = review?.artifact;
        if (!artifact || artifact.artifactType !== "TEST_CASE_REVIEW") {
            throw this.error(
                "TEST_CASE_REVIEW_NOT_FOUND",
                "TestCase Review artifact not found.",
                404
            );
        }

        const testCases = Array.isArray(artifact.testCases)
            ? artifact.testCases.map((testCase, index) => this.mapTestCase(testCase, index))
            : [];

        return new PublicTestCaseReviewDto({
            workflowId: review.sessionId ?? workflow?.id ?? "",
            artifactId: artifact.artifactId ?? "",
            status: workflow?.status ?? "",
            step: workflow?.step ?? "",
            approvalStatus: artifact.approvalStatus ?? "",
            testCases,
            summary: this.buildSummary(testCases),
            allowedActions: workflow?.allowedActions ?? [],
            exports: workflow?.exports ?? [],
            revision: artifact.revision ?? null
        });
    }

    mapTestCase(value, index) {
        const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
        const result = {};

        TEXT_FIELDS.forEach(field => {
            if (Object.hasOwn(source, field)) result[field] = source[field];
        });
        ARRAY_FIELDS.forEach(field => {
            if (Array.isArray(source[field])) result[field] = structuredClone(source[field]);
        });

        result.id =
            source.testcaseId ??
            source.testCaseId ??
            source.id ??
            `MISSING_ID_${String(index + 1)}`;
        result.testcaseId = source.testcaseId ?? source.testCaseId ?? source.id ?? "";
        result.scenario =
            source.scenario ??
            source.testScenario ??
            source.objective ??
            source.testObjective ??
            source.title ??
            "";
        result.testData = this.mapTestData(source.testData);
        result.automationCandidate = source.automationCandidate === true;
        result.executionReadiness =
            source.executionReadiness === "DATA_REQUIRED" ? "DATA_REQUIRED" : "READY";
        result.reviewStatus = ["APPROVED", "NEEDS_CHANGES", "REMOVED"].includes(source.reviewStatus)
            ? source.reviewStatus
            : "PENDING";

        return result;
    }

    mapTestData(value) {
        const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
        return {
            requirement: typeof source.requirement === "string" ? source.requirement : "",
            value: typeof source.value === "string" ? source.value : ""
        };
    }

    buildSummary(testCases) {
        const byType = {};
        const byReviewStatus = {
            PENDING: 0,
            APPROVED: 0,
            NEEDS_CHANGES: 0,
            REMOVED: 0
        };
        let ready = 0;
        let requiresTesterInput = 0;

        testCases.forEach(testCase => {
            const type =
                typeof testCase.type === "string" && testCase.type.trim()
                    ? testCase.type.trim()
                    : "UNKNOWN";
            byType[type] = (byType[type] ?? 0) + 1;
            byReviewStatus[testCase.reviewStatus] += 1;
            if (testCase.executionReadiness === "DATA_REQUIRED") {
                requiresTesterInput += 1;
            } else {
                ready += 1;
            }
        });

        return {
            total: testCases.length,
            approved: byReviewStatus.APPROVED,
            needsChanges: byReviewStatus.NEEDS_CHANGES,
            removed: byReviewStatus.REMOVED,
            pending: byReviewStatus.PENDING,
            byType,
            ready,
            requiresTesterInput
        };
    }

    error(code, message, statusCode) {
        return Object.assign(new Error(message), { code, statusCode });
    }
}
