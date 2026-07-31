const READINESS = new Set(["READY", "DATA_REQUIRED"]);
export const TEST_CASE_REVIEW_STATUSES = ["PENDING", "APPROVED", "NEEDS_CHANGES", "REMOVED"];

export function testCaseId(testCase) {
    return String(testCase?.testcaseId ?? testCase?.testCaseId ?? testCase?.id ?? "").trim();
}

export function parseTestCaseReview(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error("Phản hồi TestCase Review không hợp lệ.");
    }
    if (!Array.isArray(value.testCases) || !Array.isArray(value.allowedActions)) {
        throw new Error("TestCase Review thiếu danh sách testcase hoặc allowedActions.");
    }

    const ids = new Set();
    const testCases = value.testCases.map((testCase, index) => {
        if (!testCase || typeof testCase !== "object" || Array.isArray(testCase)) {
            throw new Error(`Testcase thứ ${index + 1} không hợp lệ.`);
        }
        const id = testCaseId(testCase);
        if (!id || id.startsWith("MISSING_ID_")) {
            throw new Error(`Testcase thứ ${index + 1} thiếu ID.`);
        }
        if (ids.has(id)) throw new Error(`Testcase ID bị trùng: ${id}.`);
        ids.add(id);

        const reviewStatus = TEST_CASE_REVIEW_STATUSES.includes(testCase.reviewStatus)
            ? testCase.reviewStatus
            : "PENDING";
        return {
            ...structuredClone(testCase),
            id,
            testcaseId: testCase.testcaseId ?? id,
            scenario:
                testCase.scenario ??
                testCase.testScenario ??
                testCase.objective ??
                testCase.testObjective ??
                testCase.title ??
                "",
            reviewStatus,
            steps: normalizeSteps(testCase.steps),
            testData: {
                ...(testCase.testData && typeof testCase.testData === "object"
                    ? structuredClone(testCase.testData)
                    : {}),
                fields:
                    testCase.testData?.fields && typeof testCase.testData.fields === "object"
                        ? structuredClone(testCase.testData.fields)
                        : {},
                requirement:
                    typeof testCase.testData?.requirement === "string"
                        ? testCase.testData.requirement
                        : "",
                value: typeof testCase.testData?.value === "string" ? testCase.testData.value : "",
                requiresTesterInput: testCase.testData?.requiresTesterInput === true
            },
            executionReadiness: READINESS.has(testCase.executionReadiness)
                ? testCase.executionReadiness
                : "UNKNOWN"
        };
    });

    return {
        ...value,
        testCases,
        allowedActions: [...value.allowedActions],
        exports: Array.isArray(value.exports) ? value.exports.map(item => ({ ...item })) : []
    };
}

export function normalizeSteps(steps) {
    if (!Array.isArray(steps)) return [];
    return steps
        .map((step, index) => {
            if (typeof step === "string") {
                return step.trim() ? { order: index + 1, action: step.trim(), expected: "" } : null;
            }
            if (!step || typeof step !== "object") return null;
            const action = String(step.action ?? step.description ?? "").trim();
            return action
                ? {
                      ...structuredClone(step),
                      order: index + 1,
                      action,
                      expected: step.expected ?? step.expectedResult ?? ""
                  }
                : null;
        })
        .filter(Boolean);
}

export function buildTestCaseBatchPayload(testCases) {
    return testCases.map(testCase => {
        const clone = structuredClone(testCase);
        delete clone._uiKey;
        delete clone._dirty;
        delete clone._selected;
        delete clone._editing;
        return clone;
    });
}

export function testCaseType(testCase) {
    return String(testCase?.type || "UNKNOWN")
        .trim()
        .toUpperCase()
        .replace(/[\s-]+/g, "_");
}

export function filterTestCases(testCases, { search = "", type = "ALL" } = {}) {
    const query = search.trim().toLocaleLowerCase("vi");
    return testCases.filter(testCase => {
        const actualType = testCaseType(testCase);
        const matchesType =
            type === "ALL" ||
            actualType === type ||
            (type === "VALIDATION" && actualType === "DATA_INTEGRITY") ||
            (type === "BUSINESS_RULE" && actualType === "RULE");
        if (!matchesType) return false;
        if (!query) return true;
        return [
            testCaseId(testCase),
            testCase.scenario,
            testCase.title,
            testCase.module,
            testCase.feature,
            testCase.function,
            testCase.expectedResult
        ].some(value =>
            String(value ?? "")
                .toLocaleLowerCase("vi")
                .includes(query)
        );
    });
}

export function summarizeReview(testCases) {
    return testCases.reduce(
        (summary, testCase) => {
            summary.total += 1;
            if (testCase.reviewStatus === "APPROVED") summary.approved += 1;
            else if (testCase.reviewStatus === "NEEDS_CHANGES") summary.needsChanges += 1;
            else if (testCase.reviewStatus === "REMOVED") summary.removed += 1;
            else summary.pending += 1;
            return summary;
        },
        { total: 0, approved: 0, needsChanges: 0, removed: 0, pending: 0 }
    );
}

export function canApproveTestCaseBatch({
    review,
    dirty = false,
    pending = false,
    testCases = []
}) {
    const summary = summarizeReview(testCases);
    return (
        review?.allowedActions?.includes("APPROVE_TEST_CASES") === true &&
        review?.approvalStatus === "pending" &&
        summary.total > 0 &&
        summary.pending + summary.needsChanges === 0 &&
        !dirty &&
        !pending
    );
}

export function reviewCompletionMessage(summary) {
    const unresolved = summary.pending + summary.needsChanges;
    if (unresolved > 0) return `Còn ${unresolved} test case chưa có quyết định.`;

    return `Đã review toàn bộ ${summary.total} test case. ${summary.approved} đã duyệt · ${summary.removed} đã loại bỏ.`;
}

export function testCaseWarnings(testCase) {
    const warnings = [];
    if (!testCaseId(testCase)) warnings.push("Thiếu testcase ID.");
    if (!String(testCase?.scenario ?? testCase?.title ?? "").trim()) {
        warnings.push("Tình huống kiểm tra đang trống.");
    }
    if (!String(testCase?.expectedResult ?? "").trim()) {
        warnings.push("Kết quả mong đợi đang trống.");
    }
    if (normalizeSteps(testCase?.steps).length === 0) {
        warnings.push("Testcase phải có ít nhất một bước thực thi hợp lệ.");
    }
    if (testCase?.executionReadiness === "DATA_REQUIRED") {
        warnings.push("Cần tester nhập giá trị dữ liệu trước khi thực thi.");
    }
    return warnings;
}

export function groupTestCases(testCases) {
    const result = {};
    testCases.forEach(testCase => {
        const module = String(testCase.module || "Chưa xác định");
        const feature = String(testCase.function || testCase.feature || "Chưa xác định");
        const type = String(testCase.type || "UNKNOWN");
        result[module] ??= {};
        result[module][feature] ??= {};
        result[module][feature][type] ??= [];
        result[module][feature][type].push(testCase);
    });
    return result;
}
