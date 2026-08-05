/**
 * Model Execution Result Artifact — immutable, traceable.
 */
export default class ExecutionResult {
    constructor({
        artifactId = "",
        status = "NOT_EXECUTED", // PASSED | FAILED | ERROR | NOT_EXECUTED | SKIPPED
        testCaseId = "",
        mappingArtifactId = "",
        generatedProjectId = "",
        summary = {},
        failures = [],
        errors = [],
        durationMs = 0,
        environment = {},
        createdAt = new Date().toISOString()
    } = {}) {
        this.artifactId = artifactId;
        this.status = status;
        this.testCaseId = testCaseId;
        this.mappingArtifactId = mappingArtifactId;
        this.generatedProjectId = generatedProjectId;
        this.summary = summary;
        this.failures = failures;
        this.errors = errors;
        this.durationMs = durationMs;
        this.environment = environment;
        this.createdAt = createdAt;
    }

    toJSON() {
        return {
            artifactType: "EXECUTION_RESULT",
            artifactId: this.artifactId,
            status: this.status,
            testCaseId: this.testCaseId,
            mappingArtifactId: this.mappingArtifactId,
            generatedProjectId: this.generatedProjectId,
            summary: this.summary,
            failures: this.failures,
            errors: this.errors,
            durationMs: this.durationMs,
            environment: this.environment,
            createdAt: this.createdAt
        };
    }
}
