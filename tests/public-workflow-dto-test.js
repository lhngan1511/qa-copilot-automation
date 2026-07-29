import assert from "node:assert/strict";
import PublicWorkflowMapper from "../src/web/mappers/PublicWorkflowMapper.js";
import PublicArtifactDto from "../src/web/dtos/PublicArtifactDto.js";

const mapper = new PublicWorkflowMapper();
const absoluteOutput = "G:\\qa-copilot-v2\\outputs\\production\\json\\approved-testcases.json";
const source = {
    status: "AWAITING_AI_CLARIFICATION",
    currentStage: "clarificationReview",
    workflowContext: {
        clarificationReview: {
            sessionId: "SESSION-001",
            artifactId: "ARTIFACT-001"
        }
    },
    clarificationStatus: {
        total: 2,
        answered: 1,
        pending: 1,
        questions: [
            { questionId: "CL001", answer: "Có" },
            { questionId: "CL002", answer: "" }
        ]
    },
    artifacts: [
        {
            artifactId: "ARTIFACT-001",
            artifactType: "AI_ANALYSIS_REVIEW",
            approvalStatus: "pending",
            storagePath: absoluteOutput
        }
    ],
    testCases: [
        {
            id: "TC001",
            approvalStatus: "approved",
            executionReadiness: "READY"
        },
        {
            id: "TC002",
            approvalStatus: "rejected",
            executionReadiness: "DATA_REQUIRED"
        }
    ],
    outputs: {
        json: absoluteOutput
    },
    requirementFile: "G:\\qa-copilot-v2\\data\\uploads\\requirement.md",
    startedAt: "2026-07-29T00:00:00.000Z",
    updatedAt: "2026-07-29T00:01:00.000Z"
};

const dto = mapper.map(source);
assert.equal(Object.getPrototypeOf(dto), Object.prototype);
assert.equal(dto.id, "SESSION-001");
assert.equal(dto.status, "AI_ANALYSIS_REVIEW_REQUIRED");
assert.equal(dto.step, "AI_ANALYSIS_REVIEW");
assert.equal(dto.isBlocking, true);
assert.deepEqual(dto.allowedActions, ["ANSWER_CLARIFICATIONS", "UPDATE_AI_ANALYSIS"]);
assert.deepEqual(dto.clarification, {
    total: 2,
    answered: 1,
    remaining: 1
});
assert.deepEqual(dto.testCases, {
    total: 2,
    approved: 1,
    rejected: 1,
    requiresTesterInput: 1
});
assert.equal(dto.artifacts[0].id, "ARTIFACT-001");
assert.equal("storagePath" in dto.artifacts[0], false);
assert.equal(dto.exports[0].downloadUrl, "/api/workflows/SESSION-001/outputs/json/download");
assert.equal(JSON.stringify(dto).includes(absoluteOutput), false);
assert.doesNotThrow(() => JSON.stringify(dto));

const serialized = JSON.parse(JSON.stringify(dto));
assert.equal(Object.getPrototypeOf(serialized), Object.prototype);
assert.equal(
    JSON.stringify(serialized, (_key, value) =>
        typeof value === "function" ? "__FUNCTION__" : value
    ).includes("__FUNCTION__"),
    false
);

const testcaseReview = mapper.map({
    pipelineStatus: "AWAITING_TEST_CASE_REVIEW",
    status: "started",
    sessionId: "SESSION-002",
    testCases: [{ executionReadiness: "DATA_REQUIRED" }]
});
assert.equal(testcaseReview.status, "TEST_CASE_REVIEW_REQUIRED");
assert.equal(testcaseReview.step, "TEST_CASE_REVIEW");
assert.deepEqual(testcaseReview.allowedActions, ["UPDATE_TEST_CASES", "APPROVE_TEST_CASES"]);

const completed = mapper.map({
    pipelineStatus: "COMPLETED",
    sessionId: "SESSION-003",
    outputs: {
        json: absoluteOutput,
        excel: "G:\\qa-copilot-v2\\outputs\\production\\excel\\approved-testcases.xlsx"
    }
});
assert.equal(completed.status, "COMPLETED");
assert.equal(completed.step, "EXPORT");
assert.deepEqual(completed.allowedActions, ["DOWNLOAD_JSON", "DOWNLOAD_EXCEL"]);
assert.equal(completed.isBlocking, false);

const unknown = mapper.map({ status: "SOMETHING_NEW" });
assert.equal(unknown.status, "UNKNOWN");
assert.equal(unknown.step, "ERROR");
assert.equal(unknown.isBlocking, true);
assert.deepEqual(unknown.allowedActions, []);

const publicArtifact = PublicArtifactDto.create({
    artifactId: "ARTIFACT-002",
    artifactType: "TEST_CASE_REVIEW",
    approvalStatus: "approved",
    filePath: absoluteOutput
});
assert.deepEqual(publicArtifact, {
    id: "ARTIFACT-002",
    type: "TEST_CASE_REVIEW",
    name: "TEST_CASE_REVIEW",
    status: "approved",
    revision: null,
    downloadAvailable: false
});

const sanitized = mapper.sanitizeLegacy(source, dto);
assert.equal("requirementFile" in sanitized, false);
assert.equal("storagePath" in sanitized.artifacts[0], false);
assert.equal(sanitized.outputs.json, "/api/workflows/SESSION-001/outputs/json/download");
assert.equal(JSON.stringify(sanitized).includes(absoluteOutput), false);

console.log("Public workflow DTO test PASSED");
