/**
 * AIAutomationService — điều phối AI Mapping + AI Codegen + Run cho Web UI.
 *
 * Provider mặc định = GeminiProvider qua AIProviderFactory (production).
 * Cho phép inject provider (FakeAIProvider) chỉ trong TEST.
 *
 * KHÔNG có runtime fallback sang mock. Nếu Gemini lỗi → trả diagnostic rõ ràng, dừng.
 */
import fs from "node:fs";
import path from "node:path";
import AIProviderFactory from "../../providers/AIProviderFactory.js";
import AIAutomationMapper from "./AIAutomationMapper.js";
import AIAutomationCodegen from "./AIAutomationCodegen.js";
import PlaywrightRunner from "../PlaywrightRunner.js";

export default class AIAutomationService {
    /**
     * @param {object} [opts]
     * @param {object|null} [opts.aiProvider]  mặc định tạo GeminiProvider
     * @param {string} [opts.rootDir]
     */
    constructor({ aiProvider = null, rootDir = process.cwd() } = {}) {
        this.rootDir = rootDir;
        // Production: AIProviderFactory -> GeminiProvider (đọc .env). Test: inject.
        this.aiProvider = aiProvider ?? AIProviderFactory.createProvider("gemini");
        this.runner = new PlaywrightRunner({ rootDir });
    }

    /** Chạy AI Mapping cho 1 testcase. */
    async analyze({ testCase, codegenFile = null, codegenText = null, confirmedFacts = [] }) {
        const mapper = new AIAutomationMapper(this.aiProvider, { codegenFile });
        const mapping = await mapper.map({ testCase, codegenFile, codegenText, confirmedFacts });
        return mapping;
    }

    /** Chạy AI Codegen cho testcase + approved mapping. */
    async generate({ testCase, mapping, codegenFile = null, codegenText = null, confirmedFacts = [] }) {
        const codegen = new AIAutomationCodegen(this.aiProvider, { rootDir: this.rootDir });
        const { code, validation } = await codegen.generate({
            testCase,
            mapping,
            codegenFile,
            codegenText,
            confirmedFacts
        });
        return { code, validation };
    }

    /** Ghi code sinh ra ra file và trả đường dẫn. */
    saveGeneratedCode({ code, testCaseId, module = "Login" }) {
        const codegen = new AIAutomationCodegen(this.aiProvider, { rootDir: this.rootDir });
        return codegen.writeFile({ code, testCaseId, module });
    }

    /** Chạy file .spec.js đã sinh. */
    async run({ filePath, env = {} }) {
        return this.runner.runFile(filePath, { env });
    }
}
