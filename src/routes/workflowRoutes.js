import { Router } from "express";
import fs from "node:fs";
import path from "node:path";

export default function createWorkflowRoutes({
    controller,
    outputDir = "./outputs",
    resolveRequirementFile = null
}) {
    if (!controller) throw new Error("controller is required.");

    const router = Router();
    const send = (res, response) =>
        res.status(response.statusCode).json({
            success: response.success,
            data: response.data ?? response.result ?? null,
            error: response.error
        });

    router.get("/", async (req, res) => {
        send(
            res,
            await controller.listWorkflows({
                limit: req.query.limit,
                offset: req.query.offset,
                projectId: req.get("x-project-id") || null
            })
        );
    });

    router.post("/", async (req, res) => {
        let requirementFile = req.body?.requirementFile;

        if (req.body?.requirementId && typeof resolveRequirementFile === "function") {
            try {
                requirementFile = resolveRequirementFile(req.body.requirementId, req.get("x-project-id") || null);
            } catch (error) {
                return res.status(error.statusCode ?? 400).json({
                    success: false,
                    data: null,
                    error: {
                        code: error.code ?? "INVALID_REQUIREMENT_ID",
                        message: error.message,
                        details: error.details ?? null
                    }
                });
            }
        }

        send(
            res,
            await controller.start({
                requirementFile,
                projectId: req.get("x-project-id") || null
            })
        );
    });

    router.get("/:sessionId", async (req, res) => {
        send(res, await controller.getWorkflow({ sessionId: req.params.sessionId }));
    });

    router.delete("/:sessionId", async (req, res) => {
        send(res, await controller.deleteWorkflow({
            sessionId: req.params.sessionId,
            projectId: req.get("x-project-id") || undefined
        }));
    });

    router.get("/:sessionId/current-review", async (req, res) => {
        send(
            res,
            await controller.getCurrentReview({
                sessionId: req.params.sessionId
            })
        );
    });

    router.get("/:sessionId/ai-analysis-review", async (req, res) => {
        send(
            res,
            await controller.getAIAnalysisReview({
                sessionId: req.params.sessionId
            })
        );
    });

    router.put("/:sessionId/ai-analysis-review", async (req, res) => {
        send(
            res,
            await controller.updateAIAnalysisReview({
                sessionId: req.params.sessionId,
                artifactId: req.body?.artifactId,
                analysis: req.body?.analysis
            })
        );
    });

    router.get("/:sessionId/test-case-review", async (req, res) => {
        send(
            res,
            await controller.getTestCaseReview({
                sessionId: req.params.sessionId
            })
        );
    });

    router.put("/:sessionId/test-case-review", async (req, res) => {
        send(
            res,
            await controller.updateTestCaseReview({
                sessionId: req.params.sessionId,
                artifactId: req.body?.artifactId,
                testCases: req.body?.testCases
            })
        );
    });

    router.get("/:sessionId/artifacts", async (req, res) => {
        send(res, await controller.getArtifacts({ sessionId: req.params.sessionId }));
    });

    router.put("/:sessionId/artifacts/:artifactId", async (req, res) => {
        send(
            res,
            await controller.editArtifact({
                sessionId: req.params.sessionId,
                artifactId: req.params.artifactId,
                artifact: req.body?.artifact ?? req.body
            })
        );
    });

    router.post("/:sessionId/clarifications/:questionId", async (req, res) => {
        const workflow = await controller.getWorkflowState({
            sessionId: req.params.sessionId
        });
        if (!workflow.success) return send(res, workflow);

        send(
            res,
            await controller.answerClarification({
                workflowContext: workflow.data.workflowContext,
                questionId: req.params.questionId,
                answer: req.body?.answer,
                answeredBy: req.body?.answeredBy
            })
        );
    });

    router.post("/:sessionId/approve", async (req, res) => {
        send(
            res,
            await controller.approveReview({
                sessionId: req.params.sessionId,
                artifactId: req.body?.artifactId,
                approvedBy: req.body?.approvedBy
            })
        );
    });

    router.post("/:sessionId/reject", async (req, res) => {
        send(
            res,
            await controller.rejectReview({
                sessionId: req.params.sessionId,
                artifactId: req.body?.artifactId,
                rejectedBy: req.body?.rejectedBy,
                reason: req.body?.reason
            })
        );
    });

    router.post("/:sessionId/resume", async (req, res) => {
        send(res, await controller.resumeSession({ sessionId: req.params.sessionId }));
    });

    router.get("/:sessionId/outputs", async (req, res) => {
        send(res, await controller.getOutputs({ sessionId: req.params.sessionId }));
    });

    router.get("/:sessionId/outputs/:format/download", async (req, res, next) => {
        try {
            const response = await controller.getOutputsForDownload({
                sessionId: req.params.sessionId
            });
            if (!response.success) return send(res, response);

            const filePath = response.data?.outputs?.[req.params.format];
            if (typeof filePath !== "string" || !filePath.trim()) {
                return res.status(404).json({
                    success: false,
                    data: null,
                    error: { code: "OUTPUT_NOT_FOUND", message: "Không tìm thấy file output." }
                });
            }

            const root = path.resolve(outputDir);
            const resolvedPath = path.resolve(filePath);
            const relative = path.relative(root, resolvedPath);
            if (
                relative.startsWith("..") ||
                path.isAbsolute(relative) ||
                !fs.existsSync(resolvedPath) ||
                !fs.statSync(resolvedPath).isFile()
            ) {
                return res.status(403).json({
                    success: false,
                    data: null,
                    error: {
                        code: "UNSAFE_OUTPUT_PATH",
                        message: "File output không thuộc thư mục được phép."
                    }
                });
            }

            return res.download(resolvedPath, path.basename(resolvedPath));
        } catch (error) {
            return next(error);
        }
    });

    return router;
}
