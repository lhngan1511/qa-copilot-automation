/**
 * Evidence State — vòng đời của một mẩu bằng chứng (evidence).
 * Chỉ evidence APPROVED mới được dùng để dựng Automation Mapping.
 */
export const EVIDENCE_STATE = Object.freeze({
    /** Mới thu thập, chưa qua review */
    DRAFT: "DRAFT",
    /** Tester duyệt */
    APPROVED: "APPROVED",
    /** Tester từ chối */
    REJECTED: "REJECTED",
    /** Tester sửa rồi duyệt */
    EDITED: "EDITED"
});

export function canBeUsedInMapping(state) {
    return state === EVIDENCE_STATE.APPROVED || state === EVIDENCE_STATE.EDITED;
}

export default { EVIDENCE_STATE, canBeUsedInMapping };
