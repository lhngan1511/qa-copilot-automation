import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { buildPlaywrightInvocation, executePlaywright, withRunnerPlaywrightEnv } from "../tools/runner/playwrightExecution.mjs";

const runnerRoot = path.resolve("tools/runner");
const require = createRequire(path.join(runnerRoot, "agent.mjs"));
const cliPath = require.resolve("@playwright/test/cli");
const jobId = `SMOKE-${Date.now()}`;
const runDir = path.join(runnerRoot, "work", jobId);
const specPath = path.join(runDir, "generated.spec.js");
fs.mkdirSync(runDir, { recursive: true });
fs.writeFileSync(specPath, "import { test, expect } from '@playwright/test';\ntest('runner smoke', () => expect(1).toBe(1));\n", "utf8");

try {
    const invocation = buildPlaywrightInvocation({ agentRoot: runnerRoot, workDir: path.join(runnerRoot, "work"), specPath, cliPath });
    assert.equal(invocation.cwd, runnerRoot, "agent cwd is the standalone Runner root");
    assert.equal(invocation.specArgument, `${jobId}/generated.spec.js`, "Playwright receives a slash-compatible spec argument relative to the configured work directory");
    assert.equal(invocation.args[2], invocation.specArgument, "spawn uses the normalized argument");
    const headedInvocation = buildPlaywrightInvocation({ agentRoot: runnerRoot, workDir: path.join(runnerRoot, "work"), specPath, cliPath, headed: true });
    assert.ok(headedInvocation.args.includes("--headed"), "headed=true adds --headed to the Runner command");
    assert.ok(!invocation.args.includes("--headed"), "headed=false/default keeps headless Playwright command");
    assert.equal(withRunnerPlaywrightEnv({}, 0).PLAYWRIGHT_SLOW_MO, "0", "slowMo=0 reaches Playwright runtime config");
    assert.equal(withRunnerPlaywrightEnv({}, 500).PLAYWRIGHT_SLOW_MO, "500", "slowMo=500 reaches Playwright runtime config");
    assert.equal(withRunnerPlaywrightEnv({}, 1000).PLAYWRIGHT_SLOW_MO, "1000", "slowMo=1000 reaches Playwright runtime config");
    const result = await executePlaywright(invocation, process.env);
    assert.equal(result.exitCode, 0, `same execution helper must pass: ${result.stderr || result.stdout}`);
    assert.equal(result.status, "PASSED", "exit code 0 maps to PASSED");
    console.log("Runner Playwright execution smoke test: PASS");
} finally {
    fs.rmSync(runDir, { recursive: true, force: true });
}
