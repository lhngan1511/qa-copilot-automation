import assert from "node:assert";
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
test("Chạy playwright test với PLAYWRIGHT_BROWSER_CHANNEL=chrome qua config (không lỗi CLI unknown option)", () => {
    const bin = path.join(rootDir, "node_modules", ".bin", "playwright");
    const res = spawnSync(
        bin,
        ["test", "--config", path.join(rootDir, "playwright.config.js"), "tests/browser-channel.integration.spec.js", "--reporter=line"],
        {
            cwd: rootDir,
            env: { ...process.env, PLAYWRIGHT_BROWSER_CHANNEL: "chrome" },
            encoding: "utf8",
            timeout: 30000
        }
    );
    const log = (res.stdout || "") + (res.stderr || "");
    // Quan trọng: CLI KHÔNG báo lỗi "Unknown option --channel". Nếu có thì fail.
    assert.ok(!/Unknown option|Unknown argument/i.test(log), `CLI không được báo unknown option, log: ${log.slice(0,300)}`);
    // Trong sandbox không có Chrome hệ thống -> sẽ báo executable không tồn tại (SYSTEM_CHROME_NOT_FOUND), KHÔNG phải lỗi bundled.
    if (res.status !== 0) {
        assert.ok(
            /executable doesn't exist|Executable doesn't exist|chrome.*not found|not found/i.test(log),
            `phải báo lỗi executable Chrome (không phải unknown option), log: ${log.slice(0,300)}`
        );
    }
    console.log(`    (exit=${res.status})`);
});

console.log(`\n==================================================`);
if (failures === 0) console.log(" BROWSER CHANNEL INTEGRATION PASSED ✔");
else console.log(` ${failures} FAILURE(S) ✘`);
console.log("==================================================\n");
process.exit(failures === 0 ? 0 : 1);
