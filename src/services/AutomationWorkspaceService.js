import AIProviderFactory from "../providers/AIProviderFactory.js";
import AIAutomationMapper from "../automation/ai/AIAutomationMapper.js";
import AIAutomationCodegen from "../automation/ai/AIAutomationCodegen.js";
import PlaywrightRunner from "../automation/PlaywrightRunner.js";
import { runtimeEnvFor } from "../automation/ai/codegenSkeleton.js";
import crypto from "node:crypto";

export default class AutomationWorkspaceService {
    constructor({ rootDir = process.cwd(), aiProvider = null } = {}) {
        this.rootDir = rootDir;
        this.aiProvider = aiProvider;
        this.runner = new PlaywrightRunner({ rootDir });
    }

    provider() {
        return this.aiProvider ?? (this.aiProvider = AIProviderFactory.createProvider("gemini"));
    }

    newRequestId() {
        return `ANALYZE-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`;
    }

    /**
     * Bọc provider để đếm số lần generate và log promptLength.
     * Không thay đổi hành vi provider/mapper.
     */
    /**
     * Bọc provider để đếm số lần generate + log promptLength, rồi RESTORE generate
     * sau request (tránh chồng wrapper giữa các request). Không đổi hành vi mapper.
     */
    wrapProviderForLogging(requestId) {
        const provider = this.provider();
        const noop = { provider, stats: { calls: 0, promptLengths: [] }, restore: () => {} };
        if (!provider || typeof provider.generate !== "function") return noop;
        const stats = { calls: 0, promptLengths: [] };
        const original = provider.generate;
        provider.generate = async prompt => {
            stats.calls += 1;
            const len = typeof prompt === "string" ? prompt.length : JSON.stringify(prompt ?? {}).length;
            stats.promptLengths.push(len);
            console.log(`[ANALYZE_START] requestId=${requestId} providerCall=${stats.calls} promptLength=${len}`);
            return original.call(provider, prompt);
        };
        return {
            provider,
            stats,
            restore: () => {
                provider.generate = original;
            }
        };
    }

    async analyze({ module = "", testCases = [], codegenText = "", confirmedFacts = [] }) {
        const requestId = this.newRequestId();
        const startedAt = Date.now();
        const testCaseCount = Array.isArray(testCases) ? testCases.length : 0;
        const codegenLength = String(codegenText ?? "").length;
        if (!Array.isArray(testCases) || testCases.length === 0) throw new Error("Thiếu danh sách testcase.");
        if (!String(codegenText).trim()) throw new Error("Thiếu nội dung CodeGen.");
        console.log(`[ANALYZE_START] requestId=${requestId} testCaseCount=${testCaseCount} codegenLength=${codegenLength}`);
        const wrapped = this.wrapProviderForLogging(requestId);
        const { provider, stats } = wrapped;
        try {
            const mapper = new AIAutomationMapper(provider);
            const result = await mapper.mapModule({ module, testCases, codegenText, confirmedFacts });
            const durationMs = Date.now() - startedAt;
            console.log(
                `[ANALYZE_SUCCESS] requestId=${requestId} durationMs=${durationMs} providerCalls=${stats.calls} promptLengths=${JSON.stringify(stats.promptLengths)} mapped=${Array.isArray(result?.testCaseMappings) ? result.testCaseMappings.length : 0}`
            );
            return result;
        } catch (error) {
            const durationMs = Date.now() - startedAt;
            console.error(
                `[ANALYZE_ERROR] requestId=${requestId} durationMs=${durationMs} providerCalls=${stats.calls} error=${error?.message}`
            );
            throw error;
        } finally {
            wrapped.restore();
        }
    }

