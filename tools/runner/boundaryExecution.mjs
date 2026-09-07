import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { cliPath } from "./playwrightPath.mjs";

/*
 boundaryExecution — chạy job RUN_BOUNDARY (Kiểm thử biên từ xa, Ngân yêu cầu 2026-09-07) NGAY TRÊN
 MÁY TESTER. Khác hẳn RUN_TESTCASE/playwrightExecution.mjs: 1 file spec chứa NHIỀU test() (mỗi giá
 trị biên/candidate là 1 test, title = candidate.id), cần kết quả PASS/FAIL RIÊNG TỪNG candidate —
 không phải 1 kết quả tổng cho cả file. Mirror ĐÚNG logic phía server (xem
 src/automation/PlaywrightRunner.js#runBoundarySpec/extractBoundaryResults/collectBoundarySpecs) —
 KHÔNG import code server (tools/runner là package tách biệt, tự có node_modules riêng, quy ước
 giống codegenExecution.mjs).

 Ảnh chụp màn hình: đọc bytes từ file Playwright ghi trong test-results/, encode base64, gửi kèm
 result của job — SERVER mới là nơi lưu bền vững (BoundaryTestingService#completeRemoteRun ghi ra
 outputDir/screenshots/ rồi ghép URL /api/boundary-testing/screenshots/<file>, ĐÚNG shape luồng
 chạy local đã dùng). Máy tester không cần giữ ảnh lại.
*/

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORK_DIR = path.join(__dirname, "work");
const SPEC_FILE = path.join(WORK_DIR, "boundary-job.spec.js");

function baseUrl(env) {
    return String(env?.BASE_URL || process.env.BASE_URL || "").trim() || null;
}

/** Đệ quy cây `suites` của Playwright JSON reporter, gom theo `spec.title` (= candidate.id) — mirror
 *  PlaywrightRunner.js#collectBoundarySpecs nguyên vẹn. */
function collectBoundarySpecs(suite, byTitle) {
    for (const s of suite.suites || []) collectBoundarySpecs(s, byTitle);
    for (const spec of suite.specs || []) {
        if (spec.title) byTitle.set(spec.title, spec);
    }
}

function stripAnsi(text) {
    return text.split(String.fromCharCode(27)).join("").replace(/\[[0-9;]*m/g, "");
}

/** Đọc kết quả PASS/FAIL + lỗi + ảnh (base64) từ JSON reporter thật — mirror
 *  PlaywrightRunner.js#extractBoundaryResults, khác 1 điểm: trả base64 thay vì copy file ra thư
 *  mục bền vững (máy tester không cần giữ, server mới lưu). */
function extractBoundaryResults(results) {
    const byTitle = new Map();
    for (const suite of results.suites || []) collectBoundarySpecs(suite, byTitle);
    const resultsById = {};
    for (const [title, spec] of byTitle.entries()) {
        const status = spec.ok ? "PASSED" : "FAILED";
        const errors = [];
        let screenshotBase64 = null;
        for (const test of spec.tests || []) {
            for (const r of test.results || []) {
                if (r.error?.message) errors.push(stripAnsi(String(r.error.message)).slice(0, 500));
                for (const att of r.attachments || []) {
                    if (!screenshotBase64 && String(att.name ?? "") === "screenshot" && att.path) {
                        try {
                            screenshotBase64 = fs.readFileSync(att.path).toString("base64");
                        } catch {
                            /* ảnh không đọc được — không chặn kết quả PASS/FAIL, chỉ thiếu ảnh */
                        }
                    }
                }
            }
        }
        resultsById[title] = { status, errorMessage: errors[0] ?? null, screenshotBase64 };
    }
    return resultsById;
}

export async function runBoundaryJob({ code, env = {} } = {}) {
    if (!code || typeof code !== "string") {
        return { status: "FAILED", error: "Job không có nội dung spec (code rỗng)." };
    }
    if (!baseUrl(env)) {
        return { status: "FAILED", error: "Chưa cấu hình BASE_URL (địa chỉ hệ thống cần kiểm thử)." };
    }

    fs.mkdirSync(WORK_DIR, { recursive: true });
    fs.writeFileSync(SPEC_FILE, code, "utf8");

    let cli;
    try {
        cli = cliPath(__dirname);
    } catch (err) {
        return { status: "FAILED", error: String(err.message ?? err) };
    }

    const jsonOutputFile = path.join(WORK_DIR, `boundary-job-${crypto.randomUUID().slice(0, 8)}.result.json`);
    const boundaryConfigPath = path.join(__dirname, "playwright.boundary.config.js");
    const args = ["test", "--browser=chromium", "--config", boundaryConfigPath, "--reporter=json", "boundary-job.spec.js"];

    // Bug thật đã gặp (2026-09-07, xác nhận bằng cách chạy thật nhiều lần): với slowMo=0 và
    // headless:false (browser hiện thật), Playwright ÂM THẦM KHÔNG chụp được ảnh màn hình cho test
    // PASSED khi screenshot:"on" — chỉ chụp được khi FAILED. Đây là race giữa lúc test/context kết
    // thúc quá nhanh và cơ chế tự chụp ảnh lúc kết thúc. playwright.config.js gốc của repo chính
    // vốn mặc định slowMo=500 ("để demo theo dõi") nên KHÔNG dính bug này — RunBoundarySpec phía
    // server cũng thừa hưởng giá trị đó. tools/runner/playwright.config.js lại mặc định slowMo=0
    // (ưu tiên tốc độ cho RUN_TESTCASE) nên phải TỰ ép sàn tối thiểu riêng cho job RUN_BOUNDARY —
    // không đổi mặc định chung của playwright.config.js vì RUN_TESTCASE không cần ảnh, cần nhanh.
    const requestedSlowMo = Number(env?.PLAYWRIGHT_SLOW_MO ?? process.env.PLAYWRIGHT_SLOW_MO);
    const slowMo = Number.isFinite(requestedSlowMo) && requestedSlowMo > 300 ? requestedSlowMo : 300;

    const result = await new Promise(resolve => {
        const child = spawn(process.execPath, [cli, ...args], {
            cwd: __dirname,
            env: {
                ...process.env,
                ...env,
                BASE_URL: baseUrl(env) || "",
                PLAYWRIGHT_SLOW_MO: String(slowMo),
                PLAYWRIGHT_JSON_OUTPUT_NAME: jsonOutputFile
            },
            stdio: ["ignore", "pipe", "pipe"],
            windowsHide: false
        });
        let stderr = "";
        child.stdout.on("data", d => process.stdout.write(d));
        child.stderr.on("data", d => { stderr += d; process.stderr.write(d); });
        child.on("error", err => resolve({ status: "FAILED", error: String(err) }));
        child.on("close", () => {
            let json = null;
            if (fs.existsSync(jsonOutputFile)) {
                try {
                    json = JSON.parse(fs.readFileSync(jsonOutputFile, "utf8"));
                } catch {
                    json = null;
                }
            }
            try {
                fs.rmSync(jsonOutputFile, { force: true });
            } catch {
                /* ignore */
            }
            if (!json) {
                resolve({ status: "FAILED", error: stderr.slice(-1000) || "Không đọc được kết quả JSON của Playwright." });
                return;
            }
            resolve({ status: "PASSED", resultsById: extractBoundaryResults(json) });
        });
    });

    return result;
}
