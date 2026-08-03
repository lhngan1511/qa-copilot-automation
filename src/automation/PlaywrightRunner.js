import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { chromium } from "@playwright/test";
import ExecutionResult from "./ExecutionResult.js";

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

export default class PlaywrightRunner {
    /**
     * @param {object} options
     * @param {string} [options.rootDir]
     * @param {string|null} [options.browserChannel]  mặc định đọc process.env.PLAYWRIGHT_BROWSER_CHANNEL
     */
    constructor({ rootDir = process.cwd(), browserChannel = null } = {}) {
        this.rootDir = rootDir;
        this.browserChannel = browserChannel ?? process.env.PLAYWRIGHT_BROWSER_CHANNEL ?? null;
    }

    /** Channel đã cấu hình (chuẩn hóa lower). */
    configuredChannel() {
        const c = String(this.browserChannel ?? "").trim().toLowerCase();
        return c || null;
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

    /**
     * Build args playwright.
     * LƯU Ý: Playwright Test CLI KHÔNG hỗ trợ `--channel`.
     * Channel được cấu hình qua playwright.config.js (`use.channel` từ PLAYWRIGHT_BROWSER_CHANNEL),
     * nên KHÔNG truyền --channel qua CLI. Chỉ dùng --browser=chromium.
     */
    buildArgs({ filePath = null, projectDir = null, extraArgs = [] } = {}) {
        const args = ["test"];
        args.push("--browser=chromium");
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
            const bin = path.join(this.rootDir, "node_modules", ".bin", "playwright");
            const resultsFile = path.join(projectDir, "test-results.json");
            try {
                if (fs.existsSync(resultsFile)) fs.unlinkSync(resultsFile);
            } catch {
                /* ignore */
            }
            const args = this.buildArgs({ projectDir, extraArgs });
            const child = spawn(bin, args, {
                cwd: this.rootDir,
                env: { ...process.env, BASE_URL: process.env.BASE_URL || "", PLAYWRIGHT_BROWSER_CHANNEL: this.configuredChannel() || "" },
                stdio: ["ignore", "pipe", "pipe"]
            });
            let stdout = "";
            let stderr = "";
            child.stdout.on("data", (d) => (stdout += d));
            child.stderr.on("data", (d) => (stderr += d));
            child.on("error", (err) => resolve({ ok: false, raw: String(err), results: null, resultsFile: null }));
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
    runFile(filePath, { env = {} } = {}) {
        return new Promise((resolve) => {
            const abs = path.resolve(filePath);
            if (!fs.existsSync(abs)) {
                resolve({ status: "ERROR", diagnostic: `Không tìm thấy file: ${abs}`, durationMs: 0, error: null, log: "" });
                return;
            }
            const browser = this.resolveBrowser();
            if (!browser.ok) {
                resolve({ status: "DIAGNOSTIC", diagnostic: browser.diagnostic, durationMs: 0, error: null, log: "" });
                return;
            }
            const bin = path.join(this.rootDir, "node_modules", ".bin", "playwright");
            const started = Date.now();
            const args = this.buildArgs({ filePath: abs });
            const child = spawn(bin, args, {
                cwd: this.rootDir,
                env: { ...process.env, ...env, BASE_URL: process.env.BASE_URL || "", PLAYWRIGHT_BROWSER_CHANNEL: this.configuredChannel() || "" },
                stdio: ["ignore", "pipe", "pipe"]
            });
            let stdout = "";
            let stderr = "";
            child.stdout.on("data", (d) => (stdout += d));
            child.stderr.on("data", (d) => (stderr += d));
            child.on("error", (err) => resolve({ status: "ERROR", diagnostic: String(err), durationMs: Date.now() - started, error: null, log: stdout + stderr }));
            child.on("close", (code) => {
                const log = stdout + stderr;
                const durationMs = Date.now() - started;
                let status = code === 0 ? "PASSED" : "FAILED";
                // Phân biệt diagnostic theo browser
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
                resolve({
                    status,
                    diagnostic: status === "PASSED" ? null : browser.diagnostic ?? log.slice(0, 500),
                    durationMs,
                    error: code === 0 ? null : log.slice(0, 1000),
                    log
                });
            });
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
