import assert from "node:assert/strict";
import { startTestServer, getCurrentStageContext } from "./http-test-helpers.js";

const api = await startTestServer();
try {
    const created = await api.request("POST", "/api/workflows", {
        requirementFile: "./requirements/thiet-bi.md"
    });
    const current = getCurrentStageContext(created.body.data);
    const resume = await api.request("POST", `/api/workflows/${current.sessionId}/resume`);
    assert.equal(resume.status, 409);
    assert.equal(resume.body.success, false);
    assert.equal("stack" in resume.body.error, false);

    const wrongApprove = await api.request("POST", `/api/workflows/${current.sessionId}/approve`, {
        artifactId: "UNKNOWN"
    });
    assert.equal(wrongApprove.status, 404);

    const rejected = await api.request("POST", `/api/workflows/${current.sessionId}/reject`, {
        artifactId: current.artifactId,
        rejectedBy: "reviewer",
        reason: "Needs revision"
    });
    assert.equal(rejected.status, 200);
    const review = await api.request("GET", `/api/workflows/${current.sessionId}/current-review`);
    assert.equal(review.body.data.approvalStatus, "rejected");
} finally {
    await api.close();
}

console.log("HTTP review gate test PASSED");
