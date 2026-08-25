import assert from "node:assert/strict";
import RunnerAgentService from "../src/services/RunnerAgentService.js";

let tick = 0;
const service = new RunnerAgentService({
    tokens: { "TESTER-PC-01": "secret-1", "TESTER-PC-02": "secret-2" },
    now: () => new Date(`2026-08-22T00:00:${String(tick++).padStart(2, "0")}.000Z`)
});

assert.throws(
    () => service.register({ agentId: "TESTER-PC-01", token: "wrong" }),
    error => error.code === "RUNNER_AGENT_UNAUTHORIZED",
    "token sai bị chặn"
);

const registered = service.register({
    agentId: "TESTER-PC-01",
    token: "secret-1",
    machineName: "Máy tester 01",
    capabilities: ["PLAYWRIGHT_RUN"],
    runnerVersion: "0.2.0",
    runtime: { nodeVersion: "v24.0.0", platform: "win32-x64", playwrightVersion: "1.62.1", configFile: "playwright.config.mjs", workDirReady: true, browserInstalled: true }
});
assert.equal(registered.status, "ONLINE", "agent đăng ký online");
assert.deepEqual(registered.capabilities, ["PLAYWRIGHT_RUN"], "capability được công bố");
assert.equal(registered.runnerVersion, "0.2.0", "server công bố phiên bản Runner");
assert.equal(registered.runtime?.playwrightVersion, "1.62.1", "server công bố runtime self-check an toàn");
assert.equal(registered.runtime?.browserInstalled, true, "server công bố Chromium đã sẵn sàng");

assert.throws(
    () => service.enqueue({ agentId: "MISSING", type: "RUN_TESTCASE" }),
    error => error.code === "RUNNER_AGENT_OFFLINE",
    "không queue vào agent offline"
);

const queued = service.enqueue({
    agentId: "TESTER-PC-01",
    type: "RUN_TESTCASE",
    payload: { workspaceId: "WS-1", testCaseId: "TC001", code: "test('x', () => {})" }
});
assert.equal(queued.status, "QUEUED", "job được queue");

const job = service.claim({ agentId: "TESTER-PC-01", token: "secret-1" });
assert.equal(job.jobId, queued.jobId, "agent chỉ nhận job của chính nó");
assert.equal(job.status, "RUNNING", "claim chuyển job sang running");
assert.equal(service.claim({ agentId: "TESTER-PC-01", token: "secret-1" }), null, "một agent chỉ chạy một job");

assert.throws(
    () => service.complete({ agentId: "TESTER-PC-02", token: "secret-2", jobId: job.jobId, result: { status: "PASSED" } }),
    error => error.code === "RUNNER_JOB_NOT_FOUND",
    "agent khác không thể complete job"
);

const completed = service.complete({
    agentId: "TESTER-PC-01",
    token: "secret-1",
    jobId: job.jobId,
    result: { status: "PASSED", durationMs: 12 }
});
assert.equal(completed.job.status, "PASSED", "result canonicalized thành passed");
assert.equal(completed.agent.status, "ONLINE", "agent rảnh lại sau complete");

console.log("Runner Agent service test: PASS");
