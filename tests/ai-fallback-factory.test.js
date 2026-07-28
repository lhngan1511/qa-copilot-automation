import "dotenv/config";

import AIProviderFactory from "../src/providers/AIProviderFactory.js";
import FallbackAIProvider from "../src/providers/FallbackAIProvider.js";
import GeminiProvider from "../src/providers/GeminiProvider.js";
import OllamaProvider from "../src/providers/OllamaProvider.js";

function main() {
    console.log("=================================");
    console.log(" AI FALLBACK FACTORY TEST");
    console.log("=================================");

    try {
        const provider = AIProviderFactory.create();

        console.log(`Configured provider: ${process.env.AI_PROVIDER}`);

        console.log(`Fallback enabled: ${process.env.AI_FALLBACK_ENABLED}`);

        console.log(`Fallback provider: ${process.env.AI_FALLBACK_PROVIDER}`);

        console.log(`Created provider: ${provider.constructor.name}`);

        if (!(provider instanceof FallbackAIProvider)) {
            throw new Error(
                `Expected FallbackAIProvider, but received ${provider.constructor.name}.`
            );
        }

        if (!(provider.primaryProvider instanceof GeminiProvider)) {
            throw new Error("Expected primary provider to be GeminiProvider.");
        }

        if (!(provider.fallbackProvider instanceof OllamaProvider)) {
            throw new Error("Expected fallback provider to be OllamaProvider.");
        }

        console.log(`Primary instance: ${provider.primaryProvider.constructor.name}`);

        console.log(`Fallback instance: ${provider.fallbackProvider.constructor.name}`);

        console.log("");
        console.log("✓ AI FALLBACK FACTORY TEST PASSED");
    } catch (error) {
        console.error("");
        console.error("✗ AI FALLBACK FACTORY TEST FAILED");
        console.error(error);

        process.exitCode = 1;
    }
}

main();
