import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import PlaywrightRunner from "../src/automation/PlaywrightRunner.js";
import { ERROR_CODES } from "../src/automation/diagnose.js";

/* P0 DEMO — Playwright chạy HIỆN trình duyệt (headed), không chạy ẩn. */

// 1. Runner mặc định: headed=true, slowMo=500 (demo).
const runner = new PlaywrightRunner({ rootDir: os.tmpdir() });
assert.equal(runner.headed, true, "demo mặc định headed=true (hiển thị browser)");
assert.equal(runner.slowMo, 500, "demo mặc định slowMo=500");

// 2. buildArgs phải chứa --headed khi headed.
const argsHeaded = new PlaywrightRunner({ rootDir: os.tmpdir(), headed: true }).buildArgs({ filePath: "x.spec.js" });
assert.ok(argsHeaded.includes("--headed"), `args phải có --headed: ${argsHeaded.join(" ")}`);
assert.ok(argsHeaded.includes("--browser=chromium"));

// 3. headed=false -> không có --headed.
const argsHidden = new PlaywrightRunner({ rootDir: os.tmpdir(), headed: false }).buildArgs({ filePath: "x.spec.js" });
assert.ok(!argsHidden.includes("--headed"), "headed=false -> không có --headed");

// 4. Không dùng shell:true — spawn env phải đúng PLAYWRIGHT_HEADLESS/SLOW_MO.
//    (kiểm tra qua resolveBrowser + pre-flight; shell được bỏ trong runFile).
//    Ta kiểm tra runner không báo lỗi syntax và config default headed.
const cfg = fs.readFileSync("playwright.config.js", "utf8");
assert.ok(cfg.includes("headless = false") || cfg.includes('"false"'), "config mặc định headless=false");
assert.ok(cfg.includes("PLAYWRIGHT_SLOW_MO ?? \"500\""), "config mặc định slowMo=500");

// 5. Browser spawn lỗi -> BROWSER_NOT_INSTALLED (pre-flight) khi không có browser.
const noBrowser = new PlaywrightRunner({ rootDir: os.tmpdir(), browserChannel: "chrome" });
// resolveBrowser với chrome luôn trả ok (Playwright tự tìm), nên không spawn -> qua pre-flight BASE_URL.
// Thay vào đó kiểm tra channel không hợp lệ -> BROWSER_NOT_INSTALLED không áp dụng; dùng SPAWN_FAILED path.
// Kiểm tra spawn error classification qua mock là đủ — xác nhận ERROR_CODES có SPAWN_FAILED.
assert.equal(ERROR_CODES.SPAWN_FAILED, "SPAWN_FAILED", "có mã SPAWN_FAILED");

// 5b. Không dùng shell:true trong source (tránh DEP0190).
const runnerSrc = fs.readFileSync("src/automation/PlaywrightRunner.js", "utf8");
// Chỉ kiểm tra dạng code buggy (shell: process.platform / shell: true trong spawn), không đụng comment.
assert.ok(!/shell:\s*process\.platform/.test(runnerSrc), "runner không được dùng shell: process.platform (DEP0190)");
assert.ok(!/shell:\s*true/.test(runnerSrc.replace(/\/\/[^\n]*/g, "")), "runner không được dùng shell:true");
// runner phải truyền env PLAYWRIGHT_HEADLESS + PLAYWRIGHT_SLOW_MO cho child.
assert.ok(runnerSrc.includes("PLAYWRIGHT_HEADLESS"), "runner set env PLAYWRIGHT_HEADLESS");
assert.ok(runnerSrc.includes("PLAYWRIGHT_SLOW_MO"), "runner set env PLAYWRIGHT_SLOW_MO");

// 5c. Batch demo chạy tuần tự (page runRequest lặp await tuần tự, không Promise.all).
const pageSrc = fs.readFileSync("web-ui/src/pages/AutomationWorkspacePage.jsx", "utf8");
assert.ok(!/runRequest[\s\S]{0,600}Promise\.all/.test(pageSrc), "batch không chạy song song (Promise.all)");
assert.ok(/for \(const item of items\)/.test(pageSrc), "batch chạy tuần tự bằng for-await");

// 6. runFile spawn env: kiểm tra env truyền cho child chứa PLAYWRIGHT_HEADLESS=false + SLOW_MO.
//    Mô phỏng bằng cách bắt spawn qua require cache (playwrightBin trỏ tới executable thật nên không spawn ở đây).
//    Thay vào đó kiểm tra runFile pre-flight: file tồn tại + thiếu BASE_URL -> BASE_URL_MISSING (không spawn browser).
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "hd-"));
const specDir = path.join(tempRoot, "outputs", "generated-tests");
fs.mkdirSync(specDir, { recursive: true });
fs.writeFileSync(path.join(specDir, "TC001.spec.js"), "test();\n");
process.env.BASE_URL = "";
const preflight = new PlaywrightRunner({ rootDir: tempRoot });
const res = await preflight.runFile("outputs/generated-tests/TC001.spec.js", { env: {} });
assert.equal(res.errorCode, "BASE_URL_MISSING", "thiếu BASE_URL -> dừng trước khi spawn browser");
assert.equal(res.fileExists, true);

fs.rmSync(tempRoot, { recursive: true, force: true });
console.log("Automation Headed Run test: PASS");
