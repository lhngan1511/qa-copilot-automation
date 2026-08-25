import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import MinimalAuthService from "../src/services/MinimalAuthService.js";
import createApp from "../src/server/createApp.js";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "qa-user-onboarding-"));
const auth = new MinimalAuthService({ dataDir });
try {
    const cli = spawnSync(process.execPath, [path.join(process.cwd(), "tools", "create-user.mjs"), "--username", "tester03", "--display-name", "Tester 03", "--password", "tester03-pass"], {
        encoding: "utf8",
        env: { ...process.env, DATA_DIR: dataDir }
    });
    assert.equal(cli.status, 0, `CLI tạo user: ${cli.stderr}`);
    assert.match(cli.stdout, /Đã tạo user tester03/, "CLI báo tạo user thành công");
    const created = auth.users().find(user => user.username === "tester03");
    assert.match(created.userId, /^USR-/, "userId được sinh tự động");
    assert.equal(created.username, "tester03");
    const stored = auth.users().find(user => user.username === "tester03");
    assert.ok(stored?.passwordHash && !stored.passwordHash.includes("tester03-pass"), "chỉ password hash được ghi vào repository");
    assert.throws(
        () => auth.createUser({ username: "tester03", displayName: "Tester trùng", password: "another-pass" }),
        error => error.code === "AUTH_USERNAME_EXISTS",
        "không overwrite user có sẵn"
    );

    const app = createApp({ repositoryType: "file", dataDir, outputDir: path.join(dataDir, "out"), v3OutputDir: path.join(dataDir, "v3") });
    const server = await new Promise(resolve => { const value = app.listen(0, "127.0.0.1", () => resolve(value)); });
    try {
        const response = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/login`, {
            method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "tester03", password: "tester03-pass" })
        });
        const body = await response.json();
        assert.equal(response.status, 200, "user mới đăng nhập được");
        assert.equal(body.data.displayName, "Tester 03");
    } finally {
        await new Promise(resolve => server.close(resolve));
    }
    console.log("User onboarding test: PASS");
} finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
}