    async generate({ testCase, mapping, codegenText = "", confirmedFacts = [] }) {
        if (!testCase?.id) throw new Error("Thiếu testcase hợp lệ.");
        if (!mapping) throw new Error("Thiếu mapping đã phân tích.");
        const codegen = new AIAutomationCodegen(this.provider(), { rootDir: this.rootDir });
        const result = await codegen.generate({ testCase, mapping, codegenText, confirmedFacts });
        // Ưu tiên guard error (vd ASSERTION_MAPPING_REQUIRED khi fallback từ chối) trước,
        // để không bị lẫn với lỗi rule validation giả (validateCode("")).
        if (result.guard && !result.guard.ok) {
            console.log(
                `[CODEGEN_SERVICE_GENERATE_RESULT] written=false filePath=null exists=false errorCode=${result.guard.errorCode ?? "?"} errorMessage=${JSON.stringify(result.guard.reason ?? "")}`
            );
            return {
                ...result,
                filePath: null,
                exists: false,
                written: false,
                guardError: result.guard.errorCode,
                guardReason: result.guard.reason,
                errorCode: result.guard.errorCode
            };
        }
        // Không ghi file nếu code chưa hoàn chỉnh / hỏng encoding / syntax lỗi.
        if (!result.validation?.ok) {
            console.log(
                `[CODEGEN_SERVICE_GENERATE_RESULT] written=false filePath=null exists=false errorCode=CODEGEN_RULE_VALIDATION_FAILED errorMessage=${JSON.stringify(result.validation?.errors ?? [])}`
            );
            return {
                ...result,
                filePath: null,
                exists: false,
                written: false,
                status: "GENERATE_FAILED",
                errorCode: "CODEGEN_RULE_VALIDATION_FAILED",
                errors: result.validation?.errors ?? [],
                source: result.source
            };
        }
        const filePath = codegen.writeFile({ code: result.code, testCaseId: testCase.id, module: testCase.module || "Module" });
        const fs = await import("node:fs");
        // Runtime env (TESTDATA_*) cho Runner — từ value đã resolve theo thứ tự ưu tiên, không log giá trị.
        const runtimeEnv = runtimeEnvFor({ testCase, mapping, codegenText });
        const exists = fs.existsSync(filePath);
        console.log(
            `[CODEGEN_SERVICE_GENERATE_RESULT] written=true filePath=${filePath} exists=${exists} errorCode=null errorMessage=""`
        );
        // Trả đường dẫn tuyệt đối chuẩn + xác nhận file tồn tại ngay sau khi ghi.
        return { ...result, filePath, exists, written: true, runtimeEnv };
    }

    async run({ filePath, env = {}, testCaseId = "", headed = null, slowMo = null }) {
        if (!filePath) throw new Error("Thiếu file kiểm thử đã sinh.");
        const fs = await import("node:fs");
        const path = await import("node:path");
        const abs = path.resolve(this.rootDir, filePath);
        // Log an toàn (không log password/secret): testCaseId, filePath, isAbsolute, exists, cwd.
        console.log(
            `[RUN_REQUEST] testCaseId=${testCaseId || "?"} filePath=${filePath} isAbsolute=${path.isAbsolute(filePath)} exists=${fs.existsSync(abs)} cwd=${this.rootDir}`
        );
        return this.runner.runFile(filePath, { env, testCaseId, headed, slowMo });
    }

    /**
     * Xuất danh sách testcase đã chọn ra file selected-testcases.json
     * (để dùng lại / chia cho tester khác / chạy CI-CD).
     */
    async exportSelected({ module = "", testCases = [], filePath = null } = {}) {
        if (!Array.isArray(testCases) || testCases.length === 0) {
            throw new Error("Không có testcase nào được chọn để xuất.");
        }
        const fs = await import("node:fs");
        const path = await import("node:path");
        const outDir = path.join(this.rootDir, "outputs", "automation-export");
        fs.mkdirSync(outDir, { recursive: true });
        const target = filePath
            ? path.join(this.rootDir, filePath)
            : path.join(outDir, "selected-testcases.json");
        const payload = {
            module,
            exportedAt: new Date().toISOString(),
            source: "Automation Intelligence Workspace",
            count: testCases.length,
            testCases: testCases.map((tc) => {
                const { mapping, ...rest } = tc ?? {};
                return {
                    ...rest,
                    mapping
                };
            })
        };
        fs.writeFileSync(target, JSON.stringify(payload, null, 2), "utf8");
        return { filePath: path.relative(this.rootDir, target), count: testCases.length };
    }
}
