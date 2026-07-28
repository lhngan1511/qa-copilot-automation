import AIProvider from "./AIProvider.js";

class FallbackAIProvider extends AIProvider {
    constructor(primaryProvider, fallbackProvider) {
        super();

        if (!primaryProvider) {
            throw new Error("FallbackAIProvider requires a primary provider.");
        }

        if (!fallbackProvider) {
            throw new Error("FallbackAIProvider requires a fallback provider.");
        }

        this.primaryProvider = primaryProvider;
        this.fallbackProvider = fallbackProvider;
        this.lastSuccessfulProviderName = "";
    }

    async generate(prompt) {
        if (typeof prompt !== "string" || !prompt.trim()) {
            throw new Error("FallbackAIProvider.generate() requires a non-empty prompt.");
        }

        this.lastSuccessfulProviderName = "";

        try {
            console.log(`[AI] Primary provider: ${this.primaryProvider.constructor.name}`);

            const result = await this.primaryProvider.generate(prompt);

            if (typeof result !== "string" || !result.trim()) {
                throw new Error("Primary provider returned an empty response.");
            }

            this.lastSuccessfulProviderName = this.getProviderName(this.primaryProvider);

            return result.trim();
        } catch (primaryError) {
            console.warn(`[AI] Primary provider failed: ${primaryError.message}`);

            console.warn(`[AI] Falling back to: ${this.fallbackProvider.constructor.name}`);

            try {
                const fallbackResult = await this.fallbackProvider.generate(prompt);

                if (typeof fallbackResult !== "string" || !fallbackResult.trim()) {
                    throw new Error("Fallback provider returned an empty response.");
                }

                this.lastSuccessfulProviderName = this.getProviderName(this.fallbackProvider);

                return fallbackResult.trim();
            } catch (fallbackError) {
                throw new Error(
                    [
                        "All AI providers failed.",
                        `Primary: ${primaryError.message}`,
                        `Fallback: ${fallbackError.message}`
                    ].join(" ")
                );
            }
        }
    }

    getProviderName(provider) {
        return String(provider?.constructor?.name || "")
            .replace(/Provider$/i, "")
            .trim()
            .toLowerCase();
    }
}

export default FallbackAIProvider;
