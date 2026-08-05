import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { EventEmitter } from "node:events";
import CodeGenSessionManager from "../src/codegen/CodeGenSessionManager.js";
import CodeGenRecordingStore from "../src/codegen/CodeGenRecordingStore.js";
import ApprovedTestcaseLoader from "../src/codegen/ApprovedTestcaseLoader.js";

let fakePidCounter = 1000;
function fakeChild() {
    const child = new EventEmitter();
    child.pid = fakePidCounter++;
    child.kill = () => {
        child.killed = true;
        process.nextTick(() => {
            child.emit("exit", 0);
            child.emit("close", 0);
        });
        return true;
    };
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    return child;
}

function buildManager({ fakeRunner = null, seedMetadata = null, execPath = process.execPath, playwrightCliPath = null, spawnThrow = null, focusFn = null } = {}) {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "codegen-test-"));
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "codegen-data-"));
    const metadataFile = path.join(dataDir, "codegen-recordings.json");
    const scriptsDir = path.join(dataDir, "codegen-scripts");
    let child = null;
    let lastSpawn = null;
    const spawnFn = (bin, args) => {
        lastSpawn = { bin, args };
        if (spawnThrow) throw spawnThrow;
        child = fakeChild();
        child.args = args;
        child.command = bin;
        return child;
    };
    const store = new CodeGenRecordingStore({ metadataFile, scriptsDir });
    if (seedMetadata) {
        store.recordings = seedMetadata;
        store.persist();
    }
    const runner =
        fakeRunner ??
        (() => {
            let runCount = 0;
            return {
                async runFile() {
                    runCount += 1;
                    return { status: runCount === 1 ? "PASSED" : "FAILED", diagnostic: runCount === 1 ? null : "boom", log: "ok", durationMs: 5, resultsFile: null };
                }
            };
        })();
    const manager = new CodeGenSessionManager({ rootDir: process.cwd(), tempDir, store, runner, spawnFn, execPath, playwrightCliPath, focusFn });
    manager._child = () => child;
    manager._store = () => store;
    manager._dataDir = () => dataDir;
    manager._lastSpawn = () => lastSpawn;
    return manager;
}

// ---------- Store: create / update / list / remove / server script ----------
{
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cg-store-"));
    const store = new CodeGenRecordingStore({ metadataFile: path.join(dir, "meta.json"), scriptsDir: path.join(dir, "scripts") });
    const rec = store.create({ mode: "FULL_FLOW", url: "https://example.com", browser: "chrome" });
    assert.ok(rec.recordingId);
    assert.equal(rec.mode, "FULL_FLOW");
    assert.equal(rec.status, "RECORDING");
    assert.equal(rec.storageMode, "TEMP");
    assert.match(rec.downloadFileName, /example\.com-recording\.spec\.js/);
    assert.deepEqual(rec.testcaseIds, []);
    assert.equal(rec.hasScript, false);

    store.update(rec.recordingId, { scriptContent: "test('x',()=>{});", status: "STOPPED" });
    assert.equal(store.get(rec.recordingId).hasScript, true);

    const saved = store.writeServerScript(rec.recordingId, "test('x',()=>{});", "custom.spec.js");
    assert.equal(saved.fileName, "custom.spec.js");
    assert.equal(fs.existsSync(saved.absPath), true);
    store.update(rec.recordingId, { serverFilePath: saved.fileName });

    // Script server chỉ nằm trong scriptsDir, không đụng approved-testcases.
    assert.ok(!path.dirname(saved.absPath).includes("approved"));

    store.remove(rec.recordingId);
    assert.equal(store.get(rec.recordingId), null);
    assert.equal(fs.existsSync(saved.absPath), false, "server script phải bị xoá khi delete recording");
    fs.rmSync(dir, { recursive: true, force: true });
}

