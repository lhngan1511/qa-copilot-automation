import RepositoryConfig from "../config/RepositoryConfig.js";
import MemoryArtifactRepository from "../repositories/MemoryArtifactRepository.js";
import MemoryWorkflowSessionRepository from "../repositories/MemoryWorkflowSessionRepository.js";
import FileArtifactRepository from "../repositories/FileArtifactRepository.js";
import FileWorkflowSessionRepository from "../repositories/FileWorkflowSessionRepository.js";

export default class RepositoryFactory {
    static create(options = {}) {
        const config = RepositoryConfig.resolve(options);

        if (config.type === "memory") {
            return {
                config,
                artifactRepository: new MemoryArtifactRepository(),
                workflowSessionRepository: new MemoryWorkflowSessionRepository()
            };
        }

        return {
            config,
            artifactRepository: new FileArtifactRepository({
                dataDir: config.dataDir
            }),
            workflowSessionRepository: new FileWorkflowSessionRepository({
                dataDir: config.dataDir
            })
        };
    }
}
