import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/* Ghi CodeGen từ xa qua Runner Agent (Ngân yêu cầu 2026-09-07) — round-trip HTTP thật qua
   createApp(), giống tests/auth-runner-ownership-test.js: đăng nhập thật, ghép đôi Runner thật,
   dispatch job qua đúng route /api/runner-agents/... rồi xác nhận CodeGenRecordingStore cập nhật
   đúng trạng thái qua GET /api/codegen/recordings/:id. Không spawn Playwright thật — mô phỏng agent
   bằng cách gọi thẳng route claim/complete như tools/runner/agent.mjs sẽ làm. */

const root = fs.mkdtempSync(path.join(os.tmpdir(), "codegen-remote-http-"));
const { default: createApp } = await import("../src/server/createApp.js");
const app = createApp({ repositoryType: "file", dataDir: root, outputDir: path.join(root, "out"), v3OutputDir: path.join(root, "v3") });
const server = await new Promise(resolve => { const value = app.listen(0, "127.0.0.1", () => resolve(value)); });
const base = `http://127.0.0.1:${server.address().port}`;

async function request(method, url, body, cookie = "") {
    const response = await fetch(`${base}${url}`, {
        method,
        headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body)
    });
    return { status: response.status, body: await response.json(), cookie: response.headers.get("set-cookie")?.split(";")[0] ?? "" };
}

try {
    const loginA = await request("POST", "/api/auth/login", { username: "tester01", password: "tester01" });
    assert.equal(loginA.status, 200, "tester01 login");
    const loginB = await request("POST", "/api/auth/login", { username: "tester02", password: "tester02" });
    assert.equal(loginB.status, 200, "tester02 login");

    // Ghép đôi máy Runner của tester01 (mô phỏng "Kết nối máy chạy này" + agent.mjs register()).
    const device = await request("POST", "/api/runner-devices", { machineName: "Máy tester01" }, loginA.cookie);
    assert.equal(device.status, 200, JSON.stringify(device.body));
    const agentId = device.body.data.device.runnerId;
    const token = device.body.data.token;
    const registered = await request("POST", "/api/runner-agents/register", { agentId, token, machineName: "Máy tester01", capabilities: ["PLAYWRIGHT_RUN", "CODEGEN_RECORD"] });
    assert.equal(registered.status, 200, JSON.stringify(registered.body));

    // 1. start-remote -> QUEUED_START.
    const started = await request("POST", "/api/codegen/recordings/start-remote", { url: "https://x/login", browser: "chrome", agentId }, loginA.cookie);
    assert.equal(started.status, 200, JSON.stringify(started.body));
    const recordingId = started.body.data.recordingId;
    assert.equal(started.body.data.status, "QUEUED_START");

    const afterStart = await request("GET", `/api/codegen/recordings/${recordingId}`, undefined, loginA.cookie);
    assert.equal(afterStart.body.data.status, "QUEUED_START");

    // 2. Agent claim + complete START_CODEGEN (mô phỏng agent.mjs, không spawn Playwright thật).
    const claimedStart = await request("POST", `/api/runner-agents/${encodeURIComponent(agentId)}/jobs/claim`, { token });
    assert.equal(claimedStart.status, 200);
    assert.equal(claimedStart.body.data.type, "START_CODEGEN");
    assert.equal(claimedStart.body.data.payload.recordingId, recordingId);
    const completedStart = await request(
        "POST",
        `/api/runner-agents/${encodeURIComponent(agentId)}/jobs/${encodeURIComponent(claimedStart.body.data.jobId)}/complete`,
        { token, result: { status: "PASSED", pid: 9999 } }
    );
    assert.equal(completedStart.status, 200, JSON.stringify(completedStart.body));

    const afterAgentStarted = await request("GET", `/api/codegen/recordings/${recordingId}`, undefined, loginA.cookie);
    assert.equal(afterAgentStarted.body.data.status, "RECORDING", "completeStartJob phải chuyển recording sang RECORDING");

    // 3. stop-remote -> STOPPING.
    const stopped = await request("POST", `/api/codegen/recordings/${recordingId}/stop-remote`, {}, loginA.cookie);
    assert.equal(stopped.status, 200, JSON.stringify(stopped.body));
    assert.equal(stopped.body.data.status, "STOPPING");

    // 4. Agent claim + complete STOP_CODEGEN với script thật -> setScript() tự chuyển SAVED.
    const claimedStop = await request("POST", `/api/runner-agents/${encodeURIComponent(agentId)}/jobs/claim`, { token });
    assert.equal(claimedStop.status, 200);
    assert.equal(claimedStop.body.data.type, "STOP_CODEGEN");
    const SCRIPT = "await page.goto('https://x/login');\nawait page.getByLabel('Tài khoản').fill('admin');";
    const completedStop = await request(
        "POST",
        `/api/runner-agents/${encodeURIComponent(agentId)}/jobs/${encodeURIComponent(claimedStop.body.data.jobId)}/complete`,
        { token, result: { status: "PASSED", scriptContent: SCRIPT } }
    );
    assert.equal(completedStop.status, 200, JSON.stringify(completedStop.body));

    const final = await request("GET", `/api/codegen/recordings/${recordingId}`, undefined, loginA.cookie);
    assert.equal(final.body.data.status, "SAVED");
    assert.equal(final.body.data.hasScript, true, "hasScript phải true sau khi setScript() nhận script không rỗng");

    // 5. Empty-capture path riêng: STOP_CODEGEN với scriptContent rỗng -> STOPPED, không phải lỗi.
    const started2 = await request("POST", "/api/codegen/recordings/start-remote", { url: "https://y", agentId }, loginA.cookie);
    const recordingId2 = started2.body.data.recordingId;
    const claimedStart2 = await request("POST", `/api/runner-agents/${encodeURIComponent(agentId)}/jobs/claim`, { token });
    await request("POST", `/api/runner-agents/${encodeURIComponent(agentId)}/jobs/${encodeURIComponent(claimedStart2.body.data.jobId)}/complete`, { token, result: { status: "PASSED", pid: 1 } });
    await request("POST", `/api/codegen/recordings/${recordingId2}/stop-remote`, {}, loginA.cookie);
    const claimedStop2 = await request("POST", `/api/runner-agents/${encodeURIComponent(agentId)}/jobs/claim`, { token });
    await request("POST", `/api/runner-agents/${encodeURIComponent(agentId)}/jobs/${encodeURIComponent(claimedStop2.body.data.jobId)}/complete`, { token, result: { status: "PASSED", scriptContent: "" } });
    const final2 = await request("GET", `/api/codegen/recordings/${recordingId2}`, undefined, loginA.cookie);
    assert.equal(final2.body.data.status, "STOPPED", "capture rỗng phải rơi về STOPPED (dán tay), không lỗi");

    // 6. Cross-user ownership: tester02 không được start-remote/stop-remote trên Runner của tester01.
    const foreignStart = await request("POST", "/api/codegen/recordings/start-remote", { url: "https://x", agentId }, loginB.cookie);
    assert.ok([401, 403].includes(foreignStart.status), `tester02 phải bị từ chối dùng Runner của tester01, nhận ${foreignStart.status}`);

    const unauthenticatedStart = await request("POST", "/api/codegen/recordings/start-remote", { url: "https://x", agentId });
    assert.ok([401, 403].includes(unauthenticatedStart.status), "chưa đăng nhập phải bị từ chối");

    console.log("Runner Agent routes CodeGen dispatch test: PASS");
} finally {
    server.close();
    fs.rmSync(root, { recursive: true, force: true });
}
