import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import PlaywrightRunner from "../src/automation/PlaywrightRunner.js";

/* P0 — Backend Run response có cấu trúc (item 6), xác minh qua pre-flight paths
   (không cần browser): SPEC_NOT_FOUND, BASE_URL_MISSING, INVALID name. */

async function main() {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "runner-"));
    const oldBaseUrl = process.env.BASE_URL;
    process.env.BASE_URL = ""; // ép thiếu BASE_URL
    const runner = new PlaywrightRunner({ rootDir });

    // File không tồn tại → SPEC_NOT_FOUND
    const missing = await runner.runFile("outputs/generated-tests/NOPE.spec.js");
    assert.equal(missing.status, "ERROR");
    assert.equal(missing.errorCode, "SPEC_NOT_FOUND");
    assert.equal(missing.passed, false);
    assert.ok(missing.errorMessage, "có errorMessage");

    // File tồn tại nhưng thiếu BASE_URL → BASE_URL_MISSING (không spawn browser)
    const specDir = path.join(rootDir, "outputs", "generated-tests");
    fs.mkdirSync(specDir, { recursive: true });
    fs.writeFileSync(path.join(specDir, "TC001.spec.js"), "test();\n");
    const noBase = await runner.runFile("outputs/generated-tests/TC001.spec.js");
    assert.equal(noBase.status, "DIAGNOSTIC");
    assert.equal(noBase.errorCode, "BASE_URL_MISSING");
    assert.match(noBase.errorMessage, /BASE_URL/);

    // Cấu trúc đầy đủ theo yêu cầu item 6
    for (const r of [missing, noBase]) {
        assert.ok("status" in r, "có status");
        assert.ok("passed" in r, "có passed");
        assert.ok("durationMs" in r, "có durationMs");
        assert.ok("errorCode" in r, "có errorCode");
        assert.ok("errorMessage" in r, "có errorMessage");
        assert.ok("failedStep" in r, "có failedStep");
        assert.ok("failedLocator" in r, "có failedLocator");
        assert.ok("filePath" in r, "có filePath");
        assert.ok("line" in r, "có line");
        assert.ok("output" in r, "có output");
        assert.ok("screenshotPath" in r, "có screenshotPath");
        assert.ok("tracePath" in r, "có tracePath");
        assert.ok("reportPath" in r, "có reportPath");
    }

    process.env.BASE_URL = oldBaseUrl;
    fs.rmSync(rootDir, { recursive: true, force: true });
    console.log("Automation Runner Diagnose test: PASS");
}

main().catch(e => { console.error(e); process.exit(1); });
