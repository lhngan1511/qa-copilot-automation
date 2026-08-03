/**
 * ReviewService — áp quyết định của tester lên discovery, tạo bộ bằng chứng APPROVED.
 * KHÔNG có cơ chế auto-approve AI Proposal.
 */
import AutomationReview, { REVIEW_DECISION } from "./AutomationReview.js";
import { EVIDENCE_STATE } from "../evidence/EvidenceState.js";
import { isProposalSource } from "../evidence/EvidenceSource.js";

export default class ReviewService {
    constructor({ reviewer = "tester" } = {}) {
        this.reviewer = reviewer;
    }

    /** Liệt kê các evidence đang DRAFT cần tester quyết định. */
    pendingDrafts(discovery) {
        return discovery.evidence.filter((e) => e.isDraft);
    }

    /**
     * @param {object} discovery AutomationDiscovery
     * @param {Array<{evidenceId:string, decision:string, editedValue?:string, comment?:string}>} decisions
     * @returns {{review:AutomationReview, approved:object[], rejected:object[], edits:object[]}}
     */
    review(discovery, decisions = []) {
        const review = new AutomationReview({
            testCaseId: discovery.testCaseId,
            reviewer: this.reviewer
        });
        const byId = new Map(discovery.evidence.map((e) => [e.id, e]));
        const approved = [];
        const rejected = [];
        const edits = [];

        for (const d of decisions) {
            const ev = byId.get(d.evidenceId);
            if (!ev) continue;
            const now = new Date().toISOString();
            switch (d.decision) {
                case REVIEW_DECISION.APPROVE:
                    ev.state = EVIDENCE_STATE.APPROVED;
                    ev.reviewedBy = this.reviewer;
                    ev.reviewedAt = now;
                    ev.decision = REVIEW_DECISION.APPROVE;
                    approved.push(ev);
                    break;
                case REVIEW_DECISION.REJECT:
                    ev.state = EVIDENCE_STATE.REJECTED;
                    ev.reviewedBy = this.reviewer;
                    ev.reviewedAt = now;
                    ev.decision = REVIEW_DECISION.REJECT;
                    rejected.push(ev);
                    break;
                case REVIEW_DECISION.EDIT:
                    ev.state = EVIDENCE_STATE.EDITED;
                    if (d.editedValue !== null && d.editedValue !== undefined) {
                        ev.value = d.editedValue;
                    }
                    ev.reviewedBy = this.reviewer;
                    ev.reviewedAt = now;
                    ev.decision = REVIEW_DECISION.EDIT;
                    edits.push(ev);
                    approved.push(ev); // EDITED được dùng như approved
                    break;
                default:
                    break;
            }
            review.addDecision({ ...d, evidenceId: d.evidenceId, reviewedAt: now });
        }

        // Cảnh báo: AI proposal không được tự duyệt nếu không có quyết định tường minh.
        const autoApprovedProposals = discovery.evidence.filter(
            (e) => isProposalSource(e.source) && e.isApproved && !e.reviewedBy
        );

        review.complete();
        return { review, approved, rejected, edits, autoApprovedProposals };
    }
}
