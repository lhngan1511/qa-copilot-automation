const READINESS = new Set(["READY", "DATA_REQUIRED"]);
export const TEST_CASE_REVIEW_STATUSES = ["PENDING", "APPROVED", "NEEDS_CHANGES", "REMOVED"];

export function testCaseId(testCase) {
    return String(testCase?.testcaseId ?? testCase?.testCaseId ?? testCase?.id ?? "").trim();
}

export function testCaseDisplayId(testCase) {
    return String(testCase?.displayId ?? "").trim() || testCaseId(testCase);
}

export function formatTestCaseCode(number) {
    const value = Number(number);
    const index = Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;
    return `TC${String(index).padStart(3, "0")}`;
}

export function nextDisplayCode(testCases = []) {
    return formatTestCaseCode((Array.isArray(testCases) ? testCases.length : 0) + 1);
}

export function nextStableTestCaseId(testCases = []) {
    const ids = (Array.isArray(testCases) ? testCases : []).map(testCase => testCaseId(testCase));
    const used = new Set(ids);
    const maxNumber = ids.reduce((max, id) => {
        const match = String(id).match(/^TC(\d+)$/i);
        return match ? Math.max(max, Number(match[1])) : max;
    }, 0);
    let next = maxNumber + 1;
    let candidate = formatTestCaseCode(next);
    while (used.has(candidate)) {
        next += 1;
        candidate = formatTestCaseCode(next);
    }
    return candidate;
}

export function createBlankManualTestCase(testCases = []) {
    const id = nextStableTestCaseId(testCases);
    return {
        id,
        testcaseId: id,
        displayId: nextDisplayCode(testCases),
        title: "",
        scenario: "",
        testScenario: "",
        module: "",
        feature: "",
        type: "POSITIVE",
        preconditions: [],
        testData: {
            fields: {},
            requirement: "",
            value: "",
            requiresTesterInput: false
        },
        steps: [{ order: 1, action: "", expected: "" }],
        expectedResult: "",
        reviewStatus: "PENDING",
        source: "MANUAL_TESTER",
        automationCandidate: false
    };
}

