import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { playwrightTestArgument } from "../tools/runner/playwrightPath.mjs";

const root = path.resolve(".");
const agent = fs.readFileSync(path.join(root, "tools", "runner", "agent.mjs"), "utf8");
const config = fs.readFileSync(path.join(root, "tools", "runner", "config.example.json"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "tools", "runner", "package.json"), "utf8"));
const runnerPlaywrightConfig = fs.readFileSync(path.join(root, "tools", "runner", "playwright.config.mjs"), "utf8");

assert.equal(config.includes("projectDir"), false, "standalone config has no projectDir");
assert.equal(agent.includes("projectDir"), false, "standalone agent has no projectDir dependency");
assert.ok(manifest.dependencies["@playwright/test"], "runner owns Playwright dependency");
assert.ok(agent.includes("createRequire(import.meta.url)") && agent.includes("@playwright/test/cli"), "CLI resolves from runner package");
assert.ok(agent.includes("runnerSelfCheck") && agent.includes("[Runner:self-check]"), "Runner self-checks its local runtime before registering");
assert.ok(agent.includes("browserInstalled") && agent.includes("npx playwright install chromium"), "self-check reports a missing Chromium with the recovery command");
assert.ok(agent.includes("path.join(workDir, String(job.jobId))"), "each job gets isolated work directory");
assert.ok(agent.includes("stdout") && agent.includes("stderr") && agent.includes("exitCode"), "runner returns execution evidence");
assert.ok(agent.includes("fs.rmSync(runDir"), "successful temporary workspaces are cleaned up");
assert.ok(agent.includes("buildPlaywrightInvocation({ agentRoot, workDir, specPath: file"), "agent delegates a workDir-relative Playwright invocation before spawn");
assert.ok(agent.includes("job.payload?.runOptions?.headed === true"), "agent receives headed from job runOptions");
assert.ok(agent.includes("withRunnerPlaywrightEnv") && runnerPlaywrightConfig.includes("PLAYWRIGHT_SLOW_MO") && runnerPlaywrightConfig.includes("launchOptions: { slowMo }"), "slowMo is injected at Runner runtime launchOptions, not generated spec");

const windowsPath = path.win32;
const windowsArg = playwrightTestArgument(
    "C:\\QA-Copilot-Runner\\work",
    "C:\\QA-Copilot-Runner\\work\\JOB-123\\generated.spec.js",
    windowsPath
);
assert.equal(windowsArg, "JOB-123/generated.spec.js", "Windows spec is passed relative to Runner workDir with forward slashes");
assert.equal(windowsArg.includes("\\"), false, "Windows backslash cannot cause a Playwright matcher miss");

console.log("Standalone Runner contract test: PASS");
