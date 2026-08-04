import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import createApp from "../src/server/createApp.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.join(testDirectory, "fixtures", "web-ui-production-requirement.md");
const confirmedFact = "Thiết bị đã ngừng sử dụng không được phép tạo phiếu điều chuyển";
const originalCwd = process.cwd();
const originalEnableAI = process.env.ENABLE_AI;
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "qa-copilot-production-clarification-"));
let server;

async function request(baseUrl, method, requestPath, body, headers = {}) {
    const jsonBody = body !== undefined && !Buffer.isBuffer(body);
    const response = await fetch(`${baseUrl}${requestPath}`, {
        method,
        headers: { ...(jsonBody ? { "content-type": "application/json" } : {}), ...headers },
        body: body === undefined ? undefined : jsonBody ? JSON.stringify(body) : body
    });
    return { status: response.status, body: await response.json() };
}

try {
    process.chdir(tempRoot);
    process.env.ENABLE_AI = "true";

    const app = createApp({
        repositoryType: "file",
        dataDir: path.join(tempRoot, "data"),
        outputDir: path.join(tempRoot, "outputs")
    });
    app.locals.dependencies.qaCopilot.aiEngine.aiProvider = {
        async generate() {
            return JSON.stringify({
                purpose: "Quản lý điều chuyển thiết bị.",
                functions: [
                    {
                        name: "Thêm thiết bị",
                        description: "Cho phép người dùng thêm một thiết bị mới.",
                        businessRules: [],
                        validationRules: [],
                        permissions: [],
                        dependencies: [],
                        assumptions: [],
                        requirementReferences: ["Thêm thiết bị"]
                    }
                ],
                risks: [],
                clarificationQuestions: [
                    {
                        id: "CL-CONFIRMED-FACT-001",
                        category: "Assumption",
                        priority: "High",
                        question: "Thiết bị ngừng sử dụng có được điều chuyển không?",
                        type: "TEXT",
                        reason: "Cần quy tắc tester xác nhận.",
                        options: [],
                        allowNotSpecified: false
                    }
                ],
                requirementComplete: false
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
        { "content-type": "text/markdown", "x-file-name": "production-clarification.md" }
    );
    assert.equal(upload.status, 201);

    const started = await request(baseUrl, "POST", "/api/workflows", {
        requirementId: upload.body.data.requirementId
    });
    assert.equal(started.status, 201);
    const workflowId = started.body.data.workflow.id;

    const beforeAnswer = await request(baseUrl, "GET", `/api/workflows/${workflowId}/current-review`);
    assert.equal(beforeAnswer.status, 200);
    const artifactId = beforeAnswer.body.data.artifact.artifactId;
    const questionId = beforeAnswer.body.data.artifact.questions[0].questionId;
    assert.equal(questionId, "CL001");
    const answered = await request(
        baseUrl,
        "POST",
        `/api/workflows/${workflowId}/clarifications/${questionId}`,
        { answer: confirmedFact, answeredBy: "diagnostic-tester" }
    );
    assert.equal(answered.status, 200);

    const approved = await request(baseUrl, "POST", `/api/workflows/${workflowId}/approve`, {
        artifactId,
        approvedBy: "diagnostic-tester"
    });
    assert.equal(approved.status, 200, JSON.stringify(approved.body));

    const resumed = await request(baseUrl, "POST", `/api/workflows/${workflowId}/resume`);
    assert.equal(resumed.status, 200, JSON.stringify(resumed.body));
    assert.equal(resumed.body.data.currentStage, "testCaseReview");

    const testCaseReview =
        resumed.body.data.workflowContext?.testCaseReview ??
        resumed.body.data.data?.workflowContext?.testCaseReview;
    assert.ok(testCaseReview?.sessionId, "resume response must retain Test Case Review session");
    const artifacts = await request(
        baseUrl,
        "GET",
        `/api/workflows/${testCaseReview.sessionId}/artifacts`
    );
    assert.equal(artifacts.status, 200);
    const testCaseArtifact = artifacts.body.data.find(
        artifact => artifact.artifactType === "TEST_CASE_REVIEW"
    );
    const clarificationTestCase = testCaseArtifact?.testCases?.find(testCase =>
        (testCase.expectedResults ?? []).includes(confirmedFact)
    );
    assert.ok(
        clarificationTestCase,
        "Approved clarification fact must appear in the final Test Case Review artifact."
    );
    assert.deepEqual(clarificationTestCase.sourceReferences, [
        { sourceType: "CLARIFICATION", sourceId: "CL001" }
    ]);
} finally {
    if (server) {
        await new Promise((resolve, reject) =>
            server.close(error => (error ? reject(error) : resolve()))
        );
    }
    process.chdir(originalCwd);
    if (originalEnableAI === undefined) delete process.env.ENABLE_AI;
    else process.env.ENABLE_AI = originalEnableAI;
    fs.rmSync(tempRoot, { recursive: true, force: true });
}
