import AIProviderFactory from "../providers/AIProviderFactory.js";
import ScenarioIntelligencePromptBuilder from "../prompts/ScenarioIntelligencePromptBuilder.js";

export default class AIScenarioIntelligenceEngine {
    constructor(provider = null, { promptBuilder } = {}) {
        this.provider = provider || AIProviderFactory.create();
        this.promptBuilder = promptBuilder || new ScenarioIntelligencePromptBuilder();
    }

    async analyze(input) {
        let source = this.providerName();
        try {
            if (!input?.isValid?.()) return this.failed(source, ["Scenario intelligence input is invalid."]);
            const rawResponse = await this.provider.generate(this.promptBuilder.build(input));
            source = this.providerName();
            const parsed = this.parse(rawResponse);
            if (!parsed || !Array.isArray(parsed.scenarios)) {
                return this.failed(source, ["AI response must contain scenarios."], rawResponse);
            }
            const owners = new Map(input.functions.map(item => [item.id, item]));
            const scenarios = parsed.scenarios
                .filter(item => item && typeof item === "object")
                .filter(item => owners.has(item.functionId))
                .filter(
                    item =>
                        (Array.isArray(item.requirementReferences) &&
                            item.requirementReferences.length > 0) ||
                        (Array.isArray(item.coveredRules) && item.coveredRules.length > 0)
                )
                .map(item => {
                    const owner = owners.get(item.functionId);
                    return {
                        ...item,
                        moduleId: input.module.id,
                        module: input.module.name,
                        functionId: owner.id,
                        function: owner.name,
                        feature: owner.name,
                        source
                    };
                });
            return {
                status: "SUCCESS",
                source,
                scenarios,
                notes: Array.isArray(parsed.notes) ? parsed.notes : [],
                confidence:
                    typeof parsed.confidence === "number"
                        ? Math.min(1, Math.max(0, parsed.confidence))
                        : 0,
                rawResponse,
                errors: []
            };
        } catch (error) {
            return this.failed(source, [error?.message || "AI scenario intelligence failed."]);
        }
    }

    parse(response) {
        if (response && typeof response === "object") return response;
        if (typeof response !== "string") throw new Error("AI response is empty.");
        let value = response.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "");
        const start = value.indexOf("{");
        const end = value.lastIndexOf("}");
        if (start >= 0 && end > start) value = value.slice(start, end + 1);
        return JSON.parse(value);
    }

    providerName() {
        return String(this.provider?.lastSuccessfulProviderName || this.provider?.constructor?.name || "unknown")
            .replace(/Provider$/i, "")
            .toLowerCase();
    }

    failed(source, errors, rawResponse = null) {
        return { status: "FAILED", source, scenarios: [], notes: [], confidence: 0, rawResponse, errors };
    }
}
