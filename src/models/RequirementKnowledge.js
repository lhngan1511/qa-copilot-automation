import RequirementModuleKnowledge from "./RequirementModuleKnowledge.js";
import RequirementFunctionKnowledge from "./RequirementFunctionKnowledge.js";

class RequirementKnowledge {
    constructor(data = {}) {
        this.module = null;
        this.functions = [];
        this.purpose = this.normalizeString(data.purpose);
        this.actors = this.normalizeStringArray(data.actors);
        this.businessRules = this.normalizeStringArray(data.businessRules);

        // Existing intelligence collections keep their original semantics.
        this.validationRules = this.cloneArray(data.validationRules);
        this.riskAreas = this.cloneArray(data.riskAreas ?? data.risks);
        this.defineArrayAlias("risks", "riskAreas");
        this.boundaryCases = this.cloneArray(data.boundaryCases);
        this.negativeCases = this.cloneArray(data.negativeCases);
        this.positiveCases = this.cloneArray(data.positiveCases);
        this.securityCases = this.cloneArray(data.securityCases);
        this.permissionCases = this.cloneArray(data.permissionCases);
        this.dataIntegrityCases = this.cloneArray(data.dataIntegrityCases);
        this.suggestedScenarios = this.cloneArray(data.suggestedScenarios);
        this.questions = this.cloneArray(data.questions ?? data.clarificationQuestions);
        this.defineArrayAlias("clarificationQuestions", "questions");

        this.permissions = this.normalizeStringArray(data.permissions);
        this.dependencies = this.normalizeStringArray(data.dependencies);
        this.assumptions = this.normalizeStringArray(data.assumptions);
        this.exceptions = this.normalizeStringArray(data.exceptions);
        this.notes = this.normalizeStringArray(data.notes);
        this.clarificationAnswers = this.cloneObjectArray(data.clarificationAnswers);
        this.approved = data.approved === true;

        this.confidence = typeof data.confidence === "number" ? data.confidence : 0;
        this.source =
            typeof data.source === "string" ? data.source : "Requirement Intelligence Engine";
        this.version = typeof data.version === "string" ? data.version : "1.0";

        if (data.module !== undefined && data.module !== null) {
            this.setModule(data.module);
        }

        this.setFunctions(data.functions);

        if (Object.prototype.hasOwnProperty.call(data, "features")) {
            this.features = this.cloneArray(data.features);
        }

        if (Object.prototype.hasOwnProperty.call(data, "feature")) {
            this.feature = data.feature;
        }
    }

    setModule(value) {
        const module = RequirementModuleKnowledge.from(value, "MOD001");
        this.module = module ? module.toJSON() : null;
        return this.module;
    }

    setFunctions(values) {
        this.functions = [];

        if (!Array.isArray(values)) {
            return this.functions;
        }

        values.forEach(value => {
            this.addFunction(value);
        });

        return this.functions;
    }

    addFunction(value) {
        const fallbackModuleId = this.module?.id ?? "";
        const fallbackId = this.getNextFunctionId();
        const functionKnowledge = RequirementFunctionKnowledge.from(value, {
            fallbackId,
            fallbackModuleId
        });

        if (!functionKnowledge) {
            return null;
        }

        if (this.functions.some(item => item.id === functionKnowledge.id)) {
            functionKnowledge.id = this.getNextFunctionId();
        }

        if (!functionKnowledge.isValid()) {
            return null;
        }

        const duplicate = this.functions.some(
            item =>
                this.normalizeComparison(item.moduleId) ===
                    this.normalizeComparison(functionKnowledge.moduleId) &&
                this.normalizeComparison(item.name) ===
                    this.normalizeComparison(functionKnowledge.name)
        );

        if (duplicate) {
            return null;
        }

        const result = functionKnowledge.toJSON();
        this.functions.push(result);
        return result;
    }

    isApproved() {
        return this.approved === true;
    }

    approve() {
        this.approved = true;
        return this;
    }

    reset() {
        const empty = new RequirementKnowledge();

        Object.keys(this).forEach(key => {
            delete this[key];
        });

        Object.assign(this, empty);
        return this;
    }

    toJSON() {
        const result = {
            module: this.module ? this.cloneValue(this.module) : null,
            functions: this.cloneValue(this.functions),
            purpose: this.purpose,
            actors: [...this.actors],
            businessRules: [...this.businessRules],
            validationRules: this.cloneValue(this.validationRules),
            permissions: [...this.permissions],
            dependencies: [...this.dependencies],
            assumptions: [...this.assumptions],
            boundaryCases: this.cloneValue(this.boundaryCases),
            exceptions: [...this.exceptions],
            riskAreas: this.cloneValue(this.riskAreas),
            risks: this.cloneValue(this.risks),
            negativeCases: this.cloneValue(this.negativeCases),
            positiveCases: this.cloneValue(this.positiveCases),
            securityCases: this.cloneValue(this.securityCases),
            permissionCases: this.cloneValue(this.permissionCases),
            dataIntegrityCases: this.cloneValue(this.dataIntegrityCases),
            suggestedScenarios: this.cloneValue(this.suggestedScenarios),
            questions: this.cloneValue(this.questions),
            clarificationQuestions: this.cloneValue(this.clarificationQuestions),
            clarificationAnswers: this.cloneValue(this.clarificationAnswers),
            approved: this.approved,
            notes: [...this.notes],
            confidence: this.confidence,
            source: this.source,
            version: this.version
        };

        if (Object.prototype.hasOwnProperty.call(this, "features")) {
            result.features = this.cloneValue(this.features);
        }

        if (Object.prototype.hasOwnProperty.call(this, "feature")) {
            result.feature = this.feature;
        }

        return result;
    }

    getNextFunctionId() {
        const usedIds = new Set(this.functions.map(item => item.id));
        let sequence = 1;
        let candidate = "";

        do {
            candidate = `FUNC${String(sequence).padStart(3, "0")}`;
            sequence += 1;
        } while (usedIds.has(candidate));

        return candidate;
    }

    normalizeString(value) {
        return typeof value === "string" ? value.trim() : "";
    }

    normalizeStringArray(values) {
        if (!Array.isArray(values)) {
            return [];
        }

        const seen = new Set();
        const result = [];

        values.forEach(value => {
            const normalized = this.normalizeString(value);

            if (!normalized || seen.has(normalized)) {
                return;
            }

            seen.add(normalized);
            result.push(normalized);
        });

        return result;
    }

    normalizeComparison(value) {
        return this.normalizeString(value).toLowerCase();
    }

    defineArrayAlias(alias, source) {
        Object.defineProperty(this, alias, {
            configurable: true,
            enumerable: true,
            get: () => this[source],
            set: value => {
                this[source] = this.cloneArray(value);
            }
        });
    }

    cloneArray(value) {
        return Array.isArray(value) ? this.cloneValue(value) : [];
    }

    cloneObjectArray(value) {
        if (!Array.isArray(value)) {
            return [];
        }

        return value
            .filter(item => item && typeof item === "object" && !Array.isArray(item))
            .map(item => this.cloneValue(item));
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
}

export default RequirementKnowledge;