export function assignDisplayIds(testCases = []) {
    return (Array.isArray(testCases) ? testCases : []).map((testCase, index) => ({
        ...testCase,
        displayId: formatTestCaseCode(index + 1)
    }));
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
            displayId: formatTestCaseCode(index + 1),
            intent: testCase.intent ?? "",
            intentGroup: testCase.intentGroup ?? "",
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
            testCase.displayId,
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

export function formatTestData(testData) {
    const fields =
        testData?.fields && typeof testData.fields === "object" && !Array.isArray(testData.fields)
            ? testData.fields
            : {};
    const labels = {
        VALID: "Hợp lệ",
        EMPTY: "Để trống",
        DUPLICATE: "Giá trị đã tồn tại",
        INVALID: "Không hợp lệ",
        BELOW_MIN: "Nhỏ hơn giới hạn tối thiểu",
        AT_MIN: "Bằng giới hạn tối thiểu",
        ABOVE_MAX: "Lớn hơn giới hạn tối đa",
        AT_MAX: "Bằng giới hạn tối đa",
        NOT_ALLOWED: "Không thuộc danh sách cho phép",
        SEARCH_CRITERIA: "Điều kiện tìm kiếm",
        EXISTING_VALUE: "Giá trị hiện có",
        UPDATED_VALUE: "Giá trị cập nhật"
    };
    const lines = Object.entries(fields).map(([name, field]) => {
        const value = field?.requiresTesterInput
            ? field.instruction || "Tester cần cung cấp dữ liệu"
            : field?.value === ""
              ? "Để trống"
              : String(field?.value ?? "");
        const purpose = labels[String(field?.purpose ?? "VALID").toUpperCase()] ?? "Dữ liệu kiểm thử";
        return `${name}: ${value} (${purpose})`;
    });
    if (lines.length > 0) return lines.join("\n");
    return String(testData?.value || testData?.requirement || "").trim();
}

// "Không có oracle" = expectedResult RỖNG, hoặc còn placeholder "Chưa xác định" do
// CodeGenRequirementDocumentBuilder/RequirementIntelligenceEngine tự chèn khi bản ghi/requirement
// KHÔNG có bước kiểm tra kết quả nào. Cả 2 trường hợp đều khiến tester có thể vô tình duyệt 1
// testcase không biết kết quả đúng là gì. RỖNG được tính riêng (không chỉ placeholder) vì bug thật
// đã gặp (2026-09-04): backend nới lỏng validateTestCase() để KHÔNG chặn cứng batch merge khi 1
// testcase PENDING có expectedResult rỗng (xem TestCaseReviewValidator.js) — nếu hasMissingOracle()
// chỉ bắt placeholder, testcase rỗng sẽ lọt qua "Duyệt tất cả đủ điều kiện" rồi bị backend chặn lại
// ở bước APPROVED (validator vẫn bắt buộc expectedResult khi APPROVED) — tái diễn đúng lỗi cũ.
export function hasMissingOracle(testCase) {
    const expectedResult = String(testCase?.expectedResult ?? "").trim();
    return !expectedResult || /chưa xác định/i.test(expectedResult);
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
    if (hasMissingOracle(testCase)) {
        warnings.push(
            "Kết quả mong đợi CHƯA XÁC ĐỊNH — bản ghi/requirement chưa có oracle, cần tester xác nhận cụ thể trước khi duyệt."
        );
    }
    if (normalizeSteps(testCase?.steps).length === 0) {
        warnings.push("Testcase phải có ít nhất một bước thực thi hợp lệ.");
    }
    if (testCase?.executionReadiness === "DATA_REQUIRED") {
        warnings.push("Cần tester nhập giá trị dữ liệu trước khi thực thi.");
    }
    return warnings;
}

const CONFLICT_STOPWORDS = new Set([
    "he", "thong", "hien", "thi", "da", "duoc", "la", "cua", "va", "khi", "gi", "khong", "co",
    "cac", "mot", "nay", "cho", "voi", "tren", "trong", "ra", "vao", "de", "neu", "thi"
]);

function conflictTokens(text) {
    return String(text ?? "")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/đ/gi, "d")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter(token => token && !CONFLICT_STOPWORDS.has(token));
}

/** Overlap coefficient (không phải Jaccard đối xứng) — tính từ phía tập NHỎ HƠN, vì 2 testcase mô
 *  tả CÙNG 1 sự kiện thường có 1 câu ngắn gọn (vd fact từ clarification: "xóa thông tin thành
 *  công") và 1 câu dài hơn nêu chi tiết UI (vd "Hệ thống hiển thị: 'Đã xóa thành công'") — Jaccard
 *  đối xứng bị pha loãng bởi các từ RIÊNG của câu dài, làm điểm thấp giả tạo. */
function overlapCoefficient(tokensA, tokensB) {
    if (tokensA.length === 0 || tokensB.length === 0) return 0;
    const setA = new Set(tokensA);
    const setB = new Set(tokensB);
    const intersection = [...setA].filter(token => setB.has(token)).length;
    return intersection / Math.min(setA.size, setB.size);
}

function sameModule(a, b) {
    const moduleA = String(a?.module ?? "").trim().toLocaleLowerCase("vi");
    const moduleB = String(b?.module ?? "").trim().toLocaleLowerCase("vi");
    return Boolean(moduleA) && moduleA === moduleB;
}

