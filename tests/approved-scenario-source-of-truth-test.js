import assert from "node:assert/strict";
import { app, scenarioResult } from "./approved-module-source-of-truth-test.js";
export { app };
const artifact = app.workflowCoordinator.findArtifact(scenarioResult.scenarioReview.artifactId);
const deletedId = artifact.scenarios[1].id;
artifact.scenarios = artifact.scenarios.filter(x => x.id !== deletedId);
artifact.scenarios[0].title = "Scenario đã chỉnh";
artifact.scenarios[0].expectedResult = "Kết quả đã duyệt";
artifact.scenarios[0].expectedResults = ["Kết quả đã duyệt"];
artifact.scenarios.push({
    ...artifact.scenarios[0],
    id: "SC-USER",
    title: "Scenario người dùng thêm",
    expectedResult: "Kết quả người dùng thêm",
    expectedResults: ["Kết quả người dùng thêm"]
});
const br18Scenario = artifact.scenarios.find(x => x.requirementReferences?.includes("BR18"));
if (br18Scenario && !br18Scenario.requirementReferences.includes("CL001"))
    br18Scenario.requirementReferences.push("CL001");
app.workflowCoordinator.saveArtifact(artifact);
app.reviewScenario({ sessionId: scenarioResult.scenarioReview.sessionId, feedback: "Approved" });
app.approveScenario({
    sessionId: scenarioResult.scenarioReview.sessionId,
    artifactId: scenarioResult.scenarioReview.artifactId
});
app.aiTestCaseIntelligenceEngine.analyze = async () => ({
    status: "FAILED",
    errors: ["offline"],
    testCases: []
});
export const testCaseResult = await app.run("./requirements/thiet-bi.md", {
    workflowContext: scenarioResult.workflowContext
});
assert.equal(testCaseResult.status, "AWAITING_TEST_CASE_REVIEW");
assert.deepEqual(testCaseResult.outputs, {});
assert.ok(testCaseResult.testCases.some(x => x.scenarioId === "SC-USER"));
assert.equal(
    testCaseResult.testCases.some(x => x.scenarioId === deletedId),
    false
);
assert.ok(
    testCaseResult.testCases.some(
        x => x.title === "Scenario đã chỉnh" && x.expectedResult === "Kết quả đã duyệt"
    )
);
assert.ok(testCaseResult.testCases.every(x => x.moduleId && x.functionId && x.scenarioId));
assert.ok(
    testCaseResult.testCases.some(
        x => x.requirementReferences?.includes("BR18") && x.requirementReferences.includes("CL001")
    )
);
const tcArtifact = app.workflowCoordinator.findArtifact(testCaseResult.testCaseReview.artifactId);
assert.equal(tcArtifact.approvalStatus, "pending");
assert.equal(tcArtifact.qualitySummary.finalCount, testCaseResult.testCases.length);
console.log("Approved scenario source-of-truth test PASSED");
