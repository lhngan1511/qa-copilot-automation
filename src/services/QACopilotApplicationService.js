import QACopilot from "../QACopilot.js";
import WorkflowExecutionContext from "../models/WorkflowExecutionContext.js";
import { normalizeTestData, resolveExecutionReadiness } from "../utils/TestDataReadiness.js";
import PipelineStatuses from "../constants/PipelineStatuses.js";
import ApplicationActions from "../constants/ApplicationActions.js";
import TestCaseReviewValidator from "../validators/TestCaseReviewValidator.js";

export default class QACopilotApplicationService {
    constructor({ qaCopilot } = {}) {
        this.qaCopilot = qaCopilot || new QACopilot();
        this.testCaseReviewValidator = new TestCaseReviewValidator();
    }

    async start({ requirementFile, projectId = null } = {}) {
        this.requireRequirementFile(requirementFile);

        const result = await this.qaCopilot.run(requirementFile, {
            workflowContext: new WorkflowExecutionContext(),
            productionWorkflow: true
        });

        const applicationResult = this.buildApplicationResult(result);
        this.persistApplicationState(applicationResult, requirementFile, projectId);
        return applicationResult;
    }

    async resume({ requirementFile, workflowContext, projectId = null } = {}) {
        this.requireRequirementFile(requirementFile);

        const normalizedContext = this.normalizeWorkflowContext(workflowContext);

        const result = await this.qaCopilot.run(requirementFile, {
            workflowContext: normalizedContext,
            productionWorkflow: true
        });

        const applicationResult = this.buildApplicationResult(result);
        this.persistApplicationState(applicationResult, requirementFile, projectId);
        return applicationResult;
    }

    answerClarification({ workflowContext, questionId, answer, answeredBy = "user" } = {}) {
        const context = this.normalizeWorkflowContext(workflowContext);

        if (!context.isStageInitialized("clarificationReview")) {
            throw new Error("Clarification review is not initialized.");
        }

        const { sessionId, artifactId } = context.getStage("clarificationReview");

        this.qaCopilot.answerClarificationQuestion({
            sessionId,
            artifactId,
            questionId,
            answer,
            answeredBy
        });

        const clarificationStatus = this.qaCopilot.getClarificationStatus({
            sessionId,
            artifactId
        });

        return {
            action: ApplicationActions.CLARIFICATION_ANSWERED,
            workflowContext: context.toJSON(),
            clarificationStatus
        };
    }

    approveCurrentStage({ workflowContext, stage, approvedBy = "user", feedback = "" } = {}) {
        const context = this.normalizeWorkflowContext(workflowContext);

        const handlers = {
            clarificationReview: {
                review: "reviewClarification",
                approve: "approveClarification"
            },
            requirementReview: {
                review: "reviewRequirement",
                approve: "approveRequirement"
            },
            moduleReview: {
                review: "reviewModule",
                approve: "approveModule"
            },
            scenarioReview: {
                review: "reviewScenario",
                approve: "approveScenario"
            },
            testCaseReview: {
                review: "reviewTestCase",
                approve: "approveTestCase"
            }
        };

        const handler = handlers[stage];

        if (!handler) {
            throw new Error(`Unsupported workflow stage: ${stage}`);
        }

        if (!context.isStageInitialized(stage)) {
            throw new Error(`Workflow stage is not initialized: ${stage}`);
        }

        const { sessionId, artifactId } = context.getStage(stage);

        const reviewResult = this.qaCopilot[handler.review]({
            sessionId,
            feedback
        });

        const approvalResult = this.qaCopilot[handler.approve]({
            sessionId,
            artifactId,
            approvedBy
        });

        return {
            action: ApplicationActions.STAGE_APPROVED,
            stage,
            workflowContext: context.toJSON(),
            reviewResult,
            approvalResult
        };
    }

    async approveAndResume({
        requirementFile,
        workflowContext,
        stage,
        approvedBy = "user",
        feedback = ""
    } = {}) {
        const approval = this.approveCurrentStage({
            workflowContext,
            stage,
            approvedBy,
            feedback
        });

        const pipeline = await this.resume({
            requirementFile,
            workflowContext: approval.workflowContext
        });

        return {
            approval,
            pipeline
        };
    }

