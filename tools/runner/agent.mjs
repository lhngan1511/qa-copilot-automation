import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runJob } from "./playwrightExecution.mjs";
import { startCodegen, stopCodegen } from "./codegenExecution.mjs";
import { runBoundaryJob } from "./boundaryExecution.mjs";

/*
 Runner Agent — chạy trên máy tester, đăng ký với QA Copilot server rồi lặp:
 heartbeat định kỳ -> claim job -> nếu có job RUN_TESTCASE thì chạy Playwright cục bộ -> báo kết quả.

 Cách chạy: node agent.mjs <đường-dẫn-file-config.json>
 Xem config.example.json để biết các trường cần điền (serverUrl/agentId/token lấy từ mục
 "Kết nối máy chạy này" trong menu tài khoản QA Copilot).
*/

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HEARTBEAT_MS = 10000;
const POLL_MS = 3000;

function loadConfig() {
    const configPath = process.argv[2];
    if (!configPath) {
        console.error("Cách dùng: node agent.mjs <đường-dẫn-file-config.json>");
        console.error("Copy config.example.json thành runner-agent.config.json, điền thông tin rồi chạy lại.");
        process.exit(1);
    }
    let raw;
    try {
        raw = fs.readFileSync(configPath, "utf8");
    } catch {
        console.error(`Không đọc được file config: ${configPath}`);
        process.exit(1);
    }
    let config;
    try {
        config = JSON.parse(raw);
    } catch {
        console.error(`File config không phải JSON hợp lệ: ${configPath}`);
        process.exit(1);
    }
    const { serverUrl, agentId, token } = config;
    if (!serverUrl || !agentId || !token) {
        console.error("Config thiếu serverUrl/agentId/token. Xem config.example.json.");
        process.exit(1);
    }
    return config;
}

const config = loadConfig();
const baseUrl = String(config.serverUrl).replace(/\/+$/, "");
const { agentId, token } = config;
const machineName = String(config.machineName ?? "").trim() || os.hostname();

