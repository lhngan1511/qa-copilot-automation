import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { EventEmitter } from "node:events";
import PlaywrightRunner from "../src/automation/PlaywrightRunner.js";

/* P0 WINDOWS — Runner spawn bằng process.execPath + CLI JS (không .cmd), shell:false,
   bắt đủ spawn/error/close, spawn lỗi không làm server chết. */

function fakeChild({ onError = null, exitCode = 0 } = {}) {
    const child = new EventEmitter();
    child.pid = 4242;
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    if (onError) child.on("error", onError);
    // Mặc định spawn thành công.
    setTimeout(() => child.emit("spawn"), 0);
    setTimeout(() => child.emit("close", exitCode), 5);
    return child;
}

function makeSpec(rootDir) {
    const specDir = path.join(rootDir, "outputs", "generated-tests");
    fs.mkdirSync(specDir, { recursive: true });
    fs.writeFileSync(path.join(specDir, "TC001.spec.js"), "test();\n");
}

async function main() {
    // 1. cliPath trỏ tới CLI JS thật (.js), không phải .cmd.
    const runner = new PlaywrightRunner({ rootDir: process.cwd() });
    const cli = runner.cliPath();
    assert.ok(cli.endsWith(".js"), `cliPath phải là .js: ${cli}`);
    assert.ok(!cli.toLowerCase().includes(".cmd"), "không được trỏ .cmd");

    // 2. Spawn dùng process.execPath + [cliPath, ...args], shell:false.
    let spawnRecord = null;
    const spawnFn = (bin, args, opts) => {
        spawnRecord = { bin, args, opts };
        return fakeChild({ exitCode: 0 });
    };
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "win-"));
    makeSpec(tempRoot);
    const r2 = new PlaywrightRunner({ rootDir: tempRoot, headed: true, browserChannel: "chrome", spawnFn });
    const res = await r2.runFile("outputs/generated-tests/TC001.spec.js", { env: { BASE_URL: "http://x:1" }, testCaseId: "TC001" });
    assert.ok(spawnRecord, "phải spawn");
    assert.equal(spawnRecord.bin, process.execPath, `bin phải là node.exe: ${spawnRecord.bin}`);
    assert.equal(spawnRecord.args[0], r2.cliPath(), "args[0] là cliPath");
    assert.ok(spawnRecord.args.includes("test"));
    assert.ok(spawnRecord.opts.shell === undefined || spawnRecord.opts.shell === false, "shell:false (hoặc không bật)");
    assert.equal(spawnRecord.opts.windowsHide, false, "windowsHide:false để browser hiện");
    // env cho child có PLAYWRIGHT_HEADLESS=false + SLOW_MO
    assert.equal(spawnRecord.opts.env.PLAYWRIGHT_HEADLESS, "false", "headed -> PLAYWRIGHT_HEADLESS=false");
    assert.equal(spawnRecord.opts.env.PLAYWRIGHT_SLOW_MO, "500");
    // PASS từ exitCode 0
    assert.equal(res.status, "PASSED");
    assert.equal(res.passed, true);

    // 3. Spawn error -> SPAWN_FAILED, không làm server chết (promise resolve, không throw).
    const spawnErr = new Error("spawn EINVAL");
    spawnErr.code = "EINVAL";
    const spawnFnErr = (bin, args, opts) => {
        const child = fakeChild();
        process.nextTick(() => child.emit("error", spawnErr));
        return child;
    };
    const r3 = new PlaywrightRunner({ rootDir: tempRoot, headed: true, browserChannel: "chrome", spawnFn: spawnFnErr });
    let caught = false;
    let res3 = null;
    try {
        res3 = await r3.runFile("outputs/generated-tests/TC001.spec.js", { env: { BASE_URL: "http://x:1" }, testCaseId: "TC001" });
    } catch {
        caught = true;
    }
    assert.equal(caught, false, "spawn lỗi KHÔNG được ném (server không chết)");
    assert.equal(res3.errorCode, "SPAWN_FAILED");
    assert.ok(res3.errorMessage && res3.errorMessage.length > 0, "có errorMessage");
    // Server vẫn sống: thực hiện thêm 1 lần run bình thường.
    const r4 = new PlaywrightRunner({ rootDir: tempRoot, headed: true, browserChannel: "chrome", spawnFn });
    const res4 = await r4.runFile("outputs/generated-tests/TC001.spec.js", { env: { BASE_URL: "http://x:1" } });
    assert.equal(res4.status, "PASSED");

    // 4. Nguồn: có listener spawn/error/close, spawn bởi process.execPath, không shell:true.
    const src = fs.readFileSync("src/automation/PlaywrightRunner.js", "utf8");
    assert.ok(src.includes('child.on("spawn"'), "có error/spawn listener");
    assert.ok(src.includes('child.on("error"'), "có error listener");
    assert.ok(src.includes('child.on("close"'), "có close listener");
    assert.ok(!/shell:\s*true/.test(src.replace(/\/\/[^\n]*/g, "")), "không shell:true");
    assert.ok(/this\.spawnFn\(process\.execPath, \[cliPath, \.\.\.args\]/.test(src), "spawn bằng process.execPath + cliPath");
    assert.ok(src.includes("RUN_START"), "log RUN_START");
    assert.ok(src.includes("RUN_SPAWNED"), "log RUN_SPAWNED (pid)");
    assert.ok(src.includes("RUN_END"), "log RUN_END");

    fs.rmSync(tempRoot, { recursive: true, force: true });
    console.log("Automation Windows Spawn test: PASS");
}

main().catch(e => { console.error(e); process.exit(1); });
