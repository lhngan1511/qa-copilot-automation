import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import PlaywrightRunner from "../automation/PlaywrightRunner.js";
import CodeGenRecordingStore from "./CodeGenRecordingStore.js";
import { parseRecording } from "./recordingParser.js";

/*
 CodeGenSessionManager — Recording Session centric (Giai đoạn 2 MVP)

 Một Recording Session là thực thể chính. Một recording có thể:
   - không gắn testcase;
   - gắn 1 testcase;
   - gắn nhiều testcase.

 Testcase không phải điều kiện bắt buộc để bắt đầu ghi. Script lưu TOÀN BỘ
 luồng; không tự tách script theo testcase, không ép one-testcase-one-file.

 Metadata + script giữ lâu dài nằm trong CodeGenRecordingStore (data/
 codegen-recordings.json + outputs/codegen/). TempDir chỉ dùng cho recording
 đang chạy / file run tạm / report-trace tạm.

 storageMode: TEMP | SERVER | DOWNLOADED
   - TEMP: script chưa lưu bền (chỉ nội dung + file tạm)
   - SERVER: đã lưu phía server -> có serverFilePath
   - DOWNLOADED: người dùng Save As bằng trình duyệt (backend không biết
     đường dẫn thật, chỉ lưu downloadFileName gợi ý)

 Mode:
   - FULL_FLOW: ghi toàn bộ luồng; link 0..n testcase
   - TESTCASE_SEGMENT: đoạn ghi phục vụ testcase; PHẢI link >=1 testcase
     trước khi hoàn tất lưu metadata
*/

const DEFAULT_TARGET = "playwright-test";
const VALID_BROWSERS = new Set(["chrome", "edge", "chromium"]);
const BROWSER_CHANNEL = { chrome: "chrome", edge: "msedge", chromium: null };

export default class CodeGenSessionManager {
    constructor({
        rootDir = process.cwd(),
        tempDir = null,
        browserChannel = null,
        store = null,
        runner = null,
        spawnFn = spawn,
        playwrightBin = null,
        playwrightCliPath = null,
        execPath = process.execPath,
        platform = process.platform,
        focusFn = null,
        powershell = "powershell.exe"
    } = {}) {
        this.rootDir = rootDir;
        this.tempDir = tempDir ?? path.join(os.tmpdir(), "qa-copilot-codegen");
        this.browserChannel = browserChannel ?? process.env.PLAYWRIGHT_BROWSER_CHANNEL ?? null;
        this.store = store ?? new CodeGenRecordingStore({ scriptsDir: path.resolve(rootDir, "outputs", "codegen") });
        this.runner = runner;
        this.spawnFn = spawnFn;
        this.execPath = execPath;
        this.platform = platform;
        this.focusFn = focusFn ?? null;
        this.powershell = powershell;
        this.playwrightBin = playwrightBin ?? this.resolvePlaywrightBin();
        this.playwrightCliPath = playwrightCliPath ?? this.resolvePlaywrightCli();

        this.session = null; // phiên ghi đang chạy
        this.status = "IDLE";
        this.activeRecording = null; // recording record của phiên đang ghi
        this.error = null;

        this.ensureTempDir();
    }

    /** Thông tin phiên hiện tại (cho status endpoint). */
    getSessionInfo() {
        const s = this.session;
        const rec = s?.recordingId ? this.store.get(s.recordingId) : null;
        return {
            status: this.status,
            recordingId: s?.recordingId ?? this.activeRecording ?? null,
            pid: s?.pid ?? null,
            url: s?.url ?? null,
            browser: rec?.browser ?? s?.browser ?? null,
            command: s?.command ?? null,
            processAlive: s?.child ? s.child.exitCode == null : false,
            startedAt: s?.startedAt ?? null,
            error: this.error ?? null
        };
    }

