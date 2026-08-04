import RequirementLoader from "./loaders/RequirementLoader.js";
import MarkdownParser from "./parsers/MarkdownParser.js";

import AIAnalysisEngine from "./engines/AIAnalysisEngine.js";

import RequirementIntelligenceEngine from "./engines/RequirementIntelligenceEngine.js";
import AIRequirementIntelligenceEngine from "./engines/AIRequirementIntelligenceEngine.js";
import RequirementKnowledge from "./models/RequirementKnowledge.js";
import RequirementIntelligenceInputMapper from "./mappers/RequirementIntelligenceInputMapper.js";
import ApprovedModuleKnowledgeMapper from "./mappers/ApprovedModuleKnowledgeMapper.js";
import ScenarioIntelligenceInputMapper from "./mappers/ScenarioIntelligenceInputMapper.js";
import AIScenarioIntelligenceEngine from "./engines/AIScenarioIntelligenceEngine.js";
import ScenarioQualityPolicy from "./intelligence/ScenarioQualityPolicy.js";
import ScenarioIntelligenceMerger from "./intelligence/ScenarioIntelligenceMerger.js";
import ApprovedScenarioMapper from "./mappers/ApprovedScenarioMapper.js";
import ApprovedTestCaseMapper from "./mappers/ApprovedTestCaseMapper.js";
import TestCaseIntelligenceInputMapper from "./mappers/TestCaseIntelligenceInputMapper.js";
import AITestCaseIntelligenceEngine from "./engines/AITestCaseIntelligenceEngine.js";
import TestCaseQualityPolicy from "./intelligence/TestCaseQualityPolicy.js";
import TestCaseIntelligenceMerger from "./intelligence/TestCaseIntelligenceMerger.js";
import SemanticTestCaseOverlapResolver from "./resolvers/SemanticTestCaseOverlapResolver.js";
import RequirementKnowledgeMerger from "./intelligence/RequirementKnowledgeMerger.js";
import RequirementKnowledgeMapper from "./mappers/RequirementKnowledgeMapper.js";
import CoreTestCaseCoverageValidator from "./validators/CoreTestCaseCoverageValidator.js";
import TestCaseReviewValidator from "./validators/TestCaseReviewValidator.js";
import ProductionTestCaseQualityGate from "./quality/ProductionTestCaseQualityGate.js";

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

import TestCaseOutputService from "./services/TestCaseOutputService.js";

import PipelineStatuses from "./constants/PipelineStatuses.js";

import WorkflowExecutionContext from "./models/WorkflowExecutionContext.js";

import ClarificationQuestion from "./models/ClarificationQuestion.js";

import QAWorkflowCoordinator from "./workflows/QAWorkflowCoordinator.js";

class QACopilot {
    constructor({ workflowCoordinator = null } = {}) {
        this.loader = new RequirementLoader();

        this.parser = new MarkdownParser();

        this.aiEngine = new AIAnalysisEngine();

        this.intelligenceEngine = new RequirementIntelligenceEngine();

        this.aiRequirementIntelligenceEngine = new AIRequirementIntelligenceEngine();

        this.requirementIntelligenceInputMapper = new RequirementIntelligenceInputMapper();

        this.approvedModuleKnowledgeMapper = new ApprovedModuleKnowledgeMapper();

        this.scenarioIntelligenceInputMapper = new ScenarioIntelligenceInputMapper();

        this.aiScenarioIntelligenceEngine = new AIScenarioIntelligenceEngine();

        this.scenarioQualityPolicy = new ScenarioQualityPolicy();

        this.scenarioIntelligenceMerger = new ScenarioIntelligenceMerger(
            this.scenarioQualityPolicy
        );

        this.approvedScenarioMapper = new ApprovedScenarioMapper();
        this.approvedTestCaseMapper = new ApprovedTestCaseMapper();
        this.testCaseIntelligenceInputMapper = new TestCaseIntelligenceInputMapper();
        this.aiTestCaseIntelligenceEngine = new AITestCaseIntelligenceEngine();
        this.testCaseQualityPolicy = new TestCaseQualityPolicy();
        this.testCaseIntelligenceMerger = new TestCaseIntelligenceMerger(
            this.testCaseQualityPolicy
        );
        this.semanticTestCaseOverlapResolver = new SemanticTestCaseOverlapResolver();
        this.coreTestCaseCoverageValidator = new CoreTestCaseCoverageValidator();
        this.testCaseReviewValidator = new TestCaseReviewValidator();
        this.productionTestCaseQualityGate = new ProductionTestCaseQualityGate();

        this.requirementKnowledgeMerger = new RequirementKnowledgeMerger();
        this.requirementKnowledgeMapper = new RequirementKnowledgeMapper();

        this.scenarioRecommendationEngine = new ScenarioRecommendationEngine();

        this.scenarioEnrichmentEngine = new ScenarioEnrichmentEngine();

        this.intelligenceScenarioGenerator = new IntelligenceScenarioGenerator();

        this.testCaseGenerator = new TestCaseGenerator();

        this.outputManager = new OutputManager();

        this.fileNameGenerator = new FileNameGenerator();

        this.workflowCoordinator = workflowCoordinator || new QAWorkflowCoordinator();

        /*
            Register Output Exporters
        */

        this.outputManager.registerExporter("json", new JsonExporter());

        this.outputManager.registerExporter("markdown", new MarkdownExporter());

        this.outputManager.registerExporter("excel", new ExcelExporter());

        this.outputManager.registerExporter("csv", new CsvExporter());

        this.testCaseOutputService = new TestCaseOutputService({
            outputManager: this.outputManager,
            fileNameGenerator: this.fileNameGenerator
        });
    }

