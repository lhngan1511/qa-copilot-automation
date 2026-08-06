import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import PlaywrightRunner from "../src/automation/PlaywrightRunner.js";
import { resolveBaseUrl, extractBaseUrls, SOURCE } from "../web-ui/src/utils/baseUrl.js";

/* P0 — Base URL: Run nhận đúng baseUrl từ UI; env chỉ là fallback; không URL -> MISSING. */

async function main() {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "burl-"));
    const oldEnv = process.env.BASE_URL;
    const runner = new PlaywrightRunner({ rootDir });

    // 1. baseUrl(env) ưu tiên env.UI hơn process.env (.env) — không bị .env ghi đè.
    process.env.BASE_URL = "http://from-env:1000";
    assert.equal(runner.baseUrl({ BASE_URL: "http://from-ui:9230" }), "http://from-ui:9230", "UI baseUrl phải thắng .env");
    assert.equal(runner.baseUrl({}), "http://from-env:1000", "không có env.UI -> .env fallback");
    process.env.BASE_URL = "";
    assert.equal(runner.baseUrl({}), null, "không có gì -> null (sẽ BASE_URL_MISSING)");

    // 2. resolveBaseUrl priority end-to-end (user > codegen > env > none)
    assert.equal(resolveBaseUrl({ edited: "", detected: ["http://cg:1"], envFallback: "http://env:2" }).source, SOURCE.CODEGEN);
    assert.equal(resolveBaseUrl({ edited: "", detected: ["http://cg:1"], envFallback: "" }).baseUrl, "http://cg:1");
    assert.equal(resolveBaseUrl({ edited: "", detected: [], envFallback: "http://env:2" }).baseUrl, "http://env:2");
    assert.equal(resolveBaseUrl({ edited: "", detected: [], envFallback: "" }).baseUrl, null);

    // 3. Run với file tồn tại + env.UI có URL -> KHÔNG báo BASE_URL_MISSING (tiếp tục đến browser/pre-flight khác).
    const specDir = path.join(rootDir, "outputs", "generated-tests");
    fs.mkdirSync(specDir, { recursive: true });
    fs.writeFileSync(path.join(specDir, "TC001.spec.js"), "test();\n");
    const withUrl = await runner.runFile("outputs/generated-tests/TC001.spec.js", { env: { BASE_URL: "http://from-ui:9230" } });
    assert.notEqual(withUrl.errorCode, "BASE_URL_MISSING", "có URL từ UI -> không MISSING");

    // 4. Run không có URL -> BASE_URL_MISSING.
    const noUrl = await runner.runFile("outputs/generated-tests/TC001.spec.js", { env: {} });
    assert.equal(noUrl.errorCode, "BASE_URL_MISSING");

    // 5. extractBaseUrls: nhiều route cùng origin -> 1; nhiều origin -> nhiều.
    assert.deepEqual(extractBaseUrls("await page.goto('http://h:1/a'); await page.goto('http://h:1/b');"), ["http://h:1"]);
    assert.deepEqual(extractBaseUrls("await page.goto('http://a:1/x'); await page.goto('https://b:2/y');"), ["http://a:1", "https://b:2"]);

    process.env.BASE_URL = oldEnv;
    fs.rmSync(rootDir, { recursive: true, force: true });
    console.log("Automation Base URL Run test: PASS");
}

main().catch(e => { console.error(e); process.exit(1); });
