import AIProviderFactory from "../providers/AIProviderFactory.js";
import AIAutomationMapper from "../automation/ai/AIAutomationMapper.js";
import AIAutomationCodegen from "../automation/ai/AIAutomationCodegen.js";
import PlaywrightRunner from "../automation/PlaywrightRunner.js";

export default class AutomationWorkspaceService {
    constructor({ rootDir = process.cwd(), aiProvider = null } = {}) {
        this.rootDir = rootDir;
        this.aiProvider = aiProvider;
        this.runner = new PlaywrightRunner({ rootDir });
    }

    provider() {
        return this.aiProvider ?? (this.aiProvider = AIProviderFactory.createProvider("gemini"));
    }

    async analyze({ module = "", testCases = [], codegenText = "", confirmedFacts = [] }) {
        if (!Array.isArray(testCases) || testCases.length === 0) throw new Error("Thiếu danh sách testcase.");
        if (!String(codegenText).trim()) throw new Error("Thiếu nội dung CodeGen.");
        const mapper = new AIAutomationMapper(this.provider());
        return mapper.mapModule({ module, testCases, codegenText, confirmedFacts });
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
