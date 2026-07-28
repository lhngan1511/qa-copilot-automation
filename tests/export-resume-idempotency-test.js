import fs from "node:fs";
import assert from "node:assert/strict";
import { app, exportResult } from "./approved-testcase-source-of-truth-test.js";

const outputPaths = Object.values(exportResult.outputs).filter(
    outputPath => typeof outputPath === "string"
);
const before = outputPaths.map(outputPath => ({
    outputPath,
    modified: fs.statSync(outputPath).mtimeMs
}));
let aiCalls = 0;
app.aiTestCaseIntelligenceEngine.analyze = async () => {
    aiCalls += 1;
    throw new Error("AI must not run on export resume.");
};

const resumed = await app.run("./requirements/thiet-bi.md", {
    workflowContext: exportResult.workflowContext
});

assert.equal(aiCalls, 0);
assert.deepEqual(resumed.outputs, exportResult.outputs);
assert.deepEqual(
    outputPaths.map(outputPath => fs.statSync(outputPath).mtimeMs),
    before.map(item => item.modified)
);

console.log("Export resume idempotency test PASSED");