    /**
     * Best-effort: đưa cửa sổ browser CodeGen lên foreground (chỉ Windows).
     * Nếu nền tảng khác hoặc không focus được -> focused:false, không crash.
     */
    async focusBrowserWindow() {
        if (this.platform !== "win32") {
            return {
                attempted: false,
                focused: false,
                supported: false,
                message: "Không hỗ trợ focus tự động trên nền tảng này (chỉ Windows). Hãy Alt+Tab sang cửa sổ Chrome/Playwright Inspector.",
                pid: this.session?.pid ?? null
            };
        }
        if (this.focusFn) {
            return this.focusFn({ session: this.session });
        }
        const result = await this.focusViaPowerShell();
        return result;
    }

    focusViaPowerShell() {
        return new Promise(resolve => {
            const script =
                "Get-Process | Where-Object { $_.ProcessName -match 'chrome|msedge|chromium|headless' -and $_.MainWindowTitle } " +
                "| Sort-Object StartTime -Descending | Select-Object -First 1 | ForEach-Object { " +
                "$wshell = New-Object -ComObject wscript.shell; $null = $wshell.AppActivate($_.Id); 'FOCUSED:' + $_.Id }";
            let out = "";
            let err = "";
            let child;
            try {
                child = this.spawnFn(this.powershell, ["-NoProfile", "-Command", script], {
                    windowsHide: true,
                    stdio: ["ignore", "pipe", "pipe"]
                });
            } catch (e) {
                resolve({ attempted: true, focused: false, supported: true, message: `Không thể gọi PowerShell: ${e.message}`, pid: this.session?.pid ?? null });
                return;
            }
            child.stdout?.on("data", d => (out += String(d)));
            child.stderr?.on("data", d => (err += String(d)));
            child.on("error", e => resolve({ attempted: true, focused: false, supported: true, message: `Lỗi PowerShell: ${e.message}`, pid: this.session?.pid ?? null }));
            child.on("close", code => {
                const found = /FOCUSED:\d+/.test(out);
                resolve({
                    attempted: true,
                    focused: found,
                    supported: true,
                    message: found
                        ? `Đã đưa cửa sổ ghi lên foreground (PID ${out.match(/FOCUSED:(\d+)/)?.[1] ?? ""}).`
                        : `Không tìm thấy cửa sổ ghi (exit=${code}). Hãy Alt+Tab sang Chrome/Playwright Inspector. ${err}`,
                    pid: this.session?.pid ?? null
                });
            });
        });
    }

    resolvePlaywrightBin() {
        const binDir = path.join(this.rootDir, "node_modules", ".bin");
        return process.platform === "win32"
            ? path.join(binDir, "playwright.cmd")
            : path.join(binDir, "playwright");
    }

    /**
     * Resolve Playwright CLI JS entry (node_modules/playwright/cli.js).
     * Dùng process.execPath (node) để spawn file .js này: chạy ổn định trên
     * Windows (tránh lỗi EINVAL khi spawn .cmd trực tiếp) và trên các OS khác.
     */
    resolvePlaywrightCli() {
        const cli = path.join(this.rootDir, "node_modules", "playwright", "cli.js");
        if (fs.existsSync(cli)) return cli;
        // Fallback: bin symlink từ .bin
        const bin = this.resolvePlaywrightBin();
        if (fs.existsSync(bin)) return bin;
        return cli;
    }

    ensureTempDir() {
        fs.mkdirSync(this.tempDir, { recursive: true });
        fs.mkdirSync(path.join(this.tempDir, "recordings"), { recursive: true });
        fs.mkdirSync(path.join(this.tempDir, "runs"), { recursive: true });
        fs.mkdirSync(path.join(this.tempDir, "reports"), { recursive: true });
    }

    channelFor(browser) {
        return BROWSER_CHANNEL[browser] ?? null;
    }

    /** Danh sách recording sessions. */
    list() {
        return this.store.list();
    }

    /** Chi tiết một recording (kèm scriptContent). */
    get(recordingId) {
        const rec = this.store.recordings.find(item => item.recordingId === recordingId);
        return rec ? { ...this.store.get(recordingId), scriptContent: rec.scriptContent ?? "" } : null;
    }

