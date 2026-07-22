import TestCase from "../models/TestCase.js";


class TestCaseGenerator {


    constructor(){

        this.counter = 1;

    }



    generate(scenarios){


        const testCases = [];



        if(
            !scenarios ||
            !Array.isArray(scenarios)
        ){

            return testCases;

        }



        scenarios.forEach(
            scenario => {


                const testCase =
                    new TestCase();



                testCase.id =
                    this.generateId();



                testCase.feature =
                    scenario.feature;



                testCase.title =
                    this.generateTitle(
                        scenario
                    );



                testCase.type =
                    scenario.type;



                testCase.preconditions =
                    scenario.preconditions;



                testCase.testData =
                    scenario.testData;



                testCase.steps =
                    this.generateSteps(
                        scenario
                    );



                testCase.expectedResults =
                    scenario.expectedResults;



                testCase.severity =
                    scenario.severity;



                testCase.priority =
                    scenario.priority;



                testCase.automationCandidate =
                    scenario.automationCandidate;



                testCases.push(
                    testCase
                );


            }
        );


        return testCases;


    }





    generateId(){


        const id =
            String(this.counter)
            .padStart(3,"0");


        this.counter++;


        return `TC${id}`;

    }





    generateTitle(scenario){


        return `Kiểm tra ${scenario.title}`;

    }





    generateSteps(scenario){


        return [

            "Mở chức năng " + scenario.feature,

            "Thực hiện tình huống: "
                + scenario.title,

            "Kiểm tra kết quả xử lý"

        ];


    }


}


export default TestCaseGenerator;