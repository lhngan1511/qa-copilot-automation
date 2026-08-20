import assert from "node:assert/strict";
import QACopilotApplicationService from "../src/services/QACopilotApplicationService.js";

const rootSessionId = "SESSION-CLARIFICATION-ROOT";
const completedSessionId = "SESSION-TESTCASE-COMPLETED";
const duplicateSessionId = "SESSION-TESTCASE-DUPLICATE";
const context = testCaseSessionId => ({
    clarificationReview: { sessionId: rootSessionId, artifactId: "ARTIFACT-ROOT" },
    requirementReview: { sessionId: "", artifactId: "" },
    moduleReview: { sessionId: "", artifactId: "" },
    scenarioReview: { sessionId: "", artifactId: "" },
    testCaseReview: {
        sessionId: testCaseSessionId,
        artifactId: `ARTIFACT-${testCaseSessionId}`
    }
});

const sessions = [
    {
        sessionId: rootSessionId,
        projectId: "PROJECT-1",
        pipelineStatus: "AWAITING_AI_CLARIFICATION",
        workflowContext: {
            ...context("")
        },
        updatedAt: "2026-08-17T08:00:00.000Z"
    },
    {
        sessionId: completedSessionId,
        projectId: null,
        pipelineStatus: "COMPLETED",
        workflowContext: context(completedSessionId),
        updatedAt: "2026-08-17T08:10:00.000Z"
    },
    {
        sessionId: duplicateSessionId,
        projectId: null,
        pipelineStatus: "AWAITING_TEST_CASE_REVIEW",
        workflowContext: context(duplicateSessionId),
        updatedAt: "2026-08-17T08:20:00.000Z"
    }
];
const artifacts = [{
    sessionId: completedSessionId,
    artifactId: `ARTIFACT-${completedSessionId}`,
    artifactType: "TEST_CASE_REVIEW",
    approvalStatus: "approved",
    testCases: [{ id: "TC001", scenario: "Nội dung tester đã sửa" }]
}];
const runtime = {
    findSessions: () => structuredClone(sessions),
    findArtifactsBySessionId: sessionId =>
        structuredClone(artifacts.filter(artifact => artifact.sessionId === sessionId)),
    deleteArtifactsBySessionId: sessionId => {
        const retained = artifacts.filter(artifact => artifact.sessionId !== sessionId);
        const deleted = artifacts.length - retained.length;
        artifacts.splice(0, artifacts.length, ...retained);
        return deleted;
    },
    deleteSession: sessionId => {
        const index = sessions.findIndex(session => session.sessionId === sessionId);
        if (index < 0) {
            return false;
        }
        sessions.splice(index, 1);
        return true;
    }
};
const service = new QACopilotApplicationService({
    qaCopilot: {
        workflowCoordinator: {
            runtime,
            findSession: sessionId =>
                structuredClone(sessions.find(session => session.sessionId === sessionId) ?? null)
        }
    }
});

const listed = service.listWorkflows({ projectId: "PROJECT-1" });
assert.equal(listed.length, 1, "một chuỗi chỉ xuất hiện một workflow trên Dashboard");
assert.equal(listed[0].session.sessionId, completedSessionId);
assert.equal(listed[0].artifacts[0].testCases[0].scenario, "Nội dung tester đã sửa");

const openedFromRoot = service.getWorkflow({ sessionId: rootSessionId });
assert.equal(openedFromRoot.sessionId, completedSessionId, "URL session cũ mở session chuẩn");
assert.equal(openedFromRoot.artifacts[0].testCases[0].scenario, "Nội dung tester đã sửa");

assert.throws(
    () => service.deleteWorkflow({ sessionId: completedSessionId, projectId: "PROJECT-OTHER" }),
    error => error?.code === "WORKFLOW_PROJECT_MISMATCH",
    "không cho xóa workflow thuộc Project khác"
);

const deleted = service.deleteWorkflow({
    sessionId: completedSessionId,
    projectId: "PROJECT-1"
});
assert.equal(deleted.deletedSessions, 3, "xóa toàn bộ session trong cùng chuỗi workflow");
assert.equal(deleted.deletedArtifacts, 1, "xóa artifact testcase của chuỗi workflow");
assert.equal(sessions.length, 0);
assert.equal(artifacts.length, 0);

console.log("Workflow session chain regression test: PASS");
