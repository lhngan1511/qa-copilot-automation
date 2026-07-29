import assert from "node:assert/strict";
import QACopilot from "../src/QACopilot.js";
import RequirementKnowledge from "../src/models/RequirementKnowledge.js";

process.env.ENABLE_AI = "false";

const originalLog = console.log;
console.log = () => {};

try {
    const app = new QACopilot();
    const requirementFile = "./requirements/thiet-bi.md";
    const markdown = app.loader.load(requirementFile);
    const reviewedRequirement = app.parser.parse(markdown);
    let parsedRequirement = structuredClone(reviewedRequirement);

    app.loader.load = () => markdown;
    app.parser.parse = () => structuredClone(parsedRequirement);

    let result = await app.run(requirementFile, {
        productionWorkflow: true
    });
    const analysisStage = result.workflowContext.clarificationReview;

    await assert.rejects(
        app.run(requirementFile, {
            productionWorkflow: true,
            workflowContext: result.workflowContext
        }),
        /AI Analysis Review must be answered, approved and completed/
    );

    app.reviewClarification({
        sessionId: analysisStage.sessionId,
        feedback: "Approved knowledge source"
    });
    app.approveClarification({
        sessionId: analysisStage.sessionId,
        artifactId: analysisStage.artifactId,
        approvedBy: "tester"
    });

    parsedRequirement = {
        module: "RAW_MARKDOWN_MUST_NOT_BE_USED",
        purpose: "Raw fallback",
        features: [{ id: "RAW001", name: "Raw fallback function" }],
        businessRules: [],
        permissions: []
    };

    let generatorKnowledge = null;
    let generatorRequirement = null;
    let generatorArgumentCount = 0;
    const originalGenerate = app.scenarioRecommendationEngine.generate.bind(
        app.scenarioRecommendationEngine
    );
    app.scenarioRecommendationEngine.generate = (...args) => {
        generatorArgumentCount = args.length;
        [generatorKnowledge, generatorRequirement] = args;
        return originalGenerate(...args);
    };

    result = await app.run(requirementFile, {
        productionWorkflow: true,
        workflowContext: result.workflowContext
    });

    assert.equal(result.reviewStage, "TEST_CASE_REVIEW");
    assert.ok(result.testCases.length > 0);
    assert.ok(generatorKnowledge instanceof RequirementKnowledge);
    assert.equal(generatorKnowledge.isApproved(), true);
    assert.equal(generatorArgumentCount, 2);
    assert.equal(Object.hasOwn(generatorKnowledge, "aiResult"), false);
    assert.equal(generatorRequirement.module, reviewedRequirement.module);
    assert.notEqual(generatorRequirement.module, parsedRequirement.module);
    assert.equal(
        generatorKnowledge.functions.some(item => item.name === "Raw fallback function"),
        false
    );

    const types = new Set(result.scenarios.map(scenario => scenario.type));
    assert.equal(types.has("POSITIVE"), true);
    assert.equal(types.has("NEGATIVE"), true);
    assert.equal(types.has("DATA_INTEGRITY"), true);
    assert.equal(types.has("PERMISSION"), true);
    assert.equal(types.has("BOUNDARY"), false);

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

    const savedAnalysisArtifact = app.workflowCoordinator.findArtifact(analysisStage.artifactId);
    assert.equal(savedAnalysisArtifact.knowledge.approved, true);
    assert.equal(savedAnalysisArtifact.knowledge.module.name, reviewedRequirement.module);
    assert.equal(
        savedAnalysisArtifact.knowledge.functions.some(
            item => item.name === "Raw fallback function"
        ),
        false
    );

    originalLog("Approved RequirementKnowledge core generation test: PASS");
} finally {
    console.log = originalLog;
}
