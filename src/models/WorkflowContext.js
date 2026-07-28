export default class WorkflowContext {
    constructor({
        workflowId = null,
        sessionId = null,
        artifactId = null,
        artifactType = null,
        input = null,
        metadata = {}
    } = {}) {
        this.workflowId = workflowId;

        this.sessionId = sessionId;

        this.artifactId = artifactId;

        this.artifactType = artifactType;

        this.input = input;

        this.metadata = metadata && typeof metadata === "object" ? { ...metadata } : {};
    }

    setInput(input) {
        this.input = input;

        return this;
    }

    setArtifact({ artifactId, artifactType } = {}) {
        if (artifactId !== undefined) {
            this.artifactId = artifactId;
        }

        if (artifactType !== undefined) {
            this.artifactType = artifactType;
        }

        return this;
    }

    setMetadata(key, value) {
        if (!key || typeof key !== "string") {
            throw new Error("Metadata key is required.");
        }

        this.metadata[key] = value;

        return this;
    }

    getMetadata(key, defaultValue = undefined) {
        if (Object.prototype.hasOwnProperty.call(this.metadata, key)) {
            return this.metadata[key];
        }

        return defaultValue;
    }

    toJSON() {
        return {
            workflowId: this.workflowId,

            sessionId: this.sessionId,

            artifactId: this.artifactId,

            artifactType: this.artifactType,

            input: this.input,

            metadata: { ...this.metadata }
        };
    }
}
