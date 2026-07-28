import AIProviderFactory from "../providers/AIProviderFactory.js";
import TestCaseIntelligencePromptBuilder from "../prompts/TestCaseIntelligencePromptBuilder.js";
export default class AITestCaseIntelligenceEngine {
    constructor(provider = null, { promptBuilder } = {}) {
        this.provider = provider || AIProviderFactory.create();
        this.promptBuilder = promptBuilder || new TestCaseIntelligencePromptBuilder();
    }
    async analyze(input) {
        let source = this.name();
        try {
            if (!input?.isValid?.()) return this.fail(source, ["Invalid input"]);
            const rawResponse = await this.provider.generate(this.promptBuilder.build(input));
            source = this.name();
            const p = this.parse(rawResponse);
            if (!Array.isArray(p.testCases))
                return this.fail(source, ["Missing testCases"], rawResponse);
            const owners = new Map(input.scenarios.map(s => [s.id, s]));
            const testCases = p.testCases
                .filter(x => {
                    const s = owners.get(x?.scenarioId);
                    return (
                        s &&
                        x.moduleId === s.moduleId &&
                        x.functionId === s.functionId &&
                        (x.requirementReferences?.length || x.coveredRules?.length) &&
                        x.steps?.length &&
                        x.expectedResult &&
                        !x.actualResult &&
                        !["PASS", "FAIL"].includes(x.status)
                    );
                })
                .map(x => ({ ...x, source }));
            return {
                status: "SUCCESS",
                source,
                testCases,
                notes: Array.isArray(p.notes) ? p.notes : [],
                confidence: Math.min(1, Math.max(0, p.confidence || 0)),
                rawResponse,
                errors: []
            };
        } catch (e) {
            return this.fail(source, [e.message]);
        }
    }
    parse(r) {
        if (r && typeof r === "object") return r;
        let v = String(r || "")
            .trim()
            .replace(/^```json\s*/i, "")
            .replace(/^```\s*/i, "")
            .replace(/\s*```$/i, "");
        const a = v.indexOf("{"),
            b = v.lastIndexOf("}");
        if (a >= 0 && b > a) v = v.slice(a, b + 1);
        return JSON.parse(v);
    }
    name() {
        return String(
            this.provider?.lastSuccessfulProviderName ||
                this.provider?.constructor?.name ||
                "unknown"
        )
            .replace(/Provider$/i, "")
            .toLowerCase();
    }
    fail(source, errors, rawResponse = null) {
        return {
            status: "FAILED",
            source,
            testCases: [],
            notes: [],
            confidence: 0,
            rawResponse,
            errors
        };
    }
}
