import BaseReviewWorkflow from "./BaseReviewWorkflow.js";

export default class TestCaseReviewWorkflow extends BaseReviewWorkflow {
    constructor({ artifactRepository, workflowSessionRepository }) {
        super({
            artifactRepository,
            workflowSessionRepository
        });
    }

    start(context = {}) {
        const session = this.requireSession(context);

        const updatedSession = {
            ...session,
            workflowName: session.workflowName ?? "testcase-review",
            status: "started",
            startedAt: session.startedAt ?? new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.workflowSessionRepository.save(updatedSession);

        const artifact = this.resolveArtifact(context);

        if (artifact) {
            this.artifactRepository.save({
                ...artifact,
                sessionId: artifact.sessionId ?? updatedSession.sessionId,
                workflowId:
                    artifact.workflowId ?? updatedSession.workflowId ?? updatedSession.workflowName,
                artifactType: artifact.artifactType ?? "testcase"
            });
        }

        return {
            action: "start",
            status: updatedSession.status,
            session: updatedSession,
            artifact
        };
    }

    execute(context = {}) {
        const session = this.getExistingSession(context);

        const updatedSession = {
            ...session,
            status: "executed",
            executedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.workflowSessionRepository.save(updatedSession);

        return {
            action: "execute",
            status: updatedSession.status,
            session: updatedSession
        };
    }

    review(context = {}) {
        const session = this.getExistingSession(context);

        const updatedSession = {
            ...session,
            status: "in-review",
            reviewData: context.reviewData ?? context.feedback ?? null,
            reviewedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.workflowSessionRepository.save(updatedSession);

        return {
            action: "review",
            status: updatedSession.status,
            session: updatedSession
        };
    }

    approve(context = {}) {
        const session = this.getExistingSession(context);

        const updatedSession = {
            ...session,
            status: "approved",
            approvedBy: context.approvedBy ?? "user",
            approvalData: context.approvalData ?? null,
            approvedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.workflowSessionRepository.save(updatedSession);

        const artifactId = context.artifactId ?? session.artifactId;

        let artifact = null;

        if (artifactId) {
            artifact = this.artifactRepository.findById(artifactId);

            if (artifact) {
                artifact = {
                    ...artifact,
                    approvalStatus: "approved",
                    approvedAt: updatedSession.approvedAt,
                    approvedBy: updatedSession.approvedBy
                };

                this.artifactRepository.save(artifact);
            }
        }

        return {
            action: "approve",
            status: updatedSession.status,
            session: updatedSession,
            artifact
        };
    }

    reject(context = {}) {
        const session = this.getExistingSession(context);

        const updatedSession = {
            ...session,
            status: "rejected",
            rejectionReason: context.reason ?? context.feedback ?? null,
            rejectedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.workflowSessionRepository.save(updatedSession);

        return {
            action: "reject",
            status: updatedSession.status,
            session: updatedSession
        };
    }

    complete(context = {}) {
        const session = this.getExistingSession(context);

        if (session.status !== "approved") {
            throw new Error("Test case review must be approved before completion.");
        }

        const updatedSession = {
            ...session,
            status: "completed",
            completedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.workflowSessionRepository.save(updatedSession);

        return {
            action: "complete",
            status: updatedSession.status,
            session: updatedSession
        };
    }

    requireSession(context = {}) {
        const session = context.session ?? {
            sessionId: context.sessionId,
            workflowId: context.workflowId,
            workflowName: context.workflowName,
            artifactId: context.artifactId
        };

        if (!session.sessionId) {
            throw new Error("sessionId is required.");
        }

        return session;
    }

    getExistingSession(context = {}) {
        const sessionId = context.sessionId ?? context.session?.sessionId;

        if (!sessionId) {
            throw new Error("sessionId is required.");
        }

        const session = this.workflowSessionRepository.findById(sessionId);

        if (!session) {
            throw new Error(`Workflow session '${sessionId}' not found.`);
        }

        return session;
    }

    resolveArtifact(context = {}) {
        const source = context.artifact ?? context.testCase ?? null;

        if (!source) {
            return null;
        }

        const artifactId = source.artifactId ?? context.artifactId;

        if (!artifactId) {
            return {
                ...source,
                artifactId: `TC-${Date.now()}`
            };
        }

        return {
            ...source,
            artifactId
        };
    }
}
