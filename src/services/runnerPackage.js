/*
 runnerPackage — helpers cho "Tải gói cài đặt Runner Agent" (Ngân yêu cầu 2026-09-07: tải 1 file
 .zip điền sẵn cấu hình + script cài 1 lần, thay cho việc tester phải tự copy thư mục/gõ tay
 config/giữ terminal mở). Tách hàm dựng nội dung config.json ra thuần (không đụng fs/network) để
 test được trực tiếp, không cần dựng server thật hay giải nén zip.
*/

/** Nội dung runner-agent.config.json sẽ nằm TRONG zip — sinh trong bộ nhớ, KHÔNG BAO GIỜ ghi ra
 *  đĩa server (token gốc chỉ tồn tại đúng 1 lần ở response tạo Runner Device, xem
 *  RunnerDeviceService#create — ghi ra đĩa server dù tạm thời cũng là rò rỉ). */
export function buildRunnerAgentConfig({ serverUrl, agentId, token, machineName }) {
    return {
        serverUrl: String(serverUrl ?? ""),
        agentId: String(agentId ?? ""),
        token: String(token ?? ""),
        machineName: String(machineName ?? "")
    };
}

/** Tên file zip gợi ý — an toàn cho tên file (không dấu, không ký tự đặc biệt). */
export function suggestPackageFileName(machineName) {
    const slug = String(machineName ?? "")
        .normalize("NFKD")
        .replace(/[^\p{L}\p{N}]+/gu, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase()
        .slice(0, 40) || "runner";
    return `qa-copilot-runner-${slug}.zip`;
}

/** Danh sách file tĩnh (đọc thẳng từ tools/runner/ tại thời điểm request) được đóng gói vào zip —
 *  KHÔNG gồm codegenExecution.test.mjs (chỉ dev dùng), config.example.json (thay bằng config đã
 *  điền sẵn), .gitignore, hay node_modules/work/test-results (build/runtime artifact). */
export const RUNNER_PACKAGE_STATIC_FILES = [
    "agent.mjs",
    "codegenExecution.mjs",
    "boundaryExecution.mjs",
    "playwrightExecution.mjs",
    "playwrightPath.mjs",
    "package.json",
    "package-lock.json",
    "playwright.config.js",
    "playwright.boundary.config.js",
    "setup.ps1",
    "setup.bat"
];
