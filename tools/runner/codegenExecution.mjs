import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cliPath } from "./playwrightPath.mjs";

/*
 codegenExecution — chạy CodeGen (Ghi màn hình) NGAY TRÊN MÁY TESTER khi job đến từ server
 (START_CODEGEN/STOP_CODEGEN). Mirror (không import — tools/runner là package tách biệt, tự có
 node_modules riêng) logic spawn/kill/capture của src/codegen/CodeGenSessionManager.js phía server,
 chỉ khác: chạy trong tiến trình agent, không phải server.

 2 job NHANH, không chặn vòng lặp claim/heartbeat của agent.mjs:
 - START_CODEGEN: spawn xong, xác nhận có pid là hoàn tất NGAY — KHÔNG chờ process thoát. Cửa sổ
   Playwright Inspector mở trên máy tester, chạy nền trong tiến trình agent tới khi có STOP_CODEGEN.
 - STOP_CODEGEN: dừng đúng process tree (graceful SIGTERM/taskkill trước, force sau ~1.5s — giống
   hệt CodeGenSessionManager#shutdownProcessTree), rồi thử đọc file output (best-effort, giống
   waitForScriptFile) — script có thể rỗng nếu Playwright chưa kịp flush lúc bị kill; trường hợp đó
   frontend rơi về đúng luồng dán tay thủ công đã có sẵn (không phải lỗi).
*/

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORK_DIR = path.join(__dirname, "work", "codegen");
const BROWSER_CHANNEL = { chrome: "chrome", edge: "msedge", chromium: null };

const sessions = new Map(); // recordingId -> { child, outputFile }

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function readScriptFile(filePath) {
    try {
        return fs.readFileSync(filePath, "utf8");
    } catch {
        return "";
    }
}

export function startCodegen({ recordingId, url, browser = "chrome", channel = null } = {}) {
    if (!recordingId || !url) {
        return { status: "FAILED", error: "Thiếu recordingId hoặc url." };
    }
    fs.mkdirSync(WORK_DIR, { recursive: true });
    const outputFile = path.join(WORK_DIR, `${recordingId}.js`);

    let cli;
    try {
        cli = cliPath(__dirname);
    } catch (err) {
        return { status: "FAILED", error: String(err.message ?? err) };
    }

    const resolvedChannel = channel || BROWSER_CHANNEL[browser] || null;
    const args = ["codegen", url, "-o", outputFile, "--target", "playwright-test", "--browser", "chromium"];
    if (resolvedChannel) args.push("--channel", resolvedChannel);

    let child;
    try {
        child = spawn(process.execPath, [cli, ...args], {
            cwd: __dirname,
            env: { ...process.env, PLAYWRIGHT_BROWSER_CHANNEL: resolvedChannel || "" },
            stdio: ["ignore", "pipe", "pipe"],
            windowsHide: false
        });
    } catch (err) {
        return { status: "FAILED", error: String(err.message ?? err) };
    }

    if (!child.pid) {
        return { status: "FAILED", error: "Process CodeGen khởi động nhưng không có PID." };
    }

    // Lỗi async (vd EINVAL) sau khi job START_CODEGEN đã báo PASSED không còn kênh nào báo ngược
    // về job đó nữa — chỉ log tại chỗ. STOP_CODEGEN sau đó vẫn dọn được session (kill/capture rỗng
    // an toàn) nên tester chỉ thấy "không nhận được script tự động", không bị kẹt.
    child.on("error", err => console.error(`[codegen] recordingId=${recordingId} process error: ${err.message}`));

    sessions.set(recordingId, { child, outputFile });
    console.log(`[codegen] started recordingId=${recordingId} pid=${child.pid} url=${url}`);
    return { status: "PASSED", pid: child.pid };
}

async function waitForStableFile(filePath, { timeoutMs = 5000, pollMs = 250, stablePolls = 3 } = {}) {
    const deadline = Date.now() + timeoutMs;
    let lastSize = -1;
    let stableCount = 0;
    while (Date.now() < deadline) {
        const size = fs.existsSync(filePath) ? fs.statSync(filePath).size : 0;
        if (size > 0) {
            if (size === lastSize) {
                stableCount += 1;
                if (stableCount >= stablePolls) return readScriptFile(filePath);
            } else {
                stableCount = 0;
            }
            lastSize = size;
        } else {
            stableCount = 0;
            lastSize = -1;
        }
        await sleep(pollMs);
    }
    return readScriptFile(filePath);
}

function runTaskKill(pid, force) {
    return new Promise(resolve => {
        let task;
        try {
            task = spawn("taskkill", force ? ["/pid", String(pid), "/T", "/F"] : ["/pid", String(pid), "/T"], {
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

async function shutdownProcessTree(child, { gracefulTimeoutMs = 1500, forceTimeoutMs = 1500 } = {}) {
    if (!child || typeof child.kill !== "function") return;
    const pid = child.pid;
    const finish = new Promise(resolve => child.once("close", resolve));
    if (process.platform === "win32" && pid) {
        await runTaskKill(pid, false);
    } else {
        try {
            child.kill("SIGTERM");
        } catch {
            /* ignore */
        }
    }
    const exitedEarly = await Promise.race([finish.then(() => true), sleep(gracefulTimeoutMs).then(() => false)]);
    if (exitedEarly) return;
    if (process.platform === "win32" && pid) {
        await runTaskKill(pid, true);
    } else {
        try {
            child.kill("SIGKILL");
        } catch {
            /* ignore */
        }
    }
    await Promise.race([finish, sleep(forceTimeoutMs)]);
}

export async function stopCodegen({ recordingId } = {}) {
    const session = sessions.get(recordingId);
    if (!session) {
        return { status: "PASSED", scriptContent: "", captured: false, error: "Không tìm thấy phiên ghi trên máy này." };
    }
    sessions.delete(recordingId);
    await shutdownProcessTree(session.child);
    const content = await waitForStableFile(session.outputFile);
    try {
        fs.rmSync(session.outputFile, { force: true });
    } catch {
        /* ignore */
    }
    console.log(`[codegen] stopped recordingId=${recordingId} captured=${Boolean(content.trim())}`);
    return { status: "PASSED", scriptContent: content, captured: Boolean(content.trim()) };
}