    getWorkflow({ sessionId } = {}) {
        if (typeof sessionId !== "string" || !sessionId.trim()) {
            throw this.applicationError("WORKFLOW_ID_REQUIRED", "workflowId is required.", 400);
        }
        const requestedSession = this.qaCopilot.workflowCoordinator.findSession(sessionId);
        const session = requestedSession
            ? this.findCanonicalWorkflowSession(requestedSession)
            : null;
        if (!session) {
            throw this.applicationError("WORKFLOW_NOT_FOUND", "Không tìm thấy workflow.", 404);
        }
        const artifacts =
            this.qaCopilot.workflowCoordinator.runtime.findArtifactsBySessionId(session.sessionId);

        return {
            ...session,
            pipelineStatus: session.pipelineStatus ?? null,
            workflowContext: session.workflowContext ?? null,
            artifacts
        };
    }

    listWorkflows({ projectId = undefined } = {}) {
        const expected = String(projectId ?? "");
        const allSessions = this.qaCopilot.workflowCoordinator.runtime.findSessions();
        const eligibleKeys = new Set(
            allSessions
                .filter(session => projectId === undefined || String(session.projectId ?? "") === expected)
                .map(session => this.workflowChainKey(session) || session.sessionId)
        );
        const sessions = allSessions.filter(session =>
            eligibleKeys.has(this.workflowChainKey(session) || session.sessionId)
        );

        return this.selectCanonicalWorkflowSessions(sessions)
        .map(session => ({
            session,
            artifacts: this.qaCopilot.workflowCoordinator.runtime.findArtifactsBySessionId(
                session.sessionId
            )
        }));
    }

    deleteWorkflow({ sessionId, projectId = undefined } = {}) {
        const session = this.requireSession(sessionId);
        const chainKey = this.workflowChainKey(session);
        const chainSessions = this.qaCopilot.workflowCoordinator.runtime.findSessions()
            .filter(candidate => this.workflowChainKey(candidate) === chainKey);
        const belongsToProject = projectId === undefined || chainSessions.some(candidate =>
            String(candidate.projectId ?? "") === String(projectId ?? "")
        );

        if (!belongsToProject) {
            throw this.applicationError("WORKFLOW_PROJECT_MISMATCH", "Workflow không thuộc Project hiện tại.", 403);
        }

        let deletedArtifacts = 0;
        let deletedSessions = 0;
        chainSessions.forEach(candidate => {
            deletedArtifacts +=
                this.qaCopilot.workflowCoordinator.runtime.deleteArtifactsBySessionId(candidate.sessionId);
            if (this.qaCopilot.workflowCoordinator.runtime.deleteSession(candidate.sessionId)) {
                deletedSessions += 1;
            }
        });

        if (deletedSessions === 0) {
            throw this.applicationError("WORKFLOW_NOT_FOUND", "Không tìm thấy workflow.", 404);
        }
        return {
            sessionId,
            workflowChainId: chainKey,
            deletedSessions,
            deletedArtifacts
        };
    }

    getCurrentReview({ sessionId } = {}) {
        const session = this.requireSession(sessionId);
        const artifacts =
            this.qaCopilot.workflowCoordinator.runtime.findArtifactsBySessionId(sessionId);
        const pendingArtifact = artifacts.find(item => item.approvalStatus === "pending");
        const artifact =
            pendingArtifact ??
            (session.status === "rejected" ? (artifacts[artifacts.length - 1] ?? null) : null);

        return {
            sessionId,
            workflowStatus: session.status ?? null,
            pipelineStatus: session.pipelineStatus ?? null,
            artifactType: artifact?.artifactType ?? null,
            artifactId: artifact?.artifactId ?? null,
            approvalStatus: artifact?.approvalStatus ?? null,
            artifact
        };
    }

