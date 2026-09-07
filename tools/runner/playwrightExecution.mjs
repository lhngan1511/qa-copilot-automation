import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { cliPath } from "./playwrightPath.mjs";

/*
 playwrightExecution — chạy 1 job RUN_TESTCASE nhận từ server: ghi `code` vào file .spec.js
 trong work dir riêng của lần chạy, spawn Playwright test, trả kết quả cùng shape server
 mong đợi ở POST /jobs/:jobId/complete (result.status "PASSED"|"FAILED" + exitCode/stdout/stderr).

 Chỉ chạy đúng 1 job/lần (agent.mjs vòng lặp tuần tự) — work/job.spec.js ghi đè mỗi lần,
 không tích lũy file rác theo thời gian.
*/

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORK_DIR = path.join(__dirname, "work");
const SPEC_FILE = path.join(WORK_DIR, "job.spec.js");

export function runJob({ code, env = {}, runOptions = {} }) {
    return new Promise(resolve => {
        if (!code || typeof code !== "string") {
            resolve({ status: "FAILED", exitCode: null, stdout: "", stderr: "", durationMs: 0, error: "Job không có nội dung spec (code rỗng)." });
            return;
        }
        fs.mkdirSync(WORK_DIR, { recursive: true });
        fs.writeFileSync(SPEC_FILE, code, "utf8");

        const headed = typeof runOptions?.headed === "boolean" ? runOptions.headed : true;
        const slowMo = Number.isFinite(Number(runOptions?.slowMo)) ? Number(runOptions.slowMo) : (headed ? 1000 : 0);

        let cli;
        try {
            cli = cliPath(__dirname);
        } catch (err) {
            resolve({ status: "FAILED", exitCode: null, stdout: "", stderr: "", durationMs: 0, error: String(err.message ?? err) });
            return;
        }

        // Không declare `projects:` trong playwright.config.js (giống config gốc) -> dùng
        // --browser=chromium (không --project) — đúng logic PlaywrightRunner.buildArgs().
        const args = ["test", "--browser=chromium", "job.spec.js", "--reporter", "line"];
        if (headed) args.push("--headed");

        const started = Date.now();
        const child = spawn(process.execPath, [cli, ...args], {
            cwd: __dirname,
            env: {
                ...process.env,
                ...env,
                PLAYWRIGHT_HEADLESS: headed ? "false" : "true",
                PLAYWRIGHT_SLOW_MO: String(slowMo)
            },
            stdio: ["ignore", "pipe", "pipe"],
            windowsHide: false
        });

        let stdout = "";
        let stderr = "";
        child.stdout.on("data", d => {
            stdout += d;
            process.stdout.write(d);
        });
        child.stderr.on("data", d => {
            stderr += d;
            process.stderr.write(d);
        });
        child.on("error", err => {
            resolve({
                status: "FAILED",
                exitCode: null,
                stdout: stdout.slice(-12000),
                stderr: stderr.slice(-12000),
                durationMs: Date.now() - started,
                error: String(err)
            });
        });
        child.on("close", exitCode => {
            resolve({
                status: exitCode === 0 ? "PASSED" : "FAILED",
                exitCode,
                stdout: stdout.slice(-12000),
                stderr: stderr.slice(-12000),
                durationMs: Date.now() - started,
                error: exitCode === 0 ? null : (stderr || stdout).slice(-1000)
            });
        });
    });
}
