import assert from "node:assert/strict";
import { startTestServer, getCurrentStageContext } from "./http-test-helpers.js";

const api = await startTestServer();
try {
    const health = await api.request("GET", "/health");
    assert.equal(health.status, 200);

    const created = await api.request("POST", "/api/workflows", {
        requirementFile: "./requirements/thiet-bi.md"
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.success, true);
    const current = getCurrentStageContext(created.body.data);

    const status = await api.request("GET", `/api/workflows/${current.sessionId}`);
    assert.equal(status.status, 200);
    assert.equal(status.body.data.workflow.id, current.sessionId);
    assert.equal(status.body.data.deprecated.pipelineStatus, created.body.data.status);
    const review = await api.request("GET", `/api/workflows/${current.sessionId}/current-review`);
    assert.equal(review.body.data.artifactId, current.artifactId);
    const artifacts = await api.request("GET", `/api/workflows/${current.sessionId}/artifacts`);
    assert.equal(artifacts.body.data.length, 1);

    const deleted = await api.request("DELETE", `/api/workflows/${current.sessionId}`);
    assert.equal(deleted.status, 200);
    assert.equal(deleted.body.data.sessionId, current.sessionId);
    assert.equal(deleted.body.data.deletedArtifacts, 1);
    const missing = await api.request("GET", `/api/workflows/${current.sessionId}`);
    assert.equal(missing.status, 404);
    const listing = await api.request("GET", "/api/workflows?limit=20&offset=0");
    assert.equal(listing.body.data.items.some(item => item.id === current.sessionId), false);
} finally {
    await api.close();
}

console.log("HTTP workflow API test PASSED");
