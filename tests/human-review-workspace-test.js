import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { startTestServer } from "./http-test-helpers.js";

const api = await startTestServer();

try {
    const page = await fetch(`${api.baseUrl}/`);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /Human Review Workspace/);

    const script = await fetch(`${api.baseUrl}/app.js`);
    assert.equal(script.status, 200);
    assert.match(await script.text(), /AWAITING_AI_CLARIFICATION|clarificationReview/);

    const styles = await fetch(`${api.baseUrl}/styles.css`);
    assert.equal(styles.status, 200);
    assert.match(await styles.text(), /\.progress/);

    const fixture = fs.readFileSync(path.resolve("requirements/thiet-bi.md"));
    const upload = await fetch(`${api.baseUrl}/api/requirements/upload`, {
        method: "POST",
        headers: {
            "content-type": "text/markdown",
            "x-file-name": encodeURIComponent("thiet-bi.md")
        },
        body: fixture
    });
    assert.equal(upload.status, 201);
    const uploadBody = await upload.json();
    assert.equal(uploadBody.success, true);
    assert.equal(path.extname(uploadBody.data.requirementId), ".md");
    assert.equal("requirementFile" in uploadBody.data, false);

    const created = await api.request("POST", "/api/workflows", {
        requirementId: uploadBody.data.requirementId
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.success, true);
    assert.match(created.body.data.status, /^AWAITING_/);
} finally {
    await api.close();
}

console.log("Human review workspace test PASSED");
