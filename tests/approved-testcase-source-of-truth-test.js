import assert from "node:assert/strict";
import ApprovedTestCaseMapper from "../src/mappers/ApprovedTestCaseMapper.js";
import { app, testCaseResult } from "./approved-scenario-source-of-truth-test.js";

const mapper = new ApprovedTestCaseMapper();
assert.throws(
    () =>
        mapper.map({
            artifactType: "TEST_CASE_REVIEW",
            approvalStatus: "pending",
            testCases: []
        }),
    /approved/
);
assert.throws(
    () =>
        mapper.map({
            artifactType: "TEST_CASE_REVIEW",
            approvalStatus: "rejected",
            testCases: []
        }),
    /approved/
);

const artifact = app.workflowCoordinator.findArtifact(testCaseResult.testCaseReview.artifactId);
const deletedTestCaseId = artifact.testCases[1].id;
artifact.testCases = artifact.testCases.filter(testCase => testCase.id !== deletedTestCaseId);
artifact.testCases[0] = {
    ...artifact.testCases[0],
    title: "TestCase đã chỉnh sửa khi review",
    objective: "Xác nhận nội dung Approved TestCase được export",
    automationNotes: "Approved TestCase export marker"
};

app.workflowCoordinator.saveArtifact(artifact);
app.reviewTestCase({
    sessionId: testCaseResult.testCaseReview.sessionId,
    feedback: "Approved for export"
});
app.approveTestCase({
    sessionId: testCaseResult.testCaseReview.sessionId,
    artifactId: testCaseResult.testCaseReview.artifactId
});

let aiCalls = 0;
app.aiTestCaseIntelligenceEngine.analyze = async () => {
    aiCalls += 1;
    throw new Error("AI must not run during approved TestCase export.");
};

export const exportResult = await app.run("./requirements/thiet-bi.md", {
    workflowContext: testCaseResult.workflowContext
});
export { app };

assert.equal(aiCalls, 0);
assert.equal(exportResult.status, "COMPLETED");
assert.equal(Object.keys(exportResult.outputs).length, 4);
assert.ok(
    exportResult.testCases.some(testCase => testCase.title === "TestCase đã chỉnh sửa khi review")
);
assert.equal(
    exportResult.testCases.some(testCase => testCase.id === deletedTestCaseId),
    false
);
assert.ok(exportResult.testCases.every(testCase => testCase.testcaseId));

console.log("Approved TestCase source-of-truth test PASSED");
