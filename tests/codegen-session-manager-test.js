import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { EventEmitter } from "node:events";
import CodeGenSessionManager, { defaultFileName, slugify } from "../src/codegen/CodeGenSessionManager.js";

function fakeChild() {
    const child = new EventEmitter();
    child.kill = () => {
        child.killed = true;
        // mô phỏng process exit khi bị kill
        process.nextTick(() => child.emit("exit", 0));
        return true;
    };
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    return child;
}

function buildManager({ fakeRunner = null } = {}) {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "codegen-test-"));
    let child = null;
    const spawnFn = (bin, args) => {
        child = fakeChild();
        child.args = args;
        return child;
    };
    const runner =
        fakeRunner ??
        {
            async runFile(filePath, opts) {
                return { status: "PASSED", diagnostic: null, log: "ok", durationMs: 5 };
            }
        };
    const manager = new CodeGenSessionManager({
        rootDir: process.cwd(),
        tempDir,
        spawnFn,
        runner
    });
    manager._child = () => child;
    return manager;
}

// ---------- slugify / defaultFileName ----------
assert.equal(slugify("https://example.com/login"), "example.com-login");
assert.equal(defaultFileName("https://example.com/login"), "example.com-login-recording.spec.js");

// ---------- Start: spawn codegen, one session at a time ----------
{
    const m = buildManager();
    const started = await m.start({ url: "https://example.com/login" });
    assert.equal(started.status, "RECORDING");
    assert.equal(m._child().args[0], "codegen");
    assert.ok(m._child().args.includes("-o"));
    assert.ok(m._child().args.includes("https://example.com/login"));

    // Start thứ hai khi đang ghi phải bị chặn.
    await assert.rejects(() => m.start({ url: "https://other.com" }), /đang ghi/);

    // Start thiếu URL bị chặn.
    await assert.rejects(() => m.start({ url: "" }), /URL/);

    await m.dispose();
    fs.rmSync(m.tempDir, { recursive: true, force: true });
}

// ---------- Stop: kết thúc process và trả script từ file tạm ----------
{
    const m = buildManager();
    await m.start({ url: "https://example.com" });
    const recFile = m.session.recordingFile;
    fs.writeFileSync(recFile, "const { test } = require('@playwright/test');\n", "utf8");

    const stopped = await m.stop({ timeoutMs: 300 });
    assert.equal(stopped.status, "STOPPED");
    assert.equal(m._child().killed, true);
    assert.match(stopped.script, /@playwright\/test/);
    assert.equal(stopped.defaultFileName, "example.com-recording.spec.js");

    // Stop khi không có phiên đang ghi phải báo lỗi.
    await assert.rejects(() => m.stop(), /phiên CodeGen/);

    await m.dispose();
    fs.rmSync(m.tempDir, { recursive: true, force: true });
}

// ---------- Save script ----------
{
    const m = buildManager();
    const saved = await m.saveScript({
        script: "console.log('hello');",
        fileName: "my script!.js"
    });
    assert.equal(saved.fileName, "my-script-.spec.js");
    assert.equal(fs.readFileSync(saved.absPath, "utf8"), "console.log('hello');");

    await assert.rejects(() => m.saveScript({ script: "" }), /Không có nội dung/);
    await m.dispose();
    fs.rmSync(m.tempDir, { recursive: true, force: true });
}

// ---------- Run: trả PASS/FAIL ----------
{
    const m = buildManager({
        fakeRunner: {
            async runFile() {
                return { status: "PASSED", diagnostic: null, log: "ok", durationMs: 5 };
            }
        }
    });
    const result = await m.run({ script: "test('x', () => {});" });
    assert.equal(result.passed, true);
    assert.equal(result.status, "PASSED");
    await m.dispose();
    fs.rmSync(m.tempDir, { recursive: true, force: true });
}

// ---------- Run: FAIL + output rút gọn ----------
{
    const m = buildManager({
        fakeRunner: {
            async runFile() {
                return { status: "FAILED", diagnostic: "locator not found", log: "x".repeat(5000), durationMs: 5 };
            }
        }
    });
    const result = await m.run({ script: "test('x', () => { throw new Error('boom') });" });
    assert.equal(result.passed, false);
    assert.equal(result.status, "FAILED");
    assert.ok(result.output.length < 5000, "output phải được rút gọn");
    await m.dispose();
    fs.rmSync(m.tempDir, { recursive: true, force: true });
}

// ---------- Cleanup khi lỗi: dispose kill process + xoá file tạm ----------
{
    const m = buildManager();
    await m.start({ url: "https://example.com" });
    fs.writeFileSync(m.session.recordingFile, "// temp", "utf8");
    const status = await m.dispose();
    assert.equal(status.status, "IDLE");
    assert.equal(fs.existsSync(m.tempDir), false);
}

console.log("CodeGen Session Manager test: PASS");