    async run(requirementFile, options = {}) {
        const workflowContext = this.buildWorkflowContext(options);

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
        const existingRequirementReview = workflowContext.getStage("requirementReview");
        const existingRequirementArtifact = existingRequirementReview.artifactId
            ? this.workflowCoordinator.findArtifact(existingRequirementReview.artifactId)
            : null;
        const existingAnalysisReview = workflowContext.getStage("clarificationReview");
        const existingAnalysisArtifact = existingAnalysisReview.artifactId
            ? this.workflowCoordinator.findArtifact(existingAnalysisReview.artifactId)
            : null;

        if (options.productionWorkflow === true && existingAnalysisArtifact) {
            aiResult = existingAnalysisArtifact.aiAnalysis ?? null;

            console.log("âœ“ AI analysis restored from AI Analysis Review Artifact");
        } else if (existingRequirementArtifact) {
            aiResult = existingRequirementArtifact.aiResult ?? null;

            console.log("✓ AI analysis restored from Requirement Artifact");
        } else if (process.env.ENABLE_AI === "true") {
            aiResult = await this.aiEngine.analyze(requirement);

            console.log("✓ AI analysis completed");
        } else if (options.productionWorkflow === true) {
            aiResult = this.aiEngine.fallbackAnalysis(requirement);
            this.aiEngine.assignAnalysisMetadata(aiResult, {
                analysisStatus: "FALLBACK",
                analysisSource: "rule-engine",
                analysisError: ""
            });

            console.log("✓ Requirement knowledge created by rule engine");
        } else {
            console.log("✓ AI skipped - Rule Engine mode");
        }

        let knowledge = new RequirementKnowledge({
            questions: requirement?.questions
        });

        this.mergeAIKnowledge(knowledge, aiResult, requirement);

        knowledge.questions = this.normalizeClarificationItems(knowledge.questions);

        /*
        =====================================================
         AI CLARIFICATION REVIEW GATE
        =====================================================
        */

        const clarificationQuestions = this.buildClarificationQuestions(knowledge, aiResult);

        const clarificationReview = workflowContext.getStage("clarificationReview");

        const clarificationReviewSessionId = clarificationReview.sessionId || null;

        const clarificationArtifactId = clarificationReview.artifactId || null;

        let approvedClarifications = [];

        if (
            (clarificationQuestions.length > 0 || options.productionWorkflow === true) &&
            (!clarificationReviewSessionId || !clarificationArtifactId)
        ) {
            const timestamp = this.fileNameGenerator.getTimestamp();

            const newSessionId = `SESSION-CLARIFICATION-${timestamp}`;

            const newArtifactId = `CLARIFICATION-${timestamp}`;

            const clarificationArtifact = {
                artifactId: newArtifactId,

                artifactType:
                    options.productionWorkflow === true
                        ? "AI_ANALYSIS_REVIEW"
                        : "AI_CLARIFICATION_REVIEW",

                approvalStatus: "pending",

                requirement,

                aiAnalysis: this.cloneValue(aiResult),

                ...(options.productionWorkflow === true
                    ? {}
                    : {
                          knowledge: knowledge.toJSON(),
                          detectedFunctions: Array.isArray(requirement?.features)
                              ? requirement.features.map(feature => ({
                                    ...this.cloneValue(feature),
                                    id: feature.id ?? "",
                                    name: feature.name ?? "",
                                    description: feature.description ?? ""
                                }))
                              : [],
                          businessRules: Array.isArray(requirement?.businessRules)
                              ? requirement.businessRules.map(item => ({ ...item }))
                              : [],
                          validation: Array.isArray(requirement?.features)
                              ? requirement.features.flatMap(feature =>
                                    Array.isArray(feature.inputs)
                                        ? feature.inputs.map(input => ({
                                              feature: feature.name ?? "",
                                              inputName: input.name ?? "",
                                              required: input.required ?? false,
                                              description: input.description ?? ""
                                          }))
                                        : []
                                )
                              : []
                      }),

                questions: clarificationQuestions,

                summary: {
                    total: clarificationQuestions.length,

                    pending: clarificationQuestions.length,

                    answered: 0,

                    approved: false
                },

                references: {
                    requirementFile
                }
            };

            const reviewResult = this.workflowCoordinator.startClarificationReview({
                sessionId: newSessionId,

                artifactId: newArtifactId,

                clarification: clarificationArtifact
            });

            workflowContext.setStage("clarificationReview", {
                sessionId: newSessionId,

                artifactId: newArtifactId
            });

            console.log("\n=================================");
            console.log(" AI CLARIFICATION REQUIRED");
            console.log("=================================");
            console.log(`Session ID: ${newSessionId}`);
            console.log(`Artifact ID: ${newArtifactId}`);
            console.log(`Questions: ${clarificationQuestions.length}`);
            console.log(`Status: ${reviewResult.status}`);
            console.log("Pipeline stopped before requirement review.");

            return {
                status: "AWAITING_AI_CLARIFICATION",

                reviewStage:
                    options.productionWorkflow === true
                        ? "AI_ANALYSIS_REVIEW"
                        : "AI_CLARIFICATION_REVIEW",

                clarificationReview: {
                    sessionId: newSessionId,

                    artifactId: newArtifactId,

                    status: reviewResult.status
                },

                requirement,

                aiResult,

                aiAnalysis: aiResult,

                knowledge,

                clarificationQuestions,

                workflowContext: workflowContext.toJSON(),

                recommendedScenarios: [],

                scenarios: [],

                testCases: [],

                outputs: {}
            };
        }

        if (clarificationQuestions.length > 0) {
            const clarificationStatus = this.getClarificationStatus({
                sessionId: clarificationReviewSessionId,

                artifactId: clarificationArtifactId
            });

            if (
                !clarificationStatus.isFullyAnswered ||
                clarificationStatus.approvalStatus !== "approved" ||
                clarificationStatus.sessionStatus !== "completed"
            ) {
                throw new Error(
                    "AI clarification must be fully answered, approved and completed before requirement review."
                );
            }

            approvedClarifications = clarificationStatus.questions.map(question => ({
                questionId: question.questionId,

                category: question.category,

                priority: question.priority,

                question: question.question,

                reason: question.reason,

                options: Array.isArray(question.options) ? [...question.options] : [],

                answer: question.answer,

                status: question.status,

                answeredBy: question.answeredBy,

                answeredAt: question.answeredAt
            }));

            console.log("\nâœ“ AI clarification approved");
        }

        if (options.productionWorkflow === true) {
            return this.runCoreProductionWorkflow({
                requirement,
                aiResult,
                knowledge,
                clarificationArtifactId,
                clarificationReviewSessionId,
                workflowContext,
                options
            });
        }

        /*
        =====================================================
         REQUIREMENT REVIEW GATE
        =====================================================

        Lần chạy đầu tiên:

        - Tạo Requirement Review Session
        - Lưu Requirement Artifact
        - Dừng pipeline
        - Không sinh Scenario
        - Không sinh TestCase
        - Không Export

        Sau khi người dùng approve và complete:

        - Truyền lại requirementReviewSessionId
        - Truyền lại requirementArtifactId
        - Pipeline mới được tiếp tục
        =====================================================
        */

        const requirementReview = workflowContext.getStage("requirementReview");

        const requirementReviewSessionId = requirementReview.sessionId || null;

        const requirementArtifactId = requirementReview.artifactId || null;

        if (!requirementReviewSessionId || !requirementArtifactId) {
            const timestamp = this.fileNameGenerator.getTimestamp();

            const newSessionId = `SESSION-REQUIREMENT-${timestamp}`;

            const newArtifactId = `REQUIREMENT-${timestamp}`;

            const requirementReviewArtifact = {
                artifactId: newArtifactId,

                artifactType: "REQUIREMENT_REVIEW",

                approvalStatus: "pending",

                requirement,

                aiResult,

                knowledge,

                questions: Array.isArray(knowledge?.questions) ? knowledge.questions : [],

                clarificationReference:
                    approvedClarifications.length > 0
                        ? {
                              clarificationReviewSessionId,

                              clarificationArtifactId
                          }
                        : null,

                clarifications: approvedClarifications
            };

            const reviewResult = this.workflowCoordinator.startRequirementReview({
                sessionId: newSessionId,

                artifactId: newArtifactId,

                requirement: requirementReviewArtifact
            });

            workflowContext.setStage("requirementReview", {
                sessionId: newSessionId,

                artifactId: newArtifactId
            });

            console.log("\n=================================");

            console.log(" REQUIREMENT REVIEW REQUIRED");

            console.log("=================================");

            console.log(`Session ID: ${newSessionId}`);

            console.log(`Artifact ID: ${newArtifactId}`);

            console.log(`Status: ${reviewResult.status}`);

            console.log("Pipeline stopped before scenario generation.");

            return {
                status: "AWAITING_REQUIREMENT_REVIEW",

                reviewStage: "REQUIREMENT_REVIEW",

                requirementReview: {
                    sessionId: newSessionId,

                    artifactId: newArtifactId,

                    status: reviewResult.status
                },

                requirement,

                aiResult,

                aiAnalysis: aiResult,

                knowledge,

                workflowContext: workflowContext.toJSON(),

                recommendedScenarios: [],

                scenarios: [],

                testCases: [],

                outputs: {}
            };
        }

        const requirementApproved = this.workflowCoordinator.isApproved(requirementArtifactId);

        const requirementReviewCompleted = this.workflowCoordinator.isCompleted(
            requirementReviewSessionId
        );

        if (!requirementApproved || !requirementReviewCompleted) {
            throw new Error(
                "Requirement review must be approved and completed before scenario generation."
            );
        }

        console.log("\n✓ Requirement review approved");

        const requirementReviewArtifact =
            this.workflowCoordinator.findArtifact(requirementArtifactId);
        const clarificationArtifact = clarificationArtifactId
            ? this.workflowCoordinator.findArtifact(clarificationArtifactId)
            : null;
        const intelligenceInput = this.requirementIntelligenceInputMapper.map({
            requirement,
            requirementReviewArtifact,
            clarificationArtifact,
            executionContext: workflowContext
        });

        if (!intelligenceInput.isValid()) {
            throw new Error("Approved requirement intelligence input is invalid.");
        }

        const moduleReview = workflowContext.getStage("moduleReview");
        const moduleReviewSessionId = moduleReview.sessionId || null;
        const moduleArtifactId = moduleReview.artifactId || null;
        const existingModuleArtifact = moduleArtifactId
            ? this.workflowCoordinator.findArtifact(moduleArtifactId)
            : null;

        if (existingModuleArtifact) {
            knowledge = existingModuleArtifact.knowledge
                ? new RequirementKnowledge(existingModuleArtifact.knowledge)
                : new RequirementKnowledge();
        } else {
            console.log("\n[4/8] Building Requirement Intelligence...");

            const ruleKnowledge = this.intelligenceEngine.analyze(intelligenceInput);
            knowledge = ruleKnowledge;

            if (process.env.ENABLE_AI === "true") {
                const aiIntelligence =
                    await this.aiRequirementIntelligenceEngine.analyze(intelligenceInput);

                if (aiIntelligence.status === "SUCCESS") {
                    knowledge = this.requirementKnowledgeMerger.merge(
                        ruleKnowledge,
                        aiIntelligence.knowledge
                    );
                } else {
                    console.warn(
                        `AI Requirement Intelligence failed; using rule fallback: ${aiIntelligence.errors.join("; ")}`
                    );
                }
            }

            console.log("✓ Requirement intelligence completed");
        }

        /*
        =====================================================
         MODULE REVIEW GATE
        =====================================================

        Sau khi Requirement Review hoàn tất:

        - Chuẩn hóa danh sách Module/Feature
        - Tạo Module Review Session và Artifact
        - Dừng pipeline trước Scenario Recommendation

        Chỉ Module Artifact đã approved và Module Review Session
        đã completed mới được phép tiếp tục sinh Scenario.
        =====================================================
        */

        let modules = this.buildModuleReviewData(requirement, knowledge);

        if (!moduleReviewSessionId || !moduleArtifactId) {
            const timestamp = this.fileNameGenerator.getTimestamp();

            const newSessionId = `SESSION-MODULE-${timestamp}`;

            const newArtifactId = `MODULE-${timestamp}`;

            const moduleReviewArtifact = {
                artifactId: newArtifactId,

                artifactType: "MODULE_REVIEW",

                module: knowledge.module,

                functions: knowledge.functions.map(item => ({ ...item })),

                notes: [...knowledge.notes],

                confidence: knowledge.confidence,

                source: knowledge.source,

                modules,

                knowledge: knowledge.toJSON(),

                requirementReference: {
                    requirementReviewSessionId,

                    requirementArtifactId,

                    clarificationSessionId: clarificationReviewSessionId || "",

                    clarificationArtifactId: clarificationArtifactId || ""
                },

                approvalStatus: "pending"
            };

            const reviewResult = this.workflowCoordinator.startModuleReview({
                sessionId: newSessionId,

                artifactId: newArtifactId,

                module: moduleReviewArtifact
            });

            workflowContext.setStage("moduleReview", {
                sessionId: newSessionId,

                artifactId: newArtifactId
            });

            console.log("\n=================================");

            console.log(" MODULE REVIEW REQUIRED");

            console.log("=================================");

            console.log(`Session ID: ${newSessionId}`);

            console.log(`Artifact ID: ${newArtifactId}`);

            console.log(`Status: ${reviewResult.status}`);

            console.log("Pipeline stopped before scenario generation.");

            return {
                status: "AWAITING_MODULE_REVIEW",

                reviewStage: "MODULE_REVIEW",

                requirementReview: {
                    sessionId: requirementReviewSessionId,

                    artifactId: requirementArtifactId,

                    status: "completed"
                },

                moduleReview: {
                    sessionId: newSessionId,

                    artifactId: newArtifactId,

                    status: reviewResult.status
                },

                requirement,

                aiResult,

                aiAnalysis: aiResult,

                knowledge,

                modules,

                workflowContext: workflowContext.toJSON(),

                recommendedScenarios: [],

                scenarios: [],

                testCases: [],

                outputs: {}
            };
        }

        const moduleApproved = this.workflowCoordinator.isApproved(moduleArtifactId);

        const moduleReviewCompleted = this.workflowCoordinator.isCompleted(moduleReviewSessionId);

        if (!moduleApproved || !moduleReviewCompleted) {
            throw new Error(
                "Module review must be approved and completed before scenario generation."
            );
        }

        console.log("\n✓ Module review approved");

        const approvedModuleArtifact = this.workflowCoordinator.findArtifact(moduleArtifactId);
        knowledge = this.approvedModuleKnowledgeMapper.map(approvedModuleArtifact, requirement);
        modules = this.buildModuleReviewData(requirement, knowledge);

        const scenarioReview = workflowContext.getStage("scenarioReview");
        const scenarioReviewSessionId = scenarioReview.sessionId || null;
        const scenarioArtifactId = scenarioReview.artifactId || null;
        const existingScenarioArtifact = scenarioArtifactId
            ? this.workflowCoordinator.findArtifact(scenarioArtifactId)
            : null;
        let recommendedScenarios = [];
        let scenarios = [];
        let scenarioQualitySummary = existingScenarioArtifact?.qualitySummary ?? null;
        let scenarioNotes = existingScenarioArtifact?.notes ?? [];
        let scenarioConfidence = existingScenarioArtifact?.confidence ?? 0;
        let scenarioSource = existingScenarioArtifact?.source ?? "rule";

        if (existingScenarioArtifact) {
            scenarios = Array.isArray(existingScenarioArtifact.scenarios)
                ? existingScenarioArtifact.scenarios.map(item => ({ ...item }))
                : [];
        } else {
            const ruleScenarios = this.scenarioRecommendationEngine
                .generate(knowledge, requirement)
                .map(scenario => ({ ...scenario, source: scenario.source || "rule" }));
            const scenarioInput = this.scenarioIntelligenceInputMapper.map({
                moduleArtifact: approvedModuleArtifact,
                knowledge,
                ruleScenarios,
                executionContext: workflowContext,
                constraints: options.scenarioConstraints
            });
            let aiScenarios = [];

            if (process.env.ENABLE_AI === "true") {
                const aiScenarioResult =
                    await this.aiScenarioIntelligenceEngine.analyze(scenarioInput);
                if (aiScenarioResult.status === "SUCCESS") {
                    aiScenarios = aiScenarioResult.scenarios;
                    scenarioNotes = aiScenarioResult.notes;
                    scenarioConfidence = aiScenarioResult.confidence;
                    scenarioSource = `rule+${aiScenarioResult.source}`;
                } else {
                    console.warn(
                        `AI Scenario Intelligence failed; using rule fallback: ${aiScenarioResult.errors.join("; ")}`
                    );
                }
            }

            const merged = this.scenarioIntelligenceMerger.merge(ruleScenarios, aiScenarios, {
                functions: knowledge.functions,
                maxScenariosPerFunction: scenarioInput.constraints.maxScenariosPerFunction
            });
            recommendedScenarios = merged.scenarios;
            scenarioQualitySummary = merged.summary;

            console.log(`✓ ${recommendedScenarios.length} scenarios recommended`);
            console.log("\n[5/8] Enriching Recommended Scenarios...");
            const enrichedScenarios = this.scenarioEnrichmentEngine.enrich({
                scenarios: recommendedScenarios,
                requirement,
                knowledge
            });
            console.log(`✓ ${enrichedScenarios.length} scenarios enriched`);
            console.log("\n[6/8] Generating Intelligence Scenarios...");
            scenarios = this.intelligenceScenarioGenerator.generate(enrichedScenarios, requirement);
            console.log(`✓ ${scenarios.length} scenarios generated`);
        }

        /*
        =====================================================
         SCENARIO REVIEW GATE
        =====================================================

        Sau khi Intelligence Scenario Generation hoàn tất:

        - Tạo Scenario Review Session và Artifact
        - Lưu toàn bộ scenarios cùng summary
        - Dừng pipeline trước TestCase Generation

        Chỉ Scenario Artifact đã approved và Scenario Review Session
        đã completed mới được phép tiếp tục sinh TestCase.
        =====================================================
        */

        const scenarioSummary = this.buildScenarioReviewSummary(scenarios);

        if (!scenarioReviewSessionId || !scenarioArtifactId) {
            const timestamp = this.fileNameGenerator.getTimestamp();

            const newSessionId = `SESSION-SCENARIO-${timestamp}`;

            const newArtifactId = `SCENARIO-${timestamp}`;

            const scenarioReviewArtifact = {
                artifactId: newArtifactId,

                artifactType: "SCENARIO_REVIEW",

                scenarios,

                notes: scenarioNotes,

                confidence: scenarioConfidence,

                source: scenarioSource,

                qualitySummary: scenarioQualitySummary,

                summary: scenarioSummary,

                references: {
                    requirementReviewSessionId,

                    requirementArtifactId,

                    moduleReviewSessionId,

                    moduleArtifactId
                },

                requirementReference: approvedModuleArtifact.requirementReference,

                approvalStatus: "pending"
            };

            const reviewResult = this.workflowCoordinator.startScenarioReview({
                sessionId: newSessionId,

                artifactId: newArtifactId,

                scenario: scenarioReviewArtifact
            });

            workflowContext.setStage("scenarioReview", {
                sessionId: newSessionId,

                artifactId: newArtifactId
            });

            console.log("\n=================================");

            console.log(" SCENARIO REVIEW REQUIRED");

            console.log("=================================");

            console.log(`Session ID: ${newSessionId}`);

            console.log(`Artifact ID: ${newArtifactId}`);

            console.log(`Status: ${reviewResult.status}`);

            console.log(`Scenarios: ${scenarios.length}`);

            console.log("Pipeline stopped before testcase generation.");

            return {
                status: "AWAITING_SCENARIO_REVIEW",

                reviewStage: "SCENARIO_REVIEW",

                requirementReview: {
                    sessionId: requirementReviewSessionId,

                    artifactId: requirementArtifactId,

                    status: "completed"
                },

                moduleReview: {
                    sessionId: moduleReviewSessionId,

                    artifactId: moduleArtifactId,

                    status: "completed"
                },

                scenarioReview: {
                    sessionId: newSessionId,

                    artifactId: newArtifactId,

                    status: reviewResult.status
                },

                requirement,

                aiResult,

                aiAnalysis: aiResult,

                knowledge,

                modules,

                recommendedScenarios,

                scenarios,

                scenarioSummary,

                workflowContext: workflowContext.toJSON(),

                testCases: [],

                outputs: {}
            };
        }

        const scenarioApproved = this.workflowCoordinator.isApproved(scenarioArtifactId);

        const scenarioReviewCompleted =
            this.workflowCoordinator.isCompleted(scenarioReviewSessionId);

        if (!scenarioApproved || !scenarioReviewCompleted) {
            throw new Error(
                "Scenario review must be approved and completed before testcase generation."
            );
        }

        console.log("\n✓ Scenario review approved");

        const approvedScenarioArtifact = this.workflowCoordinator.findArtifact(scenarioArtifactId);
        const approvedScenarios = this.approvedScenarioMapper.map(approvedScenarioArtifact);
        const testCaseReview = workflowContext.getStage("testCaseReview");
        const testCaseReviewSessionId = testCaseReview.sessionId || null;
        const testCaseArtifactId = testCaseReview.artifactId || null;
        const existingTestCaseArtifact = testCaseArtifactId
            ? this.workflowCoordinator.findArtifact(testCaseArtifactId)
            : null;
        let testCases = [];
        let testCaseQualitySummary = existingTestCaseArtifact?.qualitySummary ?? null;
        let testCaseNotes = existingTestCaseArtifact?.notes ?? [];
        let testCaseConfidence = existingTestCaseArtifact?.confidence ?? 0;
        let testCaseSource = existingTestCaseArtifact?.source ?? "rule";

        if (existingTestCaseArtifact) {
            testCases = Array.isArray(existingTestCaseArtifact.testCases)
                ? existingTestCaseArtifact.testCases.map(item => ({ ...item }))
                : [];
        } else {
            console.log("\n[7/8] Generating TestCases...");
            const ruleTestCases = this.testCaseGenerator.generate(approvedScenarios);
            const testCaseInput = this.testCaseIntelligenceInputMapper.map({
                scenarios: approvedScenarios,
                moduleArtifact: approvedModuleArtifact,
                knowledge,
                clarificationArtifact,
                executionContext: workflowContext,
                constraints: options.testCaseConstraints
            });
            const clarificationReferences = testCaseInput.clarificationAnswers
                .map(answer => answer?.questionId ?? answer?.id ?? "")
                .filter(reference => typeof reference === "string" && reference.trim());
            ruleTestCases.forEach(testCase => {
                testCase.requirementReferences = [
                    ...new Set([
                        ...(Array.isArray(testCase.requirementReferences)
                            ? testCase.requirementReferences
                            : []),
                        ...clarificationReferences
                    ])
                ];
            });
            let aiTestCases = [];
            if (process.env.ENABLE_AI === "true") {
                const aiTestCaseResult =
                    await this.aiTestCaseIntelligenceEngine.analyze(testCaseInput);
                if (aiTestCaseResult.status === "SUCCESS") {
                    aiTestCases = aiTestCaseResult.testCases;
                    testCaseNotes = aiTestCaseResult.notes;
                    testCaseConfidence = aiTestCaseResult.confidence;
                    testCaseSource = `rule+${aiTestCaseResult.source}`;
                } else {
                    console.warn(
                        `AI TestCase Intelligence failed; using rule fallback: ${aiTestCaseResult.errors.join("; ")}`
                    );
                }
            }
            const mergedTestCases = this.testCaseIntelligenceMerger.merge(
                ruleTestCases,
                aiTestCases,
                {
                    scenarios: approvedScenarios,
                    maxTestCasesPerScenario: testCaseInput.constraints.maxTestCasesPerScenario,
                    maxStepsPerTestCase: testCaseInput.constraints.maxStepsPerTestCase
                }
            );
            const overlapResolved = this.semanticTestCaseOverlapResolver.resolve(
                mergedTestCases.testCases,
                {
                    approvedFunctions: approvedModuleArtifact?.functions
                }
            );
            const qualityResult = this.productionTestCaseQualityGate.apply(overlapResolved, {
                requirement,
                knowledge
            });
            testCases = qualityResult.testCases;
            testCaseQualitySummary = mergedTestCases.summary;
            testCaseQualitySummary.overlapResolution =
                this.semanticTestCaseOverlapResolver.lastSummary;
            testCaseQualitySummary.productionQuality = qualityResult.summary;
            testCaseQualitySummary.finalCount = testCases.length;
            console.log(`✓ ${testCases.length} testcases generated`);
        }

        /*
        =====================================================
         TEST CASE REVIEW GATE
        =====================================================

        Sau khi TestCase Generation hoàn tất:

        - Tạo TestCase Review Session và Artifact
        - Lưu toàn bộ testCases cùng summary
        - Dừng pipeline trước Export

        Chỉ TestCase Artifact đã approved và TestCase Review Session
        đã completed mới được phép tiếp tục Export.
        =====================================================
        */

        testCases = this.testCaseReviewValidator.normalizeBatch(testCases, {
            defaultStatus:
                existingTestCaseArtifact?.approvalStatus === "approved" ? "APPROVED" : "PENDING"
        });
        this.testCaseReviewValidator.validateBatch(testCases);
        const testCaseSummary = this.buildTestCaseReviewSummary(testCases);

        if (!testCaseReviewSessionId || !testCaseArtifactId) {
            const timestamp = this.fileNameGenerator.getTimestamp();

            const newSessionId = `SESSION-TESTCASE-${timestamp}`;

            const newArtifactId = `TESTCASE-${timestamp}`;

            const testCaseReviewArtifact = {
                artifactId: newArtifactId,

                artifactType: "TEST_CASE_REVIEW",

                testCases,

                notes: testCaseNotes,

                confidence: testCaseConfidence,

                source: testCaseSource,

                qualitySummary: testCaseQualitySummary,

                summary: testCaseSummary,

                references: {
                    requirementReviewSessionId,

                    requirementArtifactId,

                    moduleReviewSessionId,

                    moduleArtifactId,

                    scenarioReviewSessionId,

                    scenarioArtifactId
                },

                requirementReference: approvedScenarioArtifact.references,

                approvalStatus: "pending"
            };

            const reviewResult = this.workflowCoordinator.startTestCaseReview({
                sessionId: newSessionId,

                artifactId: newArtifactId,

                testCase: testCaseReviewArtifact
            });

            workflowContext.setStage("testCaseReview", {
                sessionId: newSessionId,

                artifactId: newArtifactId
            });

            console.log("\n=================================");

            console.log(" TEST CASE REVIEW REQUIRED");

            console.log("=================================");

            console.log(`Session ID: ${newSessionId}`);

            console.log(`Artifact ID: ${newArtifactId}`);

            console.log(`Status: ${reviewResult.status}`);

            console.log(`TestCases: ${testCases.length}`);

            console.log(`Automation Candidates: ${testCaseSummary.automationCandidates}`);

            console.log("Pipeline stopped before export.");

            return {
                status: "AWAITING_TEST_CASE_REVIEW",

                reviewStage: "TEST_CASE_REVIEW",

                requirementReview: {
                    sessionId: requirementReviewSessionId,

                    artifactId: requirementArtifactId,

                    status: "completed"
                },

                moduleReview: {
                    sessionId: moduleReviewSessionId,

                    artifactId: moduleArtifactId,

                    status: "completed"
                },

                scenarioReview: {
                    sessionId: scenarioReviewSessionId,

                    artifactId: scenarioArtifactId,

                    status: "completed"
                },

                testCaseReview: {
                    sessionId: newSessionId,

                    artifactId: newArtifactId,

                    status: reviewResult.status
                },

                requirement,

                aiResult,

                aiAnalysis: aiResult,

                knowledge,

                modules,

                recommendedScenarios,

                scenarios,

                scenarioSummary,

                testCases,

                testCaseSummary,

                workflowContext: workflowContext.toJSON(),

                outputs: {}
            };
        }

        const testCaseApproved = this.workflowCoordinator.isApproved(testCaseArtifactId);

        const testCaseReviewCompleted =
            this.workflowCoordinator.isCompleted(testCaseReviewSessionId);

        if (!testCaseApproved || !testCaseReviewCompleted) {
            throw new Error("Test case review must be approved and completed before export.");
        }

        console.log("\n✓ Test case review approved");

        const approvedTestCaseArtifact = this.workflowCoordinator.findArtifact(testCaseArtifactId);
        testCases = this.approvedTestCaseMapper.map(approvedTestCaseArtifact);

        if (
            approvedTestCaseArtifact.outputs &&
            typeof approvedTestCaseArtifact.outputs === "object" &&
            Object.keys(approvedTestCaseArtifact.outputs).length > 0
        ) {
            return {
                status: PipelineStatuses.COMPLETED,
                reviewStage: null,
                requirement,
                aiResult,
                aiAnalysis: aiResult,
                knowledge,
                recommendedScenarios,
                scenarios,
                testCases,
                workflowContext: workflowContext.toJSON(),
                outputs: { ...approvedTestCaseArtifact.outputs }
            };
        }

        console.log("\n[8/8] Exporting Outputs...");

        const outputs = this.testCaseOutputService.export({
            requirement,
            testCases,
            outputRoot: options.outputRoot ?? options.outputDirectory ?? "./outputs/production",
            outputFilePrefix: options.outputFilePrefix ?? ""
        });

        this.workflowCoordinator.saveArtifact({
            ...approvedTestCaseArtifact,
            outputs: { ...outputs }
        });

        console.log("✓ All outputs exported");

        return {
            status: PipelineStatuses.COMPLETED,

            reviewStage: null,

            requirement,

            aiResult,

            aiAnalysis: aiResult,

            knowledge,

            recommendedScenarios,

            scenarios,

            testCases,

            workflowContext: workflowContext.toJSON(),

            outputs
        };
    }

