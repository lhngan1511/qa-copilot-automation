import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildRunnerAgentConfig, suggestPackageFileName } from "../src/services/runnerPackage.js";

/* Tải gói cài đặt Runner Agent 1-click (Ngân yêu cầu 2026-09-07) — không giải nén zip trong test
   (không thêm thư viện đọc zip chỉ để phục vụ test); phần nội dung config.json được test riêng qua
   buildRunnerAgentConfig() (hàm thuần), còn phần HTTP chỉ xác nhận header/status/không rỗng + các
   trường hợp từ chối (token sai, sai chủ tài khoản). */

// ---- buildRunnerAgentConfig() / suggestPackageFileName() — hàm thuần, không cần server ----
{
    const config = buildRunnerAgentConfig({ serverUrl: "http://10.0.0.5:3000", agentId: "RUNNER-x", token: "tok123", machineName: "Máy Ngân" });
    assert.deepEqual(config, { serverUrl: "http://10.0.0.5:3000", agentId: "RUNNER-x", token: "tok123", machineName: "Máy Ngân" });
    assert.equal(Object.keys(config).length, 4, "không rò rỉ field thừa nào khác");
}
{
    const name = suggestPackageFileName("Máy Ngân #1");
    assert.match(name, /^qa-copilot-runner-[a-z0-9-]+\.zip$/, `tên file phải an toàn, nhận: ${name}`);
}

// ---- HTTP round-trip qua createApp() thật ----
const root = fs.mkdtempSync(path.join(os.tmpdir(), "runner-package-"));
const { default: createApp } = await import("../src/server/createApp.js");
const app = createApp({ repositoryType: "file", dataDir: root, outputDir: path.join(root, "out"), v3OutputDir: path.join(root, "v3") });
const server = await new Promise(resolve => { const value = app.listen(0, "127.0.0.1", () => resolve(value)); });
const base = `http://127.0.0.1:${server.address().port}`;

async function requestJson(method, url, body, cookie = "") {
    const response = await fetch(`${base}${url}`, { method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, body: await response.json(), cookie: response.headers.get("set-cookie")?.split(";")[0] ?? "" };
}

async function requestRaw(method, url, body, cookie = "") {
    const response = await fetch(`${base}${url}`, { method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    const buffer = Buffer.from(await response.arrayBuffer());
    return { status: response.status, headers: response.headers, buffer };
}

try {
    const loginA = await requestJson("POST", "/api/auth/login", { username: "tester01", password: "tester01" });
    assert.equal(loginA.status, 200, "tester01 login");
    const loginB = await requestJson("POST", "/api/auth/login", { username: "tester02", password: "tester02" });
    assert.equal(loginB.status, 200, "tester02 login");

    const device = await requestJson("POST", "/api/runner-devices", { machineName: "Máy tải gói" }, loginA.cookie);
    assert.equal(device.status, 200, JSON.stringify(device.body));
    const runnerId = device.body.data.device.runnerId;
    const token = device.body.data.token;

    // 1. Happy path: đúng token, đúng chủ -> zip thật.
    const ok = await requestRaw("POST", `/api/runner-devices/${encodeURIComponent(runnerId)}/package`, { token }, loginA.cookie);
    assert.equal(ok.status, 200, ok.buffer.toString("utf8").slice(0, 300));
    assert.equal(ok.headers.get("content-type"), "application/zip");
    assert.match(ok.headers.get("content-disposition") ?? "", /attachment; filename="qa-copilot-runner-.*\.zip"/);
    assert.ok(ok.buffer.length > 1000, `zip phải có nội dung thật, nhận ${ok.buffer.length} bytes`);
    // ZIP local file header signature "PK\x03\x04" — xác nhận đây thực sự là file zip, không phải rác.
    assert.equal(ok.buffer.slice(0, 4).toString("hex"), "504b0304", "phải là zip hợp lệ (magic bytes PK..)");

    // 2. Token sai -> từ chối, không lộ zip.
    const badToken = await requestRaw("POST", `/api/runner-devices/${encodeURIComponent(runnerId)}/package`, { token: "sai-token" }, loginA.cookie);
    assert.equal(badToken.status, 401);

    // 3. Đúng token nhưng đăng nhập bằng tài khoản KHÁC (không sở hữu Runner này) -> từ chối.
    const wrongUser = await requestRaw("POST", `/api/runner-devices/${encodeURIComponent(runnerId)}/package`, { token }, loginB.cookie);
    assert.equal(wrongUser.status, 403);

    // 4. Chưa đăng nhập -> từ chối.
    const noAuth = await requestRaw("POST", `/api/runner-devices/${encodeURIComponent(runnerId)}/package`, { token });
    assert.equal(noAuth.status, 401);

    // 5. Runner đã bị thu hồi -> không tải được nữa.
    await requestJson("POST", `/api/runner-devices/${encodeURIComponent(runnerId)}/revoke`, {}, loginA.cookie);
    const revokedTry = await requestRaw("POST", `/api/runner-devices/${encodeURIComponent(runnerId)}/package`, { token }, loginA.cookie);
    assert.equal(revokedTry.status, 401, "Runner đã thu hồi không tải gói được nữa");

    console.log("Runner device package download test: PASS");
} finally {
    server.close();
    fs.rmSync(root, { recursive: true, force: true });
}
