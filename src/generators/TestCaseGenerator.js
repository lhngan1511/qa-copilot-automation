import TestCase from "../models/TestCase.js";


class TestCaseGenerator {


    constructor() {

        this.counter = 1;

    }






    generate(
        scenarios = []
    ) {



        if(
            !Array.isArray(scenarios)
        ){

            return [];

        }






        return scenarios.map(
            scenario => {


                const testCase =
                    new TestCase();





                testCase.id =
                    `TC${String(this.counter++)
                    .padStart(3,"0")}`;






                testCase.scenarioId =
                    scenario.id || "";







                testCase.module =
                    scenario.feature || "";





                testCase.feature =
                    scenario.feature || "";







                testCase.title =
                    scenario.title || "";






                testCase.testScenario =
                    scenario.title || "";







                testCase.type =
                    scenario.type || "";







                testCase.testObjective =
                    this.buildObjective(
                        scenario
                    );








                testCase.requirementReference =
                    scenario.requirementReference
                    ||
                    "";







                testCase.preconditions =
                    scenario.preconditions
                    ||
                    [];








                testCase.testData =
                    scenario.testData
                    ||
                    {

                        valid:{},

                        invalid:{}

                    };







                testCase.steps =
                    scenario.steps
                    ||
                    [];







                testCase.expectedResults =
                    scenario.expectedResults
                    ||
                    [];







                testCase.actualResult =
                    "";







                testCase.status =
                    "Not Tested";







                testCase.priority =
                    scenario.priority
                    ||
                    "MEDIUM";







                testCase.severity =
                    scenario.severity
                    ||
                    "MEDIUM";







                testCase.automation = {


                    candidate:
                        scenario.automationCandidate
                        ??
                        false,


                    framework:
                        "Playwright",


                    pageObject:
                        "",


                    locatorStrategy:
                        "",


                    locator:
                        "",


                    tags:
                        [
                            scenario.type
                        ]

                };








                testCase.intelligence =
                    scenario.intelligence
                    ||
                    null;







                testCase.traceability = {


                    requirementId:
                        scenario.requirementReference
                        ||
                        "",


                    scenarioId:
                        scenario.id
                        ||
                        ""

                };








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







                return testCase;



            }
        );



    }









    buildObjective(
        scenario
    ){



        switch(
            scenario.type
        ){



            case "NEGATIVE":

                return "Kiểm tra xử lý dữ liệu không hợp lệ";



            case "BOUNDARY":

                return "Kiểm tra giới hạn dữ liệu";



            case "PERMISSION":

                return "Kiểm tra quyền truy cập chức năng";



            case "SECURITY":

                return "Kiểm tra yêu cầu bảo mật";



            case "DATA_INTEGRITY":

                return "Kiểm tra tính toàn vẹn dữ liệu";



            default:

                return "Kiểm tra chức năng hoạt động đúng theo yêu cầu";


        }


    }



}


export default TestCaseGenerator;