import RequirementIntelligenceInput from "../models/RequirementIntelligenceInput.js";

export default class RequirementIntelligenceInputMapper {
    map({
        requirement,
        requirementReviewArtifact,
        clarificationArtifact,
        executionContext
    } = {}) {
        const approvedRequirement =
            requirementReviewArtifact?.approvalStatus === "approved"
                ? requirementReviewArtifact
                : null;

        const approvedClarifications =
            clarificationArtifact?.approvalStatus === "approved" &&
            Array.isArray(clarificationArtifact.questions)
                ? clarificationArtifact.questions.filter(
                      item =>
                          item &&
                          typeof item === "object" &&
                          item.status === "answered" &&
                          typeof item.answer === "string" &&
                          item.answer.trim() !== ""
                  )
                : [];

        const context =
            executionContext && typeof executionContext.toJSON === "function"
                ? executionContext.toJSON()
                : executionContext || {};

        return new RequirementIntelligenceInput({
            requirement,
            approvedRequirement,
            clarifications: approvedClarifications,
            requirementReference: {
                requirementReviewSessionId: context?.requirementReview?.sessionId,
                requirementArtifactId: context?.requirementReview?.artifactId,
                clarificationSessionId: context?.clarificationReview?.sessionId,
                clarificationArtifactId: context?.clarificationReview?.artifactId
            }
        });
    }
}
