class TestCase {


    constructor() {


        this.id = "";

        this.scenarioId = "";


        // Module / Feature

        this.module = "";

        this.feature = "";



        // Nội dung testcase

        this.title = "";

        this.testScenario = "";

        this.type = "";

        this.testObjective = "";



        // Trace requirement

        this.requirementReference = "";



        // Preconditions

        this.preconditions = [];



        // Test data

        this.testData = {

            inputs: {},

            expected: {},

            invalid: {}

        };



        // Steps chuẩn QA

        this.steps = [];



        // Expected Result

        this.expectedResults = [];



        // Execution

        this.actualResult = "";

        this.status = "Not Tested";



        // Priority

        this.priority = "MEDIUM";

        this.severity = "MEDIUM";



        // Automation

        this.automation = {


            candidate: false,


            framework: "Playwright",


            pageObject: "",


            locatorStrategy: "",


            locator: "",


            tags: []


        };



        // AI Intelligence

        this.intelligence = null;



        // Traceability

        this.traceability = {


            requirementId: "",


            scenarioId: ""


        };



        // Metadata

        this.source = "QA-Copilot";


        this.reason = "";


        this.riskCategory = "";


        this.createdBy = "QA-Copilot";


        this.version = "1.0";


    }


}


export default TestCase;