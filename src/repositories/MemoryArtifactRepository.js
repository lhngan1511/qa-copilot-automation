import ArtifactRepository from "./ArtifactRepository.js";

export default class MemoryArtifactRepository extends ArtifactRepository {
    constructor() {
        super();
        this.artifacts = new Map();
    }

    save(artifact) {
        this.artifacts.set(artifact.artifactId, artifact);
        return artifact;
    }

    findById(artifactId) {
        return this.artifacts.get(artifactId) ?? null;
    }

    findAll() {
        return [...this.artifacts.values()];
    }

    findByWorkflowId(workflowId) {
        return this.findAll().filter(artifact => artifact.workflowId === workflowId);
    }

    findBySessionId(sessionId) {
        return this.findAll().filter(artifact => artifact.sessionId === sessionId);
    }

    exists(artifactId) {
        return this.artifacts.has(artifactId);
    }

    deleteById(artifactId) {
        return this.artifacts.delete(artifactId);
    }
}
