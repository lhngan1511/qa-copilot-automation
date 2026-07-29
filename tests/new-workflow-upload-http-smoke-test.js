import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import createApp from "../src/server/createApp.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.join(testDirectory, "fixtures", "web-ui-production-requirement.md");
const originalCwd = process.cwd();
const originalEnableAI = process.env.ENABLE_AI;
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "qa-copilot-new-workflow-"));
const dataDir = path.join(tempRoot, "data");
const outputDir = path.join(tempRoot, "outputs");

let server;

async function request(baseUrl, method, requestPath, body, headers = {}) {
    const jsonBody = body !== undefined && !Buffer.isBuffer(body);
    const response = await fetch(`${baseUrl}${requestPath}`, {
        method,
        headers: {
            ...(jsonBody ? { "content-type": "application/json" } : {}),
            ...headers
        },
        body: body === undefined ? undefined : jsonBody ? JSON.stringify(body) : body
    });
    const payload = await response.json();

    return {
        status: response.status,
        body: payload
    };
}

try {
    process.chdir(tempRoot);
    process.env.ENABLE_AI = "true";

    const app = createApp({
        repositoryType: "file",
        dataDir,
        outputDir
    });
    let providerCalls = 0;
    app.locals.dependencies.qaCopilot.aiEngine.aiProvider = {
        async generate() {
            providerCalls += 1;
            return JSON.stringify({
                purpose: "Xác nhận requirement trước khi sinh core testcases.",
                functions: [
                    {
                        name: "Thêm thiết bị",
                        description: "Thêm thiết bị mới.",
                        businessRules: ["Mã thiết bị phải duy nhất."],
                        validationRules: ["Mã thiết bị không được để trống."],
                        permissions: [],
                        dependencies: [],
                        assumptions: [],
                        requirementReferences: ["Thêm thiết bị"]
                    }
                ],
                risks: [],
                clarificationQuestions: [],
                requirementComplete: true
            });
        }
    };

    server = await new Promise(resolve => {
        const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    });
    const baseUrl = `http://127.0.0.1:${server.address().port}`;

    const upload = await request(
        baseUrl,
        "POST",
        "/api/requirements/upload",
        fs.readFileSync(fixturePath),
        {
            "content-type": "text/markdown",
            "x-file-name": "web-ui-production-requirement.md"
        }
    );
    assert.equal(upload.status, 201);
    assert.equal(upload.body.success, true);
    assert.ok(upload.body.data.requirementId);
    assert.equal("requirementFile" in upload.body.data, false);

    const started = await request(baseUrl, "POST", "/api/workflows", {
        requirementId: upload.body.data.requirementId
    });
    assert.equal(started.status, 201);
    assert.equal(started.body.success, true);
    assert.equal(started.body.data.workflow.status, "AI_ANALYSIS_REVIEW_REQUIRED");
    assert.equal(started.body.data.workflow.step, "AI_ANALYSIS_REVIEW");
    assert.equal(providerCalls, 1);

    const workflowId = started.body.data.workflow.id;
    assert.ok(workflowId);

    const detail = await request(
        baseUrl,
        "GET",
        `/api/workflows/${encodeURIComponent(workflowId)}`
    );
    assert.equal(detail.status, 200);
    assert.equal(detail.body.data.workflow.id, workflowId);
    assert.equal(detail.body.data.workflow.status, "AI_ANALYSIS_REVIEW_REQUIRED");
    assert.equal(detail.body.data.workflow.step, "AI_ANALYSIS_REVIEW");

    const listing = await request(baseUrl, "GET", "/api/workflows?limit=20&offset=0");
    assert.equal(listing.status, 200);
    assert.ok(listing.body.data.items.some(item => item.id === workflowId));
    assert.equal(JSON.stringify(started.body).includes(tempRoot), false);

    console.log("New Workflow upload HTTP smoke test PASSED");
    console.log(`Workflow ID: ${workflowId}`);
    console.log(`Public status: ${detail.body.data.workflow.status}`);
    console.log(`Public step: ${detail.body.data.workflow.step}`);
} finally {
    if (server) {
        await new Promise((resolve, reject) =>
            server.close(error => (error ? reject(error) : resolve()))
        );
    }
    process.chdir(originalCwd);
    if (originalEnableAI === undefined) {
        delete process.env.ENABLE_AI;
    } else {
        process.env.ENABLE_AI = originalEnableAI;
    }
    fs.rmSync(tempRoot, { recursive: true, force: true });
}
