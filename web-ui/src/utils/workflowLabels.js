const statusLabels = {
    AI_ANALYSIS_REVIEW_REQUIRED: "Cần review phân tích AI",
    TEST_CASE_REVIEW_REQUIRED: "Cần review testcase",
    REVIEW_REQUIRED: "Cần review",
    COMPLETED: "Hoàn tất",
    FAILED: "Thất bại",
    UNKNOWN: "Không xác định"
};

const stepLabels = {
    AI_ANALYSIS_REVIEW: "Review phân tích AI",
    TEST_CASE_REVIEW: "Review testcase",
    EXPORT: "Xuất kết quả",
    ERROR: "Cần kiểm tra"
};

const actionLabels = {
    ANSWER_CLARIFICATIONS: "Trả lời câu hỏi",
    APPROVE_AI_ANALYSIS: "Duyệt phân tích AI",
    UPDATE_TEST_CASES: "Cập nhật testcase",
    APPROVE_TEST_CASES: "Duyệt testcase",
    DOWNLOAD_JSON: "Tải JSON",
    DOWNLOAD_EXCEL: "Tải Excel"
};

export function getWorkflowStatusLabel(status) {
    return statusLabels[status] ?? statusLabels.UNKNOWN;
}

export function getWorkflowStepLabel(step) {
    return stepLabels[step] ?? "Không xác định";
}

export function getWorkflowActionLabel(action) {
    return actionLabels[action] ?? action;
}

export function getStatusTone(status) {
    if (status === "COMPLETED") return "success";
    if (status === "FAILED") return "danger";
    if (status === "UNKNOWN") return "neutral";
    return "warning";
}
