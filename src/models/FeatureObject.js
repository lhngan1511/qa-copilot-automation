class FeatureObject {
    constructor() {
        // =====================================
        // Identity
        // =====================================

        this.id = "";

        this.name = "";

        // =====================================
        // Basic Information
        // =====================================

        this.description = "";

        // =====================================
        // Preconditions
        // =====================================

        this.preconditions = [];

        // =====================================
        // Input Data
        // =====================================

        this.inputs = [];

        // =====================================
        // Main Flow
        // =====================================

        this.flow = [];

        // =====================================
        // Business Rules
        // =====================================

        this.businessRules = [];

        // Validation rules are a first-class part of Requirement Markdown V1.
        this.validationRules = [];

        // =====================================
        // Expected Results
        // =====================================

        this.expectedResults = [];

        // =====================================
        // Exceptions / Negative Cases
        //
        // Giữ lại để tương thích với parser
        // và pipeline hiện tại.
        // Requirement mới không bắt buộc phải có.
        // =====================================

        this.exceptions = [];

        // =====================================
        // Automation Metadata
        // =====================================

        this.automation = {
            screen: "",

            operation: ""
        };

        // =====================================
        // Future Extension
        // =====================================

        this.testScenarios = [];

        this.testCases = [];
    }

    addPrecondition(condition) {
        if (condition && !this.preconditions.includes(condition)) {
            this.preconditions.push(condition);
        }
    }

    addInput(input) {
        if (!input) {
            return;
        }

        const inputName = typeof input === "string" ? input : input.name;

        const existed = this.inputs.some(currentInput => {
            const currentName =
                typeof currentInput === "string" ? currentInput : currentInput?.name;

            return (
                currentName && inputName && currentName.toLowerCase() === inputName.toLowerCase()
            );
        });

        if (!existed) {
            this.inputs.push(input);
        }
    }

    addFlow(step) {
        if (step && !this.flow.includes(step)) {
            this.flow.push(step);
        }
    }

    addBusinessRule(rule) {
        if (rule && !this.businessRules.includes(rule)) {
            this.businessRules.push(rule);
        }
    }

    addExpectedResult(result) {
        if (result && !this.expectedResults.includes(result)) {
            this.expectedResults.push(result);
        }
    }

    addException(exception) {
        if (exception && !this.exceptions.includes(exception)) {
            this.exceptions.push(exception);
        }
    }

    setAutomation(screen = "", operation = "") {
        this.automation = {
            screen: String(screen ?? "").trim(),

            operation: String(operation ?? "").trim()
        };
    }
}

export default FeatureObject;
