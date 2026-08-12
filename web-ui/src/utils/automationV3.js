/*
 automationV3 — Pure helpers cho UI Bước 5A (Workspace + Upload + Chọn testcase).

 Chỉ XỬ LÝ dữ liệu (thuần, test được). Không gọi API, không touch DOM.
 - parse/chuẩn hóa approved-testcases.json
 - chỉ giữ reviewStatus=APPROVED
 - automationCandidate=false → disable checkbox (vẫn hiển thị + lý do)
 - executionReadiness=DATA_REQUIRED → vẫn chọn được + hiện ghi chú
 Không hiển thị JSON thô.
*/

const NO_DATA_NOTE = "Cần bổ sung dữ liệu trước khi chạy";
const READY_NOTE = "Sẵn sàng";

/** Đọc chuỗi nội dung file → list testcase thô (mảng hoặc {testCases:[...]}). */
export function extractTestCaseList(parsed) {
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === "object") {
        return parsed.testCases ?? parsed.testcases ?? parsed.items ?? [];
    }
    return [];
}

/** Chuẩn hóa 1 testcase thô → DTO hiển thị (thuần). */
export function normalizeTestCase(item) {
    const id = String(item?.testCaseId ?? item?.id ?? item?.testcaseId ?? "").trim();
    const automationCandidate = item?.automationCandidate !== false;
    const executionReadiness = String(item?.executionReadiness ?? item?.dataReadiness ?? "").toUpperCase();
    return {
        testCaseId: id,
        title: String(item?.title ?? item?.scenario ?? item?.name ?? `Testcase ${id}`).trim(),
        type: String(item?.type ?? "").trim() || "N/A",
        module: String(item?.module ?? "").trim(),
        feature: String(item?.feature ?? item?.function ?? "").trim(),
        automationCandidate,
        automationDisabledReason: automationCandidate ? null : "Không đủ thông tin",
        executionReadiness,
        dataNote: executionReadiness === "DATA_REQUIRED" ? NO_DATA_NOTE : READY_NOTE
    };
}

/**
 * Chuẩn hóa toàn bộ file approved.
 * Chỉ giữ reviewStatus=APPROVED. Trả meta (module/feature/count) + skipped.
 * @returns {{ approved:Array, total:number, skippedNotApproved:number, meta:{module,feature,functionName,count} }}
 */
export function normalizeApprovedTestcases(parsed) {
    const raw = extractTestCaseList(parsed);
    const total = raw.length;
    const approved = [];
    const approvedRaw = [];
    let skippedNotApproved = 0;

    for (const item of raw) {
        if (!item || typeof item !== "object") continue;
        const status = String(item.reviewStatus ?? item.status ?? "APPROVED").toUpperCase();
        if (status !== "APPROVED") {
            skippedNotApproved += 1;
            continue;
        }
        const tc = normalizeTestCase(item);
        if (!tc.testCaseId) continue;
        approved.push(tc);
        approvedRaw.push(item);
    }

    const first = approved[0] ?? {};
    const metaModule = String(parsed?.module ?? parsed?.meta?.module ?? first.module ?? "").trim();
    const metaFeature = String(parsed?.feature ?? parsed?.meta?.feature ?? first.feature ?? "").trim();
    const metaFunction = String(first.feature ?? "").trim();

    const result = {
        approved,
        rawApproved: approvedRaw,
        total,
        skippedNotApproved,
        meta: {
            module: metaModule,
            feature: metaFeature,
            functionName: metaFunction,
            count: approved.length
        }
    };
    return result;
}

/** Parse nội dung JSON (thuần) — ném Error nếu không hợp lệ. */
export function parseApprovedFile(content) {
    let parsed;
    try {
        parsed = JSON.parse(content);
    } catch {
        const err = new Error("File không phải JSON hợp lệ.");
        err.code = "INVALID_JSON";
        throw err;
    }
    const raw = extractTestCaseList(parsed);
    if (!Array.isArray(raw)) {
        const err = new Error("File phải chứa danh sách testcase hoặc thuộc tính testCases.");
        err.code = "INVALID_SHAPE";
        throw err;
    }
    if (raw.length === 0) {
        const err = new Error("File không có testcase nào.");
        err.code = "EMPTY";
        throw err;
    }
    const result = normalizeApprovedTestcases(parsed);
    if (result.approved.length === 0) {
        const err = new Error("Không có testcase nào đạt reviewStatus = APPROVED.");
        err.code = "NO_APPROVED";
        throw err;
    }
    return result;
}

