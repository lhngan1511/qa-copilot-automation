export default class BaseWorkflow {
    constructor({ artifactRepository, workflowSessionRepository }) {
        if (!artifactRepository) {
            throw new Error("artifactRepository is required.");
        }

        if (!workflowSessionRepository) {
            throw new Error("workflowSessionRepository is required.");
        }

        this.artifactRepository = artifactRepository;

        this.workflowSessionRepository = workflowSessionRepository;
    }

    start() {
        throw new Error("BaseWorkflow.start() must be implemented.");
    }

    execute() {
        throw new Error("BaseWorkflow.execute() must be implemented.");
    }

    review() {
        throw new Error("BaseWorkflow.review() must be implemented.");
    }

    approve() {
        throw new Error("BaseWorkflow.approve() must be implemented.");
    }

    reject() {
        throw new Error("BaseWorkflow.reject() must be implemented.");
    }

    complete() {
        throw new Error("BaseWorkflow.complete() must be implemented.");
    }
}
