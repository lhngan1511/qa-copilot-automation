import WorkflowAction from "../constants/WorkflowAction.js";

export default class WorkflowEngine {
    constructor({ workflowRegistry }) {
        if (!workflowRegistry) {
            throw new Error("workflowRegistry is required.");
        }

        this.workflowRegistry = workflowRegistry;
    }

    getWorkflow(workflowName) {
        if (!workflowName) {
            throw new Error("workflowName is required.");
        }

        const workflow = this.workflowRegistry.get(workflowName);

        if (!workflow) {
            throw new Error(`Workflow '${workflowName}' is not registered.`);
        }

        return workflow;
    }

    dispatch(action, workflowName, data = {}) {
        switch (action) {
            case WorkflowAction.START:
                return this.start(workflowName, data);

            case WorkflowAction.EXECUTE:
                return this.execute(workflowName, data);

            case WorkflowAction.REVIEW:
                return this.review(workflowName, data);

            case WorkflowAction.APPROVE:
                return this.approve(workflowName, data);

            case WorkflowAction.REJECT:
                return this.reject(workflowName, data);

            case WorkflowAction.COMPLETE:
                return this.complete(workflowName, data);

            default:
                throw new Error(`Unsupported workflow action: ${action}`);
        }
    }

    start(workflowName, context = {}) {
        const workflow = this.getWorkflow(workflowName);

        return workflow.start(context);
    }

    execute(workflowName, context = {}) {
        const workflow = this.getWorkflow(workflowName);

        return workflow.execute(context);
    }

    review(workflowName, reviewData = {}) {
        const workflow = this.getWorkflow(workflowName);

        return workflow.review(reviewData);
    }

    approve(workflowName, approvalData = {}) {
        const workflow = this.getWorkflow(workflowName);

        return workflow.approve(approvalData);
    }

    reject(workflowName, rejectionData = {}) {
        const workflow = this.getWorkflow(workflowName);

        return workflow.reject(rejectionData);
    }

    complete(workflowName, completionData = {}) {
        const workflow = this.getWorkflow(workflowName);

        return workflow.complete(completionData);
    }
}
