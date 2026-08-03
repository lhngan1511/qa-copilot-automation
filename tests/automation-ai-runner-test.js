import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import PlaywrightRunner from "../src/automation/PlaywrightRunner.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

let failures = 0;
function test(name, fn) {
    try {
        fn();
        console.log(`  ✔ ${name}`);
    } catch (e) {
        failures++;
        console.error(`  ✘ ${name}`);
        console.error(`    ${e.message}`);
    }
}

console.log("\n==================================================");
console.log(" STEP 5 — RUNNER BROWSER CHANNEL TEST");
console.log("==================================================\n");

test("chrome channel: bỏ qua bundled Chromium check (resolveBrowser ok)", () => {
    const r = new PlaywrightRunner({ rootDir, browserChannel: "chrome" });
    const b = r.resolveBrowser();
    assert.strictEqual(b.ok, true);
    assert.strictEqual(b.channel, "chrome");
    assert.strictEqual(b.diagnostic, null);
});

test("msedge channel: resolveBrowser ok với channel msedge", () => {
    const r = new PlaywrightRunner({ rootDir, browserChannel: "msedge" });
    const b = r.resolveBrowser();
    assert.strictEqual(b.ok, true);
    assert.strictEqual(b.channel, "msedge");
});

test("bundled Chromium vẫn là fallback khi không cấu hình channel", () => {
    const r = new PlaywrightRunner({ rootDir, browserChannel: null });
    const b = r.resolveBrowser();
    // Nếu sandbox không có bundled -> not ok + diagnostic BUNDLED_CHROMIUM_NOT_INSTALLED.
    // Nếu có bundled -> ok, channel null. Chỉ assert diagnostic chứa cụm khi không có browser.
    if (!b.ok) {
        assert.ok(b.diagnostic.includes("BUNDLED_CHROMIUM_NOT_INSTALLED"), b.diagnostic);
    }
});

test("channel không hợp lệ trả diagnostic", () => {
    const r = new PlaywrightRunner({ rootDir, browserChannel: "firefox-xyz" });
    const b = r.resolveBrowser();
    assert.strictEqual(b.ok, false);
    assert.ok(b.diagnostic.includes("không hợp lệ"), b.diagnostic);
});

test("runFile với file không tồn tại trả ERROR diagnostic", async () => {
    const r = new PlaywrightRunner({ rootDir });
    const res = await r.runFile("/no/such/file.spec.js");
    assert.strictEqual(res.status, "ERROR");
    assert.ok(res.diagnostic.includes("Không tìm thấy"));
});

test("runFile chrome channel trong sandbox: không vướng bundled check (bỏ qua thiếu browser)", async () => {
    const tmpFile = path.join(rootDir, "outputs", "generated", "_runner_tmp.spec.js");
    fs.mkdirSync(path.dirname(tmpFile), { recursive: true });
    fs.writeFileSync(tmpFile, `import { test, expect } from '@playwright/test';\ntest('x', async ({ page }) => { await page.goto('/'); });`);
    const r = new PlaywrightRunner({ rootDir, browserChannel: "chrome" });
    const res = await r.runFile(tmpFile);
    fs.rmSync(tmpFile, { force: true });
    // Với chrome channel, resolveBrowser ok (bỏ qua bundled). Kết quả thực tế phụ thuộc Chrome hệ thống.
    // Trong sandbox không có Chrome hệ thống -> playwright lỗi executable -> DIAGNOSTIC SYSTEM_CHROME_NOT_FOUND (hoặc FAILED).
    // Chỉ assert không phải BUNDLED_CHROMIUM_NOT_INSTALLED ở diagnostic.
    assert.notStrictEqual(res.status, "ERROR");
    if (res.diagnostic) {
        assert.ok(!res.diagnostic.includes("BUNDLED_CHROMIUM_NOT_INSTALLED"), "chrome channel không báo thiếu bundled Chromium");
    }
});

console.log(`\n==================================================`);
if (failures === 0) console.log(" STEP 5 PASSED ✔");
else console.log(` ${failures} FAILURE(S) ✘`);
console.log("==================================================\n");
process.exit(failures === 0 ? 0 : 1);