    async runCoreProductionWorkflow({
        requirement,
        aiResult,
        knowledge,
        clarificationArtifactId,
        clarificationReviewSessionId,
        workflowContext,
        options
    }) {
        const analysisArtifact = clarificationArtifactId
            ? this.workflowCoordinator.findArtifact(clarificationArtifactId)
            : null;
        const analysisApproved =
            analysisArtifact?.approvalStatus === "approved" &&
            this.workflowCoordinator.isCompleted(clarificationReviewSessionId);

        if (!analysisApproved) {
            throw new Error(
                "AI Analysis Review must be answered, approved and completed before core testcase generation."
            );
        }

        knowledge = this.requirementKnowledgeMapper.map({
            approvedArtifact: analysisArtifact,
            clarificationQuestions: analysisArtifact.questions,
            clarificationAnswers: analysisArtifact.questions.filter(question =>
                this.isAnsweredClarificationQuestion(question)
            )
        });

        console.log(
            "[Clarification] RequirementKnowledge before core generation:",
            JSON.stringify(knowledge.clarificationAnswers)
        );

        if (!knowledge.isApproved()) {
            throw new Error(
                "Approved RequirementKnowledge is required before core testcase generation."
            );
        }

        const confirmedRequirement = analysisArtifact.requirement;
        if (!confirmedRequirement || typeof confirmedRequirement !== "object") {
            throw new Error(
                "Approved AI Analysis Review does not contain its reviewed requirement."
            );
        }

        this.workflowCoordinator.saveArtifact({
            ...analysisArtifact,
            knowledge: knowledge.toJSON()
        });

        console.log("\n[4/6] Generating Core Test Cases...");

        const recommendedScenarios = this.scenarioRecommendationEngine
            .generate(knowledge, confirmedRequirement)
            .filter(scenario => this.isCoreProductionScenario(scenario, knowledge))
            .map(scenario => ({ ...scenario }));
        const enrichedScenarios = this.scenarioEnrichmentEngine.enrich({
            scenarios: recommendedScenarios,
            requirement: confirmedRequirement,
            knowledge
        });
        const scenarios = this.intelligenceScenarioGenerator.generate(
            enrichedScenarios,
            confirmedRequirement
        );

        const testCaseReview = workflowContext.getStage("testCaseReview");
        const testCaseReviewSessionId = testCaseReview.sessionId || null;
        const testCaseArtifactId = testCaseReview.artifactId || null;
        const existingTestCaseArtifact = testCaseArtifactId
            ? this.workflowCoordinator.findArtifact(testCaseArtifactId)
            : null;
        let testCases = [];
        let productionQualitySummary = existingTestCaseArtifact?.qualitySummary?.productionQuality ?? null;

        if (existingTestCaseArtifact) {
            testCases = Array.isArray(existingTestCaseArtifact.testCases)
                ? existingTestCaseArtifact.testCases.map(item => ({ ...item }))
                : [];
        } else {
            const generatedTestCases = this.testCaseGenerator.generate(scenarios);
            const overlapResolved = this.semanticTestCaseOverlapResolver.resolve(generatedTestCases, {
                approvedFunctions: knowledge.functions
            });
            const qualityResult = this.productionTestCaseQualityGate.apply(overlapResolved, {
                requirement: confirmedRequirement,
                knowledge
            });
            testCases = qualityResult.testCases;
            productionQualitySummary = qualityResult.summary;
        }
        testCases = this.testCaseReviewValidator.normalizeBatch(testCases, {
            defaultStatus:
                existingTestCaseArtifact?.approvalStatus === "approved" ? "APPROVED" : "PENDING"
        });
        this.testCaseReviewValidator.validateBatch(testCases);
        const coverageSummary = this.coreTestCaseCoverageValidator.validate(knowledge, testCases);

        console.log(`✓ ${scenarios.length} core scenarios generated`);
        console.log(`✓ ${testCases.length} core testcases generated`);

        if (!testCaseReviewSessionId || !testCaseArtifactId) {
            const timestamp = this.fileNameGenerator.getTimestamp();
            const newSessionId = `SESSION-TESTCASE-${timestamp}`;
            const newArtifactId = `TESTCASE-${timestamp}`;
            const testCaseReviewArtifact = {
                artifactId: newArtifactId,
                artifactType: "TEST_CASE_REVIEW",
                testCases,
                source: "CORE_RULE_ENGINE",
                summary: this.buildTestCaseReviewSummary(testCases),
                qualitySummary: {
                    overlapResolution: this.semanticTestCaseOverlapResolver.lastSummary,
                    productionQuality: productionQualitySummary,
                    coverage: coverageSummary,
                    finalCount: testCases.length
                },
                references: {
                    aiAnalysisReviewSessionId: clarificationReviewSessionId,
                    aiAnalysisArtifactId: clarificationArtifactId
                },
                approvalStatus: "pending"
            };
            const reviewResult = this.workflowCoordinator.startTestCaseReview({
                sessionId: newSessionId,
                artifactId: newArtifactId,
                testCase: testCaseReviewArtifact
            });
            workflowContext.setStage("testCaseReview", {
                sessionId: newSessionId,
                artifactId: newArtifactId
            });

            return {
                status: PipelineStatuses.AWAITING_TEST_CASE_REVIEW,
                reviewStage: "TEST_CASE_REVIEW",
                currentStage: "testCaseReview",
                testCaseReview: {
                    sessionId: newSessionId,
                    artifactId: newArtifactId,
                    status: reviewResult.status
                },
                requirement: confirmedRequirement,
                aiResult,
                aiAnalysis: aiResult,
                knowledge,
                recommendedScenarios,
                scenarios,
                testCases,
                workflowContext: workflowContext.toJSON(),
                outputs: {}
            };
        }

        if (
            !this.workflowCoordinator.isApproved(testCaseArtifactId) ||
            !this.workflowCoordinator.isCompleted(testCaseReviewSessionId)
        ) {
            throw new Error("Tester Review must be approved and completed before export.");
        }

        const approvedTestCaseArtifact = this.workflowCoordinator.findArtifact(testCaseArtifactId);
        testCases = this.approvedTestCaseMapper.map(approvedTestCaseArtifact);

        if (Object.keys(approvedTestCaseArtifact.outputs ?? {}).length > 0) {
            return {
                status: PipelineStatuses.COMPLETED,
                reviewStage: null,
                requirement: confirmedRequirement,
                aiResult,
                aiAnalysis: aiResult,
                knowledge,
                recommendedScenarios,
                scenarios,
                testCases,
                workflowContext: workflowContext.toJSON(),
                outputs: { ...approvedTestCaseArtifact.outputs }
            };
        }

        console.log("\n[6/6] Exporting approved testcases...");
        const outputs = this.testCaseOutputService.export({
            requirement: confirmedRequirement,
            testCases,
            outputRoot: options.outputRoot ?? options.outputDirectory ?? "./outputs/production",
            outputFileName: "approved-testcases",
            formats: ["json", "markdown", "excel"]
        });
        this.workflowCoordinator.saveArtifact({
            ...approvedTestCaseArtifact,
            outputs: { ...outputs }
        });

        return {
            status: PipelineStatuses.COMPLETED,
            reviewStage: null,
            requirement: confirmedRequirement,
            aiResult,
            aiAnalysis: aiResult,
            knowledge,
            recommendedScenarios,
            scenarios,
            testCases,
            workflowContext: workflowContext.toJSON(),
            outputs
        };
    }

