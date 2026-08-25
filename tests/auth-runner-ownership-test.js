import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "auth-runner-"));
const { default: createApp } = await import("../src/server/createApp.js");
const app = createApp({ repositoryType: "file", dataDir: root, outputDir: path.join(root, "out"), v3OutputDir: path.join(root, "v3") });
const server = await new Promise(resolve => { const value = app.listen(0, "127.0.0.1", () => resolve(value)); });
const base = `http://127.0.0.1:${server.address().port}`;
async function request(method, url, body, cookie = "") {
    const response = await fetch(`${base}${url}`, { method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, body: await response.json(), cookie: response.headers.get("set-cookie")?.split(";")[0] ?? "" };
}
try {
    const adminLogin = await request("POST", "/api/auth/login", { username: "admin", password: "admin" });
    assert.equal(adminLogin.status, 200, "admin seed login");
    assert.equal(adminLogin.body.data.displayName, "Quản trị viên", "admin principal hiển thị rõ ràng");
    const loginA = await request("POST", "/api/auth/login", { username: "tester01", password: "tester01" });
    const loginB = await request("POST", "/api/auth/login", { username: "tester02", password: "tester02" });
    assert.equal(loginA.status, 200, "tester01 login"); assert.equal(loginA.body.data.username, "tester01", "auth me principal created");
    assert.equal((await request("GET", "/api/auth/me", undefined, loginA.cookie)).body.data.displayName, "Tester 01", "me returns current user");
    const deviceA = await request("POST", "/api/runner-devices", { machineName: "PC A" }, loginA.cookie);
    const deviceB = await request("POST", "/api/runner-devices", { machineName: "PC B" }, loginB.cookie);
    const duplicateA = await request("POST", "/api/runner-devices", { machineName: "pc a" }, loginA.cookie);
    assert.equal(duplicateA.status, 409, "same user cannot register the same machine twice");
    assert.ok(deviceA.body.data.token && !deviceA.body.data.device.tokenHash, "raw token only returned once; hash is private");
    assert.deepEqual((await request("GET", "/api/runner-devices", undefined, loginA.cookie)).body.data.map(v => v.runnerId), [deviceA.body.data.device.runnerId], "A sees only Runner A");
    assert.deepEqual((await request("GET", "/api/runner-devices", undefined, loginB.cookie)).body.data.map(v => v.runnerId), [deviceB.body.data.device.runnerId], "B sees only Runner B");
    await request("POST", "/api/runner-agents/register", { agentId: deviceA.body.data.device.runnerId, token: deviceA.body.data.token, machineName: "PC A" });
    await request("POST", "/api/runner-agents/register", { agentId: deviceB.body.data.device.runnerId, token: deviceB.body.data.token, machineName: "PC B" });
    assert.deepEqual((await request("GET", "/api/automation-v3/runner-agents", undefined, loginA.cookie)).body.map(v => v.agentId), [deviceA.body.data.device.runnerId], "dropdown A cannot see Runner B");
    const crossClaim = await request("POST", `/api/runner-agents/${deviceB.body.data.device.runnerId}/jobs/claim`, { token: deviceA.body.data.token });
    assert.equal(crossClaim.status, 401, "Runner A cannot claim Runner B job");
    const revoked = await request("POST", `/api/runner-devices/${deviceA.body.data.device.runnerId}/revoke`, {}, loginA.cookie);
    assert.equal(revoked.status, 200, "owner can revoke device");
    assert.deepEqual((await request("GET", "/api/runner-devices", undefined, loginA.cookie)).body.data, [], "revoked Runner no longer appears in the owner's normal list");
    const rejected = await request("POST", "/api/runner-agents/register", { agentId: deviceA.body.data.device.runnerId, token: deviceA.body.data.token });
    assert.equal(rejected.status, 401, "revoked token rejected");
    console.log("Auth + Runner ownership test: PASS");
} finally { server.close(); fs.rmSync(root, { recursive: true, force: true }); }
