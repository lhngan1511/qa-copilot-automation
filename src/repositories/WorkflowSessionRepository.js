export default class WorkflowSessionRepository {
    save(session) {
        throw new Error("WorkflowSessionRepository.save() must be implemented.");
    }

    findById(sessionId) {
        throw new Error("WorkflowSessionRepository.findById() must be implemented.");
    }

    findAll() {
        throw new Error("WorkflowSessionRepository.findAll() must be implemented.");
    }

    findByWorkflowId(workflowId) {
        throw new Error("WorkflowSessionRepository.findByWorkflowId() must be implemented.");
    }

    exists(sessionId) {
        throw new Error("WorkflowSessionRepository.exists() must be implemented.");
    }

    deleteById(sessionId) {
        throw new Error("WorkflowSessionRepository.deleteById() must be implemented.");
    }
}
