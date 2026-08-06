import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import PlaywrightRunner from "../src/automation/PlaywrightRunner.js";
import { ERROR_CODES } from "../src/automation/diagnose.js";

/* P0 — Runner không hardcode --project=chromium; chỉ thêm khi project thực sự tồn tại. */

function writeConfig(dir, projectsBlock) {
    fs.mkdirSync(dir, { recursive: true });
    const cfg = `import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./outputs/generated-tests",
  use: { headless: false, launchOptions: { slowMo: 500 } },
  ${projectsBlock}
});`;
    fs.writeFileSync(path.join(dir, "playwright.config.js"), cfg, "utf8");
}

// 1. Config KHÔNG khai báo projects -> không thêm --project.
{
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pr-none-"));
    writeConfig(dir, "");
    const runner = new PlaywrightRunner({ rootDir: dir });
    const proj = runner.resolveProject();
    assert.equal(proj.present, true);
    assert.equal(proj.name, null, "không có projects -> name null");
    const args = runner.buildArgs({ filePath: "TC001.spec.js" });
    assert.ok(!args.some(a => a.startsWith("--project=")), `không được có --project: ${args.join(" ")}`);
    assert.ok(args.includes("--browser=chromium"), "không projects -> dùng --browser=chromium");
    fs.rmSync(dir, { recursive: true, force: true });
}

// 2. Config khai báo project chromium -> mới thêm --project=chromium (không --browser).
{
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pr-chr-"));
    writeConfig(dir, 'projects: [ { name: "chromium", use: {} } ]');
    const runner = new PlaywrightRunner({ rootDir: dir });
    const proj = runner.resolveProject();
    assert.equal(proj.present, true);
    assert.equal(proj.name, "chromium");
    const args = runner.buildArgs({ filePath: "TC001.spec.js" });
    assert.ok(args.includes("--project=chromium"), `phải có --project=chromium: ${args.join(" ")}`);
    assert.ok(!args.includes("--browser=chromium"), "có project -> không dùng --browser");
    fs.rmSync(dir, { recursive: true, force: true });
}

// 3. Config khai báo projects nhưng KHÔNG có chromium -> present=false.
{
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pr-fire-"));
    writeConfig(dir, 'projects: [ { name: "firefox", use: {} } ]');
    const runner = new PlaywrightRunner({ rootDir: dir });
    const proj = runner.resolveProject();
    assert.equal(proj.present, false);
    assert.deepEqual(proj.available, ["firefox"]);
    fs.rmSync(dir, { recursive: true, force: true });
}

// 4. runFile: project không tồn tại -> PLAYWRIGHT_PROJECT_NOT_FOUND (không treo RUNNING).
async function testProjectNotFound() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pr-run-"));
    writeConfig(dir, 'projects: [ { name: "firefox", use: {} } ]');
    const specDir = path.join(dir, "outputs", "generated-tests");
    fs.mkdirSync(specDir, { recursive: true });
    fs.writeFileSync(path.join(specDir, "TC001.spec.js"), "test();\n");
    const runner = new PlaywrightRunner({ rootDir: dir, browserChannel: "chrome" });
    const res = await runner.runFile("outputs/generated-tests/TC001.spec.js", { env: { BASE_URL: "http://x:1" }, testCaseId: "TC001" });
    assert.equal(res.errorCode, ERROR_CODES.PLAYWRIGHT_PROJECT_NOT_FOUND, `phải PLAYWRIGHT_PROJECT_NOT_FOUND: ${res.errorCode}`);
    assert.ok(res.errorMessage.includes("firefox"), "message phải liệt kê project có sẵn");
    assert.equal(res.status === "RUNNING", false, "không treo ở RUNNING");
    fs.rmSync(dir, { recursive: true, force: true });
}
await testProjectNotFound();

// 5. Command/args được log (buildArgs chứa --headed + đúng project).
{
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pr-log-"));
    writeConfig(dir, 'projects: [ { name: "chromium", use: {} } ]');
    const runner = new PlaywrightRunner({ rootDir: dir, headed: true });
    const args = runner.buildArgs({ filePath: "TC001.spec.js" });
    assert.ok(args.includes("--headed"));
    assert.ok(args.includes("--project=chromium"));
    fs.rmSync(dir, { recursive: true, force: true });
}

console.log("Automation Project Resolve test: PASS");
