export default class RequirementIntelligenceInput {
    constructor({
        requirement = null,
        approvedRequirement = null,
        clarifications = [],
        requirementReference = {}
    } = {}) {
        this.requirement = this.cloneObject(requirement);
        this.approvedRequirement = this.cloneObject(approvedRequirement);
        this.clarifications = Array.isArray(clarifications)
            ? clarifications
                  .filter(item => item && typeof item === "object" && !Array.isArray(item))
                  .map(item => this.cloneValue(item))
            : [];
        this.requirementReference = {
            requirementReviewSessionId: this.normalizeText(
                requirementReference?.requirementReviewSessionId
            ),
            requirementArtifactId: this.normalizeText(
                requirementReference?.requirementArtifactId
            ),
            clarificationSessionId: this.normalizeText(
                requirementReference?.clarificationSessionId
            ),
            clarificationArtifactId: this.normalizeText(
                requirementReference?.clarificationArtifactId
            )
        };
    }

    isValid() {
        return Boolean(
            this.requirement &&
                this.approvedRequirement &&
                this.approvedRequirement.approvalStatus === "approved" &&
                this.clarifications.every(
                    item => typeof item.answer === "string" && item.answer.trim() !== ""
                )
        );
    }

    toJSON() {
        return this.cloneValue({
            requirement: this.requirement,
            approvedRequirement: this.approvedRequirement,
            clarifications: this.clarifications,
            requirementReference: this.requirementReference
        });
    }

    cloneObject(value) {
        return value && typeof value === "object" && !Array.isArray(value)
            ? this.cloneValue(value)
            : null;
    }

    cloneValue(value) {
        if (Array.isArray(value)) {
            return value.map(item => this.cloneValue(item));
        }

        if (value && typeof value === "object") {
            return Object.fromEntries(
                Object.entries(value).map(([key, item]) => [key, this.cloneValue(item)])
            );
        }

        return value;
    }

    normalizeText(value) {
        return typeof value === "string" ? value.trim() : "";
    }
}
