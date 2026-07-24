import TestCase from "../models/TestCase.js";
import TestDataGenerator from "./TestDataGenerator.js";


class TestCaseGenerator {


    constructor() {

        this.counter = 1;

        this.testDataGenerator =
            new TestDataGenerator();

    }





    generate(scenarios = []) {


        if (
            !Array.isArray(scenarios)
        ) {

            return [];

        }





        return scenarios.map(scenario => {



            const testCase =
                new TestCase();





            testCase.id =
                `TC${String(this.counter++)
                    .padStart(3, "0")}`;





            testCase.scenarioId =
                scenario.id
                ||
                "";





            testCase.feature =
                scenario.feature
                ||
                "";





            testCase.title =
                scenario.title
                ||
                "";





            testCase.type =
                scenario.type
                ||
                "";





            testCase.requirementReference =
                scenario.requirementReference
                ||
                scenario.title
                ||
                "";





            testCase.preconditions =
                scenario.preconditions
                ||
                [];





            testCase.testData =
                this.testDataGenerator.generate(

                    scenario.inputDefinitions
                    ||
                    scenario.inputs
                    ||
                    [],

                    scenario

                );





            testCase.steps =
                scenario.steps
                ||
                [];





            testCase.expectedResults =
                scenario.expectedResults
                ||
                [];





            testCase.severity =
                scenario.severity
                ||
                "MEDIUM";





            testCase.priority =
                scenario.priority
                ||
                "MEDIUM";





            testCase.automationCandidate =
                scenario.automationCandidate
                ??
                false;





            if (
                testCase.automation
            ) {


                testCase.automation.candidate =
                    testCase.automationCandidate;


            }






            testCase.source =
                "Requirement Intelligence Engine";





            testCase.reason =
                scenario.reason
                ||
                "";





            testCase.riskCategory =
                scenario.riskCategory
                ||
                "";





            testCase.intelligence =
                scenario.intelligence
                ||
                null;





            return testCase;



        });



    }


}


export default TestCaseGenerator;