    isCoreProductionScenario(scenario, knowledge) {
        const type = String(scenario?.type ?? "")
            .trim()
            .toUpperCase();
        const groupType = String(scenario?.groupType ?? "")
            .trim()
            .toUpperCase();
        const sourceTypes = (Array.isArray(scenario?.sourceItems) ? scenario.sourceItems : [])
            .map(item =>
                String(item?.source ?? "")
                    .trim()
                    .toUpperCase()
            )
            .filter(Boolean);

        if (type === "POSITIVE") return true;
        if (type === "CONFIRMED_FACT") return true;
        if (
            type === "BUSINESS_RULE" &&
            (groupType === "BUSINESS_RULE" || sourceTypes.includes("BUSINESS_RULE"))
        ) {
            return true;
        }
        if (
            type === "VALIDATION" &&
            [groupType, ...sourceTypes].some(value =>
                ["REQUIRED_VALIDATION", "FORMAT_OR_VALUE_VALIDATION"].includes(value)
            )
        ) {
            return true;
        }
        if (type === "PERMISSION") {
            return Array.isArray(knowledge?.permissions) && knowledge.permissions.length > 0;
        }
        if (type === "BOUNDARY") {
            return Array.isArray(scenario?.sourceItems) && scenario.sourceItems.length > 0;
        }
        return false;
    }

