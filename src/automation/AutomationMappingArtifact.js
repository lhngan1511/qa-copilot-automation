/**
 * Model Automation Mapping Artifact.
 * Chuyển Approved TestCase thành cấu trúc action/target/locator/valueRef/assertion
 * có traceability về testcase và step nguồn.
 */
export default class AutomationMappingArtifact {
    constructor({
        artifactId = "",
        status = "DRAFT",
        revision = 1,
        testCaseId = "",
        module = "",
        feature = "",
        pageObject = "",
        route = "",
        setup = [],
        teardown = [],
        actions = [],
        assertions = [],
        locatorReferences = [],
        dataReferences = {},
        blockers = [],
        readiness = "PENDING",
        metadata = {},
        createdAt = new Date().toISOString()
    } = {}) {
        this.artifactId = artifactId;
        this.status = status; // DRAFT | WAITING_FOR_REVIEW | APPROVED | REJECTED
        this.revision = revision;
        this.testCaseId = testCaseId;
        this.module = module;
        this.feature = feature;
        this.pageObject = pageObject;
        this.route = route;
        this.setup = setup;
        this.teardown = teardown;
        this.actions = actions;
        this.assertions = assertions;
        this.locatorReferences = locatorReferences;
        this.dataReferences = dataReferences;
        this.blockers = blockers;
        this.readiness = readiness; // READY | DATA_REQUIRED | NOT_READY
        this.metadata = metadata;
        this.createdAt = createdAt;
    }

    get isApproved() {
        return this.status === "APPROVED";
    }

    get hasBlockers() {
        return Array.isArray(this.blockers) && this.blockers.length > 0;
    }

    toJSON() {
        return {
            artifactType: "AUTOMATION_MAPPING",
            artifactId: this.artifactId,
            status: this.status,
            revision: this.revision,
            testCaseId: this.testCaseId,
            module: this.module,
            feature: this.feature,
            pageObject: this.pageObject,
            route: this.route,
            setup: this.setup,
            teardown: this.teardown,
            actions: this.actions,
            assertions: this.assertions,
            locatorReferences: this.locatorReferences,
            dataReferences: this.dataReferences,
            blockers: this.blockers,
            readiness: this.readiness,
            metadata: this.metadata,
            createdAt: this.createdAt
        };
    }
}
