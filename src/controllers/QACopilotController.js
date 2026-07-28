import QACopilotApplicationService from "../services/QACopilotApplicationService.js";

export default class QACopilotController {
    constructor({ applicationService } = {}) {
        this.applicationService = applicationService || new QACopilotApplicationService();
    }

    async start(input = {}) {
        const normalizedInput = this.normalizeInput(input);

        try {
            const result = await this.applicationService.start({
                requirementFile: normalizedInput.requirementFile
            });

            return this.successResponse({
                statusCode: 201,
                message: "QA Copilot workflow started.",
                result
            });
        } catch (error) {
            return this.errorResponse(error);
        }
    }

    async resume(input = {}) {
        const normalizedInput = this.normalizeInput(input);

        try {
            const result = await this.applicationService.resume({
                requirementFile: normalizedInput.requirementFile,
                workflowContext: normalizedInput.workflowContext
            });

            return this.successResponse({
                statusCode: 200,
                message: "QA Copilot workflow resumed.",
                result
            });
        } catch (error) {
            return this.errorResponse(error);
        }
    }

    async answerClarification(input = {}) {
        const normalizedInput = this.normalizeInput(input);

        try {
            const result = await this.applicationService.answerClarification({
                workflowContext: normalizedInput.workflowContext,
                questionId: normalizedInput.questionId,
                answer: normalizedInput.answer,
                answeredBy: normalizedInput.answeredBy
            });

            return this.successResponse({
                statusCode: 200,
                message: "Clarification answer recorded.",
                result
            });
        } catch (error) {
            return this.errorResponse(error);
        }
    }

    async approveStage(input = {}) {
        const normalizedInput = this.normalizeInput(input);

        try {
            const result = await this.applicationService.approveCurrentStage({
                workflowContext: normalizedInput.workflowContext,
                stage: normalizedInput.stage,
                approvedBy: normalizedInput.approvedBy,
                feedback: normalizedInput.feedback
            });

            return this.successResponse({
                statusCode: 200,
                message: "Workflow stage approved.",
                result
            });
        } catch (error) {
            return this.errorResponse(error);
        }
    }

    async approveAndResume(input = {}) {
        const normalizedInput = this.normalizeInput(input);

        try {
            const result = await this.applicationService.approveAndResume({
                requirementFile: normalizedInput.requirementFile,
                workflowContext: normalizedInput.workflowContext,
                stage: normalizedInput.stage,
                approvedBy: normalizedInput.approvedBy,
                feedback: normalizedInput.feedback
            });

            return this.successResponse({
                statusCode: 200,
                message: "Workflow stage approved and pipeline resumed.",
                result
            });
        } catch (error) {
            return this.errorResponse(error);
        }
    }

    async getWorkflow(input = {}) {
        return this.invoke(() => this.applicationService.getWorkflow(input));
    }

    async getCurrentReview(input = {}) {
        return this.invoke(() => this.applicationService.getCurrentReview(input));
    }

    async getArtifacts(input = {}) {
        return this.invoke(() => this.applicationService.getArtifacts(input));
    }

    async editArtifact(input = {}) {
        return this.invoke(() => this.applicationService.editArtifact(input));
    }

    async approveReview(input = {}) {
        return this.invoke(() => this.applicationService.approveReview(input));
    }

    async rejectReview(input = {}) {
        return this.invoke(() => this.applicationService.rejectReview(input));
    }

    async resumeSession(input = {}) {
        return this.invoke(() => this.applicationService.resumeSession(input));
    }

    async getOutputs(input = {}) {
        return this.invoke(() => this.applicationService.getOutputs(input));
    }

    async invoke(operation) {
        try {
            return this.successResponse({
                statusCode: 200,
                result: await operation()
            });
        } catch (error) {
            return this.errorResponse(error);
        }
    }

    async execute(action, input = {}) {
        const normalizedAction = String(action || "")
            .trim()
            .toUpperCase();

        const handlers = {
            START: "start",
            RESUME: "resume",
            ANSWER_CLARIFICATION: "answerClarification",
            APPROVE_STAGE: "approveStage",
            APPROVE_AND_RESUME: "approveAndResume"
        };

        const handler = handlers[normalizedAction];

        if (!handler) {
            return {
                success: false,
                statusCode: 400,
                message: "Unsupported controller action.",
                result: null,
                error: {
                    name: "ValidationError",
                    message: `Unsupported controller action: ${normalizedAction}`
                }
            };
        }

        return this[handler](input);
    }

    successResponse({ statusCode = 200, message = "", result = null } = {}) {
        return {
            success: true,
            statusCode,
            message,
            data: result,
            result,
            error: null
        };
    }

    errorResponse(error) {
        const isErrorLike = error && typeof error === "object";

        const name =
            isErrorLike && typeof error.name === "string" && error.name.trim()
                ? error.name
                : "Error";

        const message =
            isErrorLike && typeof error.message === "string" && error.message.trim()
                ? error.message
                : "Unknown application error.";

        const normalizedMessage = message.toLowerCase();

        const validationPatterns = [
            "is required",
            "unsupported",
            "not initialized",
            "invalid",
            "cannot be empty",
            "not found"
        ];

        const conflictPatterns = [
            "not approved",
            "not completed",
            "must be approved",
            "must be completed",
            "must be answered",
            "pending",
            "already approved",
            "already completed",
            "cannot complete",
            "cannot approve"
        ];

        const statusCode =
            Number.isInteger(error?.statusCode) && error.statusCode >= 400
                ? error.statusCode
                : validationPatterns.some(pattern => normalizedMessage.includes(pattern))
                  ? 400
                  : conflictPatterns.some(pattern => normalizedMessage.includes(pattern))
                    ? 409
                    : 500;

        return {
            success: false,
            statusCode,
            message,
            data: null,
            result: null,
            error: {
                code: error?.code ?? name,
                message,
                details: error?.details ?? null
            }
        };
    }

    normalizeInput(input) {
        if (!input || typeof input !== "object" || Array.isArray(input)) {
            return {};
        }

        return {
            ...input
        };
    }
}