    buildWorkflowContext(options = {}) {
        const normalizedOptions =
            options && typeof options === "object" && !Array.isArray(options) ? options : {};

        const sourceContext = normalizedOptions.workflowContext;

        const workflowContext =
            sourceContext instanceof WorkflowExecutionContext
                ? new WorkflowExecutionContext(sourceContext.toJSON())
                : sourceContext &&
                    typeof sourceContext === "object" &&
                    !Array.isArray(sourceContext)
                  ? new WorkflowExecutionContext(sourceContext)
                  : new WorkflowExecutionContext();

        const legacyStages = [
            {
                stageName: "clarificationReview",
                sessionId: normalizedOptions.clarificationReviewSessionId,
                artifactId: normalizedOptions.clarificationArtifactId
            },
            {
                stageName: "requirementReview",
                sessionId: normalizedOptions.requirementReviewSessionId,
                artifactId: normalizedOptions.requirementArtifactId
            },
            {
                stageName: "moduleReview",
                sessionId: normalizedOptions.moduleReviewSessionId,
                artifactId: normalizedOptions.moduleArtifactId
            },
            {
                stageName: "scenarioReview",
                sessionId: normalizedOptions.scenarioReviewSessionId,
                artifactId: normalizedOptions.scenarioArtifactId
            },
            {
                stageName: "testCaseReview",
                sessionId: normalizedOptions.testCaseReviewSessionId,
                artifactId: normalizedOptions.testCaseArtifactId
            }
        ];

        legacyStages.forEach(({ stageName, sessionId, artifactId }) => {
            if (
                typeof sessionId === "string" &&
                sessionId.trim() &&
                typeof artifactId === "string" &&
                artifactId.trim()
            ) {
                workflowContext.setStage(stageName, {
                    sessionId,

                    artifactId
                });
            }
        });

        return workflowContext;
    }

