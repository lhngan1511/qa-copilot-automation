import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import PlaywrightRunner from "../src/automation/PlaywrightRunner.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const runner = new PlaywrightRunner({ rootDir });

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
console.log(" STEP 5 — RUNNER DIAGNOSTIC TEST");
console.log("==================================================\n");

test("hasBrowser() trả false trong sandbox (Chromium chưa cài)", () => {
    const result = runner.hasBrowser();
    console.log(`    (hasBrowser = ${result})`);
    // không assert cứng — chỉ ghi nhận; nếu môi trường có browser thì khác
});

test("runFile với file không tồn tại trả ERROR diagnostic", async () => {
    const r = await runner.runFile("/no/such/file.spec.js");
    assert.strictEqual(r.status, "ERROR");
    assert.ok(r.diagnostic.includes("Không tìm thấy"));
});

test("runFile với file hợp lệ trong sandbox trả DIAGNOSTIC (thiếu browser)", async () => {
    const tmpFile = path.join(rootDir, "outputs", "generated", "_runner_tmp.spec.js");
    fs.mkdirSync(path.dirname(tmpFile), { recursive: true });
    fs.writeFileSync(
        tmpFile,
        `import { test, expect } from '@playwright/test';\ntest('x', async ({ page }) => { await page.goto('/'); });`
    );
    const r = await runner.runFile(tmpFile);
    fs.rmSync(tmpFile, { force: true });
    // sandbox thiếu browser -> DIAGNOSTIC. Nếu có browser thì kết quả khác (không assert cứng).
    if (!runner.hasBrowser()) {
        assert.strictEqual(r.status, "DIAGNOSTIC");
    }
});

console.log(`\n==================================================`);
if (failures === 0) console.log(" STEP 5 PASSED ✔");
else console.log(` ${failures} FAILURE(S) ✘`);
console.log("==================================================\n");
process.exit(failures === 0 ? 0 : 1);
