import assert from "node:assert/strict";
import { startTestServer, getCurrentStageContext } from "./http-test-helpers.js";

const api = await startTestServer();
try {
    const created = await api.request("POST", "/api/workflows", {
        requirementFile: "./requirements/thiet-bi.md"
    });
    const current = getCurrentStageContext(created.body.data);
    const approved = await api.request("POST", `/api/workflows/${current.sessionId}/approve`, {
        artifactId: current.artifactId,
        approvedBy: "api-user"
    });
    assert.equal(approved.status, 200);

    const duplicate = await api.request("POST", `/api/workflows/${current.sessionId}/approve`, {
        artifactId: current.artifactId,
        approvedBy: "api-user"
    });
    assert.equal(duplicate.status, 409);

    const resumed = await api.request("POST", `/api/workflows/${current.sessionId}/resume`);
    assert.equal(resumed.status, 200);
    assert.equal(resumed.body.data.currentStage, "moduleReview");
} finally {
    await api.close();
}

console.log("HTTP approval/resume test PASSED");
