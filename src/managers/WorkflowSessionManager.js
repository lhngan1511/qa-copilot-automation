export default class WorkflowSessionManager {
    constructor({ repository } = {}) {
        if (!repository) {
            throw new Error("WorkflowSession repository is required.");
        }

        this.repository = repository;
    }

    save(session) {
        return this.repository.save(session);
    }

    findById(sessionId) {
        return this.repository.findById(sessionId);
    }

    findAll() {
        return this.repository.findAll();
    }

    exists(sessionId) {
        return this.repository.exists(sessionId);
    }

    deleteById(sessionId) {
        return this.repository.deleteById(sessionId);
    }
}
