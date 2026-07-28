import assert from "node:assert/strict";
import QACopilot from "../src/QACopilot.js";

process.env.ENABLE_AI = "false";
const app = new QACopilot();
const requirementFile = "./requirements/thiet-bi.md";
const initial = await app.run(requirementFile);
assert.equal(initial.status, "AWAITING_REQUIREMENT_REVIEW");
assert.deepEqual(initial.recommendedScenarios, []);
assert.deepEqual(initial.scenarios, []);
assert.deepEqual(initial.testCases, []);
assert.deepEqual(initial.outputs, {});
assert.equal(initial.workflowContext.moduleReview.sessionId, "");

app.reviewRequirement({
    sessionId: initial.requirementReview.sessionId,
    feedback: "Approved"
});
app.approveRequirement({
    sessionId: initial.requirementReview.sessionId,
    artifactId: initial.requirementReview.artifactId
});
const resumed = await app.run(requirementFile, {
    workflowContext: initial.workflowContext
});
assert.equal(resumed.status, "AWAITING_MODULE_REVIEW");
assert.deepEqual(resumed.scenarios, []);
assert.deepEqual(resumed.testCases, []);
assert.deepEqual(resumed.outputs, {});
const artifact = app.workflowCoordinator.findArtifact(resumed.moduleReview.artifactId);
assert.equal(artifact.approvalStatus, "pending");
assert.equal(artifact.module.id, "MOD001");
assert.ok(artifact.functions.length > 0);
assert.ok(artifact.functions.every(item => item.moduleId === "MOD001"));
assert.deepEqual(
    artifact.modules[0].features,
    artifact.functions.map(item => item.name)
);

console.log("Requirement intelligence gate test PASSED");