async function api(pathSuffix, body) {
    const response = await fetch(`${baseUrl}${pathSuffix}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {})
    });
    let data = null;
    try {
        data = await response.json();
    } catch {
        /* ignore — non-JSON error body */
    }
    if (!response.ok || data?.success === false) {
        const message = data?.error?.message ?? data?.message ?? `HTTP ${response.status}`;
        const error = new Error(message);
        error.code = data?.error?.code ?? null;
        error.status = response.status;
        throw error;
    }
    // Mọi endpoint runner-agents đều bọc {success,data,error} — kể cả khi data hợp lệ là null
    // (claim() không có job). KHÔNG dùng `?? data`: sẽ nhầm cả envelope thành job khi data=null.
    return Object.prototype.hasOwnProperty.call(data ?? {}, "data") ? data.data : data;
}

function playwrightVersion() {
    try {
        const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "package.json"), "utf8"));
        return pkg.dependencies?.["@playwright/test"] ?? "unknown";
    } catch {
        return "unknown";
    }
}

async function register() {
    return api("/api/runner-agents/register", {
        agentId,
        token,
        machineName,
        capabilities: ["PLAYWRIGHT_RUN", "CODEGEN_RECORD", "BOUNDARY_TEST"],
        runnerVersion: "1.0.0",
        runtime: {
            nodeVersion: process.version,
            platform: `${os.platform()} ${os.release()}`,
            playwrightVersion: playwrightVersion(),
            configFile: "playwright.config.js",
            workDirReady: true,
            browserInstalled: true
        }
    });
}

/* Bug thật đã gặp (2026-09-07): RunnerAgentService chỉ lưu danh sách agent online TRONG RAM, không
   ghi ra đĩa — mỗi lần server restart (vd cập nhật code), danh sách đó mất sạch. Agent bên máy
   tester vẫn tưởng mình "đã đăng ký", heartbeat/claim cứ 404 (RUNNER_AGENT_NOT_REGISTERED) âm thầm
   mãi mãi — tester phải tự tắt/mở lại agent bằng tay mới hết. Sửa: tự phát hiện lỗi này và ĐĂNG KÝ
   LẠI ngay, không cần người can thiệp. */
async function reregisterIfUnknown(err) {
    if (err?.code !== "RUNNER_AGENT_NOT_REGISTERED" && err?.status !== 404) return false;
    console.log("[reconnect] Server không còn nhận diện agent (có thể server vừa khởi động lại) — đăng ký lại...");
    try {
        await register();
        console.log("[reconnect] Đã đăng ký lại thành công.");
        return true;
    } catch (regErr) {
        console.error(`[reconnect] Đăng ký lại thất bại: ${regErr.message}`);
        return false;
    }
}

async function heartbeat() {
    try {
        await api(`/api/runner-agents/${encodeURIComponent(agentId)}/heartbeat`, { token });
    } catch (err) {
        if (await reregisterIfUnknown(err)) return;
        console.error(`[heartbeat] ${err.message}`);
    }
}

async function claim() {
    return api(`/api/runner-agents/${encodeURIComponent(agentId)}/jobs/claim`, { token });
}

async function complete(jobId, result) {
    return api(`/api/runner-agents/${encodeURIComponent(agentId)}/jobs/${encodeURIComponent(jobId)}/complete`, { token, result });
}

async function runOneJob(job) {
    console.log(`[job] nhận job ${job.jobId} (${job.type}) — testCaseId=${job.payload?.testCaseId ?? "?"}`);
    let result;
    if (job.type === "RUN_TESTCASE") {
        const { code, env, runOptions } = job.payload ?? {};
        result = await runJob({ code, env, runOptions });
    } else if (job.type === "START_CODEGEN") {
        // Chỉ spawn CodeGen rồi báo kết quả NGAY (không chờ process thoát) — cửa sổ Inspector chạy
        // nền trong tiến trình agent này tới khi có job STOP_CODEGEN. KHÔNG chặn vòng lặp heartbeat/
        // claim (xem codegenExecution.mjs).
        result = startCodegen(job.payload ?? {});
    } else if (job.type === "STOP_CODEGEN") {
        result = await stopCodegen(job.payload ?? {});
    } else if (job.type === "RUN_BOUNDARY") {
        const { code, env } = job.payload ?? {};
        result = await runBoundaryJob({ code, env });
    } else {
        result = { status: "FAILED", error: `Loại job không hỗ trợ trên Runner này: ${job.type}` };
    }
    console.log(`[job] ${job.jobId} => ${result.status} (${result.durationMs ?? 0}ms, exitCode=${result.exitCode ?? "?"})`);
    try {
        await complete(job.jobId, result);
    } catch (err) {
        console.error(`[job] không báo được kết quả job ${job.jobId}: ${err.message}`);
    }
}

// Giới hạn v1 đã biết: sau khi START_CODEGEN hoàn tất, agent.currentJobId ở server trả về null
// ngay — không có gì chặn 1 job RUN_TESTCASE khác được dispatch tới CÙNG máy trong lúc CodeGen vẫn
// đang ghi nền. Chấp nhận cho mô hình 1 tester/1 máy hiện tại, chưa xử lý ở đây.
async function mainLoop() {
    console.log(`Đang đăng ký "${machineName}" với server ${baseUrl}...`);
    await register();
    console.log("Đã đăng ký. Đang chờ job (Ctrl+C để dừng)...");
    let lastHeartbeat = 0;
    for (;;) {
        const now = Date.now();
        if (now - lastHeartbeat >= HEARTBEAT_MS) {
            await heartbeat();
            lastHeartbeat = now;
        }
        try {
            const job = await claim();
            if (job) {
                await runOneJob(job);
                continue; // kiểm tra job tiếp theo ngay, không đợi POLL_MS
            }
        } catch (err) {
            if (!(await reregisterIfUnknown(err))) {
                console.error(`[claim] ${err.message}`);
            }
        }
        await new Promise(resolve => setTimeout(resolve, POLL_MS));
    }
}

mainLoop().catch(err => {
    console.error("Agent dừng do lỗi:", err);
    process.exit(1);
});
