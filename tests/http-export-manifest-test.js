import assert from "node:assert/strict";
import { startTestServer, getCurrentStageContext } from "./http-test-helpers.js";

const api = await startTestServer();
try {
    let result = (
        await api.request("POST", "/api/workflows", {
            requirementFile: "./requirements/thiet-bi.md"
        })
    ).body.data;

    while (!result.completed) {
        const current = getCurrentStageContext(result);
        const before = await api.request("GET", `/api/workflows/${current.sessionId}/outputs`);
        assert.equal(Object.keys(before.body.data.outputs).length, 0);

        const approved = await api.request("POST", `/api/workflows/${current.sessionId}/approve`, {
            artifactId: current.artifactId,
            approvedBy: "export-test"
        });
        assert.equal(approved.status, 200);
        const resumed = await api.request("POST", `/api/workflows/${current.sessionId}/resume`);
        assert.equal(resumed.status, 200);
        result = resumed.body.data;
    }

    assert.deepEqual(Object.keys(result.data.outputs).sort(), ["excel", "json"]);
    const context = result.workflowContext.testCaseReview;
    const outputs = await api.request("GET", `/api/workflows/${context.sessionId}/outputs`);
    assert.deepEqual(Object.keys(outputs.body.data.outputs).sort(), ["excel", "json"]);
    const completedStatus = await api.request("GET", `/api/workflows/${context.sessionId}`);
    assert.equal(completedStatus.body.data.workflow.status, "COMPLETED");

    const resumed = await api.request("POST", `/api/workflows/${context.sessionId}/resume`);
    assert.deepEqual(resumed.body.data.data.outputs, result.data.outputs);
} finally {
    await api.close();
}

console.log("HTTP export manifest test PASSED");
