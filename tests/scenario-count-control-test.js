import assert from "node:assert/strict";
import { scenarioResult } from "./approved-module-source-of-truth-test.js";

assert.ok(scenarioResult.scenarios.length > 0);
assert.ok(scenarioResult.scenarios.length < 40);
assert.ok(new Set(scenarioResult.scenarios.map(item => item.functionId)).size >= 3);
assert.ok(scenarioResult.scenarios.some(item => item.type === "POSITIVE"));
assert.ok(
    scenarioResult.scenarios.some(
        item =>
            item.type === "NEGATIVE" ||
            item.type === "EXCEPTION" ||
            item.type === "DATA_INTEGRITY"
    )
);
assert.ok(
    scenarioResult.scenarios.some(
        item =>
            Array.isArray(item.requirementReferences) &&
            item.requirementReferences.includes("BR18")
    )
);
console.log("Scenario count control test PASSED");
