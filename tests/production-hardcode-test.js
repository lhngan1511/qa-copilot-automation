import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

import TestDataBuilder from "../src/enrichers/TestDataBuilder.js";

const builder = new TestDataBuilder();
const testData = builder.build({
    identity: {
        type: "positive"
    },
    inputs: [
        {
            name: "Tên khách hàng",
            required: true
        },
        {
            name: "Tên sản phẩm",
            required: true
        }
    ]
});

assert.match(testData.requirement, /Tên khách hàng/);
assert.match(testData.requirement, /Tên sản phẩm/);
assert.equal(testData.value, "");
assert.equal(JSON.stringify(testData).includes("Thiết bị"), false);

const missingArgument = spawnSync(process.execPath, ["src/index.js"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
        ...process.env,
        ENABLE_AI: "false"
    }
});
const missingArgumentOutput = `${missingArgument.stdout}${missingArgument.stderr}`;

assert.notEqual(missingArgument.status, 0);
assert.match(missingArgumentOutput, /Usage:/);
assert.match(missingArgumentOutput, /node src\/index\.js <requirement-file>/);
assert.doesNotMatch(missingArgumentOutput, /QA COPILOT PIPELINE/);

const cliRequirementPath = "requirements/dang-nhap.md";
const cliRun = spawnSync(process.execPath, ["src/index.js", cliRequirementPath], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
        ...process.env,
        ENABLE_AI: "false"
    },
    maxBuffer: 10 * 1024 * 1024
});
const cliOutput = `${cliRun.stdout}${cliRun.stderr}`;

assert.equal(cliRun.status, 0, cliOutput);
assert.match(cliOutput, /Requirement loaded/);
assert.match(cliOutput, /REQUIREMENT REVIEW REQUIRED/);

console.log("Production hardcode validation PASSED");