    updateAIAnalysisReview({ sessionId, artifactId, analysis } = {}) {
        this.requireSession(sessionId);
        const current = this.requireArtifact(artifactId);
        this.requireArtifactOwnership(current, sessionId);

        if (current.artifactType !== "AI_ANALYSIS_REVIEW") {
            throw this.applicationError(
                "INVALID_REVIEW_TYPE",
                "Artifact is not an AI Analysis Review.",
                409
            );
        }
        if (current.approvalStatus !== "pending") {
            throw this.applicationError(
                "ARTIFACT_NOT_PENDING",
                "Only pending artifacts can be edited.",
                409
            );
        }
        if (!analysis || typeof analysis !== "object" || Array.isArray(analysis)) {
            throw this.applicationError("INVALID_AI_ANALYSIS", "analysis must be an object.", 422);
        }

        const existing =
            current.aiAnalysis && typeof current.aiAnalysis === "object" ? current.aiAnalysis : {};
        const updatedAnalysis = { ...existing };

        if (Object.hasOwn(analysis, "purpose")) {
            if (typeof analysis.purpose !== "string" || !analysis.purpose.trim()) {
                throw this.applicationError(
                    "INVALID_AI_ANALYSIS_PURPOSE",
                    "analysis purpose is required.",
                    422
                );
            }
            updatedAnalysis.purpose = analysis.purpose.trim();
        }

        return this.qaCopilot.workflowCoordinator.saveArtifact({
            ...current,
            aiAnalysis: updatedAnalysis,
            purpose: updatedAnalysis.purpose ?? current.purpose ?? "",
            updatedAt: new Date().toISOString()
        });
    }

    getArtifacts({ sessionId } = {}) {
        this.requireSession(sessionId);
        return this.qaCopilot.workflowCoordinator.runtime.findArtifactsBySessionId(sessionId);
    }

    editArtifact({ sessionId, artifactId, artifact } = {}) {
        this.requireSession(sessionId);
        const current = this.requireArtifact(artifactId);
        this.requireArtifactOwnership(current, sessionId);

        if (current.approvalStatus !== "pending") {
            throw this.applicationError(
                "ARTIFACT_NOT_PENDING",
                "Only pending artifacts can be edited.",
                409
            );
        }

        if (!artifact || typeof artifact !== "object" || Array.isArray(artifact)) {
            throw this.applicationError("INVALID_ARTIFACT", "artifact must be an object.", 422);
        }

        if (artifact.artifactId && artifact.artifactId !== current.artifactId) {
            throw this.applicationError(
                "INVALID_ARTIFACT_ID",
                "artifactId cannot be changed.",
                422
            );
        }

        const updated = {
            ...artifact,
            artifactId: current.artifactId,
            artifactType: current.artifactType,
            workflowId: current.workflowId,
            sessionId: current.sessionId,
            approvalStatus: current.approvalStatus,
            updatedAt: new Date().toISOString()
        };

        if (current.artifactType === "TEST_CASE_REVIEW" && Array.isArray(updated.testCases)) {
            updated.testCases = updated.testCases.map(testCase => {
                const clone =
                    testCase && typeof testCase === "object" && !Array.isArray(testCase)
                        ? { ...testCase }
                        : {};
                clone.testData = normalizeTestData(clone.testData, clone);
                clone.executionReadiness = resolveExecutionReadiness(clone.testData);
                return clone;
            });
        }

        return this.qaCopilot.workflowCoordinator.saveArtifact(updated);
    }