    /**
     * Start một Recording Session (tự do, không bắt buộc testcase).
     */
    /** P0 Cleanup — tạo GLOBAL recording KHÔNG spawn recorder (chỉ dùng cho Paste path). */
    createRecording({ url = "", browser = "chrome", mode = "FULL_FLOW", context = null } = {}) {
        const recording = this.store.create({ mode, url: String(url ?? ""), browser: String(browser ?? "chrome"), context });
        return this.store.get(recording.recordingId);
    }

    async start({ url = "", browser = "chrome", mode = "FULL_FLOW", context = null } = {}) {
        const normalizedUrl = String(url ?? "").trim();
        if (!normalizedUrl) {
            const error = new Error("URL không được để trống.");
            error.code = "CODE_GEN_URL_REQUIRED";
            throw error;
        }
        const normalizedBrowser = String(browser || "chrome").toLowerCase();
        if (!VALID_BROWSERS.has(normalizedBrowser)) {
            const error = new Error(`Browser không hợp lệ: ${browser}. Hỗ trợ: chrome | edge | chromium.`);
            error.code = "CODE_GEN_INVALID_BROWSER";
            throw error;
        }
        if (this.status === "RECORDING" && this.session) {
            const error = new Error("Đã có phiên CodeGen đang ghi. Dừng phiên hiện tại trước.");
            error.code = "CODE_GEN_SESSION_BUSY";
            throw error;
        }

        await this.disposeSession();
        this.ensureTempDir();

        // Tạo recording record (persistent metadata) trước.
        // context (module/feature/artifactId/session) dùng để lọc đối chiếu testcase.
        const recording = this.store.create({ mode, url: normalizedUrl, browser: normalizedBrowser, context });

        const recordingFile = path.join(this.tempDir, "recordings", `${recording.recordingId}.js`);
        const channel = this.channelFor(normalizedBrowser);
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
        if (channel) args.push("--channel", channel);

        /*
         Spawn Playwright CodeGen ổn định đa nền tảng:
         - command = process.execPath (node) + Playwright CLI .js (đã resolve
           từ node_modules/playwright/cli.js). Tránh spawn .cmd trực tiếp vốn
           lỗi EINVAL trên Windows.
         - URL / browser / output path là từng phần tử args riêng (không ghép
           chuỗi lệnh).
        */
        const command = this.execPath;
        const spawnArgs = [this.playwrightCliPath, ...args];

        console.log("[CodeGen] start before spawn:", JSON.stringify({
            platform: process.platform,
            command,
            args: spawnArgs,
            cwd: this.rootDir,
            outputPath: recordingFile,
            browser: normalizedBrowser,
            channel: channel || null,
            url: normalizedUrl
        }));

        let child;
        try {
            child = this.spawnFn(command, spawnArgs, {
                cwd: this.rootDir,
                env: {
                    ...process.env,
                    PLAYWRIGHT_BROWSER_CHANNEL: channel || ""
                },
                stdio: ["ignore", "pipe", "pipe"]
            });
        } catch (error) {
            // spawn lỗi đồng bộ (vd EINVAL): cập nhật recording sang ERROR và trả lỗi rõ.
            const detail = this.describeSpawnError(error, command, spawnArgs);
            this.store.update(recording.recordingId, {
                status: "ERROR",
                lastRunResult: { status: "ERROR", passed: false, error: detail.message, output: detail.message }
            });
            throw detail.error;
        }

        console.log(`[CodeGen] spawned PID: ${child?.pid ?? "unknown"}`);

        let log = "";
        child.stdout?.on("data", chunk => (log += String(chunk)));
        child.stderr?.on("data", chunk => (log += String(chunk)));

        // Bắt lỗi async từ process (vd EINVAL emit qua 'error' event).
        child.on("error", error => {
            console.error("[CodeGen] spawn error event:", JSON.stringify(this.describeSpawnError(error, command, spawnArgs)));
            if (this.session?.recordingId === recording.recordingId) {
                const detail = this.describeSpawnError(error, command, spawnArgs);
                this.store.update(recording.recordingId, {
                    status: "ERROR",
                    lastRunResult: { status: "ERROR", passed: false, error: detail.message, output: detail.message }
                });
                this.status = "ERROR";
                this.error = detail.error;
            }
        });

        // Chỉ coi là RECORDING khi spawn thành công VÀ có PID.
        const pid = child?.pid ?? null;
        if (!pid) {
            const detail = this.describeSpawnError(new Error("Process spawned nhưng không có PID."), command, spawnArgs);
            this.store.update(recording.recordingId, {
                status: "ERROR",
                lastRunResult: { status: "ERROR", passed: false, error: detail.message, output: detail.message }
            });
            throw detail.error;
        }

        console.log(`[CodeGen] recording started: ${JSON.stringify({
            recordingId: recording.recordingId,
            pid,
            command,
            url: normalizedUrl,
            browser: normalizedBrowser,
            outputPath: recordingFile,
            outputPathExists: fs.existsSync(recordingFile)
        })}`);

        this.session = { url: normalizedUrl, browser: normalizedBrowser, command, child, recordingFile, recordingId: recording.recordingId, startedAt: new Date().toISOString(), log, pid };
        this.status = "RECORDING";
        this.activeRecording = recording.recordingId;
        this.error = null;
        const startedAtMs = Date.now();

        child.on("exit", code => {
            if (this.status === "RECORDING" && this.session?.recordingId === recording.recordingId) {
                const content = this.readRecordingFile(recordingFile);
                const elapsedMs = Date.now() - startedAtMs;
                // Browser đóng ngay (chưa đủ thời gian ghi) -> INTERRUPTED, không để RECORDING giả.
                const status = content.trim()
                    ? "STOPPED"
                    : elapsedMs < 5000
                      ? "INTERRUPTED"
                      : "ERROR";
                this.store.update(recording.recordingId, {
                    scriptContent: content,
                    status,
                    lastRunResult: null
                });
                this.status = status;
                this.error = !content.trim()
                    ? {
                          code: status === "INTERRUPTED" ? "CODE_GEN_BROWSER_CLOSED_EARLY" : "CODE_GEN_BROWSER_UNAVAILABLE",
                          message:
                              status === "INTERRUPTED"
                                  ? `Trình duyệt ghi đã đóng ngay sau khi mở (exit=${code}, sau ${elapsedMs}ms). Không có script. Hãy bắt đầu ghi lại.`
                                  : `Không thể mở trình duyệt: ${log.slice(-400)}`
                      }
                    : null;
            }
        });

        const started = this.get(recording.recordingId);
        // Đính kèm pid của process ghi (lưu trong session, không ở store).
        return { ...started, pid };
    }

