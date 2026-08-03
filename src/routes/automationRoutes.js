import { Router } from "express";
import path from "node:path";
import fs from "node:fs";
import AutomationPipelineService from "../services/AutomationPipelineService.js";

/**
 * Routes cho Phase 2 Automation.
 *   GET  /api/automation/modules
 *   GET  /api/automation/mapping?module=
 *   POST /api/automation/run { module }
 */
export default function createAutomationRoutes({ rootDir = process.cwd() } = {}) {
    const router = Router();

    router.get("/modules", (_req, res) => {
        try {
            const service = new AutomationPipelineService({ rootDir });
            const testCases = service.loadApproved();
            const byModule = {};
            for (const tc of testCases) {
                const m = tc.module || "(none)";
                byModule[m] = (byModule[m] || 0) + 1;
            }
            res.status(200).json({
                success: true,
                data: {
                    total: testCases.length,
                    modules: Object.entries(byModule).map(([name, count]) => ({
                        name,
                        count
                    }))
                },
                error: null
            });
        } catch (error) {
            res.status(500).json({ success: false, data: null, error: { message: error.message } });
        }
    });

    router.get("/mapping", async (req, res) => {
        try {
            const service = new AutomationPipelineService({ rootDir });
            const testCases = service.filterByModule(service.loadApproved(), req.query.module);
            const mappings = testCases.map((tc) =>
                service.mappingGenerator.generate(tc, { autoApprove: true })
            );
            res.status(200).json({
                success: true,
                data: {
                    module: req.query.module || testCases[0]?.module || "",
                    count: mappings.length,
                    readyCount: mappings.filter((m) => m.blockers.length === 0).length,
                    mappings: mappings.map((m) => m.toJSON())
                },
                error: null
            });
        } catch (error) {
            res.status(500).json({ success: false, data: null, error: { message: error.message } });
        }
    });

    router.post("/run", async (req, res) => {
        try {
            const service = new AutomationPipelineService({ rootDir });
            const module = req.body?.module || "";
            const result = await service.run({ module, autoApprove: true, run: true });
            res.status(200).json({
                success: true,
                data: result,
                error: null
            });
        } catch (error) {
            res.status(500).json({ success: false, data: null, error: { message: error.message } });
        }
    });

    return router;
}