    updateTestCaseReview({ sessionId, artifactId, testCases } = {}) {
        this.requireSession(sessionId);
        const current = this.requireArtifact(artifactId);
        this.requireArtifactOwnership(current, sessionId);

        if (current.artifactType !== "TEST_CASE_REVIEW") {
            throw this.applicationError(
                "INVALID_REVIEW_TYPE",
                "Artifact is not a TestCase Review.",
                409
            );
        }
        const isFinalizedArtifact = ["approved", "completed"].includes(
            current.approvalStatus
        );
        if (current.approvalStatus !== "pending" && !isFinalizedArtifact) {
            throw this.applicationError(
                "ARTIFACT_NOT_EDITABLE",
                "Only pending or approved testcase artifacts can be edited.",
                409
            );
        }
        if (!Array.isArray(testCases)) {
            throw this.applicationError(
                "INVALID_TEST_CASE_BATCH",
                "testCases must be an array.",
                422
            );
        }

        const existingCases = this.testCaseReviewValidator.normalizeBatch(current.testCases);
        const existingById = new Map(existingCases.map(testCase => [testCase.id, testCase]));
        const submittedIds = testCases.map(testCase => this.testCaseId(testCase));
        const membershipChanged =
            testCases.length !== existingCases.length ||
            submittedIds.some(id => !existingById.has(id)) ||
            existingCases.some(testCase => !submittedIds.includes(testCase.id));
        if (isFinalizedArtifact && membershipChanged) {
            throw this.applicationError(
                "INCOMPLETE_TEST_CASE_BATCH",
                "A finalized testcase artifact cannot add or delete testcases.",
                422
            );
        }

        const seen = new Set();
        const updatedTestCases = testCases.map(testCase => {
            if (!testCase || typeof testCase !== "object" || Array.isArray(testCase)) {
                throw this.applicationError(
                    "INVALID_TEST_CASE",
                    "Each testcase must be an object.",
                    422
                );
            }

            const id = this.testCaseId(testCase);
            if (!id) {
                throw this.applicationError(
                    "INVALID_TEST_CASE_ID",
                    "Testcase must have an ID.",
                    422
                );
            }
            if (seen.has(id)) {
                throw this.applicationError(
                    "DUPLICATE_TEST_CASE_ID",
                    `Duplicate testcase ID: ${id}`,
                    422
                );
            }
            seen.add(id);

            const existing = existingById.get(id);
            const merged = this.testCaseReviewValidator.normalize({
                ...(existing ? this.cloneValue(existing) : {}),
                ...this.cloneValue(testCase),
                ...(existing
                    ? {}
                    : {
                          source: "MANUAL_TESTER",
                          reviewStatus: "PENDING",
                          createdAt: new Date().toISOString()
                      })
            });
            merged.testData = normalizeTestData(merged.testData, merged);
            merged.executionReadiness = resolveExecutionReadiness(merged.testData);
            return merged;
        });

        this.testCaseReviewValidator.validateBatch(updatedTestCases, {
            requireResolved: isFinalizedArtifact
        });
        const updatedArtifact = {
            ...current,
            testCases: updatedTestCases,
            summary: this.qaCopilot.buildTestCaseReviewSummary(updatedTestCases),
            updatedAt: new Date().toISOString()
        };

        if (isFinalizedArtifact) {
            const approvedTestCases = this.qaCopilot.approvedTestCaseMapper.map({
                ...updatedArtifact,
                approvalStatus: "approved"
            });
            Object.entries(current.outputs ?? {}).forEach(([format, outputPath]) => {
                if (typeof outputPath === "string" && outputPath) {
                    this.qaCopilot.outputManager.export(approvedTestCases, format, outputPath);
                }
            });
        }

        return this.qaCopilot.workflowCoordinator.saveArtifact(updatedArtifact);
    }

    approveReview({ sessionId, artifactId, approvedBy = "user" } = {}) {
        const session = this.requireSession(sessionId);
        const artifact = this.requireArtifact(artifactId);
        this.requireArtifactOwnership(artifact, sessionId);

        if (artifact.approvalStatus !== "pending") {
            throw this.applicationError(
                "APPROVAL_CONFLICT",
                "Artifact is not pending approval.",
                409
            );
        }

        if (artifact.artifactType === "TEST_CASE_REVIEW") {
            const testCases = this.testCaseReviewValidator.normalizeBatch(artifact.testCases);
            this.testCaseReviewValidator.validateBatch(testCases, { requireResolved: true });
            this.qaCopilot.workflowCoordinator.saveArtifact({ ...artifact, testCases });
        }

        const stage = this.stageFromArtifactType(artifact.artifactType);
        const context = new WorkflowExecutionContext(session.workflowContext ?? {});
        const stageData = context.getStage(stage);

        if (stageData.sessionId !== sessionId || stageData.artifactId !== artifactId) {
            throw this.applicationError(
                "WRONG_REVIEW_STAGE",
                "Artifact does not belong to the current review stage.",
                409
            );
        }

        return this.approveCurrentStage({
            workflowContext: context,
            stage,
            approvedBy
        });
    }

