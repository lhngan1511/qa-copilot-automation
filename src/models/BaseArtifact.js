import ArtifactStatus from "../constants/ArtifactStatus.js";

export default class BaseArtifact {
    constructor({
        artifactId,
        workflowId = "",
        sessionId = "",
        artifactType,
        stage = "",
        status = ArtifactStatus.DRAFT,
        revision = 1,
        inputArtifactIds = [],
        createdAt = null,
        updatedAt = null,
        reviewedAt = null,
        approvedAt = null,
        payload = {},
        reviewComments = [],
        metadata = {}
    } = {}) {
        this.artifactId = artifactId;
        this.workflowId = workflowId;
        this.sessionId = sessionId;
        this.artifactType = artifactType;
        this.stage = stage;
        this.status = status;
        this.revision = revision;
        this.inputArtifactIds = inputArtifactIds;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
        this.reviewedAt = reviewedAt;
        this.approvedAt = approvedAt;
        this.payload = payload;
        this.reviewComments = reviewComments;
        this.metadata = metadata;
    }
}
