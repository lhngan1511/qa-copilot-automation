import RequirementLoader from "./loaders/RequirementLoader.js";
import MarkdownParser from "./parsers/MarkdownParser.js";
import AIAnalysisEngine from "./engines/AIAnalysisEngine.js";

import RequirementIntelligenceEngine
    from "./engines/RequirementIntelligenceEngine.js";

import ScenarioRecommendationEngine
    from "./recommenders/ScenarioRecommendationEngine.js";

import IntelligenceScenarioGenerator
    from "./generators/IntelligenceScenarioGenerator.js";

import TestCaseGenerator
    from "./generators/TestCaseGenerator.js";

import OutputManager
    from "./managers/OutputManager.js";

import JsonExporter
    from "./exporters/JsonExporter.js";


class QACopilot {


    constructor() {


        this.loader =
            new RequirementLoader();


        this.parser =
            new MarkdownParser();


        this.aiEngine =
            new AIAnalysisEngine();


        this.intelligenceEngine =
            new RequirementIntelligenceEngine();


        this.scenarioRecommendationEngine =
            new ScenarioRecommendationEngine();


        this.intelligenceScenarioGenerator =
            new IntelligenceScenarioGenerator();


        this.testCaseGenerator =
            new TestCaseGenerator();


        this.outputManager =
            new OutputManager();


        this.outputManager.registerExporter(
            "json",
            new JsonExporter()
        );


    }





    async run(requirementFile) {


        console.log("\n=================================");
        console.log(" QA COPILOT PIPELINE");
        console.log("=================================\n");



        console.log("[1/7] Loading Requirement...");


        const markdown =
            this.loader.load(
                requirementFile
            );


        console.log("✓ Requirement loaded");



        console.log("\n[2/7] Parsing Requirement...");


        const requirement =
            this.parser.parse(
                markdown
            );


        console.log("✓ Requirement parsed");



        console.log("\n[3/7] AI Analysis...");


        let aiResult = null;


        if (
            process.env.ENABLE_AI === "true"
        ) {


            aiResult =
                await this.aiEngine.analyze(
                    requirement
                );


            console.log(
                "✓ AI analysis completed"
            );


        }
        else {


            console.log(
                "✓ AI skipped - Rule Engine mode"
            );


        }





        console.log("\n[4/7] Building Requirement Intelligence...");


        const knowledge =
            this.intelligenceEngine.analyze(
                requirement
            );


        console.log(
            "✓ Requirement intelligence completed"
        );





        console.log("\nGenerating Recommended Scenarios...");


        const recommendedScenarios =
            this.scenarioRecommendationEngine.generate(
                knowledge
            );


        console.log(
            `✓ ${recommendedScenarios.length} scenarios recommended`
        );





        console.log("\n[5/7] Generating Intelligence Scenarios...");


        const scenarios =
            this.intelligenceScenarioGenerator.generate(
                recommendedScenarios,
                requirement,
                knowledge
            );


        console.log(
            `✓ ${scenarios.length} scenarios generated`
        );





        console.log("\n[6/7] Generating TestCases...");


        const testCases =
            this.testCaseGenerator.generate(
                scenarios
            );


        console.log(
            `✓ ${testCases.length} testcases generated`
        );





        console.log("\n[7/7] Exporting JSON...");


        const output =
            this.outputManager.export(
                testCases,
                "json",
                requirement.feature
            );


        console.log(
            `✓ Output: ${output}`
        );





        return {


            requirement,


            aiResult,


            knowledge,


            recommendedScenarios,


            scenarios,


            testCases,


            output


        };


    }


}


export default QACopilot;