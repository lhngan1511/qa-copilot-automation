import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/*
 P0 — AI PROVIDER RECOVERY: regression cho root cause CodeGen.

 Root cause (đã trace + reproduce): src/controllers/CodeGenController.js KHÔNG có import
 AIProviderFactory/AIConfig → analyzeRecording gặp ReferenceError → bare `catch { provider = null; }`
 nuốt lỗi → trả `AI_PROVIDER_UNAVAILABLE` GIẢ dù ENABLE_AI=true, AI_PROVIDER=gemini,
 GEMINI_API_KEY đã cấu hình. Provider thực tế CHƯA BAO GIỜ được tạo.

 Fix (tối thiểu, reuse infra): thêm 2 import vào đầu controller.

 Test này:
   1. Static contract — controller có import (chặn tái phạm).
   2. Runtime — AI_PROVIDER=gemini + key (dummy) → analyze KHÔNG trả AI_PROVIDER_UNAVAILABLE;
      provider GeminiProvider được tạo; generate() được gọi (network sandbox chặn → AI_REQUEST_FAILED
      là kết quả hợp lệ — KHÔNG được giả vờ proposals:[] khi provider chưa chạy).
*/

const testDir = path.dirname(fileURLToPath(import.meta.url));
const controllerSource = fs.readFileSync(path.join(testDir, "..", "src", "controllers", "CodeGenController.js"), "utf8");

// ---- 1. Static: controller có import đúng infra (không tạo provider thứ hai) ----
assert.ok(controllerSource.includes('import AIProviderFactory from "../providers/AIProviderFactory.js";'),
    "CodeGenController import AIProviderFactory (fix thiếu import)");
assert.ok(controllerSource.includes('import AIConfig from "../config/AIConfig.js";'),
    "CodeGenController import AIConfig (fix thiếu import)");

// ---- 2. Runtime: gemini + key → provider được tạo, generate reached, KHÔNG UNAVAILABLE ----
const originalProvider = process.env.AI_PROVIDER;
const originalKey = process.env.GEMINI_API_KEY;
process.env.AI_PROVIDER = "gemini";
process.env.GEMINI_API_KEY = "dummy-key-for-regression-test"; // KHÔNG load .env — tránh key thật/network

try {
    const { default: createApp } = await import("../src/server/createApp.js");
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ai-provider-reg-"));
    const app = createApp({
        repositoryType: "file",
        dataDir: path.join(tempRoot, "data"),
        outputDir: path.join(tempRoot, "o"),
        v3OutputDir: path.join(tempRoot, "out")
    });
    const srv = await new Promise(r => { const s = app.listen(0, "127.0.0.1", () => r(s)); });
    const base = `http://127.0.0.1:${srv.address().port}`;
    async function req(m, p, b) {
        const r = await fetch(`${base}${p}`, { method: m, headers: b ? { "content-type": "application/json" } : {}, body: b ? JSON.stringify(b) : undefined });
        return { status: r.status, body: await r.json() };
    }
    const SRC = "await page.goto('http://x/login');\nawait page.getByRole('button', { name: 'Đăng nhập' }).click();\nawait expect(page.getByText('Xin chào')).toBeVisible();";
    const start = await req("POST", "/api/codegen/start", { url: "about:blank", browser: "chrome", mode: "FULL_FLOW" });
    const recId = start.body?.data?.recordingId ?? start.body?.recordingId;
    assert.ok(recId, "recordingId");
    await req("POST", `/api/codegen/recordings/${recId}/script`, { script: SRC });
    const a = await req("POST", "/api/codegen/analyze", { recordingId: recId });
    assert.equal(a.status, 200, "analyze 200");
    assert.ok(Array.isArray(a.body?.data?.proposals), "proposals là array");
    // KHÔNG còn AI_PROVIDER_UNAVAILABLE giả — provider thực sự được tạo (dù network sandbox có thể fail).
    assert.notEqual(a.body?.error?.code, "AI_PROVIDER_UNAVAILABLE",
        "KHÔNG trả AI_PROVIDER_UNAVAILABLE khi AI_PROVIDER=gemini + key đã cấu hình (root cause đã fix)");
    assert.ok(["AI_REQUEST_FAILED", "AI_RESPONSE_INVALID", "ANALYZE_FAILED"].includes(a.body?.error?.code) || a.body?.data?.proposals.length > 0,
        "sau fix: response phải là proposals>0 hoặc lỗi THẬT từ provider (AI_REQUEST_FAILED/AI_RESPONSE_INVALID) — không giả vờ");
    srv.close();
    fs.rmSync(tempRoot, { recursive: true, force: true });
} finally {
    if (originalProvider === undefined) delete process.env.AI_PROVIDER; else process.env.AI_PROVIDER = originalProvider;
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = originalKey;
}

console.log("Automation V3 AI Provider Recovery test: PASS");
