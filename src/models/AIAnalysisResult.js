export default class AIAnalysisResult {
    constructor({
        purpose = "",
        functions = [],
        risks = [],
        clarificationQuestions = [],
        requirementComplete = false,
        analysisStatus = "",
        analysisSource = "",
        analysisError = "",
        confidence = 0
    } = {}) {
        this.purpose = typeof purpose === "string" ? purpose.trim() : "";
        this.functions = this.cloneArray(functions);
        this.risks = this.cloneArray(risks);
        this.clarificationQuestions = this.cloneArray(clarificationQuestions);
        this.requirementComplete = requirementComplete === true;
        this.analysisStatus = typeof analysisStatus === "string" ? analysisStatus : "";
        this.analysisSource = typeof analysisSource === "string" ? analysisSource : "";
        this.analysisError = typeof analysisError === "string" ? analysisError : "";
        this.confidence = Number.isFinite(Number(confidence)) ? Number(confidence) : 0;

        // Temporary read compatibility. Canonical production fields are risks and
        // clarificationQuestions.
        this.defineAlias("riskAreas", "risks");
        this.defineAlias("questions", "clarificationQuestions");
    }

    defineAlias(alias, canonical) {
        Object.defineProperty(this, alias, {
            enumerable: false,
            configurable: true,
            get: () => this[canonical],
            set: value => {
                this[canonical] = this.cloneArray(value);
            }
        });
    }

    cloneArray(value) {
        return Array.isArray(value) ? value.map(item => this.clone(item)) : [];
    }

    clone(value) {
        if (Array.isArray(value)) return value.map(item => this.clone(item));
        if (value && typeof value === "object") {
            return Object.fromEntries(
                Object.entries(value).map(([key, item]) => [key, this.clone(item)])
            );
        }
        return value;
    }
}
