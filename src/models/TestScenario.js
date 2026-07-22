class TestScenario {

    constructor() {

        // Identity
        this.id = "";

        // Requirement information
        this.feature = "";

        this.title = "";

        // POSITIVE
        // NEGATIVE
        // BOUNDARY
        // BUSINESS_RULE
        // SECURITY
        // PERFORMANCE
        this.type = "POSITIVE";

        // Traceability
        this.requirementReference = "";

        this.requirementType = "";

        // Scenario information
        this.reason = "";

        this.riskLevel = "Medium";

        this.riskCategory = "";

        // Execution
        this.preconditions = [];

        this.testData = null;

        this.steps = [];

        this.expectedResults = [];

        // Management
        this.severity = "Medium";

        this.priority = "Medium";

        // Automation
        this.automationCandidate = false;

    }

}

export default TestScenario;