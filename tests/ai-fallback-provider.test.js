import FallbackAIProvider from "../src/providers/FallbackAIProvider.js";

class FailingProvider {
    async generate() {
        throw new Error("Simulated primary provider failure.");
    }
}

class WorkingProvider {
    async generate(prompt) {
        return `Fallback response for: ${prompt}`;
    }
}

async function main() {
    console.log("=================================");
    console.log(" AI FALLBACK PROVIDER TEST");
    console.log("=================================");

    try {
        const provider = new FallbackAIProvider(new FailingProvider(), new WorkingProvider());

        const result = await provider.generate("QA Copilot fallback test");

        console.log("");
        console.log("Result:");
        console.log(result);

        if (result !== "Fallback response for: QA Copilot fallback test") {
            throw new Error("Fallback provider returned an unexpected result.");
        }

        console.log("");
        console.log("✓ AI FALLBACK PROVIDER TEST PASSED");
    } catch (error) {
        console.error("");
        console.error("✗ AI FALLBACK PROVIDER TEST FAILED");
        console.error(error);

        process.exitCode = 1;
    }
}

main();
