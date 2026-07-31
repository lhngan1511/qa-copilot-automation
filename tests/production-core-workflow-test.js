import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import QACopilot from "../src/QACopilot.js";

process.env.ENABLE_AI = "false";

const originalLog = console.log;
console.log = () => {};

try {
    const app = new QACopilot();
    const outputRoot = path.join(os.tmpdir(), `qa-copilot-production-workflow-${Date.now()}`);
    const requirementFile = "./requirements/thiet-bi.md";

    let result = await app.run(requirementFile, {
        productionWorkflow: true,
        outputRoot
    });

    assert.equal(result.reviewStage, "AI_ANALYSIS_REVIEW");
    const analysisStage = result.workflowContext.clarificationReview;
    const analysisArtifact = app.workflowCoordinator.findArtifact(analysisStage.artifactId);
    assert.equal(analysisArtifact.artifactType, "AI_ANALYSIS_REVIEW");
    assert.equal(typeof analysisArtifact.aiAnalysis.purpose, "string");
    assert.ok(Array.isArray(analysisArtifact.aiAnalysis.functions));
    assert.ok(Array.isArray(analysisArtifact.aiAnalysis.risks));
    assert.ok(Array.isArray(analysisArtifact.aiAnalysis.clarificationQuestions));
    assert.equal(Object.hasOwn(analysisArtifact, "detectedFunctions"), false);
    assert.equal(Object.hasOwn(analysisArtifact.aiAnalysis, "suggestedScenarios"), false);

    app.reviewClarification({ sessionId: analysisStage.sessionId });
    app.approveClarification({
        sessionId: analysisStage.sessionId,
        artifactId: analysisStage.artifactId,
        approvedBy: "test-user"
    });

    result = await app.run(requirementFile, {
        productionWorkflow: true,
        workflowContext: result.workflowContext,
        outputRoot
    });

    assert.equal(result.reviewStage, "TEST_CASE_REVIEW");
    assert.ok(result.testCases.length > 0);
    assert.deepEqual(result.workflowContext.requirementReview, {
        sessionId: "",
        artifactId: ""
    });
    assert.deepEqual(result.workflowContext.moduleReview, {
        sessionId: "",
        artifactId: ""
    });
    assert.deepEqual(result.workflowContext.scenarioReview, {
        sessionId: "",
        artifactId: ""
    });
    assert.ok(
        result.scenarios.every(scenario =>
            [
                "POSITIVE",
                "VALIDATION",
                "NEGATIVE",
                "BUSINESS_RULE",
                "DATA_INTEGRITY",
                "PERMISSION",
                "BOUNDARY"
            ].includes(scenario.type)
        )
    );

    const testerStage = result.workflowContext.testCaseReview;
    const testCaseArtifact = app.workflowCoordinator.findArtifact(testerStage.artifactId);
    testCaseArtifact.testCases = testCaseArtifact.testCases.map(testCase => ({
        ...testCase,
        reviewStatus: "APPROVED"
    }));
    app.workflowCoordinator.saveArtifact(testCaseArtifact);
    app.reviewTestCase({ sessionId: testerStage.sessionId });
    app.approveTestCase({
        sessionId: testerStage.sessionId,
        artifactId: testerStage.artifactId,
        approvedBy: "test-user"
    });

    result = await app.run(requirementFile, {
        productionWorkflow: true,
        workflowContext: result.workflowContext,
        outputRoot
    });

    assert.equal(result.status, "COMPLETED");
    assert.deepEqual(Object.keys(result.outputs).sort(), ["excel", "json", "markdown"]);
    assert.equal(path.basename(result.outputs.json), "thiet-bi-approved-testcases.json");
    assert.equal(path.basename(result.outputs.markdown), "thiet-bi-testcases.md");
    assert.equal(path.basename(result.outputs.excel), "thiet-bi-approved-testcases.xlsx");
    assert.ok(result.testCases.every(testCase => testCase.steps.length > 0));

    originalLog("Production core workflow test: PASS");
} finally {
    console.log = originalLog;
}
