class TestScenario {


    constructor() {


        // Identity

        this.id = "";



        // Requirement information

        this.feature = "";

        this.title = "";



        // Scenario type

        // POSITIVE
        // NEGATIVE
        // BOUNDARY
        // BUSINESS_RULE
        // SECURITY
        // PERMISSION
        // DATA_INTEGRITY
        // PERFORMANCE

        this.type = "POSITIVE";



        // Traceability

        this.requirementReference = "";

        this.requirementType = "";



        // Intelligence information

        this.reason = "";

        this.riskLevel = "MEDIUM";

        this.riskCategory = "";

        this.intelligence = null;



        // Requirement inputs

        this.inputDefinitions = [];



        // Execution

        this.preconditions = [];

        this.testData = null;

        this.steps = [];

        this.expectedResults = [];



        // Management

        this.severity = "MEDIUM";

        this.priority = "MEDIUM";



        // Automation

        this.automationCandidate = false;


    }


}


export default TestScenario;