import path from "node:path";
import PublicWorkflowDto from "../dtos/PublicWorkflowDto.js";
import PublicArtifactDto from "../dtos/PublicArtifactDto.js";
import PublicStatusMapper from "./PublicStatusMapper.js";
import PublicActionMapper from "./PublicActionMapper.js";

export default class PublicWorkflowMapper {
    constructor({
        statusMapper = new PublicStatusMapper(),
        actionMapper = new PublicActionMapper()
    } = {}) {
        this.statusMapper = statusMapper;
        this.actionMapper = actionMapper;
    }

    map(source = {}) {
        const internalStatus = this.findInternalStatus(source);
        const status = this.statusMapper.map(internalStatus);
        const workflowContext = this.findWorkflowContext(source);
        const currentStage =
            source.currentStage ??
            source.data?.currentStage ??
            source.data?.reviewStage ??
            this.stageFromStatus(internalStatus);
        const stageContext = workflowContext?.[currentStage] ?? {};
        const id =
            source.sessionId ??
            source.data?.sessionId ??
            stageContext.sessionId ??
            this.findLastSessionId(workflowContext);
        const clarification = this.mapClarification(source);
        const testCases = this.mapTestCases(source);
        const sourceArtifacts = this.findArtifacts(source);
        const artifacts = sourceArtifacts.map(artifact => PublicArtifactDto.create(artifact));
        const exports = this.mapExports(source, id);
        const sessionStatus = this.findSessionStatus(source);
        const blockingReasons = this.mapBlockingReasons(internalStatus, clarification, testCases);

        return PublicWorkflowDto.create({
            id,
            name: this.findName(source, sourceArtifacts),
            status: status.status,
            step: status.step,
            allowedActions: this.actionMapper.map({
                internalStatus,
                sessionStatus,
                clarification,
                exports
            }),
            isBlocking: status.isBlocking,
            blockingReasons,
            clarification,
            testCases,
            artifacts,
            exports,
            timestamps: {
                createdAt: source.createdAt ?? source.startedAt ?? null,
                updatedAt: source.updatedAt ?? source.completedAt ?? null
            },
            revision: Number.isFinite(source.revision) ? source.revision : null
        });
    }

    sanitizeLegacy(source, workflow) {
        return this.sanitizeValue(source, {
            sessionId: workflow.id,
            exports: workflow.exports
        });
    }

    findInternalStatus(source) {
        return (
            source.pipelineStatus ??
            source.status ??
            source.data?.pipelineStatus ??
            source.data?.status ??
            null
        );
    }

    findSessionStatus(source) {
        return source.sessionStatus ?? source.status ?? source.data?.sessionStatus ?? null;
    }

    findWorkflowContext(source) {
        return source.workflowContext ?? source.data?.workflowContext ?? {};
    }

    findLastSessionId(workflowContext) {
        return (
            [
                "testCaseReview",
                "scenarioReview",
                "moduleReview",
                "requirementReview",
                "clarificationReview"
            ]
                .map(stage => workflowContext?.[stage]?.sessionId)
                .find(Boolean) ?? ""
        );
    }

    stageFromStatus(status) {
        const stages = {
            AWAITING_AI_CLARIFICATION: "clarificationReview",
            AWAITING_TEST_CASE_REVIEW: "testCaseReview",
            AWAITING_REQUIREMENT_REVIEW: "requirementReview",
            AWAITING_MODULE_REVIEW: "moduleReview",
            AWAITING_SCENARIO_REVIEW: "scenarioReview"
        };

        return stages[status] ?? "";
    }

    mapClarification(source) {
        const clarificationArtifact = (source.artifacts ?? []).find(artifact =>
            ["AI_ANALYSIS_REVIEW", "AI_CLARIFICATION_REVIEW"].includes(artifact?.artifactType)
        );
        const status =
            source.clarificationStatus ??
            source.data?.clarificationStatus ??
            source.data?.data?.clarificationStatus;
        const questions =
            status?.questions ??
            source.questions ??
            source.data?.questions ??
            source.data?.clarificationQuestions ??
            source.data?.data?.clarificationQuestions ??
            clarificationArtifact?.questions ??
            [];
        const normalizedQuestions = Array.isArray(questions) ? questions : [];
        const total = status?.total ?? normalizedQuestions.length;
        const answered =
            status?.answered ??
            normalizedQuestions.filter(question =>
                Boolean(question?.answer ?? question?.answeredAt)
            ).length;

        return {
            total,
            answered,
            remaining: status?.pending ?? Math.max(0, total - answered)
        };
    }