    rejectReview({ sessionId, artifactId, rejectedBy = "user", reason = "" } = {}) {
        const session = this.requireSession(sessionId);
        const artifact = this.requireArtifact(artifactId);
        this.requireArtifactOwnership(artifact, sessionId);

        if (artifact.approvalStatus !== "pending") {
            throw this.applicationError(
                "REJECTION_CONFLICT",
                "Artifact is not pending review.",
                409
            );
        }

        const stage = this.stageFromArtifactType(artifact.artifactType);
        const workflowNames = {
            clarificationReview: "clarification-review",
            requirementReview: "requirement-review",
            moduleReview: "module-review",
            scenarioReview: "scenario-review",
            testCaseReview: "test-case-review"
        };
        const context = new WorkflowExecutionContext(session.workflowContext ?? {});
        const stageData = context.getStage(stage);

        if (stageData.sessionId !== sessionId || stageData.artifactId !== artifactId) {
            throw this.applicationError(
                "WRONG_REVIEW_STAGE",
                "Artifact does not belong to the current review stage.",
                409
            );
        }

        const result = this.qaCopilot.workflowCoordinator.reject({
            workflowName: workflowNames[stage],
            sessionId,
            artifactId,
            rejectedBy,
            feedback: reason
        });
        this.qaCopilot.workflowCoordinator.saveArtifact({
            ...artifact,
            approvalStatus: "rejected",
            rejectedBy,
            rejectionReason: reason,
            rejectedAt: new Date().toISOString()
        });
        return result;
    }

    async resumeSession({ sessionId } = {}) {
        const requestedSession = this.requireSession(sessionId);
        const session = this.findCanonicalWorkflowSession(requestedSession);

        if (!session.requirementFile || !session.workflowContext) {
            throw this.applicationError(
                "RESUME_STATE_MISSING",
                "Stored workflow does not contain resume state.",
                409
            );
        }

        return this.resume({
            requirementFile: session.requirementFile,
            workflowContext: session.workflowContext,
            projectId: session.projectId ?? null
        });
    }

    findCanonicalWorkflowSession(session) {
        const key = this.workflowChainKey(session);
        if (!key) return session;

        const related = this.qaCopilot.workflowCoordinator.runtime.findSessions()
            .filter(candidate => this.workflowChainKey(candidate) === key);
        return this.selectPreferredWorkflowSession(related) ?? session;
    }

    selectCanonicalWorkflowSessions(sessions = []) {
        const groups = new Map();

        sessions.forEach(session => {
            const key = this.workflowChainKey(session) || session.sessionId;
            const current = groups.get(key);
            groups.set(key, this.selectPreferredWorkflowSession([current, session].filter(Boolean)));
        });

        return [...groups.values()];
    }

    selectPreferredWorkflowSession(sessions = []) {
        return [...sessions].sort((left, right) => {
            const rankDifference = this.workflowSessionRank(right) - this.workflowSessionRank(left);
            if (rankDifference !== 0) return rankDifference;

            return this.workflowSessionTimestamp(right) - this.workflowSessionTimestamp(left);
        })[0] ?? null;
    }

    workflowChainKey(session = {}) {
        const context = new WorkflowExecutionContext(session.workflowContext ?? {});
        const stages = [
            "clarificationReview",
            "requirementReview",
            "moduleReview",
            "scenarioReview",
            "testCaseReview"
        ];

        return stages
            .map(stage => context.getStage(stage).sessionId)
            .find(Boolean) || session.sessionId || "";
    }

