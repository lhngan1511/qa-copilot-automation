export default class WorkflowResult {
    constructor({
        success = true,
        workflowName = null,
        workflowId = null,
        sessionId = null,
        status = null,
        artifact = null,
        data = null,
        message = null,
        errors = [],
        metadata = {}
    } = {}) {
        this.success = Boolean(success);

        this.workflowName = workflowName;

        this.workflowId = workflowId;

        this.sessionId = sessionId;

        this.status = status;

        this.artifact = artifact;

        this.data = data;

        this.message = message;

        this.errors = Array.isArray(errors) ? [...errors] : [];

        this.metadata = metadata && typeof metadata === "object" ? { ...metadata } : {};
    }

    addError(error) {
        if (!error) {
            return this;
        }

        this.errors.push(error);

        this.success = false;

        return this;
    }

    setStatus(status) {
        this.status = status;

        return this;
    }

    setData(data) {
        this.data = data;

        return this;
    }

    setArtifact(artifact) {
        this.artifact = artifact;

        return this;
    }

    setMessage(message) {
        this.message = message;

        return this;
    }

    setMetadata(key, value) {
        if (!key || typeof key !== "string") {
            throw new Error("Metadata key is required.");
        }

        this.metadata[key] = value;

        return this;
    }

    hasErrors() {
        return this.errors.length > 0;
    }

    toJSON() {
        return {
            success: this.success,

            workflowName: this.workflowName,

            workflowId: this.workflowId,

            sessionId: this.sessionId,

            status: this.status,

            artifact: this.artifact,

            data: this.data,

            message: this.message,

            errors: [...this.errors],

            metadata: { ...this.metadata }
        };
    }
}
