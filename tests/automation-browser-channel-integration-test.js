import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

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
console.log(" BROWSER CHANNEL INTEGRATION TEST (command thật)");
console.log("==================================================\n");

// Xác minh Playwright Test CLI KHÔNG hỗ trợ --channel (đã xác minh qua --help).
test("Playwright Test CLI không hỗ trợ option --channel", () => {
    const help = execFileSync(
        path.join(rootDir, "node_modules", ".bin", "playwright"),
        ["test", "--help"],
        { encoding: "utf8" }
    );
    assert.ok(!help.includes("--channel"), "CLI không được liệt kê --channel");
});

// Chạy command thật với channel chrome qua config (không truyền --channel).
// Dùng file trong generated-tests để đảm bảo testDir nhận test.
test("Chạy playwright test với PLAYWRIGHT_BROWSER_CHANNEL=chrome qua config (không lỗi CLI unknown option)", () => {
    const genDir = path.join(rootDir, "outputs", "generated-tests");
    fs.mkdirSync(genDir, { recursive: true });
    const spec = path.join(genDir, "TC002.spec.js");
    fs.writeFileSync(spec, `import { test } from '@playwright/test';\ntest('tc', async ({ page }) => { await page.setContent('<h1>x</h1>'); });\n`);
    const bin = path.join(rootDir, "node_modules", ".bin", "playwright");
    const res = spawnSync(
        bin,
        ["test", "--config", path.join(rootDir, "playwright.config.js"), "TC002.spec.js", "--reporter=line"],
        {
            cwd: rootDir,
            env: { ...process.env, PLAYWRIGHT_BROWSER_CHANNEL: "chrome" },
            encoding: "utf8",
            timeout: 30000
        }
    );
    const log = (res.stdout || "") + (res.stderr || "");
    fs.rmSync(spec, { force: true });
    // Quan trọng: CLI KHÔNG báo lỗi "Unknown option --channel". Nếu có thì fail.
    assert.ok(!/Unknown option|Unknown argument/i.test(log), `CLI không được báo unknown option, log: ${log.slice(0,300)}`);
    // Không được "No tests found" (file nằm trong testDir)
    assert.ok(!/No tests found/i.test(log), `Không được No tests found. log: ${log.slice(0,300)}`);
    // Trong sandbox không có Chrome hệ thống -> sẽ báo executable không tồn tại, KHÔNG phải lỗi bundled.
    if (res.status !== 0) {
        assert.ok(
            /executable doesn't exist|Executable doesn't exist|chrome.*not found|not found/i.test(log),
            `phải báo lỗi executable Chrome (không phải unknown option), log: ${log.slice(0,300)}`
        );
    }
    console.log(`    (exit=${res.status})`);
});

// ---- Generated file placement: Playwright nhận đúng test (không "No tests found") ----
test("Generated file trong outputs/generated-tests được Playwright nhận (không No tests found)", () => {
    const genDir = path.join(rootDir, "outputs", "generated-tests");
    fs.mkdirSync(genDir, { recursive: true });
    const spec = path.join(genDir, "TC001.spec.js");
    fs.writeFileSync(
        spec,
        `import { test, expect } from '@playwright/test';\n` +
        `test('TC001 - đăng nhập', async ({ page }) => {\n` +
        `  await page.setContent('<h1>ok</h1>');\n` +
        `  expect(await page.textContent('h1')).toBe('ok');\n` +
        `});\n`
    );
    // Kiểm tra tên file hợp lệ
    assert.ok(/\.spec\.js$/.test(path.basename(spec)), "tên file kết thúc .spec.js");
    // Chạy --list với config có testDir=outputs/generated-tests, truyền RELATIVE path
    const bin = path.join(rootDir, "node_modules", ".bin", "playwright");
    const res = spawnSync(
        bin,
        ["test", "--config", path.join(rootDir, "playwright.config.js"), "--list", "TC001.spec.js", "--reporter=line"],
        { cwd: rootDir, encoding: "utf8", timeout: 30000 }
    );
    const log = (res.stdout || "") + (res.stderr || "");
    // Quan trọng: không được "No tests found"
    assert.ok(!/No tests found/i.test(log), `Không được No tests found. log: ${log.slice(0,400)}`);
    // Playwright nhận đúng 1 test
    assert.ok(/1 test|TC001/.test(log), `Playwright nhận 1 test. log: ${log.slice(0,400)}`);
    // dọn dẹp
    fs.rmSync(spec, { force: true });
    console.log(`    (--list exit=${res.status})`);
});

console.log(`\n==================================================`);
if (failures === 0) console.log(" BROWSER CHANNEL INTEGRATION PASSED ✔");
else console.log(` ${failures} FAILURE(S) ✘`);
console.log("==================================================\n");
process.exit(failures === 0 ? 0 : 1);
