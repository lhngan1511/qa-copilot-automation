export default class TestCaseIntelligenceInput {
    constructor({
        scenarios = [],
        module = null,
        functions = [],
        clarificationAnswers = [],
        requirementReference = {},
        constraints = {}
    } = {}) {
        this.scenarios = this.clone(scenarios);
        this.module = this.clone(module);
        this.functions = this.clone(functions);
        this.clarificationAnswers = this.clone(clarificationAnswers);
        this.requirementReference = this.clone(requirementReference);
        this.constraints = {
            maxTestCasesPerScenario: Number.isInteger(constraints.maxTestCasesPerScenario)
                ? constraints.maxTestCasesPerScenario
                : 0,
            maxStepsPerTestCase: Number.isInteger(constraints.maxStepsPerTestCase)
                ? constraints.maxStepsPerTestCase
                : 0,
            preferredCoverage: Array.isArray(constraints.preferredCoverage)
                ? [...constraints.preferredCoverage]
                : []
        };
    }
    isValid() {
        return (
            Array.isArray(this.scenarios) &&
            this.scenarios.length > 0 &&
            this.scenarios.every(
                s =>
                    s?.id &&
                    s?.moduleId &&
                    s?.functionId &&
                    s?.title &&
                    (s.expectedResult || s.expectedResults?.length || s.description || s.objective)
            )
        );
    }
    toJSON() {
        return this.clone(this);
    }
    clone(v) {
        if (Array.isArray(v)) return v.map(x => this.clone(x));
        if (v && typeof v === "object")
            return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, this.clone(x)]));
        return v;
    }
}
