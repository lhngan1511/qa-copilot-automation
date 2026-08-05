import { Router } from "express";
import CodeGenSessionManager from "../codegen/CodeGenSessionManager.js";
import CodeGenController from "../controllers/CodeGenController.js";

export default function createCodeGenRoutes({ rootDir = process.cwd(), manager = null } = {}) {
    const resolvedManager =
        manager ?? new CodeGenSessionManager({ rootDir, browserChannel: process.env.PLAYWRIGHT_BROWSER_CHANNEL ?? null });
    const controller = new CodeGenController({ manager: resolvedManager });
    const router = Router();

    router.post("/start", (req, res) => controller.start(req, res));
    router.post("/stop", (req, res) => controller.stop(req, res));
    router.get("/status", (req, res) => controller.status(req, res));
    router.post("/save", (req, res) => controller.save(req, res));
    router.post("/run", (req, res) => controller.run(req, res));
    router.post("/cleanup", (req, res) => controller.cleanup(req, res));

    return router;
}
