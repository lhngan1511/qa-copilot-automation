import AIProviderFactory from "../providers/AIProviderFactory.js";
import RequirementIntelligencePromptBuilder from "../prompts/RequirementIntelligencePromptBuilder.js";
import RequirementKnowledge from "../models/RequirementKnowledge.js";
import RequirementKnowledgeValidator from "../validators/RequirementKnowledgeValidator.js";

export default class AIRequirementIntelligenceEngine {
    constructor(provider = null, { promptBuilder, validator } = {}) {
        this.provider = provider || AIProviderFactory.create();
        this.promptBuilder = promptBuilder || new RequirementIntelligencePromptBuilder();
        this.validator = validator || new RequirementKnowledgeValidator();
    }

    async analyze(input) {
        let source = this.getProviderName();

        try {
            if (!input || typeof input.isValid !== "function" || !input.isValid()) {
                return this.failed(source, ["Requirement intelligence input is invalid."]);
            }

            const prompt = this.promptBuilder.build(input);
            const rawResponse = await this.provider.generate(prompt);
            source = this.getProviderName();
            const parsed = this.parseResponse(rawResponse);
            const knowledge = new RequirementKnowledge({
                module: parsed?.module,
                functions: parsed?.functions,
                notes: parsed?.notes,
                confidence: parsed?.confidence,
                clarificationAnswers: input.clarifications,
                source
            });
            const validation = this.validator.validate(knowledge);

            if (!knowledge.module || knowledge.functions.length === 0 || !validation.valid) {
                return this.failed(source, validation.errors.length ? validation.errors : [
                    "AI response must contain a valid module and at least one valid function."
                ], rawResponse);
            }

            return {
                status: "SUCCESS",
                source,
                knowledge,
                rawResponse,
                errors: []
            };
        } catch (error) {
            return this.failed(source, [error?.message || "AI requirement intelligence failed."]);
        }
    }

    parseResponse(response) {
        if (response && typeof response === "object") {
            return response;
        }

        if (typeof response !== "string" || !response.trim()) {
            throw new Error("AI response is empty.");
        }

        let json = response
            .trim()
            .replace(/^```json\s*/i, "")
            .replace(/^```\s*/i, "")
            .replace(/\s*```$/i, "")
            .trim();
        const start = json.indexOf("{");
        const end = json.lastIndexOf("}");

        if (start >= 0 && end > start) {
            json = json.slice(start, end + 1);
        }

        return JSON.parse(json);
    }

    getProviderName() {
        const successful = this.provider?.lastSuccessfulProviderName;

        if (typeof successful === "string" && successful.trim()) {
            return successful.trim().toLowerCase();
        }

        return String(this.provider?.constructor?.name || "unknown")
            .replace(/Provider$/i, "")
            .toLowerCase();
    }

    failed(source, errors, rawResponse = null) {
        return {
            status: "FAILED",
            source,
            knowledge: null,
            rawResponse,
            errors
        };
    }
}
