import ScenarioIntelligenceInput from "../models/ScenarioIntelligenceInput.js";

export default class ScenarioIntelligenceInputMapper {
    map({
        moduleArtifact,
        knowledge,
        ruleScenarios,
        executionContext,
        constraints
    } = {}) {
        if (
            moduleArtifact?.artifactType !== "MODULE_REVIEW" ||
            moduleArtifact?.approvalStatus !== "approved"
        ) {
            return new ScenarioIntelligenceInput();
        }

        const context =
            typeof executionContext?.toJSON === "function"
                ? executionContext.toJSON()
                : executionContext ?? {};

        return new ScenarioIntelligenceInput({
            module: knowledge?.module ?? moduleArtifact.module,
            functions: knowledge?.functions ?? moduleArtifact.functions,
            ruleScenarios,
            clarificationAnswers: knowledge?.clarificationAnswers,
            requirementReference: {
                ...moduleArtifact.requirementReference,
                moduleReviewSessionId: context?.moduleReview?.sessionId ?? "",
                moduleArtifactId: context?.moduleReview?.artifactId ?? ""
            },
            constraints
        });
    }
}