    mapTestCases(source) {
        const testCaseArtifact = (source.artifacts ?? []).find(
            artifact => artifact?.artifactType === "TEST_CASE_REVIEW"
        );
        const testCases =
            source.testCases ??
            source.data?.testCases ??
            source.data?.data?.testCases ??
            source.artifact?.testCases ??
            testCaseArtifact?.testCases ??
            [];
        const normalized = Array.isArray(testCases) ? testCases : [];

        return {
            total: normalized.length,
            approved: normalized.filter(item => item?.approvalStatus === "approved").length,
            rejected: normalized.filter(item => item?.approvalStatus === "rejected").length,
            requiresTesterInput: normalized.filter(
                item => item?.executionReadiness === "DATA_REQUIRED"
            ).length
        };
    }

    findArtifacts(source) {
        if (Array.isArray(source)) return source;
        if (Array.isArray(source.artifacts)) return source.artifacts;
        if (source.artifact && typeof source.artifact === "object") {
            return [source.artifact];
        }
        return [];
    }

    findName(source, artifacts) {
        const requirementArtifact = artifacts.find(
            artifact => artifact?.requirement && typeof artifact.requirement === "object"
        );
        const requirement = requirementArtifact?.requirement ?? source.requirement;

        return (
            requirement?.module ??
            requirement?.feature ??
            requirement?.purpose ??
            source.name ??
            source.workflowName ??
            source.workflowId ??
            "qa-copilot"
        );
    }

    mapExports(source, sessionId) {
        const outputArtifact = (source.artifacts ?? []).find(
            artifact => artifact?.outputs && typeof artifact.outputs === "object"
        );
        const outputs =
            source.outputs ??
            source.data?.outputs ??
            source.data?.data?.outputs ??
            outputArtifact?.outputs ??
            {};

        if (!outputs || typeof outputs !== "object" || Array.isArray(outputs)) {
            return [];
        }

        return Object.keys(outputs)
            .filter(format => typeof outputs[format] === "string" && outputs[format])
            .map(format => ({
                format,
                downloadAvailable: true,
                downloadUrl: sessionId
                    ? `/api/workflows/${encodeURIComponent(
                          sessionId
                      )}/outputs/${encodeURIComponent(format)}/download`
                    : null
            }));
    }

    mapBlockingReasons(internalStatus, clarification) {
        if (internalStatus === "AWAITING_AI_CLARIFICATION" && clarification.remaining > 0) {
            return [
                {
                    code: "CLARIFICATION_REQUIRED",
                    message: "Còn câu hỏi cần tester trả lời."
                }
            ];
        }

        if (internalStatus === "AWAITING_AI_CLARIFICATION") {
            return [
                {
                    code: "AI_ANALYSIS_REVIEW_REQUIRED",
                    message: "AI Analysis cần được tester phê duyệt."
                }
            ];
        }

        if (internalStatus === "AWAITING_TEST_CASE_REVIEW") {
            return [
                {
                    code: "TEST_CASE_REVIEW_REQUIRED",
                    message: "Test cases cần được tester phê duyệt."
                }
            ];
        }

        if (internalStatus === "FAILED" || !internalStatus) {
            return [
                {
                    code: "WORKFLOW_STATE_UNAVAILABLE",
                    message: "Không xác định được trạng thái workflow."
                }
            ];
        }

        return [];
    }

    sanitizeValue(value, context, key = "") {
        if (Array.isArray(value)) {
            return value.map(item => this.sanitizeValue(item, context));
        }

        if (!value || typeof value !== "object") {
            if (typeof value === "string" && this.isStoragePath(key, value)) {
                return null;
            }
            return value;
        }

        const sanitized = {};

        Object.entries(value).forEach(([entryKey, entryValue]) => {
            if (entryKey === "outputs" && this.isPlainObject(entryValue)) {
                sanitized.outputs = Object.fromEntries(
                    context.exports.map(output => [output.format, output.downloadUrl])
                );
                return;
            }

            if (this.isStorageField(entryKey)) {
                return;
            }

            sanitized[entryKey] = this.sanitizeValue(entryValue, context, entryKey);
        });

        return sanitized;
    }

    isStorageField(key) {
        return [
            "requirementFile",
            "absolutePath",
            "storagePath",
            "filePath",
            "outputRoot",
            "outputDirectory"
        ].includes(key);
    }

    isStoragePath(key, value) {
        if (!/(path|file|directory|root)$/i.test(key)) return false;
        return path.isAbsolute(value) || /^[a-zA-Z]:[\\/]/.test(value);
    }

    isPlainObject(value) {
        return Boolean(value && typeof value === "object" && !Array.isArray(value));
    }
}