    readRecordingFile(filePath) {
        try {
            if (!fs.existsSync(filePath)) return "";
            return String(fs.readFileSync(filePath, "utf8") ?? "").trim();
        } catch {
            return "";
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Chờ output file trở nên non-empty và ổn định (kích thước không đổi trong
     * một khoảng poll) trong giới hạn thời gian. Playwright chỉ ghi/flush file
     * khi recording kết thúc (Inspector/browser đóng), nên không được đọc file
     * ngay sau khi kill process.
     */
    async waitForScriptFile(filePath, { timeoutMs = 5000, pollMs = 250, stablePolls = 3 } = {}) {
        const deadline = Date.now() + timeoutMs;
        let lastSize = -1;
        let stableCount = 0;
        while (Date.now() < deadline) {
            const size = fs.existsSync(filePath) ? fs.statSync(filePath).size : 0;
            if (size > 0) {
                if (size === lastSize) {
                    stableCount += 1;
                    if (stableCount >= stablePolls) {
                        return this.readRecordingFile(filePath);
                    }
                } else {
                    stableCount = 0;
                }
                lastSize = size;
            } else {
                stableCount = 0;
                lastSize = -1;
            }
            await this.sleep(pollMs);
        }
        return this.readRecordingFile(filePath);
    }

    /**
     * Dừng đúng process tree của phiên ghi đang active (không chỉ kill wrapper
     * Node/npx). Ưu tiên graceful (SIGTERM / taskkill không /F), sau đó
     * force-kill cả process tree sau timeout.
     */
    async shutdownProcessTree(child, { gracefulTimeoutMs = 1500, forceTimeoutMs = 1500, treeKill = null } = {}) {
        if (!child || typeof child.kill !== "function") return;
        const pid = child.pid;
        const finish = new Promise(resolve => child.once("close", resolve));
        // graceful trước
        if (treeKill) {
            await treeKill(pid, { force: false });
        } else if (this.platform === "win32" && pid) {
            // taskkill /T (cả tree) không /F = graceful-ish
            await this.runTaskKill(pid, false);
        } else {
            try {
                child.kill("SIGTERM");
            } catch {
                /* ignore */
            }
        }
        const exitedEarly = await Promise.race([
            finish.then(() => true),
            this.sleep(gracefulTimeoutMs).then(() => false)
        ]);
        if (exitedEarly) return;

        // force kill tree
        if (treeKill) {
            await treeKill(pid, { force: true });
        } else if (this.platform === "win32" && pid) {
            await this.runTaskKill(pid, true);
        } else {
            try {
                child.kill("SIGKILL");
            } catch {
                /* ignore */
            }
        }
        await Promise.race([finish, this.sleep(forceTimeoutMs)]);
    }

    runTaskKill(pid, force) {
        return new Promise(resolve => {
            let task;
            try {
                task = this.spawnFn("taskkill", force ? ["/pid", String(pid), "/T", "/F"] : ["/pid", String(pid), "/T"], {
                    windowsHide: true,
                    stdio: "ignore"
                });
            } catch {
                resolve();
                return;
            }
            task.on("error", () => resolve());
            task.on("close", () => resolve());
            setTimeout(resolve, 1500);
        });
    }

    /**
     * Stop phiên: dừng đúng process tree, chờ output file được flush rồi mới
     * đọc script. Nếu không capture được script -> CODE_GEN_SCRIPT_NOT_CAPTURED,
     * status STOP_FAILED, không trả STOPPED giả.
     */
    async stop({ timeoutMs = 1500, treeKill = null } = {}) {
        if (this.status !== "RECORDING" || !this.session) {
            const error = new Error("Không có phiên CodeGen đang ghi để dừng.");
            error.code = "CODE_GEN_NO_ACTIVE_SESSION";
            throw error;
        }
        const { child, recordingId, pid } = this.session;
        const raw = this.store.recordings.find(item => item.recordingId === recordingId);
        const existingContent = String(raw?.scriptContent ?? "").trim();
        console.log(`[CodeGen] stop requested: ${JSON.stringify({ recordingId, pid, outputPath: this.session.recordingFile ?? null })}`);

        await this.shutdownProcessTree(child, { treeKill });
        console.log(`[CodeGen] process tree stopped (pid=${pid}).`);

        // Cơ chế thủ công: backend KHÔNG tự capture từ output file -o. Script
        // do tester dán vào sau đó. Giữ script đã có (nếu từng dán trước), chỉ
        // cập nhật trạng thái session. Không báo lỗi nếu chưa có script.
        this.store.update(recordingId, {
            status: "STOPPED",
            lastRunResult: null
        });
        this.status = "STOPPED";
        this.session = null;
        this.activeRecording = null;
        this.error = null;

        console.log(`[CodeGen] stop done: ${JSON.stringify({ recordingId, status: "STOPPED", scriptLength: existingContent.length })}`);
        return {
            recordingId,
            status: "STOPPED",
            scriptLength: existingContent.length,
            scriptContent: existingContent
        };
    }

    /**
     * Lưu script do tester dán từ Playwright Inspector (cơ chế thủ công).
     * Không phụ thuộc output file -o.
     */
    setScript(recordingId, { script = "" } = {}) {
        const rec = this.store.get(recordingId);
        if (!rec) {
            const error = new Error(`Recording '${recordingId}' không tồn tại.`);
            error.code = "RECORDING_NOT_FOUND";
            throw error;
        }
        const content = String(script ?? "").trim();
        // P0 Consolidation — parse global recording (steps + assertions) từ script.
        let steps = [], assertions = [], parseError = null;
        if (content) {
            try {
                const parsed = parseRecording(content);
                steps = parsed.steps ?? [];
                assertions = parsed.assertions ?? [];
            } catch (e) {
                parseError = e?.message ?? "Parse recording thất bại.";
            }
        }
        this.store.update(recordingId, {
            scriptContent: content,
            status: content ? "SAVED" : rec.status === "RECORDING" ? "RECORDING" : "STOPPED",
            steps,
            assertions,
            parseError,
            lastRunResult: null
        });
        const updated = this.get(recordingId);
        return {
            recordingId,
            status: updated.status,
            scriptLength: content.length,
            scriptContent: content
        };
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
            try {
                child.kill("SIGTERM");
            } catch {
                /* ignore */
            }
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

    /** Đổi tên file (downloadFileName). */
    rename(recordingId, { fileName } = {}) {
        const name = String(fileName ?? "").trim();
        if (!name) {
            const error = new Error("Tên file không được để trống.");
            error.code = "CODE_GEN_EMPTY_FILE_NAME";
            throw error;
        }
        const safe = this.store.safeSpecName(name);
        return this.store.update(recordingId, { downloadFileName: safe });
    }

    /**
     * Gắn testcase (0/1/n) sau khi recording hoàn tất.
     * TESTCASE_SEGMENT bắt buộc link >=1 testcase.
     */
    /**
     * Gán context (module/feature/artifactId/session) cho recording để lọc
     * đối chiếu testcase đúng ngữ cảnh AI Test Design.
     */
    setContext(recordingId, { context = null } = {}) {
        const rec = this.store.get(recordingId);
        if (!rec) {
            const error = new Error(`Recording '${recordingId}' không tồn tại.`);
            error.code = "RECORDING_NOT_FOUND";
            throw error;
        }
        const normalized = context && typeof context === "object" ? { ...context } : null;
        return this.store.update(recordingId, { context: normalized });
    }

    /** Trả context đã lưu của recording (nếu có). */
    getContext(recordingId) {
        const rec = this.store.get(recordingId);
        return rec?.context ?? null;
    }

    /**
     * Kiểm tra recording có context đáng tin cậy để đối chiếu testcase không.
     */
    hasReliableContext(recordingId) {
        const ctx = this.getContext(recordingId);
        if (!ctx) return false;
        return Boolean(
            ctx.artifactId ||
                ctx.workflowSessionId ||
                ctx.moduleId ||
                ctx.functionId ||
                ctx.module ||
                ctx.feature
        );
    }

    linkTestcases(recordingId, { testcaseIds = [] } = {}) {
        const rec = this.store.get(recordingId);
        if (!rec) {
            const error = new Error(`Recording '${recordingId}' không tồn tại.`);
            error.code = "RECORDING_NOT_FOUND";
            throw error;
        }
        if (rec.status === "RECORDING") {
            const error = new Error("Chưa thể gắn testcase khi đang ghi. Hãy dừng ghi trước.");
            error.code = "CODE_GEN_LINK_WHILE_RECORDING";
            throw error;
        }
        // BUG 2: chỉ cho phép đối chiếu khi recording có context đáng tin cậy từ
        // AI Test Design; nếu không có context -> chặn để tránh liên kết sai.
        if (!this.hasReliableContext(recordingId)) {
            const error = new Error(
                "Chỉ khả dụng khi mở CodeGen từ một bộ testcase đã duyệt (cần context module/feature/session)."
            );
            error.code = "CODE_GEN_NO_CONTEXT";
            throw error;
        }
        const ids = [...new Set((Array.isArray(testcaseIds) ? testcaseIds : []).map(id => String(id).trim()).filter(Boolean))];
        if (rec.mode === "TESTCASE_SEGMENT" && ids.length === 0) {
            const error = new Error("Mode TESTCASE_SEGMENT phải gắn ít nhất 1 testcase.");
            error.code = "CODE_GEN_SEGMENT_REQUIRES_TESTCASE";
            throw error;
        }
        return this.store.update(recordingId, { testcaseIds: ids });
    }

    /**
     * Lưu script phía server (workspace). Trả serverFilePath.
     */
    saveToWorkspace(recordingId, { fileName } = {}) {
        const rec = this.store.get(recordingId);
        if (!rec) {
            const error = new Error(`Recording '${recordingId}' không tồn tại.`);
            error.code = "RECORDING_NOT_FOUND";
            throw error;
        }
        const raw = this.store.recordings.find(item => item.recordingId === recordingId);
        const content = String(raw?.scriptContent ?? "").trim();
        if (!content) {
            const error = new Error("Không có nội dung script để lưu.");
            error.code = "CODE_GEN_EMPTY_SCRIPT";
            throw error;
        }
        const targetName = fileName ? this.store.safeSpecName(fileName) : rec.downloadFileName || "playwright-recording.spec.js";
        const { serverFilePath } = this.store.writeServerScript(recordingId, content, targetName);
        return this.store.update(recordingId, {
            storageMode: "SERVER",
            serverFilePath,
            downloadFileName: path.basename(serverFilePath)
        });
    }

    /**
     * Chạy script của recording. Trả PASS/FAIL + report/trace path.
     */
    async run(recordingId, { script, env = {} } = {}) {
        const rec = this.store.get(recordingId);
        if (!rec) {
            const error = new Error(`Recording '${recordingId}' không tồn tại.`);
            error.code = "RECORDING_NOT_FOUND";
            throw error;
        }
        // Cho phép Run trực tiếp từ nội dung textarea (script override), không
        // bắt buộc lưu script trước. Nếu không có script override thì đọc từ store.
        const content = String(script ?? this.store.recordings.find(item => item.recordingId === recordingId)?.scriptContent ?? "").trim();
        if (!content) {
            const error = new Error("Chưa có script để chạy.");
            error.code = "CODE_GEN_EMPTY_SCRIPT";
            throw error;
        }

        /*
         BUG 1 fix: temp file phải nằm TRONG testDir của Playwright config
         (./outputs/generated-tests) để Playwright discover được. Trước đây ghi
         vào os.tmpdir()/qa-copilot-codegen/runs nằm NGOÀI project root nên
         path relative vượt ra ngoài testDir -> "No tests found".
         Ghi file `recording-<id>.spec.js` vào outputs/generated-tests.
        */
        const runDir = path.join(this.rootDir, "outputs", "generated-tests");
        fs.mkdirSync(runDir, { recursive: true });
        const runFileName = `recording-${recordingId}.spec.js`;
        const runFile = path.join(runDir, runFileName);
        fs.writeFileSync(runFile, content, "utf8");

        const fileExists = fs.existsSync(runFile);
        const fileSize = fileExists ? fs.statSync(runFile).size : 0;
        if (!fileExists || fileSize <= 0) {
            const error = new Error("Không tạo được file run tạm cho Playwright.");
            error.code = "CODE_GEN_RUN_FILE_FAILED";
            throw error;
        }

        const channel = this.channelFor(rec.browser);
        const runner = this.runner ?? new PlaywrightRunner({ rootDir: this.rootDir, browserChannel: channel });
        // Truyền RELATIVE path từ project root (forward slash) để Playwright
        // match đúng file trong testDir; không bao giờ truyền raw script.
        const rel = path.relative(this.rootDir, runFile).split(path.sep).join("/");
        const result = await runner.runFile(rel, { env });

        const reportPath = result?.resultsFile && fs.existsSync(result.resultsFile)
            ? path.relative(this.rootDir, result.resultsFile)
            : null;

        const runResult = {
            status: result?.status ?? "ERROR",
            passed: result?.status === "PASSED",
            diagnostic: result?.diagnostic ?? null,
            error: result?.error ?? null,
            output: this.truncateOutput(result?.log ?? result?.diagnostic ?? ""),
            durationMs: result?.durationMs ?? 0,
            reportPath,
            tempFilePath: path.relative(this.rootDir, runFile),
            command: result?.diag?.command ?? this.resolvePlaywrightBin(),
            args: result?.diag?.commandArgs ?? [`test`, rel]
        };

        this.store.update(recordingId, { lastRunResult: runResult, reportPath });
        return runResult;
    }

    truncateOutput(text, max = 4000) {
        const value = String(text ?? "");
        return value.length > max ? `${value.slice(0, max)}...` : value;
    }

    /**
     * Mô tả lỗi spawn đầy đủ (name/message/code/errno/syscall + command/args)
     * và trả Error rõ ràng cho UI.
     */
    describeSpawnError(error, command, args) {
        const e = error instanceof Error ? error : new Error(String(error ?? "Spawn failed"));
        const detail = {
            name: e.name ?? "Error",
            message: e.message ?? String(error ?? ""),
            code: e.code ?? null,
            errno: e.errno ?? null,
            syscall: e.syscall ?? null,
            command,
            args: Array.isArray(args) ? args : []
        };
        const hint =
            e.code === "EINVAL" || e.errno === "EINVAL"
                ? "spawn EINVAL: có thể do spawn command không hợp lệ trên nền tảng này. CodeGen dùng process.execPath + Playwright CLI .js để tránh lỗi .cmd trên Windows."
                : "";
        const message = `Không thể khởi chạy Playwright CodeGen. Chi tiết: ${JSON.stringify(detail)}${hint ? ` ${hint}` : ""}`;
        const wrapped = new Error(message);
        wrapped.code = "CODE_GEN_SPAWN_FAILED";
        wrapped.details = detail;
        return { error: wrapped, message };
    }

    /** Open Folder — chỉ khi có serverFilePath. */
    openFolder(recordingId) {
        const rec = this.store.get(recordingId);
        if (!rec) {
            const error = new Error(`Recording '${recordingId}' không tồn tại.`);
            error.code = "RECORDING_NOT_FOUND";
            throw error;
        }
        if (rec.storageMode !== "SERVER" || !rec.serverFilePath) {
            const error = new Error(
                "Chưa lưu script phía server (Save to workspace) nên không mở được thư mục."
            );
            error.code = "CODE_GEN_NO_SERVER_FILE";
            throw error;
        }
        return { serverFilePath: rec.serverFilePath, folderPath: path.relative(this.rootDir, this.store.scriptsDir) };
    }

    /** Open Report / Trace — khi run đã tạo. */
    openReport(recordingId) {
        const rec = this.store.get(recordingId);
        if (!rec) {
            const error = new Error(`Recording '${recordingId}' không tồn tại.`);
            error.code = "RECORDING_NOT_FOUND";
            throw error;
        }
        return { reportPath: rec.reportPath ?? null, tracePath: rec.tracePath ?? null };
    }

    /** Delete recording. */
    delete(recordingId) {
        return this.store.remove(recordingId);
    }

    /** Dọn phiên đang ghi + file tạm (không xoá metadata/script bền). */
    async disposeSession() {
        if (this.session?.child) {
            try {
                await this.terminateChild(this.session.child, 800);
            } catch {
                /* ignore */
            }
        }
        this.session = null;
        this.activeRecording = null;
        this.status = "IDLE";
        try {
            fs.rmSync(path.join(this.tempDir, "runs"), { recursive: true, force: true });
            fs.rmSync(path.join(this.tempDir, "recordings"), { recursive: true, force: true });
        } catch {
            /* ignore */
        }
        return { status: this.status };
    }

    async dispose() {
        await this.disposeSession();
        return { status: this.status };
    }
}

export { CodeGenSessionManager };
