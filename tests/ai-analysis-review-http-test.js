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
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "qa-copilot-ai-review-http-"));

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
    return {
        status: response.status,
        body: await response.json()
    };
}

try {
    process.chdir(tempRoot);
    process.env.ENABLE_AI = "true";

    const app = createApp({
        repositoryType: "file",
        dataDir: path.join(tempRoot, "data"),
        outputDir: path.join(tempRoot, "outputs")
    });
    let providerCalls = 0;
    app.locals.dependencies.qaCopilot.aiEngine.aiProvider = {
        async generate() {
            providerCalls += 1;
            return JSON.stringify({
                purpose: "Phân tích requirement để tester xác nhận.",
                functions: [
                    {
                        name: "Thêm thiết bị",
                        description: "Thêm thiết bị mới.",
                        businessRules: ["Mã thiết bị phải duy nhất."],
                        validationRules: ["Mã thiết bị không được để trống."],
                        permissions: ["Người dùng phải có quyền thêm thiết bị."],
                        dependencies: [],
                        assumptions: [],
                        requirementReferences: ["Thêm thiết bị"]
                    }
                ],
                risks: ["Trùng mã thiết bị."],
                clarificationQuestions: [
                    {
                        id: "CL001",
                        category: "Business Rule",
                        priority: "High",
                        question: "Mã thiết bị có phân biệt chữ hoa và chữ thường không?",
                        reason: "Cần xác định cách kiểm tra trùng mã.",
                        options: ["Có", "Không", "Chưa xác định"]
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
        {
            "content-type": "text/markdown",
            "x-file-name": "ai-analysis-review.md"
        }
    );
    const started = await request(baseUrl, "POST", "/api/workflows", {
        requirementId: upload.body.data.requirementId
    });
    assert.equal(started.status, 201);
    assert.equal(providerCalls, 1);
    const workflowId = started.body.data.workflow.id;

    const review = await request(baseUrl, "GET", `/api/workflows/${workflowId}/ai-analysis-review`);
    assert.equal(review.status, 200);
    assert.equal(review.body.data.workflowId, workflowId);
    assert.equal(review.body.data.step, "AI_ANALYSIS_REVIEW");
    assert.equal(review.body.data.clarifications.length, 1);
    assert.equal(review.body.data.clarifications[0].id, "CL001");
    assert.equal(review.body.data.clarifications[0].required, true);
    assert.equal(review.body.data.clarifications[0].status, "UNANSWERED");
    assert.equal(review.body.data.summary.remaining, 1);
    assert.equal("artifact" in review.body.data, false);
    assert.equal("workflowContext" in review.body.data, false);
    assert.equal(JSON.stringify(review.body.data).includes(tempRoot), false);

    const artifactId = review.body.data.artifactId;
    const prematureApproval = await request(
        baseUrl,
        "POST",
        `/api/workflows/${workflowId}/approve`,
        {
            artifactId,
            approvedBy: "http-review-tester"
        }
    );
    assert.equal(prematureApproval.status, 409);

    const answer = await request(
        baseUrl,
        "POST",
        `/api/workflows/${workflowId}/clarifications/CL001`,
        {
            answer: "Không",
            answeredBy: "http-review-tester"
        }
    );
    assert.equal(answer.status, 200);

    const answeredReview = await request(
        baseUrl,
        "GET",
        `/api/workflows/${workflowId}/ai-analysis-review`
    );
    assert.equal(answeredReview.body.data.clarifications[0].answer, "Không");
    assert.equal(answeredReview.body.data.clarifications[0].status, "ANSWERED");
    assert.equal(answeredReview.body.data.summary.answered, 1);
    assert.equal(answeredReview.body.data.summary.remaining, 0);
    assert.ok(answeredReview.body.data.allowedActions.includes("APPROVE_AI_ANALYSIS"));

    const reviewedPurpose = "Mục đích đã được tester chỉnh sửa qua public review API.";
    const updated = await request(
        baseUrl,
        "PUT",
        `/api/workflows/${workflowId}/ai-analysis-review`,
        {
            artifactId,
            analysis: {
                purpose: reviewedPurpose
            }
        }
    );
    assert.equal(updated.status, 200);
    assert.equal(updated.body.data.analysis.purpose, reviewedPurpose);
    assert.equal(updated.body.data.clarifications[0].answer, "Không");
    assert.equal(JSON.stringify(updated.body.data).includes(tempRoot), false);

    const approval = await request(baseUrl, "POST", `/api/workflows/${workflowId}/approve`, {
        artifactId,
        approvedBy: "http-review-tester"
    });
    assert.equal(approval.status, 200);

    const approvedWorkflow = await request(baseUrl, "GET", `/api/workflows/${workflowId}`);
    assert.equal(approvedWorkflow.body.data.workflow.status, "AI_ANALYSIS_REVIEW_REQUIRED");
    assert.deepEqual(approvedWorkflow.body.data.workflow.allowedActions, ["RESUME_WORKFLOW"]);

    const approvedReview = await request(
        baseUrl,
        "GET",
        `/api/workflows/${workflowId}/ai-analysis-review`
    );
    assert.equal(approvedReview.body.data.approvalStatus, "approved");
    assert.equal(approvedReview.body.data.analysis.purpose, reviewedPurpose);

    const resumed = await request(baseUrl, "POST", `/api/workflows/${workflowId}/resume`);
    assert.equal(resumed.status, 200);
    assert.equal(resumed.body.data.workflow.status, "TEST_CASE_REVIEW_REQUIRED");
    assert.equal(resumed.body.data.workflow.step, "TEST_CASE_REVIEW");
    assert.equal(providerCalls, 1);

    console.log("AI Analysis Review HTTP test PASSED");
    console.log(`Workflow ID: ${workflowId}`);
    console.log(`Next workflow ID: ${resumed.body.data.workflow.id}`);
    console.log(`Next public step: ${resumed.body.data.workflow.step}`);
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
