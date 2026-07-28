import "dotenv/config";

import RequirementLoader from "../src/loaders/RequirementLoader.js";
import MarkdownParser from "../src/parsers/MarkdownParser.js";
import AIAnalysisEngine from "../src/engines/AIAnalysisEngine.js";
import GeminiProvider from "../src/providers/GeminiProvider.js";
import AIConfig from "../src/config/AIConfig.js";

async function main() {
    const requirementFile = "./requirements/thiet-bi.md";
    const shortPrompt = "Reply exactly: HELLO QA";

    const requirement = new MarkdownParser().parse(new RequirementLoader().load(requirementFile));

    const provider = new GeminiProvider(AIConfig.gemini);
    const engine = new AIAnalysisEngine(provider);
    const pipelinePrompt = engine.buildPrompt(requirement);

    const promptLengths = [];
    let generateCallCount = 0;

    const originalGenerate = provider.generate.bind(provider);

    provider.generate = async prompt => {
        generateCallCount += 1;
        promptLengths.push(typeof prompt === "string" ? prompt.length : 0);

        return originalGenerate(prompt);
    };

    let shortPromptStatus = "PASS";
    let shortPromptError = null;

    try {
        await provider.generate(shortPrompt);
    } catch (error) {
        shortPromptStatus = "FAIL";
        shortPromptError = error;
    }

    const callsBeforePipelineAnalysis = generateCallCount;
    const analysisResult = await engine.analyze(requirement);
    const pipelineGenerateCallCount = generateCallCount - callsBeforePipelineAnalysis;
    const pipelinePromptStatus = analysisResult.analysisStatus === "SUCCESS" ? "PASS" : "FAIL";

    console.log("=================================");
    console.log(" GEMINI PIPELINE DIAGNOSTIC");
    console.log("=================================");
    console.log("Requirement File:", requirementFile);
    console.log("Model:", provider.model);
    console.log("Short Prompt Status:", shortPromptStatus);
    console.log("Short Prompt Length:", shortPrompt.length);
    console.log("Pipeline Prompt Status:", pipelinePromptStatus);
    console.log("Pipeline Prompt Length:", pipelinePrompt.length);
    console.log("Generate Call Count:", generateCallCount);
    console.log("Pipeline Generate Call Count:", pipelineGenerateCallCount);
    console.log("Observed Prompt Lengths:", promptLengths);
    console.log("Analysis Status:", analysisResult.analysisStatus);
    console.log("Analysis Source:", analysisResult.analysisSource);

    if (shortPromptError) {
        console.log("Short Prompt Error:", {
            name: shortPromptError.name,
            message: shortPromptError.message,
            causeName: shortPromptError.cause?.name,
            causeMessage: shortPromptError.cause?.message,
            causeCode: shortPromptError.cause?.code
        });
    }

    if (shortPromptStatus === "FAIL" || pipelinePromptStatus === "FAIL") {
        process.exitCode = 1;
    }
}

main().catch(error => {
    console.error("Gemini pipeline diagnostic failed:", {
        name: error?.name,
        message: error?.message,
        causeName: error?.cause?.name,
        causeMessage: error?.cause?.message,
        causeCode: error?.cause?.code
    });
    process.exitCode = 1;
});
