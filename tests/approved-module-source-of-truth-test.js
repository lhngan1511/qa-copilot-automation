import assert from "node:assert/strict";
import QACopilot from "../src/QACopilot.js";

process.env.ENABLE_AI = "false";
export const app = new QACopilot();
let aiCalls = 0;
let clarificationAiCalls = 0;
app.aiRequirementIntelligenceEngine.analyze = async () => {
    aiCalls += 1;
    throw new Error("AI must not run.");
};
app.aiEngine.analyze = async () => {
    clarificationAiCalls += 1;
    throw new Error("Clarification AI must not run.");
};
app.aiScenarioIntelligenceEngine.analyze = async () => ({
    status: "FAILED",
    source: "fake",
    scenarios: [],
    notes: [],
    confidence: 0,
    errors: ["Offline fallback"]
});
const requirementFile = "./requirements/thiet-bi.md";
const outputRoot = "./outputs/integration/approved-module-source-of-truth";
const requirementResult = await app.run(requirementFile, { outputRoot });
app.reviewRequirement({
    sessionId: requirementResult.requirementReview.sessionId,
    feedback: "Approved"
});
app.approveRequirement({
    sessionId: requirementResult.requirementReview.sessionId,
    artifactId: requirementResult.requirementReview.artifactId
});
const moduleResult = await app.run(requirementFile, {
    workflowContext: requirementResult.workflowContext,
    outputRoot
});
assert.equal(moduleResult.status, "AWAITING_MODULE_REVIEW");
assert.deepEqual(moduleResult.scenarios, []);
assert.deepEqual(moduleResult.testCases, []);
assert.deepEqual(moduleResult.outputs, {});

const moduleArtifact = app.workflowCoordinator.findArtifact(moduleResult.moduleReview.artifactId);
const renamed = moduleArtifact.functions.find(item => item.name === "Xóa thiết bị");
renamed.name = "Ngừng sử dụng thiết bị";
renamed.businessRules = ["Chỉ ngừng sử dụng khi không còn dữ liệu đang xử lý"];
moduleArtifact.functions = moduleArtifact.functions.filter(item => item.name !== "Sửa thiết bị");
moduleArtifact.functions.push({
    id: "FUNC005",
    moduleId: moduleArtifact.module.id,
    name: "Khôi phục thiết bị",
    description: "Khôi phục trạng thái sử dụng",
    actors: ["Người dùng"],
    preconditions: [],
    businessRules: ["Chỉ khôi phục thiết bị đã ngừng sử dụng"],
    validationRules: [],
    permissions: [],
    boundaries: [],
    exceptions: [],
    risks: [],
    requirementReferences: ["USER-EDIT-001"]
});
moduleArtifact.module.name = "Tài sản";
app.workflowCoordinator.saveArtifact(moduleArtifact);
app.reviewModule({
    sessionId: moduleResult.moduleReview.sessionId,
    feedback: "Approved edits"
});
app.approveModule({
    sessionId: moduleResult.moduleReview.sessionId,
    artifactId: moduleResult.moduleReview.artifactId
});

process.env.ENABLE_AI = "true";
export const scenarioResult = await app.run(requirementFile, {
    workflowContext: moduleResult.workflowContext,
    outputRoot
});
assert.equal(scenarioResult.status, "AWAITING_SCENARIO_REVIEW");
assert.equal(aiCalls, 0);
assert.equal(clarificationAiCalls, 0);
assert.deepEqual(scenarioResult.testCases, []);
assert.deepEqual(scenarioResult.outputs, {});
assert.ok(scenarioResult.scenarios.length < 82);
assert.ok(scenarioResult.scenarios.every(item => item.module === "Tài sản"));
assert.ok(scenarioResult.scenarios.some(item => item.feature === "Ngừng sử dụng thiết bị"));
assert.equal(
    scenarioResult.scenarios.some(item => item.feature === "Xóa thiết bị"),
    false
);
assert.equal(
    scenarioResult.scenarios.some(item => item.feature === "Sửa thiết bị"),
    false
);
assert.ok(scenarioResult.scenarios.some(item => item.feature === "Khôi phục thiết bị"));
assert.ok(
    scenarioResult.scenarios.some(
        item =>
            Array.isArray(item.coveredRules) &&
            item.coveredRules.includes("Chỉ ngừng sử dụng khi không còn dữ liệu đang xử lý")
    )
);
assert.ok(
    scenarioResult.scenarios.every(
        item =>
            item.moduleId &&
            item.functionId &&
            item.function &&
            Array.isArray(item.requirementReferences)
    )
);
const scenarioArtifact = app.workflowCoordinator.findArtifact(
    scenarioResult.scenarioReview.artifactId
);
assert.equal(scenarioArtifact.approvalStatus, "pending");
assert.equal(scenarioArtifact.scenarios.length, scenarioResult.scenarios.length);
assert.equal(scenarioArtifact.qualitySummary.finalCount, scenarioResult.scenarios.length);

console.log("Approved module source-of-truth test PASSED");
