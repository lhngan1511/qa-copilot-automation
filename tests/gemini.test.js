import "dotenv/config";

import GeminiProvider from "../src/providers/GeminiProvider.js";

async function main() {
    console.log("=================================");
    console.log(" GEMINI PROVIDER TEST");
    console.log("=================================");

    try {
        const provider = new GeminiProvider();

        console.log("Provider:", provider.constructor.name);

        const result = await provider.generate("Chỉ trả lời đúng hai từ: HELLO QA");

        console.log("");
        console.log("Gemini Response:");
        console.log(result);
        console.log("");

        if (!result || typeof result !== "string") {
            throw new Error("GeminiProvider không trả về chuỗi kết quả hợp lệ.");
        }

        console.log("✓ GEMINI PROVIDER TEST PASSED");
    } catch (error) {
        console.error("");
        console.error("✗ GEMINI PROVIDER TEST FAILED");
        console.error(error);
        process.exitCode = 1;
    }
}

main();
