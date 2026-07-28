import AIConfig from "../config/AIConfig.js";

import OpenAIProvider from "./OpenAIProvider.js";
import GeminiProvider from "./GeminiProvider.js";
import ClaudeProvider from "./ClaudeProvider.js";
import OllamaProvider from "./OllamaProvider.js";
import FallbackAIProvider from "./FallbackAIProvider.js";

class AIProviderFactory {
    static createProvider(providerName) {
        const provider = String(providerName || "")
            .trim()
            .toLowerCase();

        switch (provider) {
            case "openai":
                return new OpenAIProvider(AIConfig.openai);

            case "gemini":
                return new GeminiProvider(AIConfig.gemini);

            case "claude":
                return new ClaudeProvider(AIConfig.claude);

            case "ollama":
                return new OllamaProvider(AIConfig.ollama);

            default:
                throw new Error(`Unsupported AI Provider: ${provider}`);
        }
    }

    static create() {
        const primaryProvider = this.createProvider(AIConfig.provider);

        const fallbackEnabled =
            String(process.env.AI_FALLBACK_ENABLED || "false").toLowerCase() === "true";

        if (!fallbackEnabled) {
            return primaryProvider;
        }

        const fallbackProviderName = process.env.AI_FALLBACK_PROVIDER || "ollama";

        if (
            String(AIConfig.provider).toLowerCase() === String(fallbackProviderName).toLowerCase()
        ) {
            return primaryProvider;
        }

        const fallbackProvider = this.createProvider(fallbackProviderName);

        return new FallbackAIProvider(primaryProvider, fallbackProvider);
    }
}

export default AIProviderFactory;
