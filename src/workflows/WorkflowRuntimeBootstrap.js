import WorkflowRegistry from "./WorkflowRegistry.js";

import WorkflowBootstrap from "./WorkflowBootstrap.js";

import WorkflowRuntimeFactory from "./WorkflowRuntimeFactory.js";

import MemoryWorkflowSessionRepository from "../repositories/MemoryWorkflowSessionRepository.js";

import MemoryArtifactRepository from "../repositories/MemoryArtifactRepository.js";

export default class WorkflowRuntimeBootstrap {
    static create({ workflowSessionRepository = null, artifactRepository = null } = {}) {
        const workflowRegistry = new WorkflowRegistry();

        const resolvedWorkflowSessionRepository =
            workflowSessionRepository ?? new MemoryWorkflowSessionRepository();

        const resolvedArtifactRepository =
            artifactRepository ?? new MemoryArtifactRepository();

        WorkflowBootstrap.registerAll({
            workflowRegistry,
            workflowSessionRepository: resolvedWorkflowSessionRepository,
            artifactRepository: resolvedArtifactRepository
        });

        return WorkflowRuntimeFactory.create({
            workflowRegistry,
            workflowSessionRepository: resolvedWorkflowSessionRepository,
            artifactRepository: resolvedArtifactRepository
        });
    }
}