// ---------- Manager: start -> một session, chặn session thứ hai ----------
{
    const m = buildManager();
    const rec = await m.start({ url: "https://example.com/login", browser: "chrome", mode: "FULL_FLOW" });
    assert.equal(rec.status, "RECORDING");
    // spawn dùng process.execPath + Playwright CLI .js (không spawn .cmd trực tiếp)
    const spawn = m._lastSpawn();
    assert.equal(spawn.bin, process.execPath);
    assert.equal(spawn.args[0], m.resolvePlaywrightCli());
    assert.equal(spawn.args[1], "codegen");
    assert.ok(spawn.args.includes("https://example.com/login"));
    assert.ok(spawn.args.includes("-o"));
    assert.ok(spawn.args.includes("--browser"));
    assert.ok(spawn.args.includes("chromium"));
    // chrome -> --channel chrome
    assert.ok(spawn.args.includes("--channel"));
    assert.ok(spawn.args.includes("chrome"));
    // có PID
    assert.ok(m._child().pid > 0);

    // edge -> msedge
    const mEdge = buildManager();
    await mEdge.start({ url: "https://example.com", browser: "edge", mode: "FULL_FLOW" });
    assert.ok(mEdge._lastSpawn().args.includes("msedge"));
    await mEdge.dispose();
    fs.rmSync(mEdge._store().metadataFile && path.dirname(mEdge._store().metadataFile), { recursive: true, force: true });
    fs.rmSync(mEdge.tempDir, { recursive: true, force: true });

    await assert.rejects(() => m.start({ url: "https://other.com" }), /đang ghi/);
    await assert.rejects(() => m.start({ url: "" }), /URL/);
    await assert.rejects(() => m.start({ url: "https://x.com", browser: "safari" }), /Browser/);

    await m.dispose();
    fs.rmSync(m._store().metadataFile && path.dirname(m._store().metadataFile), { recursive: true, force: true });
    fs.rmSync(m.tempDir, { recursive: true, force: true });
}

// ---------- spawn lỗi (EINVAL) -> trả lỗi rõ, không im lặng ----------
{
    const einval = Object.assign(new Error("spawn EINVAL"), { code: "EINVAL", errno: "EINVAL", syscall: "spawn" });
    const m = buildManager({ spawnThrow: einval });
    let thrown = null;
    try {
        await m.start({ url: "https://example.com", browser: "chrome", mode: "FULL_FLOW" });
    } catch (error) {
        thrown = error;
    }
    assert.ok(thrown, "spawn lỗi phải ném ra");
    assert.equal(thrown.code, "CODE_GEN_SPAWN_FAILED");
    assert.match(thrown.message, /EINVAL/);
    // recording phải chuyển sang ERROR trong store
    const storeRec = m._store().recordings[0];
    assert.equal(storeRec.status, "ERROR");
    fs.rmSync(m._store().metadataFile && path.dirname(m._store().metadataFile), { recursive: true, force: true });
    fs.rmSync(m.tempDir, { recursive: true, force: true });
}

// ---------- Stop: cơ chế thủ công - dừng process, KHÔNG tự capture file ----------
{
    const m = buildManager();
    const rec = await m.start({ url: "https://example.com", browser: "edge", mode: "TESTCASE_SEGMENT" });
    const recordingId = rec.recordingId;
    // Không cần output file: stop chỉ dừng process + cập nhật trạng thái.
    const stopped = await m.stop({ timeoutMs: 200 });
    assert.equal(stopped.status, "STOPPED");
    assert.equal(m._child().killed, true);
    assert.equal(stopped.recordingId, recordingId);
    assert.equal(m._store().get(recordingId).status, "STOPPED");

    await assert.rejects(() => m.stop(), /đang ghi/);
    fs.rmSync(m._store().metadataFile && path.dirname(m._store().metadataFile), { recursive: true, force: true });
    fs.rmSync(m.tempDir, { recursive: true, force: true });
}

// ---------- setScript (paste thủ công): lưu vào scriptContent, reload giữ script ----------
{
    const m = buildManager();
    const rec = await m.start({ url: "https://example.com", browser: "chrome", mode: "FULL_FLOW" });
    const id = rec.recordingId;
    await m.stop({ timeoutMs: 200 });

    const pasted = "const { test } = require('@playwright/test');\ntest('demo', async ({ page }) => { await page.click('#x'); });";
    const saved = m.setScript(id, { script: pasted });
    assert.equal(saved.recordingId, id);
    assert.ok(saved.scriptLength > 0, "scriptLength phải > 0 sau khi dán");
    assert.match(saved.scriptContent, /page\.click/);
    assert.equal(m._store().get(id).status, "SAVED");

    // reload recording giữ script
    assert.match(m.get(id).scriptContent, /page\.click/);

    // xoá nội dung
    const cleared = m.setScript(id, { script: "" });
    assert.equal(cleared.scriptLength, 0);
    assert.equal(m._store().get(id).status, "STOPPED");

    fs.rmSync(m._store().metadataFile && path.dirname(m._store().metadataFile), { recursive: true, force: true });
    fs.rmSync(m.tempDir, { recursive: true, force: true });
}

// ---------- Link testcase: FULL_FLOW 0..n, TESTCASE_SEGMENT >=1 ----------
{
    const m = buildManager();
    const rec = await m.start({ url: "https://example.com", browser: "chrome", mode: "TESTCASE_SEGMENT" });
    const id = rec.recordingId;
    fs.writeFileSync(path.join(m.tempDir, "recordings", `${id}.js`), "test('x',()=>{});", "utf8");
    await m.stop({ timeoutMs: 300 });
    m.setContext(id, { context: { module: "Đăng nhập", feature: "Đăng nhập" } });

    // TESTCASE_SEGMENT không gắn testcase -> lỗi
    assert.throws(() => m.linkTestcases(id, { testcaseIds: [] }), /TESTCASE_SEGMENT/);

    const linked = m.linkTestcases(id, { testcaseIds: ["TC001", "TC002"] });
    assert.deepEqual(linked.testcaseIds, ["TC001", "TC002"]);

    // FULL_FLOW link 0 testcase OK (cần context)
    const m2 = buildManager();
    const rec2 = await m2.start({ url: "https://example.com", browser: "chrome", mode: "FULL_FLOW" });
    const id2 = rec2.recordingId;
    fs.writeFileSync(path.join(m2.tempDir, "recordings", `${id2}.js`), "test('x',()=>{});", "utf8");
    await m2.stop({ timeoutMs: 300 });
    m2.setContext(id2, { context: { module: "Thiết bị", feature: "Thiết bị" } });
    const linked0 = m2.linkTestcases(id2, { testcaseIds: [] });
    assert.deepEqual(linked0.testcaseIds, []);

    fs.rmSync(m._store().metadataFile && path.dirname(m._store().metadataFile), { recursive: true, force: true });
    fs.rmSync(m.tempDir, { recursive: true, force: true });
    fs.rmSync(m2._store().metadataFile && path.dirname(m2._store().metadataFile), { recursive: true, force: true });
    fs.rmSync(m2.tempDir, { recursive: true, force: true });
}

// ---------- Save to workspace: storageMode SERVER + serverFilePath; Open Folder ----------
{
    const m = buildManager();
    const rec = await m.start({ url: "https://example.com", browser: "chrome", mode: "FULL_FLOW" });
    const id = rec.recordingId;
    await m.stop({ timeoutMs: 300 });
    m.setScript(id, { script: "test('x',()=>{});" });

    // Open folder trước khi lưu server -> lỗi
    assert.throws(() => m.openFolder(id), /server/i);

    const saved = m.saveToWorkspace(id, { fileName: "login-flow.spec.js" });
    assert.equal(saved.storageMode, "SERVER");
    assert.equal(saved.serverFilePath, "login-flow.spec.js");
    assert.equal(fs.existsSync(path.join(m._store().scriptsDir, "login-flow.spec.js")), true);

    const folder = m.openFolder(id);
    assert.equal(folder.serverFilePath, "login-flow.spec.js");

    fs.rmSync(m._store().metadataFile && path.dirname(m._store().metadataFile), { recursive: true, force: true });
    fs.rmSync(m.tempDir, { recursive: true, force: true });
}

// ---------- Run trả PASS/FAIL + cập nhật lastRunResult ----------
{
    let runCount = 0;
    const m = buildManager({
        fakeRunner: {
            async runFile() {
                runCount += 1;
                return { status: runCount === 1 ? "PASSED" : "FAILED", diagnostic: runCount === 1 ? null : "boom", log: "ok", durationMs: 5, resultsFile: null };
            }
        }
    });
    const rec = await m.start({ url: "https://example.com", browser: "chrome", mode: "FULL_FLOW" });
    const id = rec.recordingId;
    await m.stop({ timeoutMs: 300 });
    m.setScript(id, { script: "test('x',()=>{});" });

    const r1 = await m.run(id);
    assert.equal(r1.passed, true);
    assert.equal(r1.status, "PASSED");
    const r2 = await m.run(id);
    assert.equal(r2.passed, false);
    assert.equal(r2.status, "FAILED");

    const after = m.get(id);
    assert.equal(after.lastRunResult.status, "FAILED");

    fs.rmSync(m._store().metadataFile && path.dirname(m._store().metadataFile), { recursive: true, force: true });
    fs.rmSync(m.tempDir, { recursive: true, force: true });
}

// ---------- Rename / Delete ----------
{
    const m = buildManager();
    const rec = await m.start({ url: "https://example.com", browser: "chrome", mode: "FULL_FLOW" });
    const id = rec.recordingId;
    fs.writeFileSync(path.join(m.tempDir, "recordings", `${id}.js`), "test('x',()=>{});", "utf8");
    await m.stop({ timeoutMs: 300 });

    const renamed = m.rename(id, { fileName: "flow a!.spec.js" });
    assert.equal(renamed.downloadFileName, "flow-a-.spec.js");

    m.delete(id);
    assert.equal(m.get(id), null);
    fs.rmSync(m._store().metadataFile && path.dirname(m._store().metadataFile), { recursive: true, force: true });
    fs.rmSync(m.tempDir, { recursive: true, force: true });
}

// ---------- Run dùng trực tiếp script override (textarea), không cần lưu trước ----------
{
    let receivedPath = null;
    const m = buildManager({
        fakeRunner: {
            async runFile(filePath) {
                receivedPath = filePath;
                return { status: "PASSED", diagnostic: null, log: "ok", durationMs: 5, resultsFile: null, diag: { commandArgs: ["test", filePath], command: "playwright" } };
            }
        }
    });
    const rec = await m.start({ url: "https://example.com", browser: "chrome", mode: "FULL_FLOW" });
    const id = rec.recordingId;
    await m.stop({ timeoutMs: 200 });
    // KHÔNG gọi setScript trước — run dùng script override trực tiếp.
    const script = "test('paste', async ({page})=>{ await page.click('#x'); });";
    const result = await m.run(id, { script });
    assert.equal(result.passed, true);
    // BUG 1: runner phải nhận FILE PATH (đuôi .spec.js), không nhận raw script.
    assert.ok(receivedPath && /\.spec\.js$/.test(receivedPath), `runner nhận file path, got: ${receivedPath}`);
    assert.notEqual(receivedPath, script, "không truyền raw script làm test filter");
    // temp file thực sự tồn tại trong outputs/generated-tests (testDir)
    assert.ok(receivedPath, "có tempFilePath");
    assert.equal(result.status, "PASSED");
    const generatedDir = path.join(process.cwd(), "outputs", "generated-tests");
    assert.ok(fs.existsSync(generatedDir), "tạo được thư mục outputs/generated-tests");
    fs.rmSync(m._store().metadataFile && path.dirname(m._store().metadataFile), { recursive: true, force: true });
    fs.rmSync(m.tempDir, { recursive: true, force: true });
    fs.rmSync(generatedDir, { recursive: true, force: true });
}

// ---------- Link testcase là metadata thuần; reload giữ liên kết; không đụng approved-testcases ----------
{
    const m = buildManager();
    const rec = await m.start({ url: "https://example.com", browser: "chrome", mode: "FULL_FLOW" });
    const id = rec.recordingId;
    await m.stop({ timeoutMs: 200 });
    m.setScript(id, { script: "test('x',()=>{});" });

    const before = m.get(id);
    assert.deepEqual(before.testcaseIds, []);
    // BUG 2: không context -> link bị chặn
    assert.throws(() => m.linkTestcases(id, { testcaseIds: ["TC001"] }), /context|duyệt/i);
    // Gán context từ AI Test Design (module Đăng nhập)
    m.setContext(id, { context: { module: "Đăng nhập", feature: "Đăng nhập", artifactId: "ART-1" } });
    assert.equal(m.hasReliableContext(id), true);
    // Link không đổi nội dung script
    const linked = m.linkTestcases(id, { testcaseIds: ["TC001", "TC002", "TC005"] });
    assert.deepEqual(linked.testcaseIds, ["TC001", "TC002", "TC005"]);
    assert.match(m.get(id).scriptContent, /test\('x'/);

    // Reload (recreate manager với cùng store metadata file) giữ liên kết
    const metadataFile = m._store().metadataFile;
    const scriptsDir = m._store().scriptsDir;
    const store2 = new CodeGenRecordingStore({ metadataFile, scriptsDir });
    const m2 = new CodeGenSessionManager({ rootDir: process.cwd(), tempDir: m.tempDir, store: store2, spawnFn: m.spawnFn });
    assert.deepEqual(m2.get(id).testcaseIds, ["TC001", "TC002", "TC005"]);
    // approved-testcases.json không bị sửa — loader chỉ đọc; không có file nào trong dataDir tên approved
    const approvedFiles = fs.readdirSync(path.dirname(metadataFile)).filter(f => f.includes("approved"));
    assert.deepEqual(approvedFiles, []);

    fs.rmSync(path.dirname(metadataFile), { recursive: true, force: true });
    fs.rmSync(m.tempDir, { recursive: true, force: true });
}
{
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cg-loader-"));
    fs.mkdirSync(path.join(dir, "outputs", "production", "json"), { recursive: true });
    fs.writeFileSync(
        path.join(dir, "outputs", "production", "json", "approved-testcases.json"),
        JSON.stringify([
            { testcaseId: "TC001", title: "Thêm thiết bị", module: "Thiết bị", type: "POSITIVE", status: "APPROVED" },
            { testcaseId: "TC002", title: "Sửa thiết bị", module: "Thiết bị", type: "VALIDATION", status: "APPROVED" }
        ]),
        "utf8"
    );
    const loader = new ApprovedTestcaseLoader({ searchRoot: dir });
    const cases = loader.loadAll();
    assert.equal(cases.length, 2);
    assert.deepEqual(cases.map(c => c.id), ["TC001", "TC002"]);
    fs.rmSync(dir, { recursive: true, force: true });
}

// ---------- Session info + focus (non-win32) + INTERRUPTED when browser closes early ----------
{
    const m = buildManager();
    const rec = await m.start({ url: "https://example.com", browser: "chrome", mode: "FULL_FLOW" });
    const info = m.getSessionInfo();
    assert.equal(info.status, "RECORDING");
    assert.ok(info.pid > 0, "phải có PID");
    assert.equal(info.url, "https://example.com");
    assert.equal(info.browser, "chrome");
    assert.equal(info.processAlive, true);

    // focus trên nền tảng không phải win32 -> focused:false, không crash
    const focus = await m.focusBrowserWindow();
    assert.equal(focus.focused, false);
    assert.equal(focus.supported, false);

    // mô phỏng browser đóng ngay (exit không script) -> INTERRUPTED
    await m.disposeSession();
    const rec2 = await m.start({ url: "https://example.com/x", browser: "chrome", mode: "FULL_FLOW" });
    assert.equal(rec2.status, "RECORDING");
    m._child().emit("exit", 0);
    await new Promise(r => setTimeout(r, 20));
    const after = m.getSessionInfo();
    assert.equal(after.status, "INTERRUPTED");
    const rec2Store = m._store().get(rec2.recordingId);
    assert.equal(rec2Store.status, "INTERRUPTED");

    fs.rmSync(m._store().metadataFile && path.dirname(m._store().metadataFile), { recursive: true, force: true });
    fs.rmSync(m.tempDir, { recursive: true, force: true });
}

// ---------- focus khi win32: dùng focusFn inject ----------
{
    const m = buildManager({
        focusFn: async ({ session }) => ({ attempted: true, focused: session?.pid ? true : false, supported: true, message: "FOCUSED", pid: session?.pid })
    });
    const rec = await m.start({ url: "https://example.com", browser: "chrome", mode: "FULL_FLOW" });
    // ép nền tảng win32 để chạy nhánh focusFn
    m.platform = "win32";
    const focus = await m.focusBrowserWindow();
    assert.equal(focus.focused, true);
    assert.equal(focus.supported, true);
    fs.rmSync(m._store().metadataFile && path.dirname(m._store().metadataFile), { recursive: true, force: true });
    fs.rmSync(m.tempDir, { recursive: true, force: true });
}

console.log("CodeGen Session Manager (recording-centric) test: PASS");
