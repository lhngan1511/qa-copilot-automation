import AIProviderFactory from "../providers/AIProviderFactory.js";
import AIAutomationMapper from "../automation/ai/AIAutomationMapper.js";
import AIAutomationCodegen from "../automation/ai/AIAutomationCodegen.js";
import PlaywrightRunner from "../automation/PlaywrightRunner.js";
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
        if (!result.validation?.ok) return { ...result, filePath: null };
        const filePath = codegen.writeFile({ code: result.code, testCaseId: testCase.id, module: testCase.module || "Module" });
        return { ...result, filePath };
    }

    async run({ filePath, env = {} }) {
        if (!filePath) throw new Error("Thiếu file kiểm thử đã sinh.");
        return this.runner.runFile(filePath, { env });
    }
}
