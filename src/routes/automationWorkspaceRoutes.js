import { Router } from "express";
import AutomationWorkspaceService from "../services/AutomationWorkspaceService.js";
import AutomationController from "../controllers/AutomationController.js";

export default function createAutomationWorkspaceRoutes({ rootDir = process.cwd(), aiProvider = null } = {}) {
    const service = new AutomationWorkspaceService({ rootDir, aiProvider });
    const controller = new AutomationController({ service });
    const router = Router();
    router.post("/analyze", (req, res) => controller.analyze(req, res));
    router.post("/generate", (req, res) => controller.generate(req, res));
    router.post("/run", (req, res) => controller.run(req, res));
    router.post("/export", (req, res) => controller.export(req, res));
    return router;
}