    workflowSessionRank(session = {}) {
        if (session.pipelineStatus === PipelineStatuses.COMPLETED) return 100;

        const ranks = {
            [PipelineStatuses.AWAITING_TEST_CASE_REVIEW]: 50,
            [PipelineStatuses.AWAITING_SCENARIO_REVIEW]: 40,
            [PipelineStatuses.AWAITING_MODULE_REVIEW]: 30,
            [PipelineStatuses.AWAITING_REQUIREMENT_REVIEW]: 20,
            [PipelineStatuses.AWAITING_AI_CLARIFICATION]: 10
        };
        return ranks[session.pipelineStatus] ?? 0;
    }

    workflowSessionTimestamp(session = {}) {
        const value = Date.parse(session.updatedAt ?? session.completedAt ?? session.startedAt ?? "");
        return Number.isFinite(value) ? value : 0;
    }

    getOutputs({ sessionId } = {}) {
        const session = this.requireSession(sessionId);
        const artifacts =
            this.qaCopilot.workflowCoordinator.runtime.findArtifactsBySessionId(sessionId);
        const artifact = artifacts.find(item => item.artifactType === "TEST_CASE_REVIEW");

        return {
            sessionId,
            status: session.pipelineStatus ?? null,
            outputs: artifact?.outputs ?? session.outputs ?? {}
        };
    }

    buildApplicationResult(result) {
        const validResult = result && typeof result === "object" && !Array.isArray(result);

        const data = validResult ? result : {};

        const hasOutputs =
            validResult &&
            result.outputs &&
            typeof result.outputs === "object" &&
            !Array.isArray(result.outputs) &&
            Object.keys(result.outputs).length > 0;

        const status = validResult
            ? (result.status ?? (hasOutputs ? PipelineStatuses.COMPLETED : PipelineStatuses.FAILED))
            : PipelineStatuses.FAILED;

        let workflowContext;

        try {
            workflowContext =
                result?.workflowContext &&
                typeof result.workflowContext === "object" &&
                !Array.isArray(result.workflowContext)
                    ? new WorkflowExecutionContext(result.workflowContext).toJSON()
                    : this.qaCopilot.getWorkflowContextFromResult(result).toJSON();
        } catch {
            workflowContext = new WorkflowExecutionContext().toJSON();
        }

        return {
            status,
            completed: status === PipelineStatuses.COMPLETED,
            currentStage: this.getCurrentStage(status),
            nextAction: this.getNextAction(status),
            workflowContext,
            data
        };
    }

    normalizeWorkflowContext(workflowContext) {
        if (workflowContext instanceof WorkflowExecutionContext) {
            return new WorkflowExecutionContext(workflowContext.toJSON());
        }

        if (
            workflowContext &&
            typeof workflowContext === "object" &&
            !Array.isArray(workflowContext)
        ) {
            return new WorkflowExecutionContext(workflowContext);
        }

        return new WorkflowExecutionContext();
    }

    getCurrentStage(status) {
        const stages = {
            [PipelineStatuses.AWAITING_AI_CLARIFICATION]: "clarificationReview",
            [PipelineStatuses.AWAITING_REQUIREMENT_REVIEW]: "requirementReview",
            [PipelineStatuses.AWAITING_MODULE_REVIEW]: "moduleReview",
            [PipelineStatuses.AWAITING_SCENARIO_REVIEW]: "scenarioReview",
            [PipelineStatuses.AWAITING_TEST_CASE_REVIEW]: "testCaseReview"
        };

        return stages[status] ?? null;
    }

    getNextAction(status) {
        const actions = {
            [PipelineStatuses.AWAITING_AI_CLARIFICATION]: ApplicationActions.ANSWER_CLARIFICATION,
            [PipelineStatuses.AWAITING_REQUIREMENT_REVIEW]: ApplicationActions.REVIEW_REQUIREMENT,
            [PipelineStatuses.AWAITING_MODULE_REVIEW]: ApplicationActions.REVIEW_MODULE,
            [PipelineStatuses.AWAITING_SCENARIO_REVIEW]: ApplicationActions.REVIEW_SCENARIO,
            [PipelineStatuses.AWAITING_TEST_CASE_REVIEW]: ApplicationActions.REVIEW_TEST_CASE,
            [PipelineStatuses.COMPLETED]: ApplicationActions.NONE,
            [PipelineStatuses.FAILED]: ApplicationActions.CHECK_ERROR
        };

        return actions[status] ?? ApplicationActions.CHECK_ERROR;
    }

