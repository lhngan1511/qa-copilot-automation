import RequirementLoader from "./loaders/RequirementLoader.js";
import MarkdownParser from "./parsers/MarkdownParser.js";
import AIAnalysisEngine from "./engines/AIAnalysisEngine.js";
import TestScenarioGenerator from "./generators/TestScenarioGenerator.js";
import TestCaseGenerator from "./generators/TestCaseGenerator.js";
import OutputManager from "./managers/OutputManager.js";

class QACopilot {

    constructor() {

        this.loader =
            new RequirementLoader();

        this.parser =
            new MarkdownParser();

        this.aiEngine =
            new AIAnalysisEngine();

        this.scenarioGenerator =
            new TestScenarioGenerator();

        this.testCaseGenerator =
            new TestCaseGenerator();

        this.outputManager =
            new OutputManager();

    }

    run(requirementFile) {

        console.log("\n=================================");
        console.log(" QA COPILOT PIPELINE");
        console.log("=================================\n");

        console.log("[1/6] Loading Requirement...");

        const markdown =
            this.loader.load(requirementFile);

        console.log("✓ Requirement loaded");



        console.log("\n[2/6] Parsing Requirement...");

        const requirement =
            this.parser.parse(markdown);

        console.log("✓ Requirement parsed");



        console.log("\n[3/6] AI Analysis...");

        const aiResult =
            this.aiEngine.analyze(requirement);

        console.log("✓ AI analysis completed");



        console.log("\n[4/6] Generating Scenarios...");

        const scenarios =
            this.scenarioGenerator.generate(aiResult);

        console.log(
            `✓ ${scenarios.length} scenarios generated`
        );



        console.log("\n[5/6] Generating TestCases...");

        const testCases =
            this.testCaseGenerator.generate(scenarios);

        console.log(
            `✓ ${testCases.length} testcases generated`
        );



        console.log("\n[6/6] Exporting JSON...");

        const output =
            this.outputManager.export(
                testCases,
                "json",
                requirement.feature
            );

        console.log(`✓ Output: ${output}`);

        console.log("\n=================================");
        console.log(" PIPELINE COMPLETED");
        console.log("=================================\n");

        return {

            requirement,

            aiResult,

            scenarios,

            testCases,

            output

        };

    }

}

export default QACopilot;