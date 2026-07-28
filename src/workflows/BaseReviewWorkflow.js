import BaseWorkflow from "./BaseWorkflow.js";

export default class BaseReviewWorkflow extends BaseWorkflow {
    constructor({ artifactRepository, workflowSessionRepository }) {
        super({
            artifactRepository,
            workflowSessionRepository
        });
    }

    review() {
        throw new Error("BaseReviewWorkflow.review() must be implemented.");
    }

    approve() {
        throw new Error("BaseReviewWorkflow.approve() must be implemented.");
    }

    reject() {
        throw new Error("BaseReviewWorkflow.reject() must be implemented.");
    }
}