/** "Cùng sự kiện" (Ngân báo lỗi thật 2026-09-04, sửa lại sau khi bản đầu báo sai): CHỈ so sánh khi
 *  CÙNG MODULE VÀ ÍT NHẤT 1 TRONG 2 LÀ CONFIRMED_FACT (fact đứng riêng suy từ clarification, không
 *  gắn được vào 1 function cụ thể — vd TC005 trong bug gốc, feature chỉ là tên MODULE chứ không phải
 *  "Xóa đợt nhập học"). Đây là trường hợp DUY NHẤT đã xác nhận thật sự gây xung đột (1 testcase
 *  "thường" mô tả sự kiện qua assertion ghi được + 1 CONFIRMED_FACT mô tả LẠI cùng sự kiện đó qua
 *  câu trả lời clarification, nội dung khác nhau).
 *
 *  Bản đầu tiên còn coi "2 testcase CÙNG function/feature" (không cần CONFIRMED_FACT) là đủ điều
 *  kiện so sánh — BÁO SAI THẬT (2026-09-04): nhiều testcase VALIDATION của CÙNG 1 function (vd
 *  "Đăng nhập" — thiếu Tài khoản/thiếu Mật khẩu/thiếu Mã xác nhận) và cả testcase POSITIVE cùng
 *  function đó tự nhiên CHIA SẺ tên hàm + câu chữ khuôn mẫu ("Hệ thống không cho phép hoàn tất đăng
 *  nhập khi ... để trống") — đây là các testcase HỢP LỆ, KHÁC NHAU CÓ CHỦ ĐÍCH (khác field/khác
 *  luồng), không phải mâu thuẫn — nhưng độ trùng token đủ cao để vượt ngưỡng, bị báo xung đột nhầm.
 *  Bỏ hẳn nhánh functionsOverlap() để loại lớp báo sai này — chỉ còn CONFIRMED_FACT mới kích hoạt so
 *  sánh, đúng NGUYÊN VĂN trường hợp đã xác nhận là bug thật. */
function sameEvent(a, b) {
    if (!sameModule(a, b)) return false;
    return testCaseType(a) === "CONFIRMED_FACT" || testCaseType(b) === "CONFIRMED_FACT";
}

/** Phát hiện 2+ testcase mô tả CÙNG 1 sự kiện (cùng module + cùng function, hoặc có CONFIRMED_FACT)
 *  nhưng expected result MÂU THUẪN nhau (khác nội dung, không phải trùng hệt — trùng hệt đã được xử
 *  lý ở tầng dedupe khi sinh testcase). Bug thật đã gặp (2026-09-04): TC004 (Xóa, từ assertion ghi
 *  được) và TC005 (CONFIRMED_FACT, từ câu trả lời clarification) cùng mô tả thông báo xác nhận xóa
 *  nhưng cho 2 kết quả mong đợi khác nhau, cả 2 cùng nằm "Chờ duyệt" như không có gì bất thường.
 *  Trả về Map<testcaseId, Array<{ withId, expectedResult }>> — testcase KHÔNG có trong map nghĩa là
 *  không phát hiện xung đột nào. Đây là CẢNH BÁO (heuristic, có thể có false positive) — không tự
 *  quyết định cái nào đúng, chỉ nêu ra để tester tự xem xét. */
export function findExpectedResultConflicts(testCases) {
    const list = (Array.isArray(testCases) ? testCases : []).filter(
        testCase => testCase?.reviewStatus !== "REMOVED"
    );
    const conflicts = new Map();

    for (let i = 0; i < list.length; i += 1) {
        for (let j = i + 1; j < list.length; j += 1) {
            const a = list[i];
            const b = list[j];
            const expectedA = String(a?.expectedResult ?? "").trim();
            const expectedB = String(b?.expectedResult ?? "").trim();
            if (!expectedA || !expectedB) continue;
            if (expectedA.toLocaleLowerCase("vi") === expectedB.toLocaleLowerCase("vi")) continue;
            if (!sameEvent(a, b)) continue;

            const tokensA = conflictTokens(expectedA);
            const tokensB = conflictTokens(expectedB);
            if (tokensA.length < 2 || tokensB.length < 2) continue;
            if (overlapCoefficient(tokensA, tokensB) < 0.5) continue;

            const idA = testCaseId(a);
            const idB = testCaseId(b);
            if (!conflicts.has(idA)) conflicts.set(idA, []);
            if (!conflicts.has(idB)) conflicts.set(idB, []);
            conflicts.get(idA).push({ withId: idB, expectedResult: expectedB });
            conflicts.get(idB).push({ withId: idA, expectedResult: expectedA });
        }
    }
    return conflicts;
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
