import QACopilotApplicationService from "../services/QACopilotApplicationService.js";
import PublicWorkflowMapper from "../web/mappers/PublicWorkflowMapper.js";
import PublicWorkflowListMapper from "../web/mappers/PublicWorkflowListMapper.js";
import WorkflowListQueryValidator from "../web/validators/WorkflowListQueryValidator.js";
import PublicAIAnalysisReviewMapper from "../web/mappers/PublicAIAnalysisReviewMapper.js";
import PublicTestCaseReviewMapper from "../web/mappers/PublicTestCaseReviewMapper.js";

export default class QACopilotController {
    constructor({
        applicationService,
        publicWorkflowMapper,
        publicWorkflowListMapper,
        workflowListQueryValidator,
        publicAIAnalysisReviewMapper,
        publicTestCaseReviewMapper
    } = {}) {
        this.applicationService = applicationService || new QACopilotApplicationService();
        this.publicWorkflowMapper = publicWorkflowMapper || new PublicWorkflowMapper();
        this.publicWorkflowListMapper =
            publicWorkflowListMapper ||
            new PublicWorkflowListMapper({
                workflowMapper: this.publicWorkflowMapper
            });
        this.workflowListQueryValidator =
            workflowListQueryValidator || new WorkflowListQueryValidator();
        this.publicAIAnalysisReviewMapper =
            publicAIAnalysisReviewMapper || new PublicAIAnalysisReviewMapper();
        this.publicTestCaseReviewMapper =
            publicTestCaseReviewMapper || new PublicTestCaseReviewMapper();
    }

    async start(input = {}) {
        const normalizedInput = this.normalizeInput(input);

        try {
            const result = await this.applicationService.start({
                requirementFile: normalizedInput.requirementFile,
                projectId: normalizedInput.projectId ?? null
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
                workflowContext: normalizedInput.workflowContext,
                projectId: normalizedInput.projectId ?? null
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
        try {
            const result = this.applicationService.getWorkflow(input);
            const workflow = this.publicWorkflowMapper.map(result);

            return this.successResponse({
                result: {
                    workflow,
                    deprecated: {
                        pipelineStatus: result.pipelineStatus ?? null,
                        workflowContext: result.workflowContext ?? null
                    }
                },
                mapPublicResponse: false
            });
        } catch (error) {
            return this.errorResponse(error);
        }
    }

    async getWorkflowState(input = {}) {
        return this.invoke(() => this.applicationService.getWorkflow(input), {
            mapPublicResponse: false
        });
    }

    async listWorkflows(input = {}) {
        try {
            const query = this.workflowListQueryValidator.validate(input);
            const records = this.applicationService.listWorkflows({ projectId: input.projectId });
            const result = this.publicWorkflowListMapper.map(records, query);

            return this.successResponse({
                result,
                mapPublicResponse: false
            });
        } catch (error) {
            return this.errorResponse(error);
        }
    }

    async deleteWorkflow(input = {}) {
        return this.invoke(() => this.applicationService.deleteWorkflow(input), {
            mapPublicResponse: false
        });
    }

    async getCurrentReview(input = {}) {
        return this.invoke(() => this.applicationService.getCurrentReview(input));
    }

    async getAIAnalysisReview(input = {}) {
        try {
            const currentReview = this.applicationService.getCurrentReview(input);
            const review =
                currentReview.artifact?.artifactType === "AI_ANALYSIS_REVIEW"
                    ? currentReview
                    : {
                          ...currentReview,
                          artifact:
                              this.applicationService
                                  .getArtifacts(input)
                                  .findLast(
                                      artifact => artifact?.artifactType === "AI_ANALYSIS_REVIEW"
                                  ) ?? null
                      };
            const workflow = this.publicWorkflowMapper.map(
                this.applicationService.getWorkflow(input)
            );

            return this.successResponse({
                result: this.publicAIAnalysisReviewMapper.map({ review, workflow }),
                mapPublicResponse: false
            });
        } catch (error) {
            return this.errorResponse(error);
        }
    }

    async updateAIAnalysisReview(input = {}) {
        try {
            this.applicationService.updateAIAnalysisReview(input);
            return this.getAIAnalysisReview({ sessionId: input.sessionId });
        } catch (error) {
            return this.errorResponse(error);
        }
    }

    async getTestCaseReview(input = {}) {
        try {
            const currentReview = this.applicationService.getCurrentReview(input);
            const review =
                currentReview.artifact?.artifactType === "TEST_CASE_REVIEW"
                    ? currentReview
                    : {
                          ...currentReview,
                          artifact:
                              this.applicationService
                                  .getArtifacts(input)
                                  .findLast(
                                      artifact => artifact?.artifactType === "TEST_CASE_REVIEW"
                                  ) ?? null
                      };
            const workflow = this.publicWorkflowMapper.map(
                this.applicationService.getWorkflow(input)
            );

            return this.successResponse({
                result: this.publicTestCaseReviewMapper.map({ review, workflow }),
                mapPublicResponse: false
            });
        } catch (error) {
            return this.errorResponse(error);
        }
    }

    async updateTestCaseReview(input = {}) {
        try {
            this.applicationService.updateTestCaseReview(input);
            return this.getTestCaseReview({ sessionId: input.sessionId });
        } catch (error) {
            return this.errorResponse(error);
        }
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

    async getOutputsForDownload(input = {}) {
        return this.invoke(() => this.applicationService.getOutputs(input), {
            mapPublicResponse: false
        });
    }

    async invoke(operation, { mapPublicResponse = true } = {}) {
        try {
            return this.successResponse({
                statusCode: 200,
                result: await operation(),
                mapPublicResponse
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

    successResponse({
        statusCode = 200,
        message = "",
        result = null,
        mapPublicResponse = true
    } = {}) {
        const canMapPublicResponse = mapPublicResponse && result && typeof result === "object";
        const mappingSource = Array.isArray(result)
            ? {
                  sessionId: result[0]?.sessionId ?? "",
                  artifacts: result,
                  outputs:
                      result.find(item => item?.outputs && typeof item.outputs === "object")
                          ?.outputs ?? {}
              }
            : result;
        const publicWorkflow = canMapPublicResponse
            ? this.publicWorkflowMapper.map(mappingSource)
            : null;
        const publicResult =
            publicWorkflow === null
                ? result
                : Array.isArray(result)
                  ? this.publicWorkflowMapper.sanitizeLegacy(result, publicWorkflow)
                  : {
                        ...this.publicWorkflowMapper.sanitizeLegacy(result, publicWorkflow),
                        workflow: publicWorkflow
                    };

        return {
            success: true,
            statusCode,
            message,
            data: publicResult,
            result: publicResult,
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
