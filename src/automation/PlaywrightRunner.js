import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { chromium } from "@playwright/test";
import ExecutionResult from "./ExecutionResult.js";

/**
 * PlaywrightRunner
 * Chạy generated Playwright project, thu thập pass/fail/error.
 * Không sửa test nguồn; không tự approve kết quả.
 */
export default class PlaywrightRunner {
    /**
     * @param {object} options
     * @param {string} [options.rootDir]
     */
    constructor({ rootDir = process.cwd() } = {}) {
        this.rootDir = rootDir;
    }

    /** Kiểm tra browser Chromium đã cài chưa (file executable tồn tại thật). */
    hasBrowser() {
        try {
            const p = chromium.executablePath();
            return Boolean(p) && fs.existsSync(p);
        } catch {
            return false;
        }
    }

    /**
     * Chạy test trong projectDir.
     * @returns {Promise<{ok:boolean, raw:string, results:object|null, resultsFile:string|null}>}
     */
    runProject(projectDir, { extraArgs = [] } = {}) {
        return new Promise((resolve) => {
            if (!this.hasBrowser()) {
                resolve({
                    ok: false,
                    raw: "BROWSER_NOT_INSTALLED",
                    results: null,
                    resultsFile: null,
                    error: "Chromium chưa được cài đặt. Chạy `npx playwright install chromium` hoặc trỏ app đích."
                });
                return;
            }
            const bin = path.join(this.rootDir, "node_modules", ".bin", "playwright");
            const config = path.join(projectDir, "playwright.config.js");
            const resultsFile = path.join(projectDir, "test-results.json");
            try {
                if (fs.existsSync(resultsFile)) fs.unlinkSync(resultsFile);
            } catch {
                /* ignore */
            }

            const args = ["test", "--config", config, "--reporter", "json", ...extraArgs];
            const child = spawn(bin, args, {
                cwd: this.rootDir,
                env: { ...process.env, BASE_URL: process.env.BASE_URL || "" },
                stdio: ["ignore", "pipe", "pipe"]
            });
            let stdout = "";
            let stderr = "";
            child.stdout.on("data", (d) => (stdout += d));
            child.stderr.on("data", (d) => (stderr += d));
            child.on("error", (err) =>
                resolve({ ok: false, raw: String(err), results: null, resultsFile: null })
            );
            child.on("close", () => {
                let results = null;
                if (fs.existsSync(resultsFile)) {
                    try {
                        results = JSON.parse(fs.readFileSync(resultsFile, "utf8"));
                    } catch {
                        results = null;
                    }
                }
                resolve({
                    ok: results !== null,
                    raw: stdout + stderr,
                    results,
                    resultsFile
                });
            });
        });
    }

    /**
     * Tạo ExecutionResult per testcase từ raw json report.
     */
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
                        errors: [
                            runResult.error ||
                                "Không lấy được kết quả playwright (browser chưa cài hoặc lỗi runtime)."
                        ],
                        environment: env,
                        createdAt: new Date().toISOString()
                    })
            );
        }

        const specs = runResult.results.suites;
        const byFile = new Map();
        (specs || []).forEach((suite) =>
            this.flattenSpecs(suite, byFile)
        );

        return manifest.testCaseIds.map((id, i) => {
            const spec = byFile.get(`${id}.spec.js`);
            const durationMs = spec?.duration ?? 0;
            let status = "NOT_EXECUTED";
            let failures = [];
            let errors = [];
            if (spec) {
                if (spec.status === "passed") status = "PASSED";
                else if (spec.status === "failed") status = "FAILED";
                else if (spec.status === "timedOut") status = "ERROR";
                else status = String(spec.status || "UNKNOWN").toUpperCase();
                for (const r of spec.results || []) {
                    for (const e of r.error || []) {
                        failures.push(String(e.message ?? e).slice(0, 500));
                    }
                }
            }
            return new ExecutionResult({
                artifactId: `ER-${id}-${Date.now()}`,
                status,
                testCaseId: id,
                mappingArtifactId: manifest.sourceArtifactIds?.[i],
                generatedProjectId: manifest.projectId,
                summary: {
                    status,
                    durationMs,
                    source: `${id}.spec.js`
                },
                failures,
                errors,
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
            browser: "chromium",
            baseUrl: process.env.BASE_URL || "",
            node: process.version
        };
    }
}
