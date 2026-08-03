/**
 * Automation Mapping — mô hình mapping cho một testcase.
 * Được dựng CHỈ từ bằng chứng APPROVED (EvidenceState.APPROVED/EDITED).
 * Không tự sinh locator, không tự sinh test data, không tự suy luận assertion/route.
 *
 * Shape của mapping tương thích với PlaywrightGenerator hiện có
 * (route, pageObject, actions, assertions, locatorReferences, dataReferences, setup)
 * để Sprint sau chỉ việc cắm Generator vào.
 */
import { MAPPING_STATE } from "./MappingState.js";

export default class AutomationMapping {
    constructor({
        artifactId = "",
        testCaseId = "",
        module = "",
        feature = "",
        state = MAPPING_STATE.DRAFT,
        pageObject = null,
        route = null,
        setup = [],
        teardown = [],
        actions = [],
        assertions = [],
        locatorReferences = [],
        dataReferences = {},
        evidenceIds = [],
        missingEvidence = [],
        readiness = "BLOCKED",
        reviewer = null,
        reviewedAt = null,
        createdAt = new Date().toISOString()
    } = {}) {
        this.artifactId = artifactId;
        this.testCaseId = testCaseId;
        this.module = module;
        this.feature = feature;
        this.state = state;
        this.pageObject = pageObject;
        this.route = route;
        this.setup = setup;
        this.teardown = teardown;
        this.actions = actions;
        this.assertions = assertions;
        this.locatorReferences = locatorReferences;
        this.dataReferences = dataReferences;
        this.evidenceIds = evidenceIds;
        this.missingEvidence = missingEvidence;
        this.readiness = readiness;
        this.reviewer = reviewer;
        this.reviewedAt = reviewedAt;
        this.createdAt = createdAt;
    }

    get isApproved() {
        return this.state === MAPPING_STATE.APPROVED;
    }

    get hasBlockers() {
        return this.readiness === "BLOCKED";
    }

    toJSON() {
        return {
            artifactType: "AUTOMATION_MAPPING",
            artifactId: this.artifactId,
            testCaseId: this.testCaseId,
            module: this.module,
            feature: this.feature,
            state: this.state,
            pageObject: this.pageObject,
            route: this.route,
            setup: this.setup,
            teardown: this.teardown,
            actions: this.actions,
            assertions: this.assertions,
            locatorReferences: this.locatorReferences,
            dataReferences: this.dataReferences,
            evidenceIds: this.evidenceIds,
            missingEvidence: this.missingEvidence,
            readiness: this.readiness,
            reviewer: this.reviewer,
            reviewedAt: this.reviewedAt,
            createdAt: this.createdAt
        };
    }
}
