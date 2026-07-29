const READINESS = new Set(["READY", "DATA_REQUIRED"]);

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

        return {
            ...structuredClone(testCase),
            id,
            testcaseId: testCase.testcaseId ?? id,
            testData: {
                requirement:
                    typeof testCase.testData?.requirement === "string"
                        ? testCase.testData.requirement
                        : "",
                value: typeof testCase.testData?.value === "string" ? testCase.testData.value : ""
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

export function buildTestCaseBatchPayload(testCases) {
    return testCases.map(testCase => {
        const clone = structuredClone(testCase);
        delete clone._uiKey;
        delete clone._dirty;
        return clone;
    });
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

export function canApproveTestCaseBatch({
    review,
    dirty = false,
    pending = false,
    testCases = []
}) {
    return (
        review?.allowedActions?.includes("APPROVE_TEST_CASES") === true &&
        review?.approvalStatus === "pending" &&
        testCases.length > 0 &&
        !dirty &&
        !pending
    );
}

export function testCaseWarnings(testCase) {
    const warnings = [];
    if (!testCaseId(testCase)) warnings.push("Thiếu testcase ID.");
    if (!String(testCase?.title ?? "").trim()) warnings.push("Tiêu đề đang trống.");
    if (!String(testCase?.expectedResult ?? "").trim()) {
        warnings.push("Kết quả mong đợi đang trống.");
    }
    if (testCase?.executionReadiness === "DATA_REQUIRED") {
        warnings.push("Cần tester nhập giá trị dữ liệu trước khi thực thi.");
    }
    if (!READINESS.has(testCase?.executionReadiness)) {
        warnings.push("Readiness không xác định; cần lưu lại để backend chuẩn hóa.");
    }
    return warnings;
}
