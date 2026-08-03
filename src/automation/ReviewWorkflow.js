/**
 * ReviewWorkflow — điều phối toàn bộ Automation Mapping Layer:
 *
 *   approved-testcases.json (1 testcase)
 *     -> AutomationDiscovery  (thu thập evidence, AI proposal = DRAFT)
 *     -> Automation Mapping (Draft)   (chỉ dùng evidence APPROVED)
 *     -> Automation Review   (tester Approve/Reject/Edit)
 *     -> Approved Automation Mapping  (state=APPROVED, chỉ dùng evidence approved)
 *     -> Readiness (READY / PARTIAL / BLOCKED) trên mapping đã review
 *
 * Generator/Runner KHÔNG nằm trong sprint này.
 */
import DiscoveryService from "./discovery/DiscoveryService.js";
import MappingBuilder from "./mapping/MappingBuilder.js";
import ReviewService from "./review/ReviewService.js";
import ReadinessEvaluator from "./mapping/ReadinessEvaluator.js";
import ApprovedAutomationMapping from "./mapping/ApprovedAutomationMapping.js";
import { MAPPING_STATE } from "./mapping/MappingState.js";

export default class ReviewWorkflow {
    constructor({ locatorStore = null, aiProposer = null, reviewer = "tester" } = {}) {
        this.discoveryService = new DiscoveryService({ locatorStore, aiProposer });
        this.mappingBuilder = new MappingBuilder();
        this.reviewService = new ReviewService({ reviewer });
        this.readinessEvaluator = new ReadinessEvaluator();
    }

    /**
     * Bước 1-2: Discovery + dựng Draft mapping (chỉ dùng evidence đã APPROVED sẵn).
     */
    discover(testCase) {
        const discovery = this.discoveryService.discover(testCase);
        const approved = discovery.evidence.filter((e) => e.isApproved);
        const draftMapping = this.mappingBuilder.build({
            testCase,
            approvedEvidence: approved,
            state: MAPPING_STATE.WAITING_FOR_REVIEW
        });
        this.readinessEvaluator.apply(draftMapping);
        return { discovery, draftMapping };
    }

    /**
     * Bước 3: Tester review các evidence DRAFT.
     * @returns {AutomationReview}
     */
    review(discovery, decisions = []) {
        return this.reviewService.review(discovery, decisions);
    }

    /**
     * Bước 4-5: Dựng Approved mapping từ bộ evidence đã duyệt + đánh giá readiness.
     */
    approve({ testCase, discovery, reviewer = this.reviewService.reviewer }) {
        const approvedEvidence = discovery.evidence.filter((e) => e.isApproved);
        const mapping = this.mappingBuilder.build({
            testCase,
            approvedEvidence,
            state: MAPPING_STATE.APPROVED
        });
        const readiness = this.readinessEvaluator.apply(mapping);
        const approvedMapping = ApprovedAutomationMapping.fromMapping(mapping, {
            reviewer,
            reviewedAt: new Date().toISOString()
        });
        return { approvedMapping, readiness };
    }

    /**
     * Chạy trọn vòng (dùng khi đã có sẵn danh sách quyết định review).
     */
    runFull({ testCase, decisions = [], reviewer = this.reviewService.reviewer }) {
        const { discovery, draftMapping } = this.discover(testCase);
        const review = this.review(discovery, decisions);
        const { approvedMapping, readiness } = this.approve({ testCase, discovery, reviewer });
        return {
            discovery,
            draftMapping,
            review,
            approvedMapping,
            readiness
        };
    }
}
