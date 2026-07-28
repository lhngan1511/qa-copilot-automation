import WorkflowSessionRepository from "./WorkflowSessionRepository.js";

export default class MemoryWorkflowSessionRepository extends WorkflowSessionRepository {
    constructor() {
        super();
        this.sessions = new Map();
    }

    save(session) {
        this.sessions.set(session.sessionId, session);
        return session;
    }

    findById(sessionId) {
        return this.sessions.get(sessionId) ?? null;
    }

    findAll() {
        return [...this.sessions.values()];
    }

    findByWorkflowId(workflowId) {
        return this.findAll().filter(session => session.workflowId === workflowId);
    }

    exists(sessionId) {
        return this.sessions.has(sessionId);
    }

    deleteById(sessionId) {
        return this.sessions.delete(sessionId);
    }
}
