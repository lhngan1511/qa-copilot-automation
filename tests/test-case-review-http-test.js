import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";
import createApp from "../src/server/createApp.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.join(testDirectory, "fixtures", "web-ui-production-requirement.md");
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "qa-copilot-testcase-review-"));
const originalCwd = process.cwd();
const originalEnableAI = process.env.ENABLE_AI;
let server;

async function request(baseUrl, method, requestPath, body, headers = {}) {
    const json = body !== undefined && !Buffer.isBuffer(body);
    const response = await fetch(`${baseUrl}${requestPath}`, {
        method,
        headers: { ...(json ? { "content-type": "application/json" } : {}), ...headers },
        body: body === undefined ? undefined : json ? JSON.stringify(body) : body
    });
    const contentType = response.headers.get("content-type") ?? "";
    return {
        status: response.status,
        body: contentType.includes("application/json")
            ? await response.json()
            : Buffer.from(await response.arrayBuffer())
    };
}

try {
    process.chdir(tempRoot);
    process.env.ENABLE_AI = "true";
    const outputDir = path.join(tempRoot, "outputs");
    const app = createApp({
        repositoryType: "file",
        dataDir: path.join(tempRoot, "data"),
        outputDir
    });
    let providerCalls = 0;
    app.locals.dependencies.qaCopilot.aiEngine.aiProvider = {
        async generate() {
            providerCalls += 1;
            return JSON.stringify({
                purpose: "Phân tích requirement phục vụ TestCase Review.",
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
        { "content-type": "text/markdown", "x-file-name": "test-case-review.md" }
    );
    const started = await request(baseUrl, "POST", "/api/workflows", {
        requirementId: upload.body.data.requirementId
    });
    const analysisWorkflowId = started.body.data.workflow.id;
    const analysis = await request(
        baseUrl,
        "GET",
        `/api/workflows/${analysisWorkflowId}/ai-analysis-review`
    );
    await request(baseUrl, "POST", `/api/workflows/${analysisWorkflowId}/approve`, {
        artifactId: analysis.body.data.artifactId,
        approvedBy: "testcase-review-tester"
    });
    const generated = await request(baseUrl, "POST", `/api/workflows/${analysisWorkflowId}/resume`);
    assert.equal(generated.status, 200);
    assert.equal(generated.body.data.workflow.step, "TEST_CASE_REVIEW");
    const workflowId = generated.body.data.workflow.id;

    const review = await request(baseUrl, "GET", `/api/workflows/${workflowId}/test-case-review`);
    assert.equal(review.status, 200);
    assert.equal(review.body.data.step, "TEST_CASE_REVIEW");
    assert.ok(review.body.data.testCases.length > 1);
    assert.equal(review.body.data.summary.total, review.body.data.testCases.length);
    assert.equal(
        review.body.data.summary.ready + review.body.data.summary.requiresTesterInput,
        review.body.data.summary.total
    );
    assert.equal(JSON.stringify(review.body.data).includes(tempRoot), false);
    assert.equal("artifact" in review.body.data, false);
    assert.equal("workflowContext" in review.body.data, false);

    const blocked = await request(baseUrl, "POST", `/api/workflows/${workflowId}/resume`);
    assert.equal(blocked.status, 409);

    const unsupportedAdd = await request(
        baseUrl,
        "PUT",
        `/api/workflows/${workflowId}/test-case-review`,
        {
            artifactId: review.body.data.artifactId,
            testCases: [...review.body.data.testCases, { id: "UI-LOCAL", title: "Added" }]
        }
    );
    assert.equal(unsupportedAdd.status, 422);

    const initialCases = review.body.data.testCases;
    assert.ok(initialCases.every(testCase => testCase.reviewStatus === "PENDING"));
    assert.ok(initialCases.every(testCase => testCase.steps.length > 0));

    const incomplete = await request(
        baseUrl,
        "PUT",
        `/api/workflows/${workflowId}/test-case-review`,
        {
            artifactId: review.body.data.artifactId,
            testCases: initialCases.slice(1)
        }
    );
    assert.equal(incomplete.status, 422);
    assert.equal(incomplete.body.error.code, "INCOMPLETE_TEST_CASE_BATCH");

    const invalidSteps = await request(
        baseUrl,
        "PUT",
        `/api/workflows/${workflowId}/test-case-review`,
        {
            artifactId: review.body.data.artifactId,
            testCases: initialCases.map((testCase, index) =>
                index === 0 ? { ...testCase, steps: [] } : testCase
            )
        }
    );
    assert.equal(invalidSteps.status, 422);
    assert.equal(invalidSteps.body.error.code, "INVALID_TEST_STEPS");

    const editedTitle = `TESTER EDIT - ${initialCases[0].title}`;
    const decisions = initialCases.map((testCase, index) => ({
        ...testCase,
        title: index === 0 ? editedTitle : testCase.title,
        testData:
            index === 0 ? { ...testCase.testData, value: "TESTER-VALUE-001" } : testCase.testData,
        reviewStatus: index === 0 ? "APPROVED" : index === 1 ? "NEEDS_CHANGES" : "REMOVED"
    }));
    const updated = await request(baseUrl, "PUT", `/api/workflows/${workflowId}/test-case-review`, {
        artifactId: review.body.data.artifactId,
        testCases: decisions
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.data.testCases.length, initialCases.length);
    assert.equal(updated.body.data.summary.approved, 1);
    assert.equal(updated.body.data.summary.needsChanges, 1);
    assert.equal(updated.body.data.summary.removed, initialCases.length - 2);
    assert.equal(updated.body.data.testCases[0].title, editedTitle);

    const reloaded = await request(baseUrl, "GET", `/api/workflows/${workflowId}/test-case-review`);
    assert.deepEqual(
        reloaded.body.data.testCases.map(testCase => testCase.reviewStatus),
        decisions.map(testCase => testCase.reviewStatus)
    );

    const blockedApproval = await request(baseUrl, "POST", `/api/workflows/${workflowId}/approve`, {
        artifactId: review.body.data.artifactId,
        approvedBy: "testcase-review-tester"
    });
    assert.equal(blockedApproval.status, 422);
    assert.equal(blockedApproval.body.error.code, "TEST_CASE_REVIEW_UNRESOLVED");

    const resolvedBatch = decisions.map(testCase =>
        testCase.reviewStatus === "REMOVED" ? testCase : { ...testCase, reviewStatus: "APPROVED" }
    );
    const bulkApproved = await request(
        baseUrl,
        "PUT",
        `/api/workflows/${workflowId}/test-case-review`,
        { artifactId: review.body.data.artifactId, testCases: resolvedBatch }
    );
    assert.equal(bulkApproved.status, 200);
    assert.equal(bulkApproved.body.data.summary.approved, 2);

    const approved = await request(baseUrl, "POST", `/api/workflows/${workflowId}/approve`, {
        artifactId: review.body.data.artifactId,
        approvedBy: "testcase-review-tester"
    });
    assert.equal(approved.status, 200);

    const completed = await request(baseUrl, "POST", `/api/workflows/${workflowId}/resume`);
    assert.equal(completed.status, 200);
    assert.equal(completed.body.data.workflow.status, "COMPLETED");
    assert.deepEqual(completed.body.data.workflow.allowedActions.sort(), [
        "DOWNLOAD_EXCEL",
        "DOWNLOAD_JSON",
        "DOWNLOAD_MARKDOWN"
    ]);

    const jsonDownload = await request(
        baseUrl,
        "GET",
        `/api/workflows/${workflowId}/outputs/json/download`
    );
    const markdownDownload = await request(
        baseUrl,
        "GET",
        `/api/workflows/${workflowId}/outputs/markdown/download`
    );
    const excelDownload = await request(
        baseUrl,
        "GET",
        `/api/workflows/${workflowId}/outputs/excel/download`
    );
    assert.equal(jsonDownload.status, 200);
    assert.equal(markdownDownload.status, 200);
    assert.equal(excelDownload.status, 200);
    const approvedJson = Array.isArray(jsonDownload.body)
        ? jsonDownload.body
        : JSON.parse(jsonDownload.body.toString("utf8"));
    assert.equal(approvedJson.length, 2);
    assert.ok(approvedJson.every(testCase => testCase.reviewStatus === "APPROVED"));
    assert.ok(approvedJson.every(testCase => testCase.steps.length > 0));
    assert.equal(
        approvedJson.some(testCase => testCase.reviewStatus === "REMOVED"),
        false
    );
    const removedIds = resolvedBatch
        .filter(testCase => testCase.reviewStatus === "REMOVED")
        .map(testCase => testCase.testcaseId ?? testCase.id);
    const markdown = markdownDownload.body.toString("utf8");
    const workbook = XLSX.read(excelDownload.body, { type: "buffer" });
    const excelRows = XLSX.utils.sheet_to_json(workbook.Sheets["Test Cases"], { range: 6 });
    removedIds.forEach(id => {
        assert.equal(approvedJson.some(testCase => testCase.id === id), false);
        assert.equal(markdown.includes(id), false);
        assert.equal(excelRows.some(row => row["Test Case ID"] === id), false);
    });
    assert.ok(markdown.includes("Các bước kiểm thử"));
    assert.equal(providerCalls, 1);

    console.log("TestCase Review HTTP test PASSED");
    console.log(`Approved testcases: ${approvedJson.length}`);
    console.log("Add testcase: NOT SUPPORTED");
    console.log("Remove testcase: SUPPORTED");
    console.log(`JSON records: ${approvedJson.length}`);
    console.log(`Excel bytes: ${excelDownload.body.length}`);
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
