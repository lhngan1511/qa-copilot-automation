/**
 * Automation Evidence — một mẩu bằng chứng cho automation.
 * Mỗi evidence phải truy vết được:
 *   - lấy từ đâu (source)
 *   - ai đề xuất (proposedBy)
 *   - ai duyệt (reviewedBy)
 *   - khi nào duyệt (reviewedAt)
 *
 * Kinds: route | locator | assertion | selector | pageObject | testData | action
 */
import { EVIDENCE_STATE } from "./EvidenceState.js";
import { isProposalSource } from "./EvidenceSource.js";

let evidenceSeq = 0;

export default class AutomationEvidence {
    constructor({
        id = "",
        testCaseId = "",
        stepId = null,
        kind = "locator", // route | locator | assertion | selector | pageObject | testData | action
        key = "",
        value = "",
        strategy = null,
        source = "AI_PROPOSAL",
        proposedBy = "AI",
        state = null,
        reviewedBy = null,
        reviewedAt = null,
        decision = null,
        comment = "",
        notes = ""
    } = {}) {
        this.id = id || `EV-${++evidenceSeq}-${Date.now()}`;
        this.testCaseId = testCaseId;
        this.stepId = stepId;
        this.kind = kind;
        this.key = key;
        this.value = value;
        this.strategy = strategy;
        this.source = source;
        this.proposedBy = proposedBy;
        // Proposal source (AI_PROPOSAL/DOM_DISCOVERY) luôn bắt đầu DRAFT, không bao giờ tự APPROVED
        this.state = state ?? (isProposalSource(source) ? EVIDENCE_STATE.DRAFT : EVIDENCE_STATE.DRAFT);
        this.reviewedBy = reviewedBy;
        this.reviewedAt = reviewedAt;
        this.decision = decision; // APPROVE | REJECT | EDIT
        this.comment = comment;
        this.notes = notes;
    }

    get isApproved() {
        return this.state === EVIDENCE_STATE.APPROVED || this.state === EVIDENCE_STATE.EDITED;
    }

    get isDraft() {
        return this.state === EVIDENCE_STATE.DRAFT;
    }

    get isProposal() {
        return isProposalSource(this.source);
    }

    toJSON() {
        return {
            id: this.id,
            testCaseId: this.testCaseId,
            stepId: this.stepId,
            kind: this.kind,
            key: this.key,
            value: this.value,
            strategy: this.strategy,
            source: this.source,
            proposedBy: this.proposedBy,
            state: this.state,
            reviewedBy: this.reviewedBy,
            reviewedAt: this.reviewedAt,
            decision: this.decision,
            comment: this.comment
        };
    }
}