    getWorkflowContextFromResult(result) {
        if (!result || typeof result !== "object" || Array.isArray(result)) {
            return new WorkflowExecutionContext();
        }

        if (
            result.workflowContext &&
            typeof result.workflowContext === "object" &&
            !Array.isArray(result.workflowContext)
        ) {
            return new WorkflowExecutionContext(result.workflowContext);
        }

        return new WorkflowExecutionContext({
            clarificationReview: result.clarificationReview,

            requirementReview: result.requirementReview,

            moduleReview: result.moduleReview,

            scenarioReview: result.scenarioReview,

            testCaseReview: result.testCaseReview
        });
    }

    reviewRequirement({ sessionId, feedback = "" }) {
        return this.workflowCoordinator.review({
            workflowName: "requirement-review",

            sessionId,

            feedback
        });
    }

    buildClarificationQuestions(knowledge, aiResult) {
        return this.normalizeClarificationItems(knowledge?.questions, aiResult?.questions).map(
            item => ({
                questionId: item.id,

                category: item.category,

                priority: item.priority,

                question: item.question,

                type: item.type,

                reason: item.reason,

                targetField: item.targetField ?? "",

                targetRule: item.targetRule ?? "",

                ...(Array.isArray(item.options) && item.options.length > 0
                    ? { options: [...item.options] }
                    : {}),

                allowNotSpecified: item.allowNotSpecified === true,

                requirementReferences: Array.isArray(item.requirementReferences)
                    ? [...item.requirementReferences]
                    : [],

                answer: "",

                status: "pending",

                answeredAt: null,

                answeredBy: null
            })
        );
    }