export { NO_DATA_NOTE, READY_NOTE };

/* ============================== 5C-0 — Record Mapping helpers (thuần, test được) ============================== */

/** Nhãn thao tác cho 1 step (ngôn ngữ tester). */
export const ACTION_LABEL = {
    GOTO: "Mở trang",
    FILL: "Nhập",
    CLICK: "Bấm",
    CHECK: "Tích",
    UNCHECK: "Bỏ tích",
    SELECT: "Chọn",
    PRESS: "Phím",
    HOVER: "Di chuột",
    ASSERT: "Kiểm tra"
};

/** Trạng thái segment — ngôn ngữ tester. */
export function segmentStatusLabel(status) {
    if (status === "CONFIRMED") return "Đã xác nhận";
    if (status === "DRAFT") return "Nháp";
    return status ?? "—";
}

/** Trạng thái tự động hóa testcase (3 nhãn đã duyệt). */
export function decisionLabel(decision) {
    if (decision === "AUTOMATED") return "Có automation";
    if (decision === "MANUAL_ONLY") return "Chỉ kiểm thử thủ công";
    return "Chưa quyết định";
}

/** Message chuẩn cho lỗi segment/mapping (không để lộ errorCode nội bộ). */
export const SEGMENT_ERROR_MESSAGES = {
    SEGMENT_INVALID: "Khoảng bước không hợp lệ.",
    SEGMENT_OVERLAP: "Đoạn thao tác trùng với đoạn đã gán.",
    SEGMENT_TYPE_REQUIRES_TESTCASE: "Đoạn Testcase bắt buộc chọn testcase.",
    RECORDING_MAPPING_REQUIRED: "Không có bản ghi thao tác cho testcase này.",
    SEGMENT_NOT_CONFIRMED: "Bản ghi thao tác chưa được xác nhận.",
    SEGMENT_MAPPING_INVALID: "Chưa xác định đầy đủ đoạn thao tác cho testcase."
};

/** Map errorCode (từ ApiError) → message thân thiện. */
export function segmentErrorMessage(code, fallback = "Không thao tác được trên đoạn thao tác.") {
    return SEGMENT_ERROR_MESSAGES[code] ?? fallback;
}

/** Validate khoảng bước: số nguyên, 1..stepsCount, start ≤ end. Thuần — không gọi API. */
export function validateSegmentRange(stepsCount, startStep, endStep) {
    const count = Number.isInteger(stepsCount) ? stepsCount : 0;
    if (!Number.isInteger(startStep) || !Number.isInteger(endStep)
        || startStep < 1 || endStep < 1 || startStep > endStep || endStep > count) {
        return { ok: false, errorCode: "SEGMENT_INVALID", message: SEGMENT_ERROR_MESSAGES.SEGMENT_INVALID };
    }
    return { ok: true, startStep, endStep, stepCount: endStep - startStep + 1 };
}

/** Label hiển thị: "bước 6 → 8 (3 bước)". */
export function rangeLabel(startStep, endStep) {
    const n = endStep - startStep + 1;
    return `bước ${startStep} → ${endStep} (${n} bước)`;
}

/** Hai khoảng có chồng lấn? */
export function rangesOverlap(aStart, aEnd, bStart, bEnd) {
    return aStart <= bEnd && bStart <= aEnd;
}

/** Kiểm tra khoảng mới có đè lên segment đã có (loại trừ chính nó khi sửa). */
export function findOverlap(segments, startStep, endStep, excludeSegmentId = null) {
    return (Array.isArray(segments) ? segments : []).find(seg => {
        if (seg.segmentId === excludeSegmentId) return false;
        return rangesOverlap(startStep, endStep, seg.startStep, seg.endStep);
    }) ?? null;
}

/** Số bước chưa thuộc đoạn nào (thông tin — KHÔNG chặn Generate). */
export function unusedStepCount(steps, segments) {
    const segs = Array.isArray(segments) ? segments : [];
    return (Array.isArray(steps) ? steps : []).filter(step => {
        const order = step?.order;
        return !segs.some(seg => order >= seg.startStep && order <= seg.endStep);
    }).length;
}

/** Steps thuộc khoảng [start..end] (theo order). */
export function stepsInRange(steps, startStep, endStep) {
    return (Array.isArray(steps) ? steps : [])
        .filter(s => Number.isInteger(s?.order) && s.order >= startStep && s.order <= endStep);
}

