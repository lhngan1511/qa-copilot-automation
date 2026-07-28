export default class ArtifactManager {
    constructor({ repository } = {}) {
        if (!repository) {
            throw new Error("Artifact repository is required.");
        }

        this.repository = repository;
    }

    save(artifact) {
        return this.repository.save(artifact);
    }

    findById(artifactId) {
        return this.repository.findById(artifactId);
    }

    findAll() {
        return this.repository.findAll();
    }

    findByWorkflowId(workflowId) {
        return this.repository.findByWorkflowId(workflowId);
    }

    findBySessionId(sessionId) {
        return this.repository.findBySessionId(sessionId);
    }

    exists(artifactId) {
        return this.repository.exists(artifactId);
    }

    deleteById(artifactId) {
        return this.repository.deleteById(artifactId);
    }
}
