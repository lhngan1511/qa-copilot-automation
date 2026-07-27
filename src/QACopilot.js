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

        this.mergeAIKnowledge(knowledge, aiResult, requirement);

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

    mergeAIKnowledge(knowledge, aiResult, requirement) {
        if (aiResult?.analysisStatus !== "SUCCESS" || !knowledge || typeof knowledge !== "object") {
            return;
        }

        try {
            const suggestedScenarios = Array.isArray(knowledge.suggestedScenarios)
                ? [...knowledge.suggestedScenarios]
                : [];
            const riskAreas = Array.isArray(knowledge.riskAreas) ? [...knowledge.riskAreas] : [];
            const questions = Array.isArray(knowledge.questions) ? [...knowledge.questions] : [];
            const scenarioKeys = this.collectExistingScenarioKeys(knowledge, requirement);
            const riskKeys = new Set(
                riskAreas.map(value => this.getComparableText(value)).filter(Boolean)
            );
            const questionKeys = new Set(
                questions.map(value => this.getComparableText(value)).filter(Boolean)
            );
            let suggestedScenariosAdded = 0;
            let riskAreasAdded = 0;
            let questionsAdded = 0;

            if (Array.isArray(aiResult.suggestedScenarios)) {
                aiResult.suggestedScenarios.forEach(scenario => {
                    if (!this.isValidAIScenario(scenario, requirement)) {
                        return;
                    }

                    const scenarioKey = this.buildScenarioComparisonKey(scenario, requirement);

                    if (!scenarioKey || scenarioKeys.has(scenarioKey)) {
                        return;
                    }

                    const clonedScenario = this.cloneValue(scenario);

                    if (!this.isMeaningfulText(clonedScenario.source)) {
                        clonedScenario.source = "AI_ANALYSIS";
                    }

                    suggestedScenarios.push(clonedScenario);
                    scenarioKeys.add(scenarioKey);
                    suggestedScenariosAdded += 1;
                });
            }

            riskAreasAdded = this.mergeAITextItems(riskAreas, aiResult.riskAreas, riskKeys);
            questionsAdded = this.mergeAITextItems(questions, aiResult.questions, questionKeys);

            knowledge.suggestedScenarios = suggestedScenarios;
            knowledge.riskAreas = riskAreas;
            knowledge.questions = questions;

            console.log("AI Knowledge Merge:");
            console.log(`- Suggested Scenarios Added: ${suggestedScenariosAdded}`);
            console.log(`- Risk Areas Added: ${riskAreasAdded}`);
            console.log(`- Questions Added: ${questionsAdded}`);
        } catch (error) {
            console.warn(`AI Knowledge Merge skipped: ${this.getConciseError(error)}`);
        }
    }

    mergeAITextItems(target, source, comparisonKeys) {
        if (!Array.isArray(source)) {
            return 0;
        }

        let added = 0;

        source.forEach(value => {
            if (!this.isMeaningfulText(value)) {
                return;
            }

            const normalizedValue = this.normalizeText(value);
            const comparisonKey = this.getComparableText(normalizedValue);

            if (!comparisonKey || comparisonKeys.has(comparisonKey)) {
                return;
            }

            target.push(normalizedValue);
            comparisonKeys.add(comparisonKey);
            added += 1;
        });

        return added;
    }

    collectExistingScenarioKeys(knowledge, requirement) {
        const collectionNames = [
            "suggestedScenarios",
            "positiveCases",
            "negativeCases",
            "boundaryCases",
            "securityCases",
            "permissionCases",
            "dataIntegrityCases"
        ];
        const keys = new Set();

        collectionNames.forEach(collectionName => {
            const collection = knowledge?.[collectionName];

            if (!Array.isArray(collection)) {
                return;
            }

            collection.forEach(scenario => {
                const key = this.buildScenarioComparisonKey(scenario, requirement);

                if (key) {
                    keys.add(key);
                }
            });
        });

        return keys;
    }

    isValidAIScenario(scenario, requirement) {
        if (!this.isPlainObject(scenario)) {
            return false;
        }

        if (
            Object.prototype.hasOwnProperty.call(scenario, "id") &&
            this.isMeaningfulText(scenario.id)
        ) {
            return false;
        }

        if (!this.isMeaningfulText(scenario.title) || !this.isMeaningfulText(scenario.feature)) {
            return false;
        }

        const type = this.normalizeScenarioType(scenario.type);

        if (this.isMeaningfulText(scenario.type) && !type) {
            return false;
        }

        const validFeatures = this.getRequirementScopes(requirement);

        return validFeatures.has(this.normalizeForComparison(scenario.feature));
    }

    getRequirementScopes(requirement) {
        const scopes = new Set();

        if (Array.isArray(requirement?.features)) {
            requirement.features.forEach(feature => {
                const featureName =
                    typeof feature === "string"
                        ? feature
                        : (feature?.name ?? feature?.feature ?? feature?.title);
                const normalizedFeature = this.normalizeForComparison(featureName);

                if (normalizedFeature) {
                    scopes.add(normalizedFeature);
                }
            });
        }

        [requirement?.feature, requirement?.module].forEach(value => {
            const normalizedScope = this.normalizeForComparison(value);

            if (normalizedScope) {
                scopes.add(normalizedScope);
            }
        });

        return scopes;
    }

    buildScenarioComparisonKey(scenario, requirement) {
        if (!scenario || typeof scenario !== "object") {
            return "";
        }

        const title = this.normalizeForComparison(
            scenario.title ?? scenario.testScenario ?? scenario.content ?? scenario.description
        );

        if (!title) {
            return "";
        }

        const moduleName = this.normalizeForComparison(scenario.module ?? requirement?.module);
        const feature = this.normalizeForComparison(scenario.feature ?? scenario.featureName);
        const type = this.normalizeScenarioType(scenario.type);

        return [moduleName, feature, title, type].join("|");
    }

    normalizeScenarioType(value) {
        if (!this.isMeaningfulText(value)) {
            return "";
        }

        const type = this.normalizeText(value)
            .toUpperCase()
            .replace(/[\s-]+/g, "_");
        const supportedTypes = new Set([
            "POSITIVE",
            "NEGATIVE",
            "PERMISSION",
            "DATA_INTEGRITY",
            "BOUNDARY",
            "SECURITY"
        ]);

        return supportedTypes.has(type) ? type : "";
    }

    getComparableText(value) {
        const text =
            typeof value === "string"
                ? value
                : value && typeof value === "object"
                  ? (value.content ?? value.title ?? value.description ?? value.name)
                  : "";

        return this.normalizeText(text)
            .replace(/[.!?;:,]+$/g, "")
            .toLowerCase();
    }

    normalizeForComparison(value) {
        return this.normalizeText(value)
            .replace(/[.!?;:,]+$/g, "")
            .toLowerCase();
    }

    normalizeText(value) {
        return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
    }

    isMeaningfulText(value) {
        return this.normalizeText(value) !== "";
    }

    cloneValue(value) {
        if (Array.isArray(value)) {
            return value.map(item => this.cloneValue(item));
        }

        if (this.isPlainObject(value)) {
            return Object.fromEntries(
                Object.entries(value).map(([key, item]) => [key, this.cloneValue(item)])
            );
        }

        return value;
    }

    isPlainObject(value) {
        if (!value || typeof value !== "object" || Array.isArray(value)) {
            return false;
        }

        const prototype = Object.getPrototypeOf(value);

        return prototype === Object.prototype || prototype === null;
    }

    getConciseError(error) {
        const message = typeof error === "string" ? error : error?.message;
        const normalizedMessage = this.normalizeText(message) || "Unknown merge error";

        return normalizedMessage.length > 160
            ? `${normalizedMessage.slice(0, 157)}...`
            : normalizedMessage;
    }
}

export default QACopilot;
