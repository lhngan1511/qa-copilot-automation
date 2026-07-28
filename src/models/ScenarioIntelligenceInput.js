export default class ScenarioIntelligenceInput {
    constructor({
        module = null,
        functions = [],
        ruleScenarios = [],
        clarificationAnswers = [],
        requirementReference = {},
        constraints = {}
    } = {}) {
        this.module = this.cloneObject(module);
        this.functions = this.cloneArray(functions);
        this.ruleScenarios = this.cloneArray(ruleScenarios);
        this.clarificationAnswers = this.cloneArray(clarificationAnswers);
        this.requirementReference = this.cloneObject(requirementReference) ?? {};
        this.constraints = {
            maxScenariosPerFunction:
                Number.isInteger(constraints?.maxScenariosPerFunction) &&
                constraints.maxScenariosPerFunction >= 0
                    ? constraints.maxScenariosPerFunction
                    : 0,
            preferredTypes: Array.isArray(constraints?.preferredTypes)
                ? constraints.preferredTypes.filter(value => typeof value === "string")
                : []
        };
    }

    isValid() {
        return Boolean(
            this.module?.id &&
                this.module?.name &&
                this.functions.some(item => item?.id && item?.moduleId && item?.name)
        );
    }

    toJSON() {
        return this.cloneValue(this);
    }

    cloneObject(value) {
        return value && typeof value === "object" && !Array.isArray(value)
            ? this.cloneValue(value)
            : null;
    }

    cloneArray(value) {
        return Array.isArray(value) ? this.cloneValue(value) : [];
    }

    cloneValue(value) {
        if (Array.isArray(value)) return value.map(item => this.cloneValue(item));
        if (value && typeof value === "object") {
            return Object.fromEntries(
                Object.entries(value).map(([key, item]) => [key, this.cloneValue(item)])
            );
        }
        return value;
    }
}
