class TestCase {

    constructor() {

        // ==========================
        // Identity
        // ==========================

        this.id = "";

        this.scenarioId = "";

        // ==========================
        // Requirement Information
        // ==========================

        this.feature = "";

        this.title = "";

        this.type = "";

        this.requirementReference = "";

        // ==========================
        // Test Execution
        // ==========================

        this.preconditions = [];

        this.testData = {
            inputs: {},
            expected: {},
            invalid: {}
        };

        this.steps = [];

        this.expectedResults = [];

        // ==========================
        // Test Management
        // ==========================

        this.severity = "Medium";

        this.priority = "Medium";

        // ==========================
        // Automation
        // ==========================

        this.automationCandidate = false;

        this.automation = {
            candidate: false,
            framework: "",
            pageObject: "",
            locatorStrategy: "",
            tags: []
        };

        // ==========================
        // Intelligence Metadata
        // ==========================

        this.source = "";

        this.reason = "";

        this.riskCategory = "";

        // ==========================
        // Version
        // ==========================

        this.createdBy = "QA-Copilot";

        this.version = "1.0";

    }

}

export default TestCase;