import assert from "node:assert/strict";
import { startTestServer } from "./http-test-helpers.js";

const api = await startTestServer();

async function upload(name, content = "# Requirement") {
    return fetch(`${api.baseUrl}/api/requirements/upload`, {
        method: "POST",
        headers: {
            "content-type": "text/markdown",
            "x-file-name": encodeURIComponent(name)
        },
        body: content
    });
}

try {
    const invalidType = await upload("requirement.txt");
    assert.equal(invalidType.status, 415);
    assert.equal((await invalidType.json()).error.code, "INVALID_FILE_TYPE");

    const traversal = await upload("../outside.md");
    assert.equal(traversal.status, 400);
    assert.equal((await traversal.json()).error.code, "INVALID_FILE_NAME");

    const windowsTraversal = await upload("..\\outside.md");
    assert.equal(windowsTraversal.status, 400);

    const empty = await upload("empty.md", "");
    assert.equal(empty.status, 400);
} finally {
    await api.close();
}

console.log("Requirement upload security test PASSED");
