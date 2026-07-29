import express from "express";
import RepositoryFactory from "../factories/RepositoryFactory.js";
import WorkflowRuntimeBootstrap from "../workflows/WorkflowRuntimeBootstrap.js";
import QAWorkflowCoordinator from "../workflows/QAWorkflowCoordinator.js";
import QACopilot from "../QACopilot.js";
import QACopilotApplicationService from "../services/QACopilotApplicationService.js";
import QACopilotController from "../controllers/QACopilotController.js";
import createWorkflowRoutes from "../routes/workflowRoutes.js";
import errorHandler from "../middleware/errorHandler.js";
import RequirementUploadService from "../services/RequirementUploadService.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serverDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(serverDirectory, "../..");
const defaultPublicDirectory = path.join(projectDirectory, "public");

export default function createApp({
    repositoryType,
    dataDir,
    controller = null,
    publicDir = defaultPublicDirectory,
    outputDir = "./outputs",
    uploadDir
} = {}) {
    const repositories = RepositoryFactory.create({
        type: repositoryType,
        dataDir
    });
    const runtime = WorkflowRuntimeBootstrap.create({
        artifactRepository: repositories.artifactRepository,
        workflowSessionRepository: repositories.workflowSessionRepository
    });
    const workflowCoordinator = new QAWorkflowCoordinator(runtime);
    const qaCopilot = new QACopilot({ workflowCoordinator });
    const applicationService = new QACopilotApplicationService({ qaCopilot });
    const resolvedController = controller ?? new QACopilotController({ applicationService });
    const requirementUploadService = new RequirementUploadService({
        uploadDir: uploadDir ?? path.join(repositories.config.dataDir, "uploads")
    });
    const resolvedPublicDirectory = path.resolve(publicDir);
    const indexFile = path.join(resolvedPublicDirectory, "index.html");

    const app = express();
    app.disable("x-powered-by");
    app.post(
        "/api/requirements/upload",
        express.raw({ type: "text/markdown", limit: requirementUploadService.maxBytes }),
        (req, res, next) => {
            try {
                const result = requirementUploadService.save({
                    fileName: req.get("x-file-name"),
                    content: req.body
                });
                res.status(201).json({ success: true, data: result, error: null });
            } catch (error) {
                next(error);
            }
        }
    );
    app.use(express.json({ limit: "2mb" }));
    app.get("/health", (_req, res) => {
        res.status(200).json({
            success: true,
            data: { status: "ok" },
            error: null
        });
    });
    app.use(
        "/api/workflows",
        createWorkflowRoutes({
            controller: resolvedController,
            outputDir,
            resolveRequirementFile: requirementId => requirementUploadService.resolve(requirementId)
        })
    );
    app.get("/", (_req, res, next) => {
        if (!fs.existsSync(indexFile)) {
            const error = new Error(`Frontend index not found: ${indexFile}`);
            error.code = "FRONTEND_NOT_FOUND";
            error.statusCode = 500;
            return next(error);
        }

        return res.sendFile(indexFile);
    });
    app.use(express.static(resolvedPublicDirectory, { index: false }));
    app.use(errorHandler);

    app.locals.dependencies = {
        config: repositories.config,
        repositories,
        runtime,
        workflowCoordinator,
        qaCopilot,
        applicationService,
        controller: resolvedController,
        requirementUploadService,
        publicDirectory: resolvedPublicDirectory,
        indexFile,
        indexExists: fs.existsSync(indexFile)
    };

    return app;
}
