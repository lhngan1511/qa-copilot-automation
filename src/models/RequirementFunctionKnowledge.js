export default class RequirementFunctionKnowledge {
    constructor({
        id = "",
        moduleId = "",
        name = "",
        description = "",
        actors = [],
        preconditions = [],
        businessRules = [],
        validationRules = [],
        permissions = [],
        boundaries = [],
        exceptions = [],
        risks = [],
        requirementReferences = []
    } = {}) {
        this.id = this.normalizeString(id);
        this.moduleId = this.normalizeString(moduleId);
        this.name = this.normalizeString(name);
        this.description = this.normalizeString(description);
        this.actors = this.normalizeStringArray(actors);
        this.preconditions = this.normalizeStringArray(preconditions);
        this.businessRules = this.normalizeStringArray(businessRules);
        this.validationRules = this.normalizeStringArray(validationRules);
        this.permissions = this.normalizeStringArray(permissions);
        this.boundaries = this.normalizeStringArray(boundaries);
        this.exceptions = this.normalizeStringArray(exceptions);
        this.risks = this.normalizeStringArray(risks);
        this.requirementReferences = this.normalizeStringArray(requirementReferences);
    }

    isValid() {
        return Boolean(this.id && this.moduleId && this.name);
    }

    toJSON() {
        return {
            id: this.id,
            moduleId: this.moduleId,
            name: this.name,
            description: this.description,
            actors: [...this.actors],
            preconditions: [...this.preconditions],
            businessRules: [...this.businessRules],
            validationRules: [...this.validationRules],
            permissions: [...this.permissions],
            boundaries: [...this.boundaries],
            exceptions: [...this.exceptions],
            risks: [...this.risks],
            requirementReferences: [...this.requirementReferences]
        };
    }

    static from(value, { fallbackId = "", fallbackModuleId = "" } = {}) {
        if (typeof value === "string") {
            const name = value.trim();

            if (!name) {
                return null;
            }

            return new RequirementFunctionKnowledge({
                id: fallbackId,
                moduleId: fallbackModuleId,
                name
            });
        }

        if (!value || typeof value !== "object" || Array.isArray(value)) {
            return null;
        }

        const legacyModuleId =
            typeof value.module === "string" && /^MOD\d+$/i.test(value.module.trim())
                ? value.module
                : "";

        return new RequirementFunctionKnowledge({
            id: typeof value.id === "string" && value.id.trim() ? value.id : fallbackId,
            moduleId:
                typeof value.moduleId === "string" && value.moduleId.trim()
                    ? value.moduleId
                    : legacyModuleId || fallbackModuleId,
            name: value.name ?? value.feature,
            description: value.description,
            actors: value.actors,
            preconditions: value.preconditions,
            businessRules: value.businessRules ?? value.rules,
            validationRules: value.validationRules ?? value.validations,
            permissions: value.permissions ?? value.permissionRules,
            boundaries: value.boundaries ?? value.boundaryCases,
            exceptions: value.exceptions ?? value.exceptionCases,
            risks: value.risks ?? value.riskAreas,
            requirementReferences: value.requirementReferences ?? value.references
        });
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
}
