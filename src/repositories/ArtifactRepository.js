export default class ArtifactRepository {
    save(artifact) {
        throw new Error("ArtifactRepository.save() must be implemented.");
    }

    findById(artifactId) {
        throw new Error("ArtifactRepository.findById() must be implemented.");
    }

    findAll() {
        throw new Error("ArtifactRepository.findAll() must be implemented.");
    }

    findByWorkflowId(workflowId) {
        throw new Error("ArtifactRepository.findByWorkflowId() must be implemented.");
    }

    findBySessionId(sessionId) {
        throw new Error("ArtifactRepository.findBySessionId() must be implemented.");
    }

    exists(artifactId) {
        throw new Error("ArtifactRepository.exists() must be implemented.");
    }

    deleteById(artifactId) {
        throw new Error("ArtifactRepository.deleteById() must be implemented.");
    }
}
