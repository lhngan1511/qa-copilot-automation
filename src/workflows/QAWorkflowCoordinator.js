import WorkflowRuntimeBootstrap from "./WorkflowRuntimeBootstrap.js";

import WorkflowAction from "../constants/WorkflowAction.js";

import WorkflowNames from "../constants/WorkflowNames.js";

class QAWorkflowCoordinator {
    constructor(runtime = null) {
        this.runtime = runtime || WorkflowRuntimeBootstrap.create();
    }

    /*
    =====================================================
     START REVIEW GATES
    =====================================================
    */

    startRequirementReview({ sessionId, artifactId, requirement }) {
        return this.startReview({
            workflowName: WorkflowNames.REQUIREMENT_REVIEW,
            sessionId,
            artifactId,
            artifactKey: "requirement",
            artifact: requirement
        });
    }

    startClarificationReview({ sessionId, artifactId, clarification }) {
        return this.startReview({
            workflowName: WorkflowNames.CLARIFICATION_REVIEW,
            sessionId,
            artifactId,
            artifactKey: "requirement",
            artifact: clarification
        });
    }

    startModuleReview({ sessionId, artifactId, module }) {
        return this.startReview({
            workflowName: WorkflowNames.MODULE_REVIEW,
            sessionId,
            artifactId,
            artifactKey: "module",
            artifact: module
        });
    }

    startScenarioReview({ sessionId, artifactId, scenario }) {
        return this.startReview({
            workflowName: WorkflowNames.SCENARIO_REVIEW,
            sessionId,
            artifactId,
            artifactKey: "scenario",
            artifact: scenario
        });
    }

    startTestCaseReview({ sessionId, artifactId, testCase }) {
        return this.startReview({
            workflowName: WorkflowNames.TEST_CASE_REVIEW,
            sessionId,
            artifactId,
            artifactKey: "testCase",
            artifact: testCase
        });
    }

    /*
    =====================================================
     REVIEW ACTIONS
    =====================================================
    */

    review({ workflowName, sessionId, feedback = "" }) {
        this.requireWorkflowName(workflowName);

        this.requireSessionId(sessionId);

        return this.runtime.dispatch(WorkflowAction.REVIEW, workflowName, {
            sessionId,
            feedback
        });
    }

    approve({ workflowName, sessionId, artifactId, approvedBy = "user" }) {
        this.requireWorkflowName(workflowName);

        this.requireSessionId(sessionId);

        this.requireArtifactId(artifactId);

        return this.runtime.dispatch(WorkflowAction.APPROVE, workflowName, {
            sessionId,
            artifactId,
            approvedBy
        });
    }

    reject({ workflowName, sessionId, artifactId, feedback = "", rejectedBy = "user" }) {
        this.requireWorkflowName(workflowName);

        this.requireSessionId(sessionId);

        this.requireArtifactId(artifactId);

        return this.runtime.dispatch(WorkflowAction.REJECT, workflowName, {
            sessionId,
            artifactId,
            feedback,
            rejectedBy
        });
    }

    complete({ workflowName, sessionId }) {
        this.requireWorkflowName(workflowName);

        this.requireSessionId(sessionId);

        return this.runtime.dispatch(WorkflowAction.COMPLETE, workflowName, {
            sessionId
        });
    }

    /*
    =====================================================
     CONVENIENCE APPROVAL METHODS
    =====================================================
    */

    approveRequirement({ sessionId, artifactId, approvedBy = "user" }) {
        return this.approveAndComplete({
            workflowName: WorkflowNames.REQUIREMENT_REVIEW,

            sessionId,

            artifactId,

            approvedBy
        });
    }

    approveClarification({ sessionId, artifactId, approvedBy = "user" }) {
        return this.approveAndComplete({
            workflowName: WorkflowNames.CLARIFICATION_REVIEW,

            sessionId,

            artifactId,

            approvedBy
        });
    }

    approveModule({ sessionId, artifactId, approvedBy = "user" }) {
        return this.approveAndComplete({
            workflowName: WorkflowNames.MODULE_REVIEW,

            sessionId,

            artifactId,

            approvedBy
        });
    }

    approveScenario({ sessionId, artifactId, approvedBy = "user" }) {
        return this.approveAndComplete({
            workflowName: WorkflowNames.SCENARIO_REVIEW,

            sessionId,

            artifactId,

            approvedBy
        });
    }

    approveTestCase({ sessionId, artifactId, approvedBy = "user" }) {
        return this.approveAndComplete({
            workflowName: WorkflowNames.TEST_CASE_REVIEW,

            sessionId,

            artifactId,

            approvedBy
        });
    }

    /*
    =====================================================
     LOOKUP METHODS
    =====================================================
    */

    findSession(sessionId) {
        this.requireSessionId(sessionId);

        return this.runtime.findSession(sessionId);
    }

    findArtifact(artifactId) {
        this.requireArtifactId(artifactId);

        return this.runtime.findArtifact(artifactId);
    }

    saveArtifact(artifact) {
        this.requireArtifact(artifact);

        this.requireArtifactId(artifact.artifactId);

        return this.runtime.saveArtifact(artifact);
    }

    isApproved(artifactId) {
        const artifact = this.findArtifact(artifactId);

        return artifact?.approvalStatus === "approved";
    }

    isCompleted(sessionId) {
        const session = this.findSession(sessionId);

        return session?.status === "completed";
    }

    /*
    =====================================================
     INTERNAL METHODS
    =====================================================
    */

    startReview({ workflowName, sessionId, artifactId, artifactKey, artifact }) {
        this.requireWorkflowName(workflowName);

        this.requireSessionId(sessionId);

        this.requireArtifactId(artifactId);

        this.requireArtifact(artifact);

        return this.runtime.dispatch(WorkflowAction.START, workflowName, {
            sessionId,

            artifactId,

            [artifactKey]: artifact
        });
    }

    approveAndComplete({ workflowName, sessionId, artifactId, approvedBy }) {
        const approval = this.approve({
            workflowName,

            sessionId,

            artifactId,

            approvedBy
        });

        const completion = this.complete({
            workflowName,

            sessionId
        });

        return {
            approval,

            completion,

            session: this.findSession(sessionId),

            artifact: this.findArtifact(artifactId)
        };
    }

    requireWorkflowName(workflowName) {
        if (typeof workflowName !== "string" || workflowName.trim() === "") {
            throw new Error("workflowName is required.");
        }
    }

    requireSessionId(sessionId) {
        if (typeof sessionId !== "string" || sessionId.trim() === "") {
            throw new Error("sessionId is required.");
        }
    }

    requireArtifactId(artifactId) {
        if (typeof artifactId !== "string" || artifactId.trim() === "") {
            throw new Error("artifactId is required.");
        }
    }

    requireArtifact(artifact) {
        if (!artifact || typeof artifact !== "object") {
            throw new Error("artifact is required.");
        }
    }
}

export default QAWorkflowCoordinator;
