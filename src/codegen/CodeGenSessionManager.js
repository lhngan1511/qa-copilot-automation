import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import PlaywrightRunner from "../automation/PlaywrightRunner.js";

/*
 CodeGenSessionManager
 MVP cho Giai đoạn 2 - Playwright CodeGen.

 Luồng: URL -> Start (spawn `playwright codegen`) -> tester thao tác trên
 trình duyệt -> Stop (kết thúc process an toàn, đọc script) -> người dùng tự
 tải/lưu script -> Run thử.

 Ràng buộc MVP:
   - Chỉ một phiên CodeGen chạy tại một thời điểm.
   - Một URL, một script.
   - Không AI, không self-healing, không Automation Intelligence, không phụ
     thuộc approved-testcases.json.
   - File tạm được dọn khi dừng / lỗi / server restart (qua dispose).
*/

const DEFAULT_TARGET = "playwright-test";
const VALID_BROWSERS = new Set(["chromium", "chrome"]);

function slugify(value) {
    return String(value ?? "")
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//i, "")
        .replace(/\/+$/g, "")
        .replace(/[^a-z0-9.]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80) || "playwright";
}

function defaultFileName(url) {
    return `${slugify(url)}-recording.spec.js`;
}

export default class CodeGenSessionManager {
    constructor({
        rootDir = process.cwd(),
        tempDir = null,
        browserChannel = null,
        runner = null,
        spawnFn = spawn,
        playwrightBin = null
    } = {}) {
        this.rootDir = rootDir;
        this.tempDir = tempDir ?? path.join(os.tmpdir(), "qa-copilot-codegen");
        this.browserChannel = browserChannel ?? process.env.PLAYWRIGHT_BROWSER_CHANNEL ?? null;
        this.runner = runner ?? new PlaywrightRunner({ rootDir, browserChannel: this.browserChannel });
        this.spawnFn = spawnFn;
        this.playwrightBin = playwrightBin ?? this.resolvePlaywrightBin();

        this.session = null;
        this.status = "IDLE";
        this.script = "";
        this.error = null;
        this.defaultFileName = "playwright-recording.spec.js";

        this.ensureTempDir();
    }

    resolvePlaywrightBin() {
        const binDir = path.join(this.rootDir, "node_modules", ".bin");
        return process.platform === "win32"
            ? path.join(binDir, "playwright.cmd")
            : path.join(binDir, "playwright");
    }

    ensureTempDir() {
        fs.mkdirSync(this.tempDir, { recursive: true });
        fs.mkdirSync(path.join(this.tempDir, "recordings"), { recursive: true });
        fs.mkdirSync(path.join(this.tempDir, "runs"), { recursive: true });
    }

    /** Đường dẫn file ghi lại script cho phiên hiện tại. */
    recordingPath(url, stamp = Date.now()) {
        return path.join(this.tempDir, "recordings", `${slugify(url)}-${stamp}.js`);
    }

    getStatus() {
        // Nếu đang ghi hoặc đã dừng mà file tạm đã được ghi, cập nhật script.
        if (this.session && this.status !== "IDLE" && this.session.recordingFile) {
            try {
                if (fs.existsSync(this.session.recordingFile)) {
                    const content = fs.readFileSync(this.session.recordingFile, "utf8");
                    if (content.trim()) this.script = content;
                }
            } catch {
                /* ignore */
            }
        }
        return {
            status: this.status,
            url: this.session?.url ?? null,
            script: this.script,
            defaultFileName: this.defaultFileName,
            recordingFile: this.session?.recordingFile ?? null,
            startedAt: this.session?.startedAt ?? null,
            error: this.error
        };
    }

    /**
     * Start một phiên CodeGen.
     * Ném lỗi nếu đã có phiên đang ghi (chỉ một phiên tại một thời điểm).
     */
    async start({ url } = {}) {
        const normalizedUrl = String(url ?? "").trim();
        if (!normalizedUrl) {
            const error = new Error("URL không được để trống.");
            error.code = "CODE_GEN_URL_REQUIRED";
            throw error;
        }
        if (this.status === "RECORDING" && this.session) {
            const error = new Error(
                "Đã có phiên CodeGen đang ghi. Dừng phiên hiện tại trước khi bắt đầu phiên mới."
            );
            error.code = "CODE_GEN_SESSION_BUSY";
            throw error;
        }

        // Dọn dữ liệu phiên cũ.
        await this.dispose();
        this.ensureTempDir();

        const recordingFile = this.recordingPath(normalizedUrl);
        const args = [
            "codegen",
            normalizedUrl,
            "-o",
            recordingFile,
            "--target",
            DEFAULT_TARGET,
            "--browser",
            "chromium"
        ];
        if (this.browserChannel === "chrome") args.push("--channel", "chrome");

        const child = this.spawnFn(this.playwrightBin, args, {
            cwd: this.rootDir,
            env: {
                ...process.env,
                PLAYWRIGHT_BROWSER_CHANNEL: this.browserChannel || ""
            },
            stdio: ["ignore", "pipe", "pipe"]
        });

        let log = "";
        child.stdout?.on("data", chunk => (log += String(chunk)));
        child.stderr?.on("data", chunk => (log += String(chunk)));

        this.session = {
            url: normalizedUrl,
            child,
            recordingFile,
            startedAt: new Date().toISOString(),
            log
        };
        this.status = "RECORDING";
        this.script = "";
        this.error = null;
        this.defaultFileName = defaultFileName(normalizedUrl);

        // Theo dõi nếu process tự thoát (ví dụ thiếu browser / lỗi khởi động).
        child.on("exit", code => {
            if (this.status === "RECORDING" && this.session?.child === child) {
                const content = this.readRecordingFile(this.session.recordingFile);
                this.script = content;
                this.status = "STOPPED";
                this.error = {
                    code: "CODE_GEN_PROCESS_EXITED",
                    message: `Playwright CodeGen đã tự kết thúc (exit=${code}). ${
                        content ? "Script đã được ghi." : "Script chưa được ghi."
                    }`
                };
                // Nếu là lỗi khởi động (browser thiếu) thì ghi rõ.
                if (!content && /executable doesn't exist|Failed to launch|ERR_|not found/i.test(log)) {
                    this.error.code = "CODE_GEN_BROWSER_UNAVAILABLE";
                    this.error.message = `Không thể mở trình duyệt cho CodeGen: ${log.slice(-400)}`;
                }
            }
        });

        return this.getStatus();
    }

