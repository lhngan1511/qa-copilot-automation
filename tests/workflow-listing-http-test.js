import assert from "node:assert/strict";
import { startTestServer } from "./http-test-helpers.js";

const api = await startTestServer();

function containsStoragePath(value) {
    return /[a-zA-Z]:[\\/]|tests[\\/]\.tmp|outputs[\\/]production/.test(JSON.stringify(value));
}

try {
    const empty = await api.request("GET", "/api/workflows");
    assert.equal(empty.status, 200);
    assert.deepEqual(empty.body.data.items, []);
    assert.deepEqual(empty.body.data.pagination, {
        total: 0,
        limit: 20,
        offset: 0,
        hasMore: false
    });
    assert.equal(containsStoragePath(empty.body), false);

    const runtime = api.app.locals.dependencies.runtime;
    const sessions = [
        {
            sessionId: "SESSION-A",
            workflowName: "test-case-review",
            status: "started",
            pipelineStatus: "AWAITING_TEST_CASE_REVIEW",
            startedAt: "2026-07-01T08:00:00.000Z",
            updatedAt: "2026-07-03T08:00:00.000Z",
            workflowContext: {
                clarificationReview: { sessionId: "", artifactId: "" },
                requirementReview: { sessionId: "", artifactId: "" },
                moduleReview: { sessionId: "", artifactId: "" },
                scenarioReview: { sessionId: "", artifactId: "" },
                testCaseReview: {
                    sessionId: "SESSION-A",
                    artifactId: "ARTIFACT-A"
                }
            },
            requirementFile: "G:\\private\\requirement-a.md"
        },
        {
            sessionId: "SESSION-B",
            workflowName: "clarification-review",
            status: "started",
            pipelineStatus: "AWAITING_AI_CLARIFICATION",
            startedAt: "2026-07-01T09:00:00.000Z",
            updatedAt: "2026-07-02T08:00:00.000Z",
            workflowContext: {
                clarificationReview: {
                    sessionId: "SESSION-B",
                    artifactId: "ARTIFACT-B"
                },
                requirementReview: { sessionId: "", artifactId: "" },
                moduleReview: { sessionId: "", artifactId: "" },
                scenarioReview: { sessionId: "", artifactId: "" },
                testCaseReview: { sessionId: "", artifactId: "" }
            },
            requirementFile: "G:\\private\\requirement-b.md"
        },
        {
            sessionId: "SESSION-C",
            workflowName: "test-case-review",
            status: "completed",
            pipelineStatus: "COMPLETED",
            startedAt: "2026-07-01T07:00:00.000Z",
            workflowContext: {
                clarificationReview: { sessionId: "", artifactId: "" },
                requirementReview: { sessionId: "", artifactId: "" },
                moduleReview: { sessionId: "", artifactId: "" },
                scenarioReview: { sessionId: "", artifactId: "" },
                testCaseReview: {
                    sessionId: "SESSION-C",
                    artifactId: "ARTIFACT-C"
                }
            }
        }
    ];
    sessions.forEach(session => runtime.saveSession(session));

    runtime.saveArtifact({
        artifactId: "ARTIFACT-A",
        sessionId: "SESSION-A",
        artifactType: "TEST_CASE_REVIEW",
        approvalStatus: "pending",
        requirement: { module: "Quản lý thiết bị", content: "private full content" },
        testCases: [
            { id: "TC001", executionReadiness: "READY" },
            { id: "TC002", executionReadiness: "DATA_REQUIRED" }
        ]
    });
    runtime.saveArtifact({
        artifactId: "ARTIFACT-B",
        sessionId: "SESSION-B",
        artifactType: "AI_ANALYSIS_REVIEW",
        approvalStatus: "pending",
        requirement: { module: "Quản lý khách hàng", content: "private full content" },
        questions: [
            { questionId: "CL001", answer: "Có" },
            { questionId: "CL002", answer: "" }
        ]
    });
    runtime.saveArtifact({
        artifactId: "ARTIFACT-C",
        sessionId: "SESSION-C",
        artifactType: "TEST_CASE_REVIEW",
        approvalStatus: "approved",
        requirement: { module: "Quản lý sản phẩm", content: "private full content" },
        testCases: [{ id: "TC003", executionReadiness: "READY" }],
        outputs: {
            json: "G:\\private\\outputs\\approved-testcases.json",
            excel: "G:\\private\\outputs\\approved-testcases.xlsx"
        }
    });

    const listing = await api.request("GET", "/api/workflows");
    assert.equal(listing.status, 200);
    assert.equal(listing.body.data.items.length, 3);
    assert.deepEqual(
        listing.body.data.items.map(item => item.id),
        ["SESSION-A", "SESSION-B", "SESSION-C"]
    );
    assert.equal(listing.body.data.items[0].name, "Quản lý thiết bị");
    assert.equal(listing.body.data.items[0].status, "TEST_CASE_REVIEW_REQUIRED");
    assert.equal(listing.body.data.items[0].testCases.total, 2);
    assert.equal(listing.body.data.items[0].testCases.requiresTesterInput, 1);
    assert.equal(listing.body.data.items[1].clarification.remaining, 1);
    assert.equal(listing.body.data.items[2].exportAvailable, true);
    assert.equal("testCasesArray" in listing.body.data.items[0], false);
    assert.equal("requirement" in listing.body.data.items[0], false);
    assert.equal("artifacts" in listing.body.data.items[0], false);
    assert.equal(containsStoragePath(listing.body), false);

    const firstPage = await api.request("GET", "/api/workflows?limit=2&offset=0");
    const secondPage = await api.request("GET", "/api/workflows?limit=2&offset=2");
    assert.deepEqual(
        firstPage.body.data.items.map(item => item.id),
        ["SESSION-A", "SESSION-B"]
    );
    assert.deepEqual(
        secondPage.body.data.items.map(item => item.id),
        ["SESSION-C"]
    );
    assert.deepEqual(firstPage.body.data.pagination, {
        total: 3,
        limit: 2,
        offset: 0,
        hasMore: true
    });
    assert.deepEqual(secondPage.body.data.pagination, {
        total: 3,
        limit: 2,
        offset: 2,
        hasMore: false
    });

    for (const query of ["limit=0", "limit=101", "offset=-1", "limit=abc"]) {
        const invalid = await api.request("GET", `/api/workflows?${query}`);
        assert.equal(invalid.status, 400);
        assert.equal(invalid.body.success, false);
        assert.equal(invalid.body.error.code, "INVALID_WORKFLOW_QUERY");
        assert.equal("stack" in invalid.body.error, false);
    }

    const detail = await api.request("GET", "/api/workflows/SESSION-A");
    assert.equal(detail.status, 200);
    assert.deepEqual(Object.keys(detail.body.data).sort(), ["deprecated", "workflow"]);
    assert.equal(detail.body.data.workflow.id, "SESSION-A");
    assert.equal(detail.body.data.workflow.name, "Quản lý thiết bị");
    assert.equal(detail.body.data.workflow.status, "TEST_CASE_REVIEW_REQUIRED");
    assert.equal(detail.body.data.workflow.step, "TEST_CASE_REVIEW");
    assert.deepEqual(detail.body.data.workflow.allowedActions, [
        "UPDATE_TEST_CASES",
        "APPROVE_TEST_CASES"
    ]);
    assert.equal(detail.body.data.workflow.testCases.total, 2);
    assert.equal(containsStoragePath(detail.body), false);
    assert.doesNotThrow(() => JSON.stringify(detail.body.data.workflow));

    const missing = await api.request("GET", "/api/workflows/SESSION-UNKNOWN");
    assert.equal(missing.status, 404);
    assert.equal(missing.body.success, false);
    assert.equal(missing.body.error.code, "WORKFLOW_NOT_FOUND");
    assert.equal("stack" in missing.body.error, false);
    assert.equal(containsStoragePath(missing.body), false);

    const reloaded = await api.request("GET", "/api/workflows/SESSION-C");
    assert.equal(reloaded.status, 200);
    assert.equal(reloaded.body.data.workflow.status, "COMPLETED");
    assert.deepEqual(
        reloaded.body.data.workflow.exports.map(output => output.format),
        ["json", "excel"]
    );
    assert.equal(containsStoragePath(reloaded.body), false);
} finally {
    await api.close();
}

console.log("Workflow listing HTTP test PASSED");
