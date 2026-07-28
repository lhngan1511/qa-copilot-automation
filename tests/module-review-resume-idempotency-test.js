import assert from "node:assert/strict";
import { app, scenarioResult } from "./approved-module-source-of-truth-test.js";

const before = app.workflowCoordinator.runtime.artifactManager
    .findAll()
    .filter(item => item.artifactType === "SCENARIO_REVIEW");
await assert.rejects(
    () =>
        app.run("./requirements/thiet-bi.md", {
            workflowContext: scenarioResult.workflowContext
        }),
    /Scenario review must be approved/
);
const after = app.workflowCoordinator.runtime.artifactManager
    .findAll()
    .filter(item => item.artifactType === "SCENARIO_REVIEW");
assert.equal(before.length, 1);
assert.equal(after.length, 1);
assert.equal(before[0].artifactId, after[0].artifactId);

console.log("Module review resume idempotency test PASSED");
