import { Router } from "express";
import path from "node:path";
import fs from "node:fs";
import AIAutomationService from "../automation/ai/AIAutomationService.js";
import AutomationPipelineService from "../services/AutomationPipelineService.js";

/**
 * Routes cho Automation MVP.
 *   GET  /api/automation/modules
 *   POST /api/automation/analyze   { testCase, codegenFile, confirmedFacts }  -> AI Mapping
 *   POST /api/automation/generate  { testCase, mapping, codegenFile }          -> AI Codegen
 *   POST /api/automation/run       { filePath, env }                           -> chạy Playwright
 *
 * @param {object} opts
 * @param {object|null} [opts.aiProvider]  inject provider (test). Mặc định GeminiProvider.
 */
export default function createAutomationRoutes({ rootDir = process.cwd(), aiProvider = null } = {}) {
    const router = Router();
    const service = new AIAutomationService({ aiProvider, rootDir });

    router.get("/modules", (_req, res) => {
        try {
            const s = new AutomationPipelineService({ rootDir });
            const testCases = s.loadApproved();
            const byModule = {};
            for (const tc of testCases) {
                const m = tc.module || "(none)";
                byModule[m] = (byModule[m] || 0) + 1;
            }
            res.status(200).json({
                success: true,
                data: { total: testCases.length, modules: Object.entries(byModule).map(([name, count]) => ({ name, count })) },
                error: null
            });
        } catch (error) {
            res.status(500).json({ success: false, data: null, error: { message: error.message } });
        }
    });

    router.post("/analyze", async (req, res) => {
        try {
            const { module, testCases, testCase, codegenFile = null, codegenText = null, confirmedFacts = [] } = req.body ?? {};
            if (!codegenText && (!codegenFile || !fs.existsSync(path.resolve(codegenFile)))) {
                throw new Error("Thiếu codegenText hoặc codegenFile hợp lệ.");
            }
            // Ưu tiên map toàn bộ module nếu có testCases array; ngược lại map 1 testcase (backward-compatible).
            if (Array.isArray(testCases) && testCases.length > 0) {
                const mapping = await service.analyzeModule({ module: module ?? testCases[0].module ?? "", testCases, codegenFile, codegenText, confirmedFacts });
                res.status(200).json({ success: true, data: mapping, error: null });
            } else {
                if (!testCase) throw new Error("Thiếu testCase.");
                const mapping = await service.analyze({ testCase, codegenFile, codegenText, confirmedFacts });
                res.status(200).json({ success: true, data: { mapping }, error: null });
            }
        } catch (error) {
            // Không fallback sang mock. Trả diagnostic rõ.
            res.status(500).json({ success: false, data: null, error: { message: error.message, diagnostic: "AI_MAPPING_FAILED" } });
        }
    });

    router.post("/generate", async (req, res) => {
        try {
            const { testCase, mapping, codegenFile = null, codegenText = null, confirmedFacts = [] } = req.body ?? {};
            if (!testCase || !mapping) throw new Error("Thiếu testCase/mapping.");
            const { code, validation } = await service.generate({ testCase, mapping, codegenFile, codegenText, confirmedFacts });
            // KHÔNG ghi file hợp lệ khi validation fail — reject toàn bộ output (locator ngoài mapping).
            if (!validation.ok) {
                res.status(200).json({
                    success: false,
                    data: { code, validation, filePath: null },
                    error: { message: "Code không đạt validation — không ghi file.", diagnostic: "AI_CODEGEN_REJECTED", details: validation.errors }
                });
                return;
            }
            const filePath = service.saveGeneratedCode({ code, testCaseId: testCase.id, module: testCase.module || "Login" });
            res.status(200).json({ success: true, data: { code, validation, filePath }, error: null });
        } catch (error) {
            res.status(500).json({ success: false, data: null, error: { message: error.message, diagnostic: "AI_CODEGEN_FAILED" } });
        }
    });

    router.post("/run", async (req, res) => {
        try {
            const { filePath, env = {} } = req.body ?? {};
            if (!filePath) throw new Error("Thiếu filePath.");
            const result = await service.run({ filePath, env });
            res.status(200).json({ success: true, data: result, error: null });
        } catch (error) {
            res.status(500).json({ success: false, data: null, error: { message: error.message } });
        }
    });

    return router;
}
