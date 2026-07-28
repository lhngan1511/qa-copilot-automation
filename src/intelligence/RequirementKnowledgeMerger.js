import RequirementKnowledge from "../models/RequirementKnowledge.js";
import RequirementKnowledgeValidator from "../validators/RequirementKnowledgeValidator.js";

export default class RequirementKnowledgeMerger {
    constructor(validator = new RequirementKnowledgeValidator()) {
        this.validator = validator;
    }

    merge(ruleKnowledge, aiKnowledge) {
        const result = new RequirementKnowledge(
            typeof ruleKnowledge?.toJSON === "function" ? ruleKnowledge.toJSON() : ruleKnowledge
        );

        if (!aiKnowledge || typeof aiKnowledge !== "object") {
            return result;
        }

        const aiFunctions = Array.isArray(aiKnowledge.functions) ? aiKnowledge.functions : [];

        aiFunctions.forEach(aiFunction => {
            const match = result.functions.find(ruleFunction =>
                this.isFunctionMatch(ruleFunction, aiFunction)
            );

            if (match) {
                this.mergeFunction(match, aiFunction);
                return;
            }

            if (
                aiFunction?.moduleId === result.module?.id &&
                Array.isArray(aiFunction.requirementReferences) &&
                aiFunction.requirementReferences.length > 0
            ) {
                const candidate = new RequirementKnowledge({
                    module: result.module,
                    functions: [aiFunction]
                });

                if (this.validator.validate(candidate).valid) {
                    result.addFunction(aiFunction);
                }
            }
        });

        result.notes = this.mergeArrays(result.notes, aiKnowledge.notes);
        result.confidence = Math.min(
            1,
            Math.max(
                Number.isFinite(result.confidence) ? result.confidence : 0,
                Number.isFinite(aiKnowledge.confidence) ? aiKnowledge.confidence : 0
            )
        );
        result.source = aiKnowledge.source
            ? `rule+${String(aiKnowledge.source).trim().toLowerCase()}`
            : "rule-engine";

        return result;
    }

    isFunctionMatch(ruleFunction, aiFunction) {
        const sameName =
            this.normalize(ruleFunction?.name) &&
            this.normalize(ruleFunction?.name) === this.normalize(aiFunction?.name);
        const ruleReferences = this.normalizeArray(ruleFunction?.requirementReferences);
        const aiReferences = this.normalizeArray(aiFunction?.requirementReferences);
        const sharedReference = ruleReferences.some(reference => aiReferences.includes(reference));

        return sameName || sharedReference;
    }

    mergeFunction(target, source) {
        if (!target.description && typeof source?.description === "string") {
            target.description = source.description.trim();
        }

        [
            "actors",
            "preconditions",
            "businessRules",
            "validationRules",
            "permissions",
            "boundaries",
            "exceptions",
            "risks",
            "requirementReferences"
        ].forEach(field => {
            target[field] = this.mergeArrays(target[field], source?.[field]);
        });
    }

    mergeArrays(first, second) {
        const result = [];
        const seen = new Set();

        [...(Array.isArray(first) ? first : []), ...(Array.isArray(second) ? second : [])].forEach(
            value => {
                if (typeof value !== "string" || !value.trim()) {
                    return;
                }

                const key = this.normalize(value);

                if (!seen.has(key)) {
                    seen.add(key);
                    result.push(value.trim());
                }
            }
        );

        return result;
    }

    normalizeArray(values) {
        return (Array.isArray(values) ? values : []).map(value => this.normalize(value));
    }

    normalize(value) {
        return typeof value === "string" ? value.trim().toLowerCase() : "";
    }
}
