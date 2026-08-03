/**
 * AutomationReview — mô hình cuộc review của tester trên một bộ bằng chứng.
 * Tester quyết định từng evidence: APPROVE / REJECT / EDIT.
 * Chỉ evidence APPROVED/EDITED mới được dùng để dựng mapping.
 */
export const REVIEW_DECISION = Object.freeze({
    APPROVE: "APPROVE",
    REJECT: "REJECT",
    EDIT: "EDIT"
});

let reviewSeq = 0;

export default class AutomationReview {
    constructor({ testCaseId = "", mappingDraftId = "", reviewer = "tester" } = {}) {
        this.reviewId = `R${++reviewSeq}-${Date.now()}`;
        this.testCaseId = testCaseId;
        this.mappingDraftId = mappingDraftId;
        this.reviewer = reviewer;
        this.createdAt = new Date().toISOString();
        this.completedAt = null;
        this.items = []; // { evidenceId, decision, editedValue, comment, reviewedAt }
    }

    /** Ghi quyết định cho một evidence. */
    addDecision({ evidenceId, decision, editedValue = null, comment = "" }) {
        this.items.push({
            evidenceId,
            decision,
            editedValue,
            comment,
            reviewedAt: new Date().toISOString()
        });
    }

    complete() {
        this.completedAt = new Date().toISOString();
    }

    toJSON() {
        return {
            reviewId: this.reviewId,
            testCaseId: this.testCaseId,
            mappingDraftId: this.mappingDraftId,
            reviewer: this.reviewer,
            createdAt: this.createdAt,
            completedAt: this.completedAt,
            items: this.items
        };
    }
}
