import assert from "node:assert/strict";
import { app, testCaseResult } from "./approved-scenario-source-of-truth-test.js";

assert.equal(testCaseResult.status, "AWAITING_TEST_CASE_REVIEW");
assert.deepEqual(testCaseResult.outputs, {});
assert.equal(
    app.workflowCoordinator.findArtifact(testCaseResult.testCaseReview.artifactId).approvalStatus,
    "pending"
);

console.log("Export gate test PASSED");
