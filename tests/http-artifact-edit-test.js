import assert from "node:assert/strict";
import { startTestServer, getCurrentStageContext } from "./http-test-helpers.js";

const api = await startTestServer();
try {
    const created = await api.request("POST", "/api/workflows", {
        requirementFile: "./requirements/thiet-bi.md"
    });
    const current = getCurrentStageContext(created.body.data);
    const review = await api.request("GET", `/api/workflows/${current.sessionId}/current-review`);
    const editedArtifact = {
        ...review.body.data.artifact,
        userEdit: "saved over HTTP"
    };
    const edit = await api.request(
        "PUT",
        `/api/workflows/${current.sessionId}/artifacts/${current.artifactId}`,
        { artifact: editedArtifact }
    );
    assert.equal(edit.status, 200);
    assert.equal(edit.body.data.userEdit, "saved over HTTP");
    assert.equal(edit.body.data.approvalStatus, "pending");

    const wrongSession = await api.request(
        "PUT",
        `/api/workflows/OTHER/artifacts/${current.artifactId}`,
        { artifact: editedArtifact }
    );
    assert.equal(wrongSession.status, 404);
} finally {
    await api.close();
}

console.log("HTTP artifact edit test PASSED");
