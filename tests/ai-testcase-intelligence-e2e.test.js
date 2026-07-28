import "dotenv/config";
import assert from "node:assert/strict";

process.env.AI_PROVIDER = "gemini";
process.env.AI_FALLBACK_ENABLED = "false";
process.env.ENABLE_AI = "true";

const [{ app, scenarioResult }, { default: ApprovedScenarioMapper }] =
    await Promise.all([
        import("./approved-module-source-of-truth-test.js"),
        import("../src/mappers/ApprovedScenarioMapper.js")
    ]);
const [
    { default: TestCaseIntelligenceInputMapper },
    { default: TestCaseGenerator },
    { default: AITestCaseIntelligenceEngine },
    { default: TestCaseQualityPolicy },
    { default: TestCaseIntelligenceMerger }
] = await Promise.all([
    import("../src/mappers/TestCaseIntelligenceInputMapper.js"),
    import("../src/generators/TestCaseGenerator.js"),
    import("../src/engines/AITestCaseIntelligenceEngine.js"),
    import("../src/intelligence/TestCaseQualityPolicy.js"),
    import("../src/intelligence/TestCaseIntelligenceMerger.js")
]);

process.env.ENABLE_AI = "true";

app.reviewScenario({
    sessionId: scenarioResult.scenarioReview.sessionId,
    feedback: "Gemini TestCase E2E prerequisite"
});
app.approveScenario({
    sessionId: scenarioResult.scenarioReview.sessionId,
    artifactId: scenarioResult.scenarioReview.artifactId
});

const scenarioArtifact = app.workflowCoordinator.findArtifact(
    scenarioResult.scenarioReview.artifactId
);
const approvedScenarios = new ApprovedScenarioMapper().map(scenarioArtifact);
const ruleTestCases = new TestCaseGenerator().generate(approvedScenarios);
const input = new TestCaseIntelligenceInputMapper().map({
    scenarios: approvedScenarios,
    moduleArtifact: app.workflowCoordinator.findArtifact(
        scenarioResult.workflowContext.moduleReview.artifactId
    ),
    executionContext: scenarioResult.workflowContext
});
const aiResult = await new AITestCaseIntelligenceEngine().analyze(input);
assert.equal(aiResult.status, "SUCCESS", aiResult.errors.join("; "));
assert.equal(aiResult.source, "gemini");

const policy = new TestCaseQualityPolicy();
const merged = new TestCaseIntelligenceMerger(policy).merge(ruleTestCases, aiResult.testCases, {
    scenarios: approvedScenarios
});

assert.ok(merged.testCases.every(testCase => testCase.scenarioId));
assert.ok(merged.testCases.every(testCase => !testCase.actualResult));
assert.ok(merged.testCases.every(testCase => !["PASS", "FAIL"].includes(testCase.status)));

console.log(
    JSON.stringify(
        {
            approvedScenarioCount: approvedScenarios.length,
            ruleTestCaseCount: ruleTestCases.length,
            aiTestCaseCount: aiResult.testCases.length,
            ...merged.summary,
            source: aiResult.source,
            qualityObservations: aiResult.notes
        },
        null,
        2
    )
);
console.log("AI TestCase Intelligence Gemini E2E PASSED");
