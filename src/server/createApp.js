import express from "express";
import RepositoryFactory from "../factories/RepositoryFactory.js";
import WorkflowRuntimeBootstrap from "../workflows/WorkflowRuntimeBootstrap.js";
import QAWorkflowCoordinator from "../workflows/QAWorkflowCoordinator.js";
import QACopilot from "../QACopilot.js";
import QACopilotApplicationService from "../services/QACopilotApplicationService.js";
import QACopilotController from "../controllers/QACopilotController.js";
import createWorkflowRoutes from "../routes/workflowRoutes.js";
import createAutomationWorkspaceRoutes from "../routes/automationWorkspaceRoutes.js";
import createCodeGenRoutes from "../routes/codeGenRoutes.js";
import createTemplateTestCaseRoutes from "../routes/templateTestCaseRoutes.js";
import CodeGenSessionManager from "../codegen/CodeGenSessionManager.js";
import CodeGenRecordingStore from "../codegen/CodeGenRecordingStore.js";
import AutomationWorkspace from "../codegen/AutomationWorkspace.js";
import CurrentRecordingSession from "../codegen/CurrentRecordingSession.js";
import GenerateService from "../codegen/GenerateService.js";
import AutomationWorkspaceApplicationService from "../services/AutomationWorkspaceApplicationService.js";
import ActionLibrary from "../codegen/ActionLibrary.js";
import BoundaryEntryStore from "../codegen/BoundaryEntryStore.js";
import BoundaryTestingService from "../services/BoundaryTestingService.js";
import PlaywrightRunner from "../automation/PlaywrightRunner.js";
import createAutomationV3Routes from "../routes/automationV3Routes.js";
import createBoundaryTestingRoutes from "../routes/boundaryTestingRoutes.js";
import createProjectRoutes from "../routes/projectRoutes.js";
import createRunnerAgentRoutes from "../routes/runnerAgentRoutes.js";
import RunnerAgentService from "../services/RunnerAgentService.js";
import MinimalAuthService from "../services/MinimalAuthService.js";
import RunnerDeviceService from "../services/RunnerDeviceService.js";
import RemoteCodeGenService from "../services/RemoteCodeGenService.js";
import createAuthRoutes, { attachPrincipal } from "../routes/authRoutes.js";
import createRunnerDeviceRoutes from "../routes/runnerDeviceRoutes.js";
import errorHandler from "../middleware/errorHandler.js";
import RequirementUploadService from "../services/RequirementUploadService.js";
import AIProviderFactory from "../providers/AIProviderFactory.js";
import ImageRequirementDraftService from "../requirements/ImageRequirementDraftService.js";
import createImageRequirementRoutes from "../routes/imageRequirementRoutes.js";
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
    uploadDir,
    v3OutputDir = null,
    projectRepository = null
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
    const imageRequirementService = new ImageRequirementDraftService({
        dataDir: repositories.config.dataDir,
        requirementUploadService,
        provider: {
            analyzeRequirementImages(input) {
                return AIProviderFactory.createProvider("gemini").analyzeRequirementImages(input);
            }
        }
    });
    const resolvedPublicDirectory = path.resolve(publicDir);
    const indexFile = path.join(resolvedPublicDirectory, "index.html");

    const app = express();
    app.disable("x-powered-by");

    app.post(
        "/api/requirements/upload",
        express.raw({
            type: "text/markdown",
            limit: requirementUploadService.maxBytes
        }),
        (req, res, next) => {
            try {
                const result = requirementUploadService.save({
                    fileName: req.get("x-file-name"),
                    content: req.body,
                    projectId: req.get("x-project-id") || null
                });

                res.status(201).json({
                    success: true,
                    data: result,
                    error: null
                });
            } catch (error) {
                next(error);
            }
        }
    );

    app.use(
        "/api/requirement-drafts/images",
        express.json({ limit: "45mb" }),
        createImageRequirementRoutes({ service: imageRequirementService })
    );

    // Kết quả job RUN_BOUNDARY (Kiểm thử biên chạy từ xa, Ngân yêu cầu 2026-09-07) kèm ảnh chụp
    // màn hình dạng base64 chụp trên máy tester — vượt xa giới hạn JSON toàn cục 2mb bên dưới, cần
    // đăng ký limit riêng cao hơn TRƯỚC middleware toàn cục (cùng vị trí/lý do route ảnh requirement
    // ở trên) — nếu đặt sau dòng 2mb thì middleware toàn cục đã chặn request trước khi tới đây.
    app.use("/api/runner-agents", express.json({ limit: "20mb" }));

    app.use(express.json({ limit: "2mb" }));
    const authService = new MinimalAuthService({ dataDir: path.resolve(dataDir ?? path.join(projectDirectory, "data")) });
    app.use(attachPrincipal(authService));
    app.use("/api/auth", createAuthRoutes({ auth: authService }));

    app.get("/health", (_req, res) => {
        res.status(200).json({
            success: true,
            data: { status: "ok", baseUrl: process.env.BASE_URL || "" },
            error: null
        });
    });

    if (projectRepository) {
        app.use("/api/projects", createProjectRoutes({ repository: projectRepository }));
    }

    app.use(
        "/api/workflows",
        createWorkflowRoutes({
            controller: resolvedController,
            outputDir,
            resolveRequirementFile: (requirementId, projectId) => requirementUploadService.resolve(requirementId, projectId)
        })
    );

    app.use("/api/automation-workspace", createAutomationWorkspaceRoutes({ dataDir }));

    const codeGenDataDir = path.resolve(dataDir ?? path.join(projectDirectory, "data"));
    // Boundary — Action Library: TÀI SẢN DÙNG CHUNG (mọi workspace + Codegen dùng lại).
    const v3ActionLibrary = new ActionLibrary({
        metadataFile: path.join(codeGenDataDir, "action-library.json")
    });
    const codeGenManager = new CodeGenSessionManager({
        rootDir: projectDirectory,
        store: new CodeGenRecordingStore({
            metadataFile: path.join(codeGenDataDir, "codegen-recordings.json"),
            scriptsDir: path.join(projectDirectory, "outputs", "codegen")
        })
    });
    // Ghi CodeGen từ xa qua Runner Agent (Ngân yêu cầu 2026-09-07) — runnerAgentService chưa tồn
    // tại tới đây (khởi tạo bên dưới), gán sau bằng property mutation giống hệt cách
    // v3ApplicationService.runnerAgentService được gán, để KHÔNG phải dời chỗ mount /api/codegen.
    const remoteCodeGenService = new RemoteCodeGenService({ manager: codeGenManager });
    app.use("/api/codegen", createCodeGenRoutes({ rootDir: projectDirectory, manager: codeGenManager, actionLibrary: v3ActionLibrary, usageFn: () => v3ApplicationService?.countLibraryUsage() ?? new Map(), unbindAllFn: blockId => v3ApplicationService?.unbindBlockEverywhere(blockId), remoteCodeGenService }));

    app.use("/api/template-testcases", createTemplateTestCaseRoutes());

    // ---- Architecture V3 (Record by Testcase) — Route → Application Service → Domain/Store/GenerateService → Renderer ----
    const v3Workspace = new AutomationWorkspace({
        metadataFile: path.join(codeGenDataDir, "automation-workspaces.json")
    });
    const v3Store = new CodeGenRecordingStore({
        metadataFile: path.join(codeGenDataDir, "codegen-recordings.json"),
        scriptsDir: path.join(projectDirectory, "outputs", "codegen")
    });
    const v3Session = new CurrentRecordingSession({ store: v3Store, workspace: v3Workspace });
    const v3GenerateService = new GenerateService({
        workspace: v3Workspace,
        store: v3Store,
        outputDir: v3OutputDir ?? path.join(projectDirectory, "outputs", "generated-tests"),
        actionLibrary: v3ActionLibrary
    });
    const sharedPlaywrightRunner = new PlaywrightRunner({ rootDir: projectDirectory });
    const v3ApplicationService = new AutomationWorkspaceApplicationService({
        workspace: v3Workspace,
        store: v3Store,
        session: v3Session,
        generateService: v3GenerateService,
        actionLibrary: v3ActionLibrary,
        // P0-C - runner de chay thu testcase dang mo (reuse PlaywrightRunner).
        runner: sharedPlaywrightRunner
    });
    const runnerDeviceService = new RunnerDeviceService({ dataDir: codeGenDataDir });
    const runnerAgentService = new RunnerAgentService({ deviceService: runnerDeviceService });
    v3ApplicationService.runnerAgentService = runnerAgentService;
    remoteCodeGenService.runnerAgentService = runnerAgentService;

    // Kiểm thử biên — namespace route riêng, service riêng, KHÔNG đọc testDataBindings/testcase
    // nào. Tạo entry bằng cách dán script tay hoặc chọn 1 Bản ghi đã lưu (CodeGen) — KHÔNG còn qua
    // Thư viện thao tác (Ngân yêu cầu 2026-09-07: chọn từ Bản ghi đã lưu thay vì Thư viện thao tác).
    // Khởi tạo ở ĐÂY (trước khi mount /api/runner-agents) vì completion callback RUN_BOUNDARY cần
    // truyền boundaryTestingService thẳng vào createRunnerAgentRoutes — khác RemoteCodeGenService
    // (không thể gán runnerAgentService sau khi đã mount route như CodeGen, vì đây là closure biến
    // service, không phải property trên object đã có).
    const boundaryEntryStore = new BoundaryEntryStore({
        metadataFile: path.join(codeGenDataDir, "boundary-entries.json")
    });
    const boundaryOutputDir = path.join(projectDirectory, "outputs", "generated-tests", "boundary");
    const boundaryTestingService = new BoundaryTestingService({
        store: boundaryEntryStore,
        runner: sharedPlaywrightRunner,
        outputDir: boundaryOutputDir,
        runnerAgentService
    });

    app.use("/api/runner-devices", createRunnerDeviceRoutes({ service: runnerDeviceService, runnerSourceDir: path.join(projectDirectory, "tools", "runner") }));
    // Limit JSON 20mb cho namespace này đã đăng ký SỚM hơn (gần đầu file, trước middleware 2mb toàn
    // cục) — xem comment ở đó để hiểu vì sao không đặt limit ngay tại đây được.
    app.use("/api/runner-agents", createRunnerAgentRoutes({ service: runnerAgentService, applicationService: v3ApplicationService, remoteCodeGenService, boundaryTestingService }));
    app.use("/api/automation-v3", createAutomationV3Routes({ applicationService: v3ApplicationService }));

    // Ảnh chụp màn hình sau mỗi lần chạy kiểm thử biên (xem playwright.boundary.config.js) — cần
    // mở được trực tiếp từ trình duyệt (screenshotPath trả về là URL dạng
    // /api/boundary-testing/screenshots/<file>, không phải đường dẫn hệ thống).
    app.use("/api/boundary-testing/screenshots", express.static(path.join(boundaryOutputDir, "screenshots"), { index: false }));
    app.use("/api/boundary-testing", createBoundaryTestingRoutes({ service: boundaryTestingService }));

    app.use(express.static(resolvedPublicDirectory, { index: false }));

    app.use((req, res, next) => {
        if (req.path.startsWith("/api") || req.path === "/health") return next();
        if (req.method !== "GET" || !req.accepts("html")) return next();
        if (!fs.existsSync(indexFile)) {
            const error = new Error(`Frontend index not found: ${indexFile}`);
            error.code = "FRONTEND_NOT_FOUND";
            error.statusCode = 500;
            return next(error);
        }
        return res.sendFile(indexFile);
    });

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
        codeGenManager,
        remoteCodeGenService,
        v3ApplicationService,
        runnerAgentService,
        authService,
        runnerDeviceService,
        publicDirectory: resolvedPublicDirectory,
        indexFile,
        indexExists: fs.existsSync(indexFile)
    };

    return app;
}
