import WorkflowNames from "../constants/WorkflowNames.js";

import RequirementReviewWorkflow from "./RequirementReviewWorkflow.js";

import ModuleReviewWorkflow from "./ModuleReviewWorkflow.js";

import ScenarioReviewWorkflow from "./ScenarioReviewWorkflow.js";

import TestCaseReviewWorkflow from "./TestCaseReviewWorkflow.js";

export default class WorkflowBootstrap {
    static registerAll({ workflowRegistry, artifactRepository, workflowSessionRepository } = {}) {
        if (!workflowRegistry) {
            throw new Error("workflowRegistry is required.");
        }

        if (!artifactRepository) {
            throw new Error("artifactRepository is required.");
        }

        if (!workflowSessionRepository) {
            throw new Error("workflowSessionRepository is required.");
        }

        const dependencies = {
            artifactRepository,
            workflowSessionRepository
        };

        workflowRegistry.register(
            WorkflowNames.CLARIFICATION_REVIEW,
            new RequirementReviewWorkflow(dependencies)
        );

        workflowRegistry.register(
            WorkflowNames.REQUIREMENT_REVIEW,
            new RequirementReviewWorkflow(dependencies)
        );

        workflowRegistry.register(
            WorkflowNames.MODULE_REVIEW,
            new ModuleReviewWorkflow(dependencies)
        );

        workflowRegistry.register(
            WorkflowNames.SCENARIO_REVIEW,
            new ScenarioReviewWorkflow(dependencies)
        );

        workflowRegistry.register(
            WorkflowNames.TEST_CASE_REVIEW,
            new TestCaseReviewWorkflow(dependencies)
        );

        return workflowRegistry;
    }
}
