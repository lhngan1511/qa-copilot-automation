export default class WorkflowRuntime {
    constructor({ workflowEngine, workflowSessionManager, artifactManager } = {}) {
        if (!workflowEngine) {
            throw new Error("workflowEngine is required.");
        }

        if (!workflowSessionManager) {
            throw new Error("workflowSessionManager is required.");
        }

        if (!artifactManager) {
            throw new Error("artifactManager is required.");
        }

        this.workflowEngine = workflowEngine;

        this.workflowSessionManager = workflowSessionManager;

        this.artifactManager = artifactManager;
    }

    dispatch(action, workflowName, context = {}) {
        return this.workflowEngine.dispatch(action, workflowName, context);
    }

    saveSession(session) {
        return this.workflowSessionManager.save(session);
    }

    findSession(sessionId) {
        return this.workflowSessionManager.findById(sessionId);
    }

    findSessions() {
        return this.workflowSessionManager.findAll();
    }

    deleteSession(sessionId) {
        return this.workflowSessionManager.deleteById(sessionId);
    }

    saveArtifact(artifact) {
        return this.artifactManager.save(artifact);
    }

    findArtifact(artifactId) {
        return this.artifactManager.findById(artifactId);
    }

    findArtifactsBySessionId(sessionId) {
        return this.artifactManager.findBySessionId(sessionId);
    }

    deleteArtifactsBySessionId(sessionId) {
        const artifacts = this.artifactManager.findBySessionId(sessionId);
        artifacts.forEach(artifact => this.artifactManager.deleteById(artifact.artifactId));
        return artifacts.length;
    }
}
