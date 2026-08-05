import { Router } from "express";
import CodeGenSessionManager from "../codegen/CodeGenSessionManager.js";
import CodeGenRecordingStore from "../codegen/CodeGenRecordingStore.js";
import ApprovedTestcaseLoader from "../codegen/ApprovedTestcaseLoader.js";
import CodeGenController from "../controllers/CodeGenController.js";

export default function createCodeGenRoutes({
    rootDir = process.cwd(),
    manager = null,
    testcaseLoader = null
} = {}) {
    const resolvedManager =
        manager ??
        new CodeGenSessionManager({
            rootDir,
            store: new CodeGenRecordingStore({ scriptsDir: `${rootDir}/outputs/codegen` })
        });
    const resolvedLoader = testcaseLoader ?? new ApprovedTestcaseLoader({ searchRoot: rootDir });
    const controller = new CodeGenController({ manager: resolvedManager, testcaseLoader: resolvedLoader });
    const router = Router();

    router.get("/status", (req, res) => controller.status(req, res));
    router.get("/recordings", (req, res) => controller.list(req, res));
    router.get("/recordings/:recordingId", (req, res) => controller.get(req, res));
    router.post("/recordings/:recordingId/rename", (req, res) => controller.rename(req, res));
    router.post("/recordings/:recordingId/script", (req, res) => controller.setScript(req, res));
    router.post("/recordings/:recordingId/link", (req, res) => controller.linkTestcases(req, res));
    router.post("/recordings/:recordingId/save", (req, res) => controller.save(req, res));
    router.post("/recordings/:recordingId/run", (req, res) => controller.run(req, res));
    router.post("/recordings/:recordingId/open-folder", (req, res) => controller.openFolder(req, res));
    router.post("/recordings/:recordingId/open-report", (req, res) => controller.openReport(req, res));
    router.delete("/recordings/:recordingId", (req, res) => controller.remove(req, res));

    router.post("/start", (req, res) => controller.start(req, res));
    router.post("/stop", (req, res) => controller.stop(req, res));
    router.post("/focus", (req, res) => controller.focus(req, res));
    router.get("/testcases", (req, res) => controller.testcases(req, res));
    router.post("/cleanup", (req, res) => controller.cleanup(req, res));

    return router;
}