    answerClarificationQuestion({
        sessionId,
        artifactId,
        questionId,
        answer,
        answeredBy = "user"
    }) {
        this.requireMeaningfulClarificationValue(sessionId, "sessionId");
        this.requireMeaningfulClarificationValue(artifactId, "artifactId");
        this.requireMeaningfulClarificationValue(questionId, "questionId");

        if (typeof answer !== "string" || answer.trim() === "") {
            throw new Error("answer is required.");
        }

        const artifact = this.workflowCoordinator.findArtifact(artifactId);

        if (!artifact || artifact.sessionId !== sessionId) {
            throw new Error(`Clarification artifact '${artifactId}' not found.`);
        }

        const questions = Array.isArray(artifact.questions) ? artifact.questions : [];

        const questionIndex = questions.findIndex(question => question?.questionId === questionId);

        if (questionIndex < 0) {
            throw new Error(`Clarification question '${questionId}' not found.`);
        }

        const updatedQuestions = questions.map((question, index) =>
            index === questionIndex
                ? {
                      ...question,

                      answer: answer.trim(),

                      status: "answered",

                      answeredAt: new Date().toISOString(),

                      answeredBy
                  }
                : question
        );

        const answered = updatedQuestions.filter(question =>
            this.isAnsweredClarificationQuestion(question)
        ).length;

        return this.workflowCoordinator.saveArtifact({
            ...artifact,

            questions: updatedQuestions,

            summary: {
                ...(artifact.summary ?? {}),

                total: updatedQuestions.length,

                answered,

                pending: updatedQuestions.length - answered
            }
        });
    }

    getClarificationStatus({ sessionId, artifactId }) {
        this.requireMeaningfulClarificationValue(sessionId, "sessionId");
        this.requireMeaningfulClarificationValue(artifactId, "artifactId");

        const artifact = this.workflowCoordinator.findArtifact(artifactId);

        if (!artifact || artifact.sessionId !== sessionId) {
            throw new Error(`Clarification artifact '${artifactId}' not found.`);
        }

        const session = this.workflowCoordinator.findSession(sessionId);

        if (!session) {
            throw new Error(`Clarification session '${sessionId}' not found.`);
        }

        const questions = Array.isArray(artifact.questions) ? artifact.questions : [];

        const answered = questions.filter(question =>
            this.isAnsweredClarificationQuestion(question)
        ).length;

        return {
            sessionId,

            artifactId,

            total: questions.length,

            answered,

            pending: questions.length - answered,

            isFullyAnswered: questions.length > 0 && answered === questions.length,

            approvalStatus: artifact.approvalStatus ?? null,

            sessionStatus: session.status ?? null,

            questions
        };
    }

    reviewClarification({ sessionId, feedback = "" }) {
        return this.workflowCoordinator.review({
            workflowName: "clarification-review",

            sessionId,

            feedback
        });
    }

    approveClarification({ sessionId, artifactId, approvedBy = "user" }) {
        const status = this.getClarificationStatus({
            sessionId,

            artifactId
        });

        if (!status.isFullyAnswered && status.total > 0) {
            throw new Error("All clarification questions must be answered before approval.");
        }

        return this.workflowCoordinator.approveClarification({
            sessionId,

            artifactId,

            approvedBy
        });
    }

    requireMeaningfulClarificationValue(value, fieldName) {
        if (typeof value !== "string" || value.trim() === "") {
            throw new Error(`${fieldName} is required.`);
        }
    }

    isAnsweredClarificationQuestion(question) {
        return (
            question?.status === "answered" &&
            typeof question.answer === "string" &&
            question.answer.trim() !== ""
        );
    }

    approveRequirement({ sessionId, artifactId, approvedBy = "user" }) {
        return this.workflowCoordinator.approveRequirement({
            sessionId,

            artifactId,

            approvedBy
        });
    }

    reviewModule({ sessionId, feedback = "" }) {
        return this.workflowCoordinator.review({
            workflowName: "module-review",

            sessionId,

            feedback
        });
    }

    approveModule({ sessionId, artifactId, approvedBy = "user" }) {
        return this.workflowCoordinator.approveModule({
            sessionId,

            artifactId,

            approvedBy
        });
    }

    reviewScenario({ sessionId, feedback = "" }) {
        return this.workflowCoordinator.review({
            workflowName: "scenario-review",

            sessionId,

            feedback
        });
    }

    approveScenario({ sessionId, artifactId, approvedBy = "user" }) {
        return this.workflowCoordinator.approveScenario({
            sessionId,

            artifactId,

            approvedBy
        });
    }

    reviewTestCase({ sessionId, feedback = "" }) {
        return this.workflowCoordinator.review({
            workflowName: "test-case-review",

            sessionId,

            feedback
        });
    }

    approveTestCase({ sessionId, artifactId, approvedBy = "user" }) {
        return this.workflowCoordinator.approveTestCase({
            sessionId,

            artifactId,

            approvedBy
        });
    }

    buildModuleReviewData(requirement, knowledge = null) {
        if (knowledge?.module && Array.isArray(knowledge?.functions)) {
            return [
                {
                    module: knowledge.module.name,
                    features: knowledge.functions.map(item => item.name)
                }
            ];
        }

        const normalizedModule =
            typeof requirement?.module === "string" ? requirement.module.trim() : "";

        const moduleName = normalizedModule || "Module chưa xác định";

        const features = [];

        const featureKeys = new Set();

        const addFeature = value => {
            const featureName =
                typeof value === "string"
                    ? value.trim()
                    : value && typeof value === "object"
                      ? String(value.name ?? value.feature ?? value.title ?? "").trim()
                      : "";

            if (!featureName) {
                return;
            }

            const comparisonKey = featureName.toLowerCase();

            if (featureKeys.has(comparisonKey)) {
                return;
            }

            featureKeys.add(comparisonKey);

            features.push(featureName);
        };

        if (Array.isArray(requirement?.features)) {
            requirement.features.forEach(addFeature);
        }

        if (features.length === 0) {
            addFeature(requirement?.feature);
        }

        return [
            {
                module: moduleName,

                features
            }
        ];
    }

    buildScenarioReviewSummary(scenarios) {
        if (!Array.isArray(scenarios)) {
            return {
                total: 0,

                byType: {},

                byFeature: {}
            };
        }

        const byType = {};

        const byFeature = {};

        scenarios.forEach(scenario => {
            const type =
                typeof scenario?.type === "string" && scenario.type.trim()
                    ? scenario.type.trim()
                    : "UNKNOWN";

            const feature =
                typeof scenario?.feature === "string" && scenario.feature.trim()
                    ? scenario.feature.trim()
                    : "Chức năng chưa xác định";

            byType[type] = (byType[type] ?? 0) + 1;

            byFeature[feature] = (byFeature[feature] ?? 0) + 1;
        });

        return {
            total: scenarios.length,

            byType,

            byFeature
        };
    }

    buildTestCaseReviewSummary(testCases) {
        if (!Array.isArray(testCases)) {
            return {
                total: 0,

                byType: {},

                byFeature: {},

                bySeverity: {},

                automationCandidates: 0
            };
        }

        const byType = {};

        const byFeature = {};

        const bySeverity = {};

        let automationCandidates = 0;

        testCases.forEach(testCase => {
            const type =
                typeof testCase?.type === "string" && testCase.type.trim()
                    ? testCase.type.trim()
                    : "UNKNOWN";

            const feature =
                typeof testCase?.feature === "string" && testCase.feature.trim()
                    ? testCase.feature.trim()
                    : "Chức năng chưa xác định";

            const severity =
                typeof testCase?.severity === "string" && testCase.severity.trim()
                    ? testCase.severity.trim()
                    : "UNKNOWN";

            byType[type] = (byType[type] ?? 0) + 1;

            byFeature[feature] = (byFeature[feature] ?? 0) + 1;

            bySeverity[severity] = (bySeverity[severity] ?? 0) + 1;

            if (testCase?.automationCandidate === true) {
                automationCandidates += 1;
            }
        });

        return {
            total: testCases.length,

            byType,

            byFeature,

            bySeverity,

            automationCandidates
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
            const existingQuestions = Array.isArray(knowledge.questions) ? knowledge.questions : [];
            const scenarioKeys = this.collectExistingScenarioKeys(knowledge, requirement);
            const riskKeys = new Set(
                riskAreas.map(value => this.getComparableText(value)).filter(Boolean)
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
            const normalizedExistingQuestions = this.normalizeClarificationItems(existingQuestions);
            const questions = this.normalizeClarificationItems(
                normalizedExistingQuestions,
                aiResult.questions
            );
            questionsAdded = Math.max(0, questions.length - normalizedExistingQuestions.length);

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

    normalizeClarificationItems(...collections) {
        const questions = [];
        const comparisonKeys = new Set();
        const usedIds = new Set();
        let fallbackSequence = 1;

        const getFallbackId = () => {
            let candidate = `CL${String(fallbackSequence).padStart(3, "0")}`;

            while (usedIds.has(candidate.toUpperCase())) {
                fallbackSequence += 1;
                candidate = `CL${String(fallbackSequence).padStart(3, "0")}`;
            }

            return candidate;
        };

        for (const collection of collections) {
            if (!Array.isArray(collection)) {
                continue;
            }

            for (const item of collection) {
                if (questions.length >= 5) {
                    return questions;
                }

                const fallbackId = getFallbackId();
                const sourceItem =
                    item && typeof item === "object" && !Array.isArray(item)
                        ? {
                              ...item,

                              id: item.id ?? item.questionId,

                              question: item.question ?? item.content ?? item.text ?? item.title
                          }
                        : item;
                const question = ClarificationQuestion.from(sourceItem, fallbackId);

                if (!question) {
                    continue;
                }

                const comparisonKey = ClarificationQuestion.deduplicationKey(question);

                if (!comparisonKey || comparisonKeys.has(comparisonKey)) {
                    continue;
                }

                const requestedId = question.id.trim();
                const requestedIdKey = requestedId.toUpperCase();
                const questionId =
                    /^CL\d{3,}$/i.test(requestedId) && !usedIds.has(requestedIdKey)
                        ? requestedId
                        : fallbackId;
                const normalizedQuestion = ClarificationQuestion.from(
                    {
                        ...question.toJSON(),
                        id: questionId
                    },
                    questionId
                );

                if (!normalizedQuestion?.isValid()) {
                    continue;
                }

                usedIds.add(normalizedQuestion.id.toUpperCase());
                comparisonKeys.add(comparisonKey);
                questions.push({
                    ...normalizedQuestion.toJSON(),
                    requirementReferences: Array.isArray(sourceItem?.requirementReferences)
                        ? sourceItem.requirementReferences
                              .filter(
                                  reference => typeof reference === "string" && reference.trim()
                              )
                              .map(reference => reference.trim())
                        : []
                });
            }
        }

        return questions;
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
