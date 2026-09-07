import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { createRequire } from "node:module";
import { chromium } from "@playwright/test";
import ExecutionResult from "./ExecutionResult.js";
import { buildRunResponse, ERROR_CODES, ERROR_MESSAGES } from "./diagnose.js";

const __require = createRequire(import.meta.url);

/**
 * PlaywrightRunner
 * Chạy generated Playwright project/file, thu thập pass/fail/error.
 *
 * Hỗ trợ browser channel cài sẵn trên máy:
 *   - PLAYWRIGHT_BROWSER_CHANNEL=chrome  -> dùng Chrome hệ thống (channel "chrome"), KHÔNG cần bundled Chromium.
 *   - PLAYWRIGHT_BROWSER_CHANNEL=msedge  -> dùng Edge hệ thống (channel "msedge").
 *   - Không cấu hình channel             -> fallback bundled Chromium (chromium.executablePath()).
 *
 * Không hardcode đường dẫn máy local — dùng channel chính thức của Playwright.
 * Diagnostic phân biệt:
 *   SYSTEM_CHROME_NOT_FOUND / SYSTEM_EDGE_NOT_FOUND / BUNDLED_CHROMIUM_NOT_INSTALLED
 */

const VALID_CHANNELS = new Set(["chrome", "msedge"]);

// Tên file test hợp lệ: *.spec.js / *.test.js / *.spec.ts / *.test.ts / *.spec.mjs / *.test.cjs...
const TEST_FILE_RE = /\.(spec|test)\.[cm]?[jt]s$/;

