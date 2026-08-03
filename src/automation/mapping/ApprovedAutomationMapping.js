/**
 * ApprovedAutomationMapping — Automation Mapping đã được Tester duyệt.
 * Là loại Artifact CHÍNH THỨC mà Playwright Generator được phép đọc.
 * Trạng thái khóa ở APPROVED; không có AI Proposal tự chuyển sang đây.
 */
import AutomationMapping from "./AutomationMapping.js";
import { MAPPING_STATE } from "./MappingState.js";

export default class ApprovedAutomationMapping extends AutomationMapping {
    constructor(props = {}) {
        super({
            ...props,
            state: MAPPING_STATE.APPROVED
        });
    }

    /** Build từ một AutomationMapping đã được review duyệt. */
    static fromMapping(mapping, { reviewer = "tester", reviewedAt = new Date().toISOString() } = {}) {
        return new ApprovedAutomationMapping({
            artifactId: mapping.artifactId,
            testCaseId: mapping.testCaseId,
            module: mapping.module,
            feature: mapping.feature,
            pageObject: mapping.pageObject,
            route: mapping.route,
            setup: mapping.setup,
            teardown: mapping.teardown,
            actions: mapping.actions,
            assertions: mapping.assertions,
            locatorReferences: mapping.locatorReferences,
            dataReferences: mapping.dataReferences,
            evidenceIds: mapping.evidenceIds,
            missingEvidence: mapping.missingEvidence,
            readiness: mapping.readiness,
            reviewer,
            reviewedAt,
            createdAt: mapping.createdAt
        });
    }
}
