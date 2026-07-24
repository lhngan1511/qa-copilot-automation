class TestScenario {


    constructor(){


        this.id = "";


        // Module

        this.feature = "";



        // Scenario information

        this.title = "";

        this.type = "POSITIVE";


        this.priority = "MEDIUM";

        this.severity = "MEDIUM";



        this.reason = "";

        this.riskCategory = "";




        // Requirement trace

        this.requirementReference = "";

        this.requirementType = "";




        // Test preparation

        this.preconditions = [];



        // Input data definition

        this.inputDefinitions = [];



        // Generated test data

        this.testData = {

            valid: {},

            invalid: {}

        };





        // Test execution steps

        this.steps = [];





        // Expected business results

        this.expectedResults = [];





        // Automation information

        this.automationCandidate = false;





        // Intelligence information

        this.intelligence = null;


    }


}


export default TestScenario;