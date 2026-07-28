import "dotenv/config";
import assert from "node:assert/strict";
import RequirementLoader from "../src/loaders/RequirementLoader.js";
import MarkdownParser from "../src/parsers/MarkdownParser.js";
import RequirementIntelligenceInput from "../src/models/RequirementIntelligenceInput.js";
import RequirementIntelligenceEngine from "../src/engines/RequirementIntelligenceEngine.js";
import ScenarioRecommendationEngine from "../src/recommenders/ScenarioRecommendationEngine.js";
import ScenarioIntelligenceInputMapper from "../src/mappers/ScenarioIntelligenceInputMapper.js";
import AIScenarioIntelligenceEngine from "../src/engines/AIScenarioIntelligenceEngine.js";
import ScenarioQualityPolicy from "../src/intelligence/ScenarioQualityPolicy.js";
import ScenarioIntelligenceMerger from "../src/intelligence/ScenarioIntelligenceMerger.js";

if (
    process.env.ENABLE_AI !== "true" ||
    String(process.env.AI_PROVIDER).toLowerCase() !== "gemini" ||
    process.env.AI_FALLBACK_ENABLED !== "false"
) {
    throw new Error("Run with ENABLE_AI=true AI_PROVIDER=gemini AI_FALLBACK_ENABLED=false.");
}

const requirement = new MarkdownParser().parse(
    new RequirementLoader().load("./requirements/thiet-bi.md")
);
const intelligenceInput = new RequirementIntelligenceInput({
    requirement,
    approvedRequirement: { approvalStatus: "approved", requirement },
    clarifications: [{
        questionId: "CL001",
        answer: "Hiển thị toàn bộ dữ liệu",
        status: "answered"
    }]
});
const knowledge = new RequirementIntelligenceEngine().analyze(intelligenceInput);
const artifact = {
    artifactType: "MODULE_REVIEW",
    approvalStatus: "approved",
    module: knowledge.module,
    functions: knowledge.functions,
    requirementReference: {}
};
const ruleScenarios = new ScenarioRecommendationEngine().generate(knowledge, requirement);
const scenarioInput = new ScenarioIntelligenceInputMapper().map({
    moduleArtifact: artifact,
    knowledge,
    ruleScenarios
});
const ai = await new AIScenarioIntelligenceEngine().analyze(scenarioInput);
assert.equal(ai.status, "SUCCESS");
assert.equal(ai.source, "gemini");
const merged = new ScenarioIntelligenceMerger(new ScenarioQualityPolicy()).merge(
    ruleScenarios,
    ai.scenarios,
    { functions: knowledge.functions }
);
console.log(JSON.stringify({
    ruleCandidates: ruleScenarios.length,
    aiCandidates: ai.scenarios.length,
    ...merged.summary
}, null, 2));
