import { Router } from "express";
import fs from "node:fs";
import path from "node:path";

export default function createWorkflowRoutes({ controller, outputDir = "./outputs" }) {
    if (!controller) throw new Error("controller is required.");

    const router = Router();
    const send = (res, response) =>
        res.status(response.statusCode).json({
            success: response.success,
            data: response.data ?? response.result ?? null,
            error: response.error
        });

    router.post("/", async (req, res) => {
        send(
            res,
            await controller.start({
                requirementFile: req.body?.requirementFile
            })
        );
    });

    router.get("/:sessionId", async (req, res) => {
        send(res, await controller.getWorkflow({ sessionId: req.params.sessionId }));
    });

    router.get("/:sessionId/current-review", async (req, res) => {
        send(
            res,
            await controller.getCurrentReview({
                sessionId: req.params.sessionId
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
        const workflow = await controller.getWorkflow({ sessionId: req.params.sessionId });
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
            const response = await controller.getOutputs({ sessionId: req.params.sessionId });
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