    readRecordingFile(filePath) {
        try {
            if (!fs.existsSync(filePath)) return "";
            const content = fs.readFileSync(filePath, "utf8");
            return String(content ?? "").trim();
        } catch {
            return "";
        }
    }

    /**
     * Stop phiên: kết thúc process an toàn rồi đọc script từ file tạm.
     */
    async stop({ timeoutMs = 2000 } = {}) {
        if (this.status !== "RECORDING" || !this.session) {
            const error = new Error("Không có phiên CodeGen đang ghi để dừng.");
            error.code = "CODE_GEN_NO_ACTIVE_SESSION";
            throw error;
        }
        const { child, recordingFile } = this.session;
        await this.terminateChild(child, timeoutMs);

        this.script = this.readRecordingFile(recordingFile);
        this.status = "STOPPED";
        this.error = null;

        const result = this.getStatus();
        if (!result.script) {
            result.warning =
                "Script chưa được ghi. Nếu trình duyệt ghi đang mở, hãy đóng cửa sổ ghi rồi bấm Dừng lần nữa.";
        }
        return result;
    }

    terminateChild(child, timeoutMs) {
        return new Promise(resolve => {
            if (!child || typeof child.kill !== "function") {
                resolve();
                return;
            }
            let finished = false;
            const finish = () => {
                if (finished) return;
                finished = true;
                resolve();
            };
            child.once("exit", finish);
            child.kill("SIGTERM");
            // Nếu không tự thoát sau timeout -> kill mạnh.
            setTimeout(() => {
                if (finished) return;
                try {
                    child.kill("SIGKILL");
                } catch {
                    /* ignore */
                }
                setTimeout(finish, 300);
            }, timeoutMs);
        });
    }

    /**
     * Lưu script đã ghi (hoặc script tuỳ chỉnh) xuống file tạm để run.
     * Trả về đường dẫn file .spec.js tương đối rootDir để Playwright chạy.
     */
    async saveScript({ script, fileName = "playwright-recording.spec.js", fileNameHint = null } = {}) {
        const content = String(script ?? this.script ?? "").trim();
        if (!content) {
            const error = new Error("Không có nội dung script để lưu.");
            error.code = "CODE_GEN_EMPTY_SCRIPT";
            throw error;
        }
        const safeName = this.safeSpecName(fileName || fileNameHint || "playwright-recording.spec.js");
        const filePath = path.join(this.tempDir, "runs", safeName);
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, content, "utf8");
        this.script = content;
        return {
            fileName: safeName,
            absPath: filePath,
            relPath: path.relative(this.rootDir, filePath)
        };
    }

    safeSpecName(name) {
        const base = path.basename(String(name || "playwright-recording.spec.js"));
        const safe = base.replace(/[^a-zA-Z0-9._-]/g, "-");
        const withExt = /\.(spec|test)\.[cm]?[jt]s$/i.test(safe)
            ? safe
            : `${safe.replace(/\.js$/i, "")}.spec.js`;
        return withExt;
    }

    /**
     * Chạy script: cho phép truyền script (nội dung) hoặc filePath đã có.
     * Trả PASS/FAIL + stdout/stderr rút gọn.
     */
    async run({ script, filePath, env = {} } = {}) {
        let target = filePath;
        if (!target) {
            const saved = await this.saveScript({ script });
            target = saved.relPath;
        }
        const result = await this.runner.runFile(target, { env });
        return {
            status: result?.status ?? "ERROR",
            passed: result?.status === "PASSED",
            diagnostic: result?.diagnostic ?? null,
            error: result?.error ?? null,
            output: this.truncateOutput(result?.log ?? result?.diagnostic ?? ""),
            durationMs: result?.durationMs ?? 0
        };
    }

    truncateOutput(text, max = 4000) {
        const value = String(text ?? "");
        return value.length > max ? `${value.slice(0, max)}...` : value;
    }

    /**
     * Dọn dữ liệu phiên: kill process còn chạy và xoá file tạm.
     */
    async dispose() {
        if (this.session?.child) {
            try {
                await this.terminateChild(this.session.child, 800);
            } catch {
                /* ignore */
            }
        }
        this.session = null;
        this.status = "IDLE";
        this.script = "";
        this.error = null;
        this.defaultFileName = "playwright-recording.spec.js";
        try {
            fs.rmSync(this.tempDir, { recursive: true, force: true });
        } catch {
            /* ignore */
        }
        return { status: this.status };
    }
}

export { CodeGenSessionManager, defaultFileName, slugify };
