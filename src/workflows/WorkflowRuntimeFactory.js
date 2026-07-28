import WorkflowEngine from "./WorkflowEngine.js";
import WorkflowRuntime from "./WorkflowRuntime.js";

import WorkflowSessionManager from "../managers/WorkflowSessionManager.js";

import ArtifactManager from "../managers/ArtifactManager.js";

import MemoryWorkflowSessionRepository from "../repositories/MemoryWorkflowSessionRepository.js";

import MemoryArtifactRepository from "../repositories/MemoryArtifactRepository.js";

export default class WorkflowRuntimeFactory {
    static create({
        workflowRegistry,
        workflowSessionRepository = null,
        artifactRepository = null
    } = {}) {
        if (!workflowRegistry) {
            throw new Error("workflowRegistry is required.");
        }

        const resolvedSessionRepository =
            workflowSessionRepository ?? new MemoryWorkflowSessionRepository();

        const resolvedArtifactRepository = artifactRepository ?? new MemoryArtifactRepository();

        const workflowSessionManager = new WorkflowSessionManager({
            repository: resolvedSessionRepository
        });

        const artifactManager = new ArtifactManager({
            repository: resolvedArtifactRepository
        });

        const workflowEngine = new WorkflowEngine({
            workflowRegistry
        });

        return new WorkflowRuntime({
            workflowEngine,
            workflowSessionManager,
            artifactManager
        });
    }
}
