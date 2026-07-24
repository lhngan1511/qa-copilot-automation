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

        this.requirementType = "";



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

        this.severity = "MEDIUM";

        this.priority = "MEDIUM";



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
        // Requirement Intelligence
        // ==========================

        this.intelligence = null;


        this.source = "";


        this.reason = "";


        this.riskCategory = "";



        // ==========================
        // Metadata
        // ==========================

        this.createdBy = "QA-Copilot";

        this.version = "1.0";


    }


}


export default TestCase;