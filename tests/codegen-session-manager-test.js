import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { EventEmitter } from "node:events";
import CodeGenSessionManager from "../src/codegen/CodeGenSessionManager.js";
import CodeGenRecordingStore from "../src/codegen/CodeGenRecordingStore.js";
import ApprovedTestcaseLoader from "../src/codegen/ApprovedTestcaseLoader.js";

function fakeChild() {
    const child = new EventEmitter();
    child.kill = () => {
        child.killed = true;
        process.nextTick(() => child.emit("exit", 0));
        return true;
    };
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    return child;
}

function buildManager({ fakeRunner = null, seedMetadata = null } = {}) {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "codegen-test-"));
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "codegen-data-"));
    const metadataFile = path.join(dataDir, "codegen-recordings.json");
    const scriptsDir = path.join(dataDir, "codegen-scripts");
    let child = null;
    const spawnFn = (bin, args) => {
        child = fakeChild();
        child.args = args;
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
    const manager = new CodeGenSessionManager({ rootDir: process.cwd(), tempDir, store, runner, spawnFn });
    manager._child = () => child;
    manager._store = () => store;
    manager._dataDir = () => dataDir;
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
    assert.equal(m._child().args[0], "codegen");
    assert.ok(m._child().args.includes("--channel"));
    assert.ok(m._child().args.includes("chrome"));

    await assert.rejects(() => m.start({ url: "https://other.com" }), /đang ghi/);
    await assert.rejects(() => m.start({ url: "" }), /URL/);
    await assert.rejects(() => m.start({ url: "https://x.com", browser: "safari" }), /Browser/);

    await m.dispose();
    fs.rmSync(m._store().metadataFile && path.dirname(m._store().metadataFile), { recursive: true, force: true });
    fs.rmSync(m.tempDir, { recursive: true, force: true });
}

// ---------- Manager: stop lưu toàn bộ script ----------
{
    const m = buildManager();
    const rec = await m.start({ url: "https://example.com", browser: "edge", mode: "TESTCASE_SEGMENT" });
    const recordingId = rec.recordingId;
    fs.writeFileSync(path.join(m.tempDir, "recordings", `${recordingId}.js`), "const { test } = require('@playwright/test');\n", "utf8");
    const stopped = await m.stop({ timeoutMs: 300 });
    assert.equal(stopped.status, "STOPPED");
    assert.equal(m._child().killed, true);
    assert.match(stopped.scriptContent, /@playwright\/test/);

    await assert.rejects(() => m.stop(), /đang ghi/);
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

    // TESTCASE_SEGMENT không gắn testcase -> lỗi
    assert.throws(() => m.linkTestcases(id, { testcaseIds: [] }), /TESTCASE_SEGMENT/);

    const linked = m.linkTestcases(id, { testcaseIds: ["TC001", "TC002"] });
    assert.deepEqual(linked.testcaseIds, ["TC001", "TC002"]);

    // FULL_FLOW link 0 testcase OK
    const m2 = buildManager();
    const rec2 = await m2.start({ url: "https://example.com", browser: "chrome", mode: "FULL_FLOW" });
    const id2 = rec2.recordingId;
    fs.writeFileSync(path.join(m2.tempDir, "recordings", `${id2}.js`), "test('x',()=>{});", "utf8");
    await m2.stop({ timeoutMs: 300 });
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
    fs.writeFileSync(path.join(m.tempDir, "recordings", `${id}.js`), "test('x',()=>{});", "utf8");
    await m.stop({ timeoutMs: 300 });

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
    fs.writeFileSync(path.join(m.tempDir, "recordings", `${id}.js`), "test('x',()=>{});", "utf8");
    await m.stop({ timeoutMs: 300 });

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

// ---------- ApprovedTestcaseLoader: chỉ đọc approved-testcases.json ----------
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

console.log("CodeGen Session Manager (recording-centric) test: PASS");
