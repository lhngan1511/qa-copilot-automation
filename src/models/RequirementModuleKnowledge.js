export default class RequirementModuleKnowledge {
    constructor({ id = "", name = "", purpose = "", requirementReferences = [] } = {}) {
        this.id = this.normalizeString(id);
        this.name = this.normalizeString(name);
        this.purpose = this.normalizeString(purpose);
        this.requirementReferences = this.normalizeStringArray(requirementReferences);
    }

    isValid() {
        return Boolean(this.id && this.name);
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            purpose: this.purpose,
            requirementReferences: [...this.requirementReferences]
        };
    }

    static from(value, fallbackId = "") {
        if (typeof value === "string") {
            const name = value.trim();

            if (!name) {
                return null;
            }

            return new RequirementModuleKnowledge({
                id: fallbackId,
                name
            });
        }

        if (!value || typeof value !== "object" || Array.isArray(value)) {
            return null;
        }

        return new RequirementModuleKnowledge({
            id: typeof value.id === "string" && value.id.trim() ? value.id : fallbackId,
            name: value.name ?? value.module,
            purpose: value.purpose,
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
