import WorkflowStatus from "../constants/WorkflowStatus.js";

export default class WorkflowSession {
    constructor({
        sessionId,
        workflowId,
        status = WorkflowStatus.CREATED,
        currentStage = "",
        artifactIds = [],
        waitingForReviewArtifactId = null,
        startedAt = null,
        updatedAt = null,
        completedAt = null,
        lastError = null,
        metadata = {}
    } = {}) {
        this.sessionId = sessionId;
        this.workflowId = workflowId;
        this.status = status;
        this.currentStage = currentStage;
        this.artifactIds = artifactIds;
        this.waitingForReviewArtifactId = waitingForReviewArtifactId;
        this.startedAt = startedAt;
        this.updatedAt = updatedAt;
        this.completedAt = completedAt;
        this.lastError = lastError;
        this.metadata = metadata;
    }
}
