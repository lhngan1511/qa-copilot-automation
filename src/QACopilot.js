import RequirementLoader from "./loaders/RequirementLoader.js";
import MarkdownParser from "./parsers/MarkdownParser.js";

import AIAnalysisEngine from "./engines/AIAnalysisEngine.js";

import RequirementIntelligenceEngine from "./engines/RequirementIntelligenceEngine.js";

import ScenarioRecommendationEngine from "./recommenders/ScenarioRecommendationEngine.js";

import ScenarioEnrichmentEngine from "./engines/ScenarioEnrichmentEngine.js";

import IntelligenceScenarioGenerator from "./generators/IntelligenceScenarioGenerator.js";

import TestCaseGenerator from "./generators/TestCaseGenerator.js";

import OutputManager from "./managers/OutputManager.js";

import JsonExporter from "./exporters/JsonExporter.js";

import MarkdownExporter from "./exporters/MarkdownExporter.js";

import ExcelExporter from "./exporters/ExcelExporter.js";

import CsvExporter from "./exporters/CsvExporter.js";

import FileNameGenerator from "./utils/FileNameGenerator.js";

class QACopilot {
    constructor() {
        this.loader = new RequirementLoader();

        this.parser = new MarkdownParser();

        this.aiEngine = new AIAnalysisEngine();

        this.intelligenceEngine = new RequirementIntelligenceEngine();

        this.scenarioRecommendationEngine = new ScenarioRecommendationEngine();

        this.scenarioEnrichmentEngine = new ScenarioEnrichmentEngine();

        this.intelligenceScenarioGenerator = new IntelligenceScenarioGenerator();

        this.testCaseGenerator = new TestCaseGenerator();

        this.outputManager = new OutputManager();

        this.fileNameGenerator = new FileNameGenerator();

        /*
            Register Output Exporters
        */

        this.outputManager.registerExporter("json", new JsonExporter());

        this.outputManager.registerExporter("markdown", new MarkdownExporter());

        this.outputManager.registerExporter("excel", new ExcelExporter());

        this.outputManager.registerExporter("csv", new CsvExporter());
    }

    async run(requirementFile) {
        console.log("\n=================================");
        console.log(" QA COPILOT PIPELINE");
        console.log("=================================\n");

        console.log("[1/8] Loading Requirement...");

        const markdown = this.loader.load(requirementFile);

        console.log("✓ Requirement loaded");

        console.log("\n[2/8] Parsing Requirement...");

        const requirement = this.parser.parse(markdown);

        console.log("\n========== REQUIREMENT ==========");
        console.log(JSON.stringify(requirement, null, 2));
        console.log("================================\n");

        console.log("✓ Requirement parsed");

        console.log("\n[3/8] AI Analysis...");

        let aiResult = null;

        if (process.env.ENABLE_AI === "true") {
            aiResult = await this.aiEngine.analyze(requirement);

            console.log("✓ AI analysis completed");
        } else {
            console.log("✓ AI skipped - Rule Engine mode");
        }

        console.log("\n[4/8] Building Requirement Intelligence...");

        const knowledge = this.intelligenceEngine.analyze(requirement);

        console.log("✓ Requirement intelligence completed");

        const recommendedScenarios = this.scenarioRecommendationEngine
            .generate(knowledge, requirement)
            .map(scenario => ({ ...scenario }));

        console.log(`✓ ${recommendedScenarios.length} scenarios recommended`);

        console.log("\n[5/8] Enriching Recommended Scenarios...");

        const enrichedScenarios = this.scenarioEnrichmentEngine.enrich({
            scenarios: recommendedScenarios,
            requirement,
            knowledge
        });

        console.log(`✓ ${enrichedScenarios.length} scenarios enriched`);

        console.log("\n[6/8] Generating Intelligence Scenarios...");

        const scenarios = this.intelligenceScenarioGenerator.generate(
            enrichedScenarios,
            requirement
        );

        console.log(`✓ ${scenarios.length} scenarios generated`);

        console.log("\n[7/8] Generating TestCases...");

        const testCases = this.testCaseGenerator.generate(scenarios);

        console.log(`✓ ${testCases.length} testcases generated`);

        console.log("\n[8/8] Exporting Outputs...");

        const featureName = requirement.feature || "testcases";

        const safeFeature = featureName.replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, "_");

        const timestamp = this.fileNameGenerator.getTimestamp();

        const baseName = `${safeFeature}_testcases_${timestamp}`;

        const outputs = {};

        outputs.json = this.outputManager.export(
            testCases,
            "json",
            `outputs/json/${baseName}.json`
        );

        outputs.markdown = this.outputManager.export(
            testCases,
            "markdown",
            `outputs/markdown/${baseName}.md`
        );

        outputs.excel = this.outputManager.export(
            testCases,
            "excel",
            `outputs/excel/${baseName}.xlsx`
        );

        outputs.csv = this.outputManager.export(testCases, "csv", `outputs/csv/${baseName}.csv`);

        console.log("✓ All outputs exported");

        return {
            requirement,

            aiResult,

            knowledge,

            recommendedScenarios,

            scenarios,

            testCases,

            outputs
        };
    }
}

export default QACopilot;
