export default class ApprovedScenarioMapper {
    map(artifact) {
        if (artifact?.artifactType !== "SCENARIO_REVIEW")
            throw new Error("Artifact type must be SCENARIO_REVIEW.");
        if (artifact?.approvalStatus !== "approved")
            throw new Error("Scenario Artifact must be approved.");
        if (!Array.isArray(artifact.scenarios)) return [];
        return artifact.scenarios.map(item => {
            const value = this.clone(item);
            value.id ||= value.scenarioId ?? "";
            value.functionId ||= value.featureId ?? "";
            value.function ||= value.functionName ?? value.feature ?? "";
            value.feature ||= value.function;
            value.requirementReferences = Array.isArray(value.requirementReferences)
                ? value.requirementReferences
                : value.requirementReference
                  ? [value.requirementReference]
                  : [];
            if (!value.id || !value.functionId || !value.title) {
                throw new Error("Approved scenario requires id, functionId and title.");
            }
            return value;
        });
    }
    clone(value) {
        if (Array.isArray(value)) return value.map(item => this.clone(item));
        if (value && typeof value === "object")
            return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, this.clone(v)]));
        return value;
    }
}
