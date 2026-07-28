export default class RequirementKnowledgeValidator {
    validate(knowledge) {
        const result = {
            valid: true,
            errors: [],
            warnings: []
        };

        if (!knowledge || typeof knowledge !== "object" || Array.isArray(knowledge)) {
            result.errors.push("Knowledge must be an object.");
            result.valid = false;
            return result;
        }

        const module = this.getObject(knowledge.module);
        const functions = Array.isArray(knowledge.functions) ? knowledge.functions : [];
        const modules = Array.isArray(knowledge.modules) ? knowledge.modules : [];

        const moduleIds = new Set();
        modules.forEach(value => {
            const item = this.getObject(value);

            if (!item || !this.hasText(item.id)) {
                return;
            }

            const moduleId = item.id.trim();

            if (moduleIds.has(moduleId)) {
                result.errors.push(`Duplicate module id: ${moduleId}.`);
                return;
            }

            moduleIds.add(moduleId);
        });

        if (!module) {
            result.warnings.push("Knowledge does not contain a structured module.");
        } else {
            if (!this.hasText(module.id)) {
                result.errors.push("Module id is required.");
            }

            if (!this.hasText(module.name)) {
                result.errors.push("Module name is required.");
            }

            if (!this.hasText(module.purpose)) {
                result.warnings.push("Module purpose is missing.");
            }
        }

        if (functions.length === 0) {
            result.warnings.push("Knowledge does not contain structured functions.");
        }

        const functionIds = new Set();

        functions.forEach((value, index) => {
            const item = this.getObject(value);
            const label = `Function at index ${index}`;

            if (!item) {
                result.errors.push(`${label} must be an object.`);
                return;
            }

            if (!this.hasText(item.id)) {
                result.errors.push(`${label} id is required.`);
            } else if (functionIds.has(item.id.trim())) {
                result.errors.push(`Duplicate function id: ${item.id.trim()}.`);
            } else {
                functionIds.add(item.id.trim());
            }

            if (!this.hasText(item.moduleId)) {
                result.errors.push(`${label} moduleId is required.`);
            }

            if (!this.hasText(item.name)) {
                result.errors.push(`${label} name is required.`);
            }

            if (
                module &&
                this.hasText(module.id) &&
                this.hasText(item.moduleId) &&
                item.moduleId.trim() !== module.id.trim()
            ) {
                result.errors.push(
                    `${label} moduleId '${item.moduleId.trim()}' does not match module '${module.id.trim()}'.`
                );
            }

            if (!Array.isArray(item.requirementReferences) || item.requirementReferences.length === 0) {
                result.warnings.push(`${label} does not contain requirementReferences.`);
            }

            const hasBusinessRules =
                Array.isArray(item.businessRules) && item.businessRules.length > 0;
            const hasValidationRules =
                Array.isArray(item.validationRules) && item.validationRules.length > 0;

            if (!hasBusinessRules && !hasValidationRules) {
                result.warnings.push(`${label} does not contain businessRules or validationRules.`);
            }
        });

        if (
            typeof knowledge.confidence === "number" &&
            (knowledge.confidence < 0 || knowledge.confidence > 1)
        ) {
            result.warnings.push("Confidence must be between 0 and 1.");
        }

        result.valid = result.errors.length === 0;
        return result;
    }

    getObject(value) {
        return value && typeof value === "object" && !Array.isArray(value) ? value : null;
    }

    hasText(value) {
        return typeof value === "string" && value.trim() !== "";
    }
}
