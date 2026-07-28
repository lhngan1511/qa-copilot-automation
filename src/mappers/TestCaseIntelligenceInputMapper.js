import TestCaseIntelligenceInput from "../models/TestCaseIntelligenceInput.js";
export default class TestCaseIntelligenceInputMapper {
    map({
        scenarios,
        moduleArtifact,
        knowledge,
        clarificationArtifact,
        executionContext,
        constraints
    } = {}) {
        const context = executionContext?.toJSON?.() ?? executionContext ?? {};
        return new TestCaseIntelligenceInput({
            scenarios,
            module: moduleArtifact?.module ?? knowledge?.module,
            functions: moduleArtifact?.functions ?? knowledge?.functions,
            clarificationAnswers:
                clarificationArtifact?.approvalStatus === "approved"
                    ? clarificationArtifact.questions
                    : knowledge?.clarificationAnswers,
            requirementReference: {
                scenarioReview: context.scenarioReview,
                moduleReview: context.moduleReview
            },
            constraints
        });
    }
}
