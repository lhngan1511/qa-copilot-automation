export default class WorkflowExecutionContext {
    constructor(data = {}) {
        this.clarificationReview = this.normalizeStage(data.clarificationReview);

        this.requirementReview = this.normalizeStage(data.requirementReview);

        this.moduleReview = this.normalizeStage(data.moduleReview);

        this.scenarioReview = this.normalizeStage(data.scenarioReview);

        this.testCaseReview = this.normalizeStage(data.testCaseReview);
    }

    normalizeStage(stage = {}) {
        return {
            sessionId: typeof stage?.sessionId === "string" ? stage.sessionId.trim() : "",

            artifactId: typeof stage?.artifactId === "string" ? stage.artifactId.trim() : ""
        };
    }

    setStage(stageName, { sessionId = "", artifactId = "" } = {}) {
        if (!this.hasStage(stageName)) {
            throw new Error(`Unsupported workflow stage: ${stageName}`);
        }

        this[stageName] = this.normalizeStage({
            sessionId,
            artifactId
        });

        return this;
    }

    getStage(stageName) {
        if (!this.hasStage(stageName)) {
            throw new Error(`Unsupported workflow stage: ${stageName}`);
        }

        return {
            ...this[stageName]
        };
    }

    isStageInitialized(stageName) {
        const stage = this.getStage(stageName);

        return Boolean(stage.sessionId && stage.artifactId);
    }

    hasStage(stageName) {
        return [
            "clarificationReview",
            "requirementReview",
            "moduleReview",
            "scenarioReview",
            "testCaseReview"
        ].includes(stageName);
    }

    toJSON() {
        return {
            clarificationReview: {
                ...this.clarificationReview
            },

            requirementReview: {
                ...this.requirementReview
            },

            moduleReview: {
                ...this.moduleReview
            },

            scenarioReview: {
                ...this.scenarioReview
            },

            testCaseReview: {
                ...this.testCaseReview
            }
        };
    }
}