    requireRequirementFile(requirementFile) {
        if (typeof requirementFile !== "string" || requirementFile.trim() === "") {
            throw new Error("requirementFile is required.");
        }
    }

    persistApplicationState(applicationResult, requirementFile, projectId = null) {
        const currentStage = applicationResult.currentStage;
        const context = new WorkflowExecutionContext(applicationResult.workflowContext);
        const persistedStage =
            currentStage ??
            [
                "testCaseReview",
                "scenarioReview",
                "moduleReview",
                "requirementReview",
                "clarificationReview"
            ].find(stage => context.isStageInitialized(stage));
        if (!persistedStage) return;

        const { sessionId, artifactId } = context.getStage(persistedStage);
        if (!sessionId) return;

        const session = this.qaCopilot.workflowCoordinator.findSession(sessionId);
        if (!session) return;

        this.qaCopilot.workflowCoordinator.runtime.saveSession({
            ...session,
            projectId: projectId ?? session.projectId ?? null,
            requirementFile,
            workflowContext: context.toJSON(),
            pipelineStatus: applicationResult.status,
            currentStage: currentStage ?? null,
            currentArtifactId: artifactId,
            outputs: applicationResult.data?.outputs ?? {}
        });
    }

    requireSession(sessionId) {
        if (typeof sessionId !== "string" || !sessionId.trim()) {
            throw this.applicationError("SESSION_ID_REQUIRED", "sessionId is required.", 400);
        }

        const session = this.qaCopilot.workflowCoordinator.findSession(sessionId);
        if (!session) {
            throw this.applicationError(
                "SESSION_NOT_FOUND",
                `Workflow session '${sessionId}' not found.`,
                404
            );
        }
        return session;
    }

    requireArtifact(artifactId) {
        if (typeof artifactId !== "string" || !artifactId.trim()) {
            throw this.applicationError("ARTIFACT_ID_REQUIRED", "artifactId is required.", 400);
        }

        const artifact = this.qaCopilot.workflowCoordinator.findArtifact(artifactId);
        if (!artifact) {
            throw this.applicationError(
                "ARTIFACT_NOT_FOUND",
                `Artifact '${artifactId}' not found.`,
                404
            );
        }
        return artifact;
    }

    requireArtifactOwnership(artifact, sessionId) {
        if (artifact.sessionId !== sessionId) {
            throw this.applicationError(
                "ARTIFACT_SESSION_MISMATCH",
                "Artifact does not belong to this workflow session.",
                409
            );
        }
    }

    stageFromArtifactType(artifactType) {
        const stages = {
            AI_ANALYSIS_REVIEW: "clarificationReview",
            AI_CLARIFICATION_REVIEW: "clarificationReview",
            REQUIREMENT_REVIEW: "requirementReview",
            MODULE_REVIEW: "moduleReview",
            SCENARIO_REVIEW: "scenarioReview",
            TEST_CASE_REVIEW: "testCaseReview"
        };
        const stage = stages[artifactType];
        if (!stage) {
            throw this.applicationError(
                "UNSUPPORTED_ARTIFACT_TYPE",
                `Unsupported review artifact type: ${artifactType}`,
                409
            );
        }
        return stage;
    }

    testCaseId(testCase) {
        return String(testCase?.testcaseId ?? testCase?.testCaseId ?? testCase?.id ?? "").trim();
    }

    cloneValue(value) {
        return value === undefined ? undefined : structuredClone(value);
    }

    applicationError(code, message, statusCode) {
        const error = new Error(message);
        error.code = code;
        error.statusCode = statusCode;
        return error;
    }
}
