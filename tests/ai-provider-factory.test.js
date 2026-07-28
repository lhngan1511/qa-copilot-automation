import "dotenv/config";

import AIProviderFactory from "../src/providers/AIProviderFactory.js";
import GeminiProvider from "../src/providers/GeminiProvider.js";

function main() {
    console.log("=================================");
    console.log(" AI PROVIDER FACTORY TEST");
    console.log("=================================");

    try {
        const provider = AIProviderFactory.create();

        console.log(`Configured provider: ${process.env.AI_PROVIDER}`);
        console.log(`Created provider: ${provider.constructor.name}`);

        if (!(provider instanceof GeminiProvider)) {
            throw new Error(`Expected GeminiProvider, but received ${provider.constructor.name}.`);
        }

        console.log("");
        console.log("✓ AI PROVIDER FACTORY TEST PASSED");
    } catch (error) {
        console.error("");
        console.error("✗ AI PROVIDER FACTORY TEST FAILED");
        console.error(error);

        process.exitCode = 1;
    }
}

main();