/** Có thể xác nhận đoạn không? (range hợp lệ + loại hợp lệ + testcase nếu cần). */
export function canConfirmSegment({ range, segType, testCaseId, stepsCount }) {
    if (!range || range.ok !== true) return false;
    if (segType !== "SETUP" && segType !== "TESTCASE") return false;
    if (segType === "TESTCASE" && !testCaseId) return false;
    return true;
}

/* ============================== 5C — Điều kiện xác nhận (assertion) helpers ============================== */

/** Nhãn loại điều kiện (ngôn ngữ tester). */
export function assertionTypeLabel(type) {
    const map = {
        URL: "URL",
        TEXT_VISIBLE: "Hiển thị nội dung",
        ROLE_VISIBLE: "Phần tử / nút",
        LOCATOR_VISIBLE: "Phần tử (locator)",
        VALUE_EQUALS: "Giá trị / Thuộc tính",
        ATTRIBUTE: "Giá trị / Thuộc tính",
        COUNT: "Số lượng phần tử"
    };
    return map[type] ?? type ?? "—";
}

/** Nhãn trạng thái điều kiện. */
export function assertionStatusLabel(status) {
    if (status === "TESTER_CONFIRMED") return "Đã xác nhận";
    if (status === "DRAFT") return "Nháp";
    if (status === "SUGGESTED") return "Đề xuất";
    if (status === "REJECTED") return "Từ chối";
    if (status === "REMOVED") return "Đã xóa";
    return status ?? "—";
}

/** Nhãn matcher (ngôn ngữ tester). */
export function matcherLabel(matcher) {
    const map = {
        toHaveURL: "URL đúng",
        toBeVisible: "Hiển thị",
        toBeHidden: "Không hiển thị",
        toHaveValue: "Có giá trị",
        toBeDisabled: "Vô hiệu",
        toHaveCount: "Đúng số lượng"
    };
    return map[matcher] ?? matcher ?? "—";
}

/** Danh sách loại + matcher cho form (giữ thứ tự ổn định). */
export const ASSERTION_TYPE_OPTIONS = [
    { value: "TEXT_VISIBLE", label: "Hiển thị nội dung" },
    { value: "URL", label: "URL" },
    { value: "ROLE_VISIBLE", label: "Phần tử / nút" },
    { value: "LOCATOR_VISIBLE", label: "Phần tử (locator)" },
    { value: "ATTRIBUTE", label: "Giá trị / Thuộc tính" },
    { value: "COUNT", label: "Số lượng phần tử" }
];

export const MATCHER_OPTIONS = [
    { value: "toBeVisible", label: "Hiển thị" },
    { value: "toBeHidden", label: "Không hiển thị" },
    { value: "toHaveURL", label: "URL đúng" },
    { value: "toHaveValue", label: "Có giá trị" },
    { value: "toBeDisabled", label: "Vô hiệu" },
    { value: "toHaveCount", label: "Đúng số lượng" }
];

/** Gate Generate (6C.1 — TẤT CẢ thao tác trong binding phải CONFIRMED + ≥1 assertion TESTER_CONFIRMED). */
export function canGenerateForTestcase(testCase) {
    if (!testCase) return false;
    if (testCase.selectedForAutomation !== true) return false;
    const segs = testCase.segmentSummary ?? { total: 0, confirmed: 0, draft: 0 };
    const allConfirmed = segs.total > 0 && segs.confirmed === segs.total;
    const assertionConfirmed = (testCase.assertionStatus?.confirmed ?? 0) > 0;
    return allConfirmed && assertionConfirmed;
}

/** Lý do chưa thể Generate (message gợi ý cho UI, không phải lỗi API). */
export function generateGateReason(testCase) {
    if (!testCase) return "Testcase chưa có dữ liệu.";
    if (testCase.selectedForAutomation !== true) return "Testcase chưa được chọn để tự động hóa.";
    const segs = testCase.segmentSummary ?? { total: 0, confirmed: 0, draft: 0 };
    if (segs.total === 0) return "Chưa có thao tác nào.";
    if (segs.confirmed !== segs.total) {
        const draftItem = (Array.isArray(testCase.segments) ? testCase.segments : []).find(s => s.status !== "CONFIRMED");
        const name = draftItem?.label || testCase.title || "thao tác";
        return `Thao tác '${name}' chưa được xác nhận.`;
    }
    if ((testCase.assertionStatus?.confirmed ?? 0) === 0) return "Chưa có điều kiện xác nhận phù hợp với kết quả mong đợi.";
    return null;
}
