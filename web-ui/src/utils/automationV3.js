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
