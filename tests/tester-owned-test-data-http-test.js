import assert from "node:assert/strict";
import { startTestServer, getCurrentStageContext } from "./http-test-helpers.js";

const api = await startTestServer();

try {
    let result = (
        await api.request("POST", "/api/workflows", {
            requirementFile: "./requirements/thiet-bi.md"
        })
    ).body.data;

    const analysisReview = getCurrentStageContext(result);
    const approvedAnalysis = await api.request(
        "POST",
        `/api/workflows/${analysisReview.sessionId}/approve`,
        {
            artifactId: analysisReview.artifactId,
            approvedBy: "tester-data-test"
        }
    );
    assert.equal(approvedAnalysis.status, 200);

    result = (await api.request("POST", `/api/workflows/${analysisReview.sessionId}/resume`)).body
        .data;
    assert.equal(result.currentStage, "testCaseReview");

    const testCaseReview = getCurrentStageContext(result);
    const review = await api.request(
        "GET",
        `/api/workflows/${testCaseReview.sessionId}/current-review`
    );
    const artifact = review.body.data.artifact;
    const editableIndex = artifact.testCases.findIndex(
        testCase => testCase.executionReadiness === "DATA_REQUIRED"
    );
    assert.ok(editableIndex >= 0);

    const editedTestCases = artifact.testCases.map((testCase, index) =>
        index === editableIndex
            ? {
                  ...testCase,
                  testData: {
                      ...testCase.testData,
                      value: "TESTER-PROVIDED-VALUE"
                  }
              }
            : testCase
    );
    const edit = await api.request(
        "PUT",
        `/api/workflows/${testCaseReview.sessionId}/artifacts/${testCaseReview.artifactId}`,
        {
            artifact: {
                ...artifact,
                testCases: editedTestCases
            }
        }
    );

    assert.equal(edit.status, 200);
    assert.equal(edit.body.data.approvalStatus, "pending");
    assert.equal(edit.body.data.testCases[editableIndex].testData.value, "TESTER-PROVIDED-VALUE");
    assert.equal(edit.body.data.testCases[editableIndex].executionReadiness, "READY");
} finally {
    await api.close();
}

console.log("Tester-owned Test Data HTTP edit: PASS");
