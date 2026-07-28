import assert from "node:assert/strict";
import { app, testCaseResult } from "./approved-scenario-source-of-truth-test.js";
const before = app.workflowCoordinator.runtime.artifactManager
    .findAll()
    .filter(x => x.artifactType === "TEST_CASE_REVIEW");
await assert.rejects(
    () =>
        app.run("./requirements/thiet-bi.md", { workflowContext: testCaseResult.workflowContext }),
    /Test case review must be approved/
);
const after = app.workflowCoordinator.runtime.artifactManager
    .findAll()
    .filter(x => x.artifactType === "TEST_CASE_REVIEW");
assert.equal(before.length, after.length);
console.log("TestCase resume idempotency test PASSED");
