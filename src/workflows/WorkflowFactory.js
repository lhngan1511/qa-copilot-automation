import RequirementReviewWorkflow from "./RequirementReviewWorkflow.js";

import ModuleReviewWorkflow from "./ModuleReviewWorkflow.js";

import ScenarioReviewWorkflow from "./ScenarioReviewWorkflow.js";

import TestCaseReviewWorkflow from "./TestCaseReviewWorkflow.js";

export default class WorkflowFactory {
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

    createRequirementReviewWorkflow() {
        return new RequirementReviewWorkflow({
            artifactRepository: this.artifactRepository,

            workflowSessionRepository: this.workflowSessionRepository
        });
    }

    createModuleReviewWorkflow() {
        return new ModuleReviewWorkflow({
            artifactRepository: this.artifactRepository,

            workflowSessionRepository: this.workflowSessionRepository
        });
    }

    createScenarioReviewWorkflow() {
        return new ScenarioReviewWorkflow({
            artifactRepository: this.artifactRepository,

            workflowSessionRepository: this.workflowSessionRepository
        });
    }

    createTestCaseReviewWorkflow() {
        return new TestCaseReviewWorkflow({
            artifactRepository: this.artifactRepository,

            workflowSessionRepository: this.workflowSessionRepository
        });
    }
}
