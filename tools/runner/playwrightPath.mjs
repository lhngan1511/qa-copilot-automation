import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

/**
 * Resolve đường dẫn CLI JS thật của Playwright (không dùng .cmd shim) — cùng cách
 * src/automation/PlaywrightRunner.js làm ở phía server, để hành vi chạy giống hệt.
 * Runner tự có node_modules riêng (không phụ thuộc repo qa-copilot-automation).
 */
export function cliPath(rootDir) {
    try {
        const req = createRequire(path.join(rootDir, "package.json"));
        try {
            return req.resolve("@playwright/test/cli");
        } catch {
            /* fallthrough */
        }
        try {
            return req.resolve("playwright/cli.js");
        } catch {
            /* fallthrough */
        }
    } catch {
        /* fallthrough */
    }
    for (const base of ["@playwright/test", "playwright"]) {
        const candidate = path.join(rootDir, "node_modules", base, "cli.js");
        if (fs.existsSync(candidate)) return candidate;
    }
    throw new Error(
        "Không tìm thấy Playwright CLI (cli.js). Hãy chạy `npm install` trong thư mục tools/runner trước."
    );
}