// Rà locator (proactive audit) — dòng hành động cần chèn kiểm tra count() trước khi thực thi.
const AUDIT_ACTION_RE = /^(\s*)await\s+(.+?)\.(click|fill|check|uncheck|selectOption|press|hover)\(/;

export default class PlaywrightRunner {
    /**
     * @param {object} options
     * @param {string} [options.rootDir]
     * @param {string|null} [options.browserChannel]  mặc định đọc process.env.PLAYWRIGHT_BROWSER_CHANNEL
     */
    constructor({ rootDir = process.cwd(), browserChannel = null, headed = null, slowMo = null, spawnFn = null } = {}) {
        this.rootDir = rootDir;
        this.browserChannel = browserChannel ?? process.env.PLAYWRIGHT_BROWSER_CHANNEL ?? null;
        // Demo mặc định: HIỂN THỊ browser thật (headed) + slow motion 500ms để xem thao tác.
        // Có thể ghi đè qua env PLAYWRIGHT_HEADLESS / PLAYWRIGHT_SLOW_MO hoặc option.
        this.headed = headed ?? (String(process.env.PLAYWRIGHT_HEADLESS ?? "false").toLowerCase() !== "true");
        this.slowMo = slowMo ?? (Number(process.env.PLAYWRIGHT_SLOW_MO ?? "500") || 0);
        // Injectable spawn để test (mặc định dùng spawn thật). Signature: spawnFn(bin, args, opts).
        this.spawnFn = spawnFn ?? spawn;
    }

    /** Channel đã cấu hình (chuẩn hóa lower). */
    configuredChannel() {
        const c = String(this.browserChannel ?? "").trim().toLowerCase();
        return c || null;
    }

    /** Escape regex special chars để argument path không bị Playwright hiểu sai. */
    escapeRegex(s) {
        return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    /**
     * Resolve đường dẫn CLI JS thật của Playwright (không dùng .cmd shim).
     * Spawn qua process.execPath để chạy đúng trên Windows (không lệ thuộc shell).
     */
    cliPath() {
        // Thử resolve từ rootDir (dự án có node_modules riêng), rồi từ chính package này.
        const candidates = [
            path.join(this.rootDir, "package.json"),
            path.join(import.meta.dirname ?? process.cwd(), "package.json")
        ];
        for (const base of candidates) {
            try {
                const req = createRequire(base);
                try {
                    return req.resolve("@playwright/test/cli");
                } catch { /* fallthrough */ }
                try {
                    return req.resolve("playwright/cli.js");
                } catch { /* fallthrough */ }
            } catch { /* fallthrough */ }
        }
        // Dự phòng: tìm cli.js trong node_modules của rootDir.
        for (const base of ["@playwright/test", "playwright"]) {
            const candidate = path.join(this.rootDir, "node_modules", base, "cli.js");
            if (fs.existsSync(candidate)) return candidate;
        }
        throw new Error("Không tìm thấy Playwright CLI (cli.js). Hãy cài @playwright/test.");
    }

    /**
     * Phân giải browser và diagnostic khi thiếu.
     * @returns {{ok:boolean, channel:string|null, diagnostic:string|null}}
     */
    resolveBrowser() {
        const channel = this.configuredChannel();

        if (channel === "chrome") {
            // Dùng channel chrome — Playwright tự tìm Chrome hệ thống. Chỉ báo lỗi khi run fail.
            return { ok: true, channel: "chrome", diagnostic: null };
        }
        if (channel === "msedge") {
            return { ok: true, channel: "msedge", diagnostic: null };
        }
        if (channel && !VALID_CHANNELS.has(channel)) {
            return {
                ok: false,
                channel: null,
                diagnostic: `Browser channel không hợp lệ: "${channel}". Hỗ trợ: chrome | msedge (hoặc bỏ trống để dùng bundled Chromium).`
            };
        }

        // fallback bundled Chromium
        try {
            const p = chromium.executablePath();
            if (p && fs.existsSync(p)) {
                return { ok: true, channel: null, diagnostic: null };
            }
        } catch {
            /* fallthrough */
        }
        return {
            ok: false,
            channel: null,
            diagnostic:
                "BUNDLED_CHROMIUM_NOT_INSTALLED: Chromium bundled chưa cài. Chạy `npx playwright install chromium`, hoặc đặt PLAYWRIGHT_BROWSER_CHANNEL=chrome để dùng Chrome hệ thống."
        };
    }

    /** Đọc nội dung playwright.config.js (ưu tiên projectDir config, rồi rootDir). */
    configText(projectDir = null) {
        const p = projectDir
            ? path.join(projectDir, "playwright.config.js")
            : path.join(this.rootDir, "playwright.config.js");
        if (fs.existsSync(p)) return fs.readFileSync(p, "utf8");
        return "";
    }

    /** Trích danh sách tên project được khai báo trong config (nếu có `projects: [...]`). */
    configProjectNames(text) {
        const s = String(text ?? "");
        if (!/projects\s*:\s*\[/.test(s)) return [];
        const names = [];
        const re = /name\s*:\s*["']([^"']+)["']/g;
        let m;
        while ((m = re.exec(s)) !== null) names.push(m[1]);
        return names;
    }

    /**
     * Xác định project mặc định (chromium) có tồn tại trong config hay không.
     * - Không khai báo `projects:`        -> present=true, name=null (dùng --browser, không --project).
     * - Có project 'chromium'             -> present=true, name='chromium' (dùng --project=chromium).
     * - Khai báo projects nhưng không có  -> present=false (PLAYWRIGHT_PROJECT_NOT_FOUND).
     */
    resolveProject(projectDir = null) {
        const names = this.configProjectNames(this.configText(projectDir));
        if (names.length === 0) return { present: true, name: null, available: [] };
        if (names.includes("chromium")) return { present: true, name: "chromium", available: names };
        return { present: false, name: null, available: names };
    }

    /**
     * Build args playwright.
     * LƯU Ý: Playwright Test CLI KHÔNG hỗ trợ `--channel`.
     * Channel được cấu hình qua playwright.config.js (`use.channel` từ PLAYWRIGHT_BROWSER_CHANNEL),
     * nên KHÔNG truyền --channel qua CLI.
     * Chỉ thêm `--project=chromium` khi config THỰC SỰ khai báo project 'chromium';
     * nếu config không có `projects:` thì dùng `--browser=chromium` (không --project).
     * Headed: truyền `--headed` rõ ràng (không phụ thuộc config mặc định).
     */
    buildArgs({ filePath = null, projectDir = null, extraArgs = [], project = null } = {}) {
        const args = ["test"];
        const resolved = project != null
            ? { present: true, name: project }
            : this.resolveProject(projectDir);
        if (resolved.present && resolved.name) args.push(`--project=${resolved.name}`);
        else if (resolved.present) args.push("--browser=chromium");
        if (this.headed) args.push("--headed");
        if (projectDir) args.push("--config", path.join(projectDir, "playwright.config.js"));
        if (filePath) args.push(filePath);
        args.push("--reporter", projectDir ? "json" : "line", ...extraArgs);
        return args;
    }

    /**
     * Chạy test trong projectDir.
     * @returns {Promise<{ok:boolean, raw:string, results:object|null, resultsFile:string|null}>}
     */
    runProject(projectDir, { extraArgs = [] } = {}) {
        return new Promise((resolve) => {
            const browser = this.resolveBrowser();
            if (!browser.ok) {
                resolve({ ok: false, raw: browser.diagnostic, results: null, resultsFile: null, error: browser.diagnostic });
                return;
            }
            const cliPath = this.cliPath();
            const resultsFile = path.join(projectDir, "test-results.json");
            try {
                if (fs.existsSync(resultsFile)) fs.unlinkSync(resultsFile);
            } catch {
                /* ignore */
            }
            const proj = this.resolveProject(projectDir);
            if (!proj.present) {
                resolve({
                    ok: false,
                    raw: `PLAYWRIGHT_PROJECT_NOT_FOUND: config khai báo projects ${JSON.stringify(proj.available)} nhưng không có 'chromium'.`,
                    results: null,
                    resultsFile: null,
                    error: `PLAYWRIGHT_PROJECT_NOT_FOUND: ${JSON.stringify(proj.available)}`
                });
                return;
            }
            const args = this.buildArgs({ projectDir, extraArgs, project: proj.name });
            // Spawn bằng process.execPath + CLI JS thật (không .cmd, không shell) — ổn định trên Windows.
            const child = this.spawnFn(process.execPath, [cliPath, ...args], {
                cwd: this.rootDir,
                env: {
                    ...process.env,
                    BASE_URL: process.env.BASE_URL || "",
                    PLAYWRIGHT_BROWSER_CHANNEL: this.configuredChannel() || "",
                    PLAYWRIGHT_HEADLESS: this.headed ? "false" : "true",
                    PLAYWRIGHT_SLOW_MO: String(this.slowMo || 0)
                },
                stdio: ["ignore", "pipe", "pipe"],
                windowsHide: false
            });
            let stdout = "";
            let stderr = "";
            child.stdout.on("data", (d) => (stdout += d));
            child.stderr.on("data", (d) => (stderr += d));
            child.on("spawn", () => {
                /* spawn thành công — không làm gì thêm (chỉ cần listener để tránh lỗi). */
            });
            child.on("error", (err) => resolve({ ok: false, raw: String(err), results: null, resultsFile: null, error: String(err) }));
            child.on("close", () => {
                let results = null;
                if (fs.existsSync(resultsFile)) {
                    try {
                        results = JSON.parse(fs.readFileSync(resultsFile, "utf8"));
                    } catch {
                        results = null;
                    }
                }
                resolve({ ok: results !== null, raw: stdout + stderr, results, resultsFile });
            });
        });
    }

    /**
     * Chạy một file .spec.js đơn lẻ.
     * @param {string} filePath
     * @returns {Promise<object>}
     */
    enrichRun({ status, durationMs = 0, errorCode = null, errorMessage = null, log = "", browserDiagnostic = null, code = 0, filePath = null, testCaseId = null, requestedFilePath = null, fileExists = null }) {
        const d = buildRunResponse({
            status,
            durationMs,
            log,
            baseUrlPresent: Boolean(this.baseUrl()),
            browserDiagnostic,
            code,
            filePath
        });
        return {
            status,
            passed: status === "PASSED",
            durationMs,
            errorCode: errorCode ?? d.errorCode,
            errorMessage: errorMessage ?? d.errorMessage,
            failedStep: d.failedStep,
            failedLocator: d.failedLocator,
            filePath: filePath ?? d.filePath,
            requestedFilePath: requestedFilePath ?? filePath ?? d.filePath,
            fileExists: fileExists ?? null,
            testCaseId: testCaseId ?? null,
            line: d.line,
            output: d.output,
            screenshotPath: d.screenshotPath,
            tracePath: d.tracePath,
            reportPath: d.reportPath,
            expectedValue: d.expectedValue,
            actualValue: d.actualValue
        };
    }

    /** BASE_URL hiệu lực: env param hoặc server .env; rỗng = chưa cấu hình. */
    baseUrl(env = {}) {
        const v = String(env.BASE_URL || process.env.BASE_URL || "").trim();
        return v || null;
    }

    /**
     * Chạy một file .spec.js đơn lẻ.
     * @param {string} filePath
     * @returns {Promise<object>}
     */
    runFile(filePath, { env = {}, testCaseId = "", headed = null, slowMo = null, generation = null } = {}) {
        return new Promise((resolve) => {
            // Chế độ chạy hiệu lực: option > instance default (demo headed + slowMo 500).
            const effectiveHeaded = headed ?? this.headed;
            const effectiveSlowMo = slowMo ?? this.slowMo;
            const requestId = `RUN-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            // Resolve về absolute để kiểm tra tồn tại, nhưng TRUYỀN relative từ project root cho Playwright
            const abs = path.resolve(this.rootDir, filePath);
            const fileExists = fs.existsSync(abs);
            const baseName = path.basename(abs);
            const testDir = "./outputs/generated-tests";

            // diagnostic log (không secret)
            const diag = {
                generatedFilePath: filePath,
                requestedFilePath: filePath,
                cwd: this.rootDir,
                testDir,
                fileExists,
                baseName,
                testCaseId: testCaseId || null,
                generation: generation ?? null
            };
            const respond = (base, overrides = {}) => resolve({ ...base, ...this.enrichRun({ ...base, ...overrides }), diag });

            if (!fileExists) {
                const msg =
                    `Không tìm thấy file kiểm thử "${filePath}" — file không tồn tại trong thư mục "${this.rootDir}". ` +
                    "Hãy Sinh lại automation ở bước ④.";
                respond(
                    { status: "ERROR", durationMs: 0, log: `SPEC_NOT_FOUND: "${filePath}" không tồn tại (cwd=${this.rootDir})`, error: null, diagnostic: msg, filePath, requestedFilePath: filePath, fileExists: false },
                    { errorCode: ERROR_CODES.SPEC_NOT_FOUND, errorMessage: msg, filePath, fileExists: false }
                );
                return;
            }
            if (!TEST_FILE_RE.test(baseName)) {
                const msg = `File "${filePath}" không đúng tên *.spec.js/*.test.js — không thể chạy. Hãy Sinh lại automation.`;
                respond(
                    { status: "ERROR", durationMs: 0, log: `INVALID_TEST_FILE_NAME: "${filePath}"`, error: null, diagnostic: msg, filePath, requestedFilePath: filePath, fileExists: true },
                    { errorCode: ERROR_CODES.SPEC_NOT_FOUND, errorMessage: msg, filePath, fileExists: true }
                );
                return;
            }

            // Thiếu BASE_URL -> lỗi cấu hình, không spawn browser.
            if (!this.baseUrl(env)) {
                respond(
                    { status: "DIAGNOSTIC", durationMs: 0, log: "BASE_URL_MISSING: Chưa cấu hình BASE_URL", error: null, diagnostic: "BASE_URL_MISSING", filePath, requestedFilePath: filePath, fileExists: true },
                    { errorCode: ERROR_CODES.BASE_URL_MISSING, errorMessage: ERROR_MESSAGES.BASE_URL_MISSING, filePath, fileExists: true }
                );
                return;
            }

            const browser = this.resolveBrowser();
            if (!browser.ok) {
                respond(
                    { status: "DIAGNOSTIC", durationMs: 0, log: browser.diagnostic, error: null, diagnostic: browser.diagnostic, filePath, requestedFilePath: filePath, fileExists: true },
                    { errorCode: ERROR_CODES.BROWSER_NOT_INSTALLED, errorMessage: ERROR_MESSAGES.BROWSER_NOT_INSTALLED, filePath, browserDiagnostic: browser.diagnostic, fileExists: true }
                );
                return;
            }

            // Kiểm tra project 'chromium' có tồn tại trong config trước khi spawn.
            const proj = this.resolveProject();
            if (!proj.present) {
                const msg =
                    `playwright.config.js khai báo projects ${JSON.stringify(proj.available)} nhưng không có project 'chromium'. ` +
                    "Sửa playwright.config.js hoặc đổi project mặc định.";
                console.error(`[RUN_END] requestId=${requestId} status=PLAYWRIGHT_PROJECT_NOT_FOUND durationMs=0`);
                respond(
                    { status: "DIAGNOSTIC", durationMs: 0, log: msg, error: null, diagnostic: msg, filePath, requestedFilePath: filePath, fileExists: true },
                    { errorCode: ERROR_CODES.PLAYWRIGHT_PROJECT_NOT_FOUND, errorMessage: msg, filePath, fileExists: true }
                );
                return;
            }

            // Relative path từ project root, dùng forward slash (Windows path có '\\' làm hỏng regex của Playwright).
            const relRaw = path.relative(this.rootDir, abs).split(path.sep).join("/");
            const rel = this.escapeRegex(relRaw);
            const cliPath = this.cliPath();
            const started = Date.now();
            const args = this.buildArgs({ filePath: rel, project: proj.name });
            diag.commandArgs = args;
            diag.command = process.execPath;
            diag.cliPath = cliPath;
            diag.headed = effectiveHeaded;
            diag.slowMo = effectiveSlowMo;
            const browserLabel = this.configuredChannel() ?? "chromium";
            console.log(
                `[RUN_START] requestId=${requestId} command=${process.execPath} cliPath=${cliPath} testCaseId=${testCaseId || "?"} filePath=${filePath} generationVersion=${generation?.version ?? "?"} generationHash=${generation?.hash ?? "?"} effectiveDataBindings=${JSON.stringify(generation?.effectiveDataBindings ?? [])} headed=${effectiveHeaded} slowMo=${effectiveSlowMo} browser=${browserLabel} cwd=${this.rootDir} args=${JSON.stringify(args)}`
            );
            // Spawn bằng process.execPath + CLI JS thật (không .cmd, không shell:true) — ổn định trên Windows.
            const child = this.spawnFn(process.execPath, [cliPath, ...args], {
                cwd: this.rootDir,
                env: {
                    ...process.env,
                    ...env,
                    BASE_URL: this.baseUrl(env) || "",
                    PLAYWRIGHT_BROWSER_CHANNEL: this.configuredChannel() || "",
                    PLAYWRIGHT_HEADLESS: effectiveHeaded ? "false" : "true",
                    PLAYWRIGHT_SLOW_MO: String(effectiveSlowMo || 0)
                },
                stdio: ["ignore", "pipe", "pipe"],
                windowsHide: false
            });
            let stdout = "";
            let stderr = "";
            child.stdout.on("data", (d) => {
                stdout += d;
                console.log(`[RUN_STDOUT] requestId=${requestId} ${String(d).trimEnd()}`);
            });
            child.stderr.on("data", (d) => {
                stderr += d;
                console.log(`[RUN_STDERR] requestId=${requestId} ${String(d).trimEnd()}`);
            });
            child.on("spawn", () => {
                console.log(`[RUN_SPAWNED] requestId=${requestId} pid=${child.pid ?? "?"}`);
            });
            child.on("error", (err) => {
                // Mọi lỗi spawn đều được catch — không làm server crash.
                console.error(`[RUN_END] requestId=${requestId} status=SPAWN_FAILED exitCode=? durationMs=${Date.now() - started} error=${String(err)}`);
                respond(
                    { status: "DIAGNOSTIC", durationMs: Date.now() - started, log: String(err), error: String(err), diagnostic: String(err), filePath, requestedFilePath: filePath, fileExists: true, testCaseId: testCaseId || null },
                    { errorCode: ERROR_CODES.SPAWN_FAILED, errorMessage: ERROR_MESSAGES.SPAWN_FAILED, filePath, fileExists: true }
                );
            });
            child.on("close", (code) => {
                const log = stdout + stderr;
                const durationMs = Date.now() - started;
                let status = code === 0 ? "PASSED" : "FAILED";
                if (code !== 0) {
                    const ch = this.configuredChannel();
                    if (ch === "chrome" && /executable doesn't exist|chrome.*not found|Executable doesn't exist/i.test(log)) {
                        status = "DIAGNOSTIC";
                        browser.diagnostic = "SYSTEM_CHROME_NOT_FOUND: Không tìm thấy Chrome hệ thống. Kiểm tra Chrome đã cài hoặc dùng PLAYWRIGHT_BROWSER_CHANNEL=msedge / bundled Chromium.";
                    } else if (ch === "msedge" && /executable doesn't exist|msedge.*not found|Executable doesn't exist/i.test(log)) {
                        status = "DIAGNOSTIC";
                        browser.diagnostic = "SYSTEM_EDGE_NOT_FOUND: Không tìm thấy Microsoft Edge hệ thống.";
                    }
                }
                if (log.includes("net::ERR_CONNECTION_REFUSED") || log.includes("connect ECONNREFUSED") || log.includes("net::ERR")) {
                    status = "FAILED_APP_UNREACHABLE";
                }
                if (/No tests found/i.test(log)) {
                    status = "FAILED";
                    browser.diagnostic =
                        `NO_TESTS_FOUND: Playwright không nhận test. file=${rel} baseName=${baseName} fileExists=${fileExists} testDir=${testDir}. ` +
                        "Kiểm tra file nằm trong outputs/generated-tests và đúng tên *.spec.js.";
                }
                console.log(`[RUN_END] requestId=${requestId} status=${status} exitCode=${code ?? "?"} durationMs=${durationMs}`);
                respond(
                    {
                        status,
                        durationMs,
                        log,
                        diagnostic: status === "PASSED" ? null : browser.diagnostic ?? log.slice(0, 500),
                        error: code === 0 ? null : log.slice(0, 1000),
                        filePath,
                        requestedFilePath: filePath,
                        fileExists: true,
                        testCaseId: testCaseId || null
                    },
                    { browserDiagnostic: status === "DIAGNOSTIC" ? browser.diagnostic : null, code }
                );
            });
        });
    }

    /**
     * Phase 5 — Kiểm thử biên: chạy 1 file .spec.js chứa NHIỀU test() (mỗi candidate 1 test,
     * title = candidate.id) và trả kết quả RIÊNG TỪNG test — khác `runFile` (chỉ đọc exit code
     * tổng của cả file) và khác `buildExecutionResults`/`flattenSpecs` (gom theo TÊN FILE, ghi đè
     * khi nhiều test cùng file — không dùng được ở đây, xem `collectBoundarySpecs`).
     *
     * Dùng `--reporter=json` + biến môi trường chính thức của Playwright JSON reporter
     * `PLAYWRIGHT_JSON_OUTPUT_NAME` để ghi kết quả ra file thay vì stdout (cùng cơ chế
     * `runProject` đã dùng qua `test-results.json`), rồi gom theo `spec.title` (= candidate.id).
     *
     * Dùng `playwright.boundary.config.js` (kế thừa config gốc, chỉ đổi `screenshot: "on"`) thay
     * vì config mặc định (`only-on-failure`) — tester cần thấy giao diện thực tế sau khi nhập giá
     * trị biên dù PASSED hay FAILED, không chỉ khi lỗi (xem playwright.boundary.config.js).
     *
     * Ảnh chụp màn hình Playwright ghi vào `test-results/` — thư mục này bị Playwright XÓA SẠCH
     * mỗi lần chạy mới, nên phải copy ra `screenshotsDir` (bền vững, không bị ghi đè) ngay khi đọc
     * xong kết quả, nếu không lịch sử chạy cũ sẽ mất ảnh sau lần chạy kế tiếp.
     * @returns {Promise<{ok:boolean, resultsById:Map<string,{status,errorMessage,screenshotFile}>, raw:string, error:string|null}>}
     */
    runBoundarySpec(filePath, { env = {}, screenshotsDir = null } = {}) {
        return new Promise((resolve) => {
            const abs = path.resolve(this.rootDir, filePath);
            if (!fs.existsSync(abs)) {
                resolve({ ok: false, resultsById: new Map(), raw: "", error: `Không tìm thấy file "${filePath}".` });
                return;
            }
            if (!TEST_FILE_RE.test(path.basename(abs))) {
                resolve({ ok: false, resultsById: new Map(), raw: "", error: `File "${filePath}" không đúng tên *.spec.js.` });
                return;
            }
            if (!this.baseUrl(env)) {
                resolve({ ok: false, resultsById: new Map(), raw: "", error: ERROR_MESSAGES.BASE_URL_MISSING });
                return;
            }
            const browser = this.resolveBrowser();
            if (!browser.ok) {
                resolve({ ok: false, resultsById: new Map(), raw: "", error: browser.diagnostic });
                return;
            }
            const proj = this.resolveProject();
            if (!proj.present) {
                resolve({ ok: false, resultsById: new Map(), raw: "", error: `playwright.config.js không có project 'chromium' (${JSON.stringify(proj.available)}).` });
                return;
            }

            const relRaw = path.relative(this.rootDir, abs).split(path.sep).join("/");
            const rel = this.escapeRegex(relRaw);
            const jsonOutputFile = path.join(path.dirname(abs), `${path.basename(abs, path.extname(abs))}.result.json`);
            try {
                if (fs.existsSync(jsonOutputFile)) fs.unlinkSync(jsonOutputFile);
            } catch {
                /* ignore */
            }

            const boundaryConfigPath = path.join(this.rootDir, "playwright.boundary.config.js");
            const destScreenshotsDir = screenshotsDir ? path.resolve(screenshotsDir) : path.join(path.dirname(abs), "screenshots");
            const args = this.buildArgs({ filePath: rel, project: proj.name, extraArgs: ["--config", boundaryConfigPath, "--reporter=json"] });
            const cliPath = this.cliPath();
            const requestId = `BND-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            console.log(`[BOUNDARY_RUN_START] requestId=${requestId} filePath=${filePath} args=${JSON.stringify(args)}`);
            const child = this.spawnFn(process.execPath, [cliPath, ...args], {
                cwd: this.rootDir,
                env: {
                    ...process.env,
                    ...env,
                    BASE_URL: this.baseUrl(env) || "",
                    PLAYWRIGHT_BROWSER_CHANNEL: this.configuredChannel() || "",
                    PLAYWRIGHT_HEADLESS: this.headed ? "false" : "true",
                    PLAYWRIGHT_SLOW_MO: String(this.slowMo || 0),
                    PLAYWRIGHT_JSON_OUTPUT_NAME: jsonOutputFile
                },
                stdio: ["ignore", "pipe", "pipe"],
                windowsHide: false
            });
            let stdout = "";
            let stderr = "";
            // Log ra console giống runFile ([RUN_STDOUT]) — không có log này thì không ai (kể cả
            // dev) chẩn đoán được vì sao 1 kịch bản kiểm thử biên chạy thật lại fail (bug thật:
            // trước đây `raw` bị bỏ qua hoàn toàn sau khi resolve, không log, không lưu).
            child.stdout.on("data", (d) => { stdout += d; console.log(`[BOUNDARY_RUN_STDOUT] requestId=${requestId} ${String(d).trimEnd()}`); });
            child.stderr.on("data", (d) => { stderr += d; console.log(`[BOUNDARY_RUN_STDERR] requestId=${requestId} ${String(d).trimEnd()}`); });
            child.on("error", (err) => {
                console.error(`[BOUNDARY_RUN_END] requestId=${requestId} status=SPAWN_FAILED error=${String(err)}`);
                resolve({ ok: false, resultsById: new Map(), raw: String(err), error: String(err) });
            });
            child.on("close", (exitCode) => {
                let results = null;
                if (fs.existsSync(jsonOutputFile)) {
                    try {
                        results = JSON.parse(fs.readFileSync(jsonOutputFile, "utf8"));
                    } catch {
                        results = null;
                    }
                }
                if (!results) {
                    console.error(`[BOUNDARY_RUN_END] requestId=${requestId} status=NO_JSON_RESULT exitCode=${exitCode}`);
                    resolve({ ok: false, resultsById: new Map(), raw: stdout + stderr, error: "Không đọc được kết quả JSON của Playwright." });
                    return;
                }
                const resultsById = this.extractBoundaryResults(results, destScreenshotsDir);
                const summary = [...resultsById.entries()].map(([id, r]) => ({ id, status: r.status, error: r.errorMessage, screenshot: r.screenshotFile }));
                console.log(`[BOUNDARY_RUN_END] requestId=${requestId} status=DONE exitCode=${exitCode} results=${JSON.stringify(summary)}`);
                resolve({ ok: true, resultsById, raw: stdout + stderr, error: null });
            });
        });
    }

    /** Đọc kết quả PASSED/FAILED + lỗi + ảnh chụp màn hình từ JSON reporter thật của Playwright,
     *  gom theo `spec.title` (= candidate.id). Tách riêng thành hàm thuần (không I/O ngoài
     *  `persistBoundaryScreenshot`) để unit-test được với 1 fixture JSON thật — trước đây logic
     *  này nằm trực tiếp trong callback `child.on("close")` và đọc SAI field
     *  (`spec.status`/`spec.results`, vốn không tồn tại — cây JSON thật là `spec.ok` (boolean) +
     *  `spec.tests[].results[]`), khiến MỌI lần chạy đều báo FAILED không lý do, không ảnh, bất kể
     *  kết quả thật — xem tests/boundary-testing-test.js để thấy fixture thật bắt được lỗi này. */
    extractBoundaryResults(results, destScreenshotsDir) {
        const byTitle = new Map();
        for (const suite of results.suites || []) this.collectBoundarySpecs(suite, byTitle);
        const resultsById = new Map();
        for (const [title, spec] of byTitle.entries()) {
            const status = spec.ok ? "PASSED" : "FAILED";
            const errors = [];
            let screenshotFile = null;
            for (const test of spec.tests || []) {
                for (const r of test.results || []) {
                    if (r.error?.message) errors.push(this.stripAnsi(String(r.error.message)).slice(0, 500));
                    for (const att of r.attachments || []) {
                        if (!screenshotFile && String(att.name ?? "") === "screenshot" && att.path) {
                            screenshotFile = this.persistBoundaryScreenshot(att.path, destScreenshotsDir, title);
                        }
                    }
                }
            }
            resultsById.set(title, { status, errorMessage: errors[0] ?? null, screenshotFile });
        }
        return resultsById;
    }

    /** Playwright ghi mã màu ANSI vào message lỗi (vd \x1b[31m...\x1b[39m) — hiển thị thẳng ra
     *  UI tester sẽ ra ký tự rác, phải bóc trước khi lưu/trả về. */
    stripAnsi(text) {
        return text.split(String.fromCharCode(27)).join("").replace(/\[[0-9;]*m/g, "");
    }

    /** Đệ quy cây `suites` của Playwright JSON reporter, gom theo `spec.title` (= candidate.id
     *  — mỗi test() trong file boundary được đặt title riêng) — KHÁC `flattenSpecs` (gom theo
     *  tên file, ghi đè khi nhiều test cùng file, không dùng được cho N-test-1-file). */
    collectBoundarySpecs(suite, byTitle) {
        for (const s of suite.suites || []) this.collectBoundarySpecs(s, byTitle);
        for (const spec of suite.specs || []) {
            if (spec.title) byTitle.set(spec.title, spec);
        }
    }

    /** Copy 1 ảnh chụp màn hình từ `test-results/` (Playwright xóa sạch thư mục này mỗi lần chạy
     *  mới) sang `destDir` bền vững — trả về TÊN FILE (không phải đường dẫn hệ thống tuyệt đối,
     *  vì đường dẫn đó không mở được từ trình duyệt; route tĩnh sẽ ghép URL từ tên file này). */
    persistBoundaryScreenshot(srcPath, destDir, title) {
        try {
            if (!fs.existsSync(srcPath)) return null;
            fs.mkdirSync(destDir, { recursive: true });
            const safeTitle = String(title).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40);
            const fileName = `${safeTitle}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
            fs.copyFileSync(srcPath, path.join(destDir, fileName));
            return fileName;
        } catch {
            return null;
        }
    }

    /**
     * Rà locator (proactive audit) — chạy ĐÚNG file .spec.js đã Generate thật (không dựng lại
     * logic render riêng, tránh lệch với những gì Chạy thử thực sự dùng), nhưng chèn thêm 1 dòng
     * kiểm tra `locator.count()` trước mỗi hành động để biết locator đó còn khớp đúng 1 phần tử
     * trên giao diện hiện tại hay không — không cần đợi cả bài test chạy fail giữa chừng mới biết.
     * Đây là run THẬT (thao tác thật trên hệ thống, giống hệt Chạy thử), chỉ khác ở chỗ có thêm
     * báo cáo tình trạng từng locator dọc theo quá trình chạy.
     * @returns {Promise<{ok:boolean, results:Array, raw:string, error:string|null}>}
     */
    runLocatorAudit(filePath, { env = {} } = {}) {
        return new Promise((resolve) => {
            const abs = path.resolve(this.rootDir, filePath);
            if (!fs.existsSync(abs)) {
                resolve({ ok: false, results: [], raw: "", error: `Không tìm thấy file "${filePath}".` });
                return;
            }
            if (!TEST_FILE_RE.test(path.basename(abs))) {
                resolve({ ok: false, results: [], raw: "", error: `File "${filePath}" không đúng tên *.spec.js.` });
                return;
            }
            if (!this.baseUrl(env)) {
                resolve({ ok: false, results: [], raw: "", error: ERROR_MESSAGES.BASE_URL_MISSING });
                return;
            }
            const browser = this.resolveBrowser();
            if (!browser.ok) {
                resolve({ ok: false, results: [], raw: "", error: browser.diagnostic });
                return;
            }
            const proj = this.resolveProject();
            if (!proj.present) {
                resolve({ ok: false, results: [], raw: "", error: `playwright.config.js không có project 'chromium' (${JSON.stringify(proj.available)}).` });
                return;
            }

            const auditDir = path.join(this.rootDir, "outputs", "generated-tests", ".audit");
            fs.mkdirSync(auditDir, { recursive: true });
            const baseName = path.basename(abs);
            const auditFile = path.join(auditDir, baseName);
            const resultsPath = path.join(auditDir, `${path.basename(abs, path.extname(abs))}.audit-result.json`);

            const source = fs.readFileSync(abs, "utf8");
            const instrumented = this.instrumentForAudit(source, resultsPath);
            if (!instrumented.ok) {
                resolve({ ok: false, results: [], raw: "", error: instrumented.error });
                return;
            }
            try {
                if (fs.existsSync(resultsPath)) fs.unlinkSync(resultsPath);
            } catch {
                /* ignore */
            }
            fs.writeFileSync(auditFile, instrumented.code, "utf8");

            const relRaw = path.relative(this.rootDir, auditFile).split(path.sep).join("/");
            const rel = this.escapeRegex(relRaw);
            const auditConfigPath = path.join(this.rootDir, "playwright.audit.config.js");
            const args = this.buildArgs({ filePath: rel, project: proj.name, extraArgs: ["--config", auditConfigPath] });
            const cliPath = this.cliPath();
            const requestId = `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            console.log(`[AUDIT_RUN_START] requestId=${requestId} filePath=${filePath} args=${JSON.stringify(args)}`);
            const child = this.spawnFn(process.execPath, [cliPath, ...args], {
                cwd: this.rootDir,
                env: {
                    ...process.env,
                    ...env,
                    BASE_URL: this.baseUrl(env) || "",
                    PLAYWRIGHT_BROWSER_CHANNEL: this.configuredChannel() || "",
                    PLAYWRIGHT_HEADLESS: this.headed ? "false" : "true",
                    PLAYWRIGHT_SLOW_MO: String(this.slowMo || 0)
                },
                stdio: ["ignore", "pipe", "pipe"],
                windowsHide: false
            });
            let stdout = "";
            let stderr = "";
            child.stdout.on("data", (d) => { stdout += d; console.log(`[AUDIT_RUN_STDOUT] requestId=${requestId} ${String(d).trimEnd()}`); });
            child.stderr.on("data", (d) => { stderr += d; console.log(`[AUDIT_RUN_STDERR] requestId=${requestId} ${String(d).trimEnd()}`); });
            child.on("error", (err) => {
                console.error(`[AUDIT_RUN_END] requestId=${requestId} status=SPAWN_FAILED error=${String(err)}`);
                resolve({ ok: false, results: [], raw: String(err), error: String(err) });
            });
            child.on("close", (exitCode) => {
                let raw = [];
                if (fs.existsSync(resultsPath)) {
                    try {
                        raw = JSON.parse(fs.readFileSync(resultsPath, "utf8"));
                    } catch {
                        raw = [];
                    }
                }
                const results = this.classifyAuditResults(raw);
                console.log(`[AUDIT_RUN_END] requestId=${requestId} exitCode=${exitCode} results=${JSON.stringify(results.map(r => ({ line: r.line, verdict: r.verdict })))}`);
                resolve({ ok: true, results, raw: stdout + stderr, error: null });
            });
        });
    }

    /** Chèn dòng kiểm tra `count()` trước mỗi hành động, bọc thân test trong try/finally để vẫn
     *  ghi được kết quả MỘT PHẦN khi 1 bước sau đó throw/timeout (locator gãy giữa chừng không
     *  làm mất kết quả các bước đã audit trước đó). Chỉ nhận đúng cấu trúc spec do rendererV3.js
     *  sinh ra (1 khối `test(...)` duy nhất, dòng cuối là "});") — không dùng cho spec viết tay. */
    instrumentForAudit(source, resultsPath) {
        const lines = String(source ?? "").split("\n");
        const testStartIdx = lines.findIndex(l => /^test\(/.test(l));
        let testEndIdx = -1;
        for (let i = lines.length - 1; i >= 0; i--) {
            if (lines[i].trim() === "});") { testEndIdx = i; break; }
        }
        if (testStartIdx === -1 || testEndIdx === -1 || testEndIdx <= testStartIdx) {
            return { ok: false, error: "Không nhận diện được cấu trúc file test để rà locator." };
        }
        const out = [];
        out.push(lines[0]);
        out.push('import fs from "node:fs";');
        for (let i = 1; i < testStartIdx; i++) out.push(lines[i]);
        out.push(lines[testStartIdx]);
        out.push("  const __audit = [];");
        out.push("  try {");
        for (let i = testStartIdx + 1; i < testEndIdx; i++) {
            const line = lines[i];
            const m = AUDIT_ACTION_RE.exec(line);
            if (m) {
                const expr = m[2].trim();
                out.push(`${m[1]}__audit.push({ line: ${i + 1}, expr: ${JSON.stringify(expr)}, count: await (${expr}).count() });`);
            }
            out.push(line);
        }
        out.push("  } finally {");
        out.push(`    fs.writeFileSync(${JSON.stringify(resultsPath.split(path.sep).join("/"))}, JSON.stringify(__audit));`);
        out.push("  }");
        for (let i = testEndIdx; i < lines.length; i++) out.push(lines[i]);
        return { ok: true, code: out.join("\n") };
    }

    /** Loại locator từ biểu thức nguồn (`page.getByRole(...)`, `page.locator(...)`, ...) — bản
     *  backend tương đương `classifyLocatorKind` ở web-ui/src/utils/runDiagnose.js (không import
     *  cross-runtime giữa web-ui và src, 2 phía chạy 2 runtime khác nhau). */
    classifyLocatorKind(expr) {
        const s = String(expr ?? "");
        if (/getByRole/i.test(s)) return "role";
        if (/getByLabel/i.test(s)) return "label";
        if (/getByPlaceholder/i.test(s)) return "placeholder";
        if (/getByTestId/i.test(s)) return "testid";
        if (/getByText/i.test(s)) return "text";
        if (/^\/\/|xpath=/i.test(s)) return "xpath";
        return "css";
    }

    /** count() -> verdict + cờ fragile (css/xpath vẫn khớp đúng 1 phần tử nhưng kém ổn định nhất
     *  theo thứ tự ưu tiên locator — xem .claude/rules/locator_strategy.md). */
    classifyAuditResults(rawEntries) {
        return (Array.isArray(rawEntries) ? rawEntries : []).map(e => {
            const kind = this.classifyLocatorKind(e?.expr);
            const count = Number(e?.count ?? 0);
            const verdict = count === 0 ? "BROKEN" : count === 1 ? "OK" : "AMBIGUOUS";
            return { line: e?.line ?? null, expr: e?.expr ?? "", kind, count, verdict, fragile: kind === "css" || kind === "xpath" };
        });
    }

    buildExecutionResults(projectDir, manifest, runResult) {
        if (!runResult.results) {
            const env = this.environment();
            return manifest.testCaseIds.map(
                (id, i) =>
                    new ExecutionResult({
                        artifactId: `ER-${id}-${Date.now()}`,
                        status: "ERROR",
                        testCaseId: id,
                        mappingArtifactId: manifest.sourceArtifactIds?.[i],
                        generatedProjectId: manifest.projectId,
                        errors: [runResult.error || "Không lấy được kết quả playwright (browser chưa cài hoặc lỗi runtime)."],
                        environment: env,
                        createdAt: new Date().toISOString()
                    })
            );
        }
        const specs = runResult.results.suites;
        const byFile = new Map();
        (specs || []).forEach((suite) => this.flattenSpecs(suite, byFile));
        return manifest.testCaseIds.map((id, i) => {
            const spec = byFile.get(`${id}.spec.js`);
            const durationMs = spec?.duration ?? 0;
            let status = "NOT_EXECUTED";
            let failures = [];
            if (spec) {
                if (spec.status === "passed") status = "PASSED";
                else if (spec.status === "failed") status = "FAILED";
                else if (spec.status === "timedOut") status = "ERROR";
                else status = String(spec.status || "UNKNOWN").toUpperCase();
                for (const r of spec.results || []) {
                    for (const e of r.error || []) failures.push(String(e.message ?? e).slice(0, 500));
                }
            }
            return new ExecutionResult({
                artifactId: `ER-${id}-${Date.now()}`,
                status,
                testCaseId: id,
                mappingArtifactId: manifest.sourceArtifactIds?.[i],
                generatedProjectId: manifest.projectId,
                summary: { status, durationMs, source: `${id}.spec.js` },
                failures,
                errors: [],
                environment: this.environment(),
                createdAt: new Date().toISOString()
            });
        });
    }

    flattenSpecs(suite, byFile) {
        for (const s of suite.suites || []) this.flattenSpecs(s, byFile);
        for (const spec of suite.specs || []) {
            const file = spec.file ? path.basename(spec.file) : "";
            const key = Object.keys(byFile).find((k) => file.startsWith(k));
            if (key) byFile.set(key, spec);
            else if (file.endsWith(".spec.js")) byFile.set(file, spec);
        }
    }

    environment() {
        return {
            browser: this.configuredChannel() ?? "chromium",
            baseUrl: process.env.BASE_URL || "",
            node: process.version
        };
    }
}
