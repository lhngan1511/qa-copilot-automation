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
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "qa-copilot-web-ui-http-"));
const dataDir = path.join(tempRoot, "data");
const outputDir = path.join(tempRoot, "outputs");

let server;

async function request(baseUrl, method, requestPath, body, headers = {}) {
    const hasJsonBody = body !== undefined && !Buffer.isBuffer(body);
    const response = await fetch(`${baseUrl}${requestPath}`, {
        method,
        headers: {
            ...(hasJsonBody ? { "content-type": "application/json" } : {}),
            ...headers
        },
        body: body === undefined ? undefined : Buffer.isBuffer(body) ? body : JSON.stringify(body)
    });
    const contentType = response.headers.get("content-type") ?? "";
    const responseBody = contentType.includes("application/json")
        ? await response.json()
        : Buffer.from(await response.arrayBuffer());

    return { status: response.status, body: responseBody };
}

function currentStage(applicationResult) {
    const stage = applicationResult.currentStage;
    return {
        stage,
        ...applicationResult.workflowContext[stage]
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
    const providerCalls = [];
    app.locals.dependencies.qaCopilot.aiEngine.aiProvider = {
        async generate(prompt) {
            providerCalls.push(prompt);
            return JSON.stringify({
                purpose: "Phân tích chức năng thêm thiết bị để tester xác nhận.",
                functions: [
                    {
                        name: "Thêm thiết bị",
                        description: "Thêm thiết bị mới.",
                        businessRules: ["Mã thiết bị phải duy nhất."],
                        validationRules: [
                            "Mã thiết bị không được để trống.",
                            "Tên thiết bị không được để trống."
                        ],
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
                        reason: "Requirement chưa mô tả quy tắc so sánh mã.",
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

    const health = await request(baseUrl, "GET", "/health");
    assert.equal(health.status, 200);
    assert.equal(health.body.success, true);

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
    assert.ok(upload.body.data.requirementId);
    assert.equal("requirementFile" in upload.body.data, false);
    assert.equal(JSON.stringify(upload.body.data).includes(dataDir), false);

    let result = await request(baseUrl, "POST", "/api/workflows", {
        requirementId: upload.body.data.requirementId
    });
    assert.equal(result.status, 201);
    assert.equal(result.body.success, true);
    result = result.body.data;
    assert.equal(result.status, "AWAITING_AI_CLARIFICATION");
    assert.equal(result.currentStage, "clarificationReview");
    assert.equal(result.workflow.status, "AI_ANALYSIS_REVIEW_REQUIRED");
    assert.equal(result.workflow.step, "AI_ANALYSIS_REVIEW");
    assert.ok(result.workflow.allowedActions.includes("ANSWER_CLARIFICATIONS"));
    assert.equal(JSON.stringify(result.workflow).includes(tempRoot), false);
    assert.equal(providerCalls.length, 1);

    const analysisStage = currentStage(result);
    assert.ok(analysisStage.sessionId);
    assert.ok(analysisStage.artifactId);

    const persistedAnalysis = await request(
        baseUrl,
        "GET",
        `/api/workflows/${analysisStage.sessionId}`
    );
    assert.equal(persistedAnalysis.status, 200);
    assert.equal(persistedAnalysis.body.data.workflow.status, "AI_ANALYSIS_REVIEW_REQUIRED");
    assert.equal(
        persistedAnalysis.body.data.deprecated.pipelineStatus,
        "AWAITING_AI_CLARIFICATION"
    );
    const workflowList = await request(baseUrl, "GET", "/api/workflows");
    assert.equal(workflowList.status, 200);
    assert.ok(workflowList.body.data.items.some(item => item.id === analysisStage.sessionId));

    const prematureResume = await request(
        baseUrl,
        "POST",
        `/api/workflows/${analysisStage.sessionId}/resume`
    );
    assert.equal(prematureResume.status, 409);
    assert.equal(prematureResume.body.success, false);
    assert.match(prematureResume.body.error.message, /approved|answered/i);
    assert.equal("stack" in prematureResume.body.error, false);

    const prematureApproval = await request(
        baseUrl,
        "POST",
        `/api/workflows/${analysisStage.sessionId}/approve`,
        {
            artifactId: analysisStage.artifactId,
            approvedBy: "contract-tester"
        }
    );
    assert.equal(prematureApproval.status, 409);
    assert.match(prematureApproval.body.error.message, /answered/i);

    const analysisReview = await request(
        baseUrl,
        "GET",
        `/api/workflows/${analysisStage.sessionId}/current-review`
    );
    assert.equal(analysisReview.status, 200);
    assert.equal(analysisReview.body.data.artifactId, analysisStage.artifactId);
    assert.equal(analysisReview.body.data.artifact.artifactType, "AI_ANALYSIS_REVIEW");
    assert.equal(analysisReview.body.data.artifact.questions.length, 1);
    const question = analysisReview.body.data.artifact.questions[0];

    const answer = await request(
        baseUrl,
        "POST",
        `/api/workflows/${analysisStage.sessionId}/clarifications/${question.questionId}`,
        {
            answer: "Không",
            answeredBy: "contract-tester"
        }
    );
    assert.equal(answer.status, 200);
    assert.equal(answer.body.data.clarificationStatus.isFullyAnswered, true);

    const reviewedPurpose = "Mục đích đã được tester xác nhận qua HTTP.";
    const editedAnalysis = await request(
        baseUrl,
        "PUT",
        `/api/workflows/${analysisStage.sessionId}/artifacts/${analysisStage.artifactId}`,
        {
            artifact: {
                ...analysisReview.body.data.artifact,
                aiAnalysis: {
                    ...analysisReview.body.data.artifact.aiAnalysis,
                    purpose: reviewedPurpose
                },
                purpose: reviewedPurpose,
                questions: answer.body.data.clarificationStatus.questions
            }
        }
    );
    assert.equal(editedAnalysis.status, 200);
    assert.equal(editedAnalysis.body.data.approvalStatus, "pending");
    assert.equal(editedAnalysis.body.data.aiAnalysis.purpose, reviewedPurpose);

    const approvedAnalysis = await request(
        baseUrl,
        "POST",
        `/api/workflows/${analysisStage.sessionId}/approve`,
        {
            artifactId: analysisStage.artifactId,
            approvedBy: "contract-tester"
        }
    );
    assert.equal(approvedAnalysis.status, 200);
    assert.equal(approvedAnalysis.body.data.action, "STAGE_APPROVED");
    const approvedAnalysisArtifacts = await request(
        baseUrl,
        "GET",
        `/api/workflows/${analysisStage.sessionId}/artifacts`
    );
    assert.equal(
        approvedAnalysisArtifacts.body.data.find(
            artifact => artifact.artifactId === analysisStage.artifactId
        ).approvalStatus,
        "approved"
    );

    const generated = await request(
        baseUrl,
        "POST",
        `/api/workflows/${analysisStage.sessionId}/resume`
    );
    assert.equal(generated.status, 200);
    result = generated.body.data;
    assert.equal(result.status, "AWAITING_TEST_CASE_REVIEW");
    assert.equal(result.currentStage, "testCaseReview");
    assert.equal(result.workflow.status, "TEST_CASE_REVIEW_REQUIRED");
    assert.equal(result.workflow.step, "TEST_CASE_REVIEW");
    assert.deepEqual(result.workflow.allowedActions, ["UPDATE_TEST_CASES", "APPROVE_TEST_CASES"]);
    assert.ok(result.data.testCases.length > 0);
    assert.ok(result.data.testCases.every(testCase => testCase.testData?.fields));
    assert.ok(
        result.data.testCases.every(
            testCase =>
                typeof testCase.expectedResult === "string" && testCase.expectedResult.trim()
        )
    );
    assert.ok(result.data.testCases.some(testCase => testCase.type === "POSITIVE"));
    assert.ok(
        result.data.testCases.some(testCase =>
            ["VALIDATION", "DATA_INTEGRITY"].includes(testCase.type)
        )
    );
    assert.equal(
        result.data.testCases.some(testCase => testCase.type === "BOUNDARY"),
        false
    );

    const testerStage = currentStage(result);
    const outputsBeforeApproval = await request(
        baseUrl,
        "GET",
        `/api/workflows/${testerStage.sessionId}/outputs`
    );
    assert.equal(outputsBeforeApproval.status, 200);
    assert.deepEqual(outputsBeforeApproval.body.data.outputs, {});

    const prematureExportResume = await request(
        baseUrl,
        "POST",
        `/api/workflows/${testerStage.sessionId}/resume`
    );
    assert.equal(prematureExportResume.status, 409);
    assert.match(prematureExportResume.body.error.message, /approved/i);

    const testerReview = await request(
        baseUrl,
        "GET",
        `/api/workflows/${testerStage.sessionId}/current-review`
    );
    const testerArtifact = testerReview.body.data.artifact;
    const approvedTitle = "TESTER APPROVED - " + testerArtifact.testCases[0].title;
    const editedTestCases = testerArtifact.testCases.map((testCase, index) => ({
        ...testCase,
        title: index === 0 ? approvedTitle : testCase.title,
        reviewStatus: "APPROVED"
    }));
    const editedTestcaseArtifact = await request(
        baseUrl,
        "PUT",
        `/api/workflows/${testerStage.sessionId}/artifacts/${testerStage.artifactId}`,
        {
            artifact: {
                ...testerArtifact,
                testCases: editedTestCases
            }
        }
    );
    assert.equal(editedTestcaseArtifact.status, 200);
    assert.equal(editedTestcaseArtifact.body.data.approvalStatus, "pending");

    const approvedTestcases = await request(
        baseUrl,
        "POST",
        `/api/workflows/${testerStage.sessionId}/approve`,
        {
            artifactId: testerStage.artifactId,
            approvedBy: "contract-tester"
        }
    );
    assert.equal(approvedTestcases.status, 200);
    assert.equal(approvedTestcases.body.data.action, "STAGE_APPROVED");
    const approvedTesterArtifacts = await request(
        baseUrl,
        "GET",
        `/api/workflows/${testerStage.sessionId}/artifacts`
    );
    assert.equal(
        approvedTesterArtifacts.body.data.find(
            artifact => artifact.artifactId === testerStage.artifactId
        ).approvalStatus,
        "approved"
    );

    const completed = await request(
        baseUrl,
        "POST",
        `/api/workflows/${testerStage.sessionId}/resume`
    );
    assert.equal(completed.status, 200);
    result = completed.body.data;
    assert.equal(result.status, "COMPLETED");
    assert.deepEqual(Object.keys(result.data.outputs).sort(), ["excel", "json", "markdown"]);
    assert.equal(result.workflow.status, "COMPLETED");
    assert.equal(result.workflow.step, "EXPORT");
    assert.deepEqual(result.workflow.allowedActions.sort(), [
        "DOWNLOAD_EXCEL",
        "DOWNLOAD_JSON",
        "DOWNLOAD_MARKDOWN"
    ]);

    assert.equal(JSON.stringify(result).includes(tempRoot), false);
    assert.equal(
        result.data.outputs.json,
        `/api/workflows/${testerStage.sessionId}/outputs/json/download`
    );
    assert.equal(
        result.data.outputs.excel,
        `/api/workflows/${testerStage.sessionId}/outputs/excel/download`
    );

    const jsonPath = path.join(
        outputDir,
        "production",
        "json",
        "quan-ly-thiet-bi-approved-testcases.json"
    );
    const excelPath = path.join(
        outputDir,
        "production",
        "excel",
        "quan-ly-thiet-bi-approved-testcases.xlsx"
    );
    assert.ok(jsonPath.startsWith(outputDir));
    assert.ok(excelPath.startsWith(outputDir));
    assert.ok(fs.statSync(jsonPath).size > 0);
    assert.ok(fs.statSync(excelPath).size > 0);

    const approvedJson = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
    assert.equal(approvedJson.length, editedTestCases.length);
    assert.equal(approvedJson[0].title, approvedTitle);
    assert.ok(
        approvedJson.every(
            testCase =>
                testCase.testData &&
                typeof testCase.testData.requirement === "string" &&
                typeof testCase.testData.value === "string" &&
                ["READY", "DATA_REQUIRED"].includes(testCase.executionReadiness)
        )
    );
    assert.equal(
        approvedJson.some(testCase =>
            JSON.stringify(testCase).includes(
                "Phân tích chức năng thêm thiết bị để tester xác nhận."
            )
        ),
        false
    );

    const jsonDownload = await request(
        baseUrl,
        "GET",
        `/api/workflows/${testerStage.sessionId}/outputs/json/download`
    );
    assert.equal(jsonDownload.status, 200);
    assert.ok(jsonDownload.body.length > 0);

    const excelDownload = await request(
        baseUrl,
        "GET",
        `/api/workflows/${testerStage.sessionId}/outputs/excel/download`
    );
    assert.equal(excelDownload.status, 200);
    assert.ok(excelDownload.body.length > 0);

    const reloaded = await request(baseUrl, "GET", `/api/workflows/${testerStage.sessionId}`);
    assert.equal(reloaded.status, 200);
    assert.equal(reloaded.body.data.workflow.status, "COMPLETED");
    assert.equal(reloaded.body.data.deprecated.pipelineStatus, "COMPLETED");
    assert.equal(JSON.stringify(reloaded.body.data).includes(tempRoot), false);
    assert.equal(
        reloaded.body.data.deprecated.workflowContext.testCaseReview.artifactId,
        testerStage.artifactId
    );

    const reloadedArtifacts = await request(
        baseUrl,
        "GET",
        `/api/workflows/${testerStage.sessionId}/artifacts`
    );
    const finalArtifact = reloadedArtifacts.body.data.find(
        artifact => artifact.artifactId === testerStage.artifactId
    );
    assert.equal(finalArtifact.approvalStatus, "approved");
    assert.equal(finalArtifact.testCases[0].title, approvedTitle);
    assert.deepEqual(finalArtifact.outputs, result.data.outputs);
    assert.equal(JSON.stringify(finalArtifact).includes(tempRoot), false);

    console.log("Web UI production HTTP contract test PASSED");
    console.log(`Approved testcases: ${approvedJson.length}`);
    console.log(`JSON bytes: ${fs.statSync(jsonPath).size}`);
    console.log(`Excel bytes: ${fs.statSync(excelPath).size}`);
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
