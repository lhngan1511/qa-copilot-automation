/**
 * Mapping State — vòng đời của Automation Mapping Artifact.
 * Chỉ mapping APPROVED mới được dùng làm đầu vào cho Playwright Generator.
 */
export const MAPPING_STATE = Object.freeze({
    /** Mapping đang xây dựng từ bằng chứng APPROVED (trước review hoàn tất) */
    DRAFT: "DRAFT",
    /** Đã đủ bằng chứng draft, đang chờ tester review */
    WAITING_FOR_REVIEW: "WAITING_FOR_REVIEW",
    /** Tester đã duyệt toàn bộ bằng chứng cần thiết */
    APPROVED: "APPROVED",
    /** Bị từ chối */
    REJECTED: "REJECTED",
    /** Cần chỉnh sửa thêm */
    NEEDS_REVISION: "NEEDS_REVISION"
});

export default { MAPPING_STATE };
