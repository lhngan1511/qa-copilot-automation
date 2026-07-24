import TestScenario from "../models/TestScenario.js";


class IntelligenceScenarioGenerator {


    constructor() {

        this.counter = 1;

    }



    generate(
        recommendedScenarios,
        requirement,
        knowledge = null
    ) {


        if (
            !Array.isArray(recommendedScenarios)
        ) {

            return [];

        }



        return recommendedScenarios.map(item => {


            const scenario =
                new TestScenario();



            scenario.id =
                `SC${String(this.counter++)
                    .padStart(3, "0")}`;



            scenario.feature =
                requirement.feature || "";



            scenario.title =
                item.title || "";



            scenario.type =
                item.type || "POSITIVE";



            scenario.priority =
                item.priority || "MEDIUM";



            scenario.reason =
                item.reason || "";



            scenario.riskCategory =
                item.riskCategory
                ||
                item.type
                ||
                "";



            scenario.requirementReference =
                item.requirementReference
                ||
                item.title
                ||
                "";



            scenario.requirementType =
                item.type || "";



            scenario.inputDefinitions =
                requirement.inputDefinitions
                ||
                [];



            scenario.preconditions =
                [
                    "Người dùng đã đăng nhập"
                ];



            scenario.steps =
                this.generateSteps(
                    scenario
                );



            scenario.expectedResults =
                [
                    this.generateExpectedResult(
                        scenario
                    )
                ];



            scenario.testData =
                null;



            scenario.severity =
                item.priority
                ||
                "MEDIUM";



            scenario.automationCandidate =
                true;




            if (knowledge) {


                scenario.intelligence = {


                    confidence:
                        knowledge.confidence
                        ||
                        0,


                    validationRules:
                        knowledge.validationRules
                        ||
                        [],


                    boundaryCases:
                        knowledge.boundaryCases
                        ||
                        [],


                    negativeCases:
                        knowledge.negativeCases
                        ||
                        [],


                    positiveCases:
                        knowledge.positiveCases
                        ||
                        [],


                    securityCases:
                        knowledge.securityCases
                        ||
                        [],


                    permissionCases:
                        knowledge.permissionCases
                        ||
                        [],


                    dataIntegrityCases:
                        knowledge.dataIntegrityCases
                        ||
                        []


                };


            }



            return scenario;


        });


    }







    generateSteps(scenario) {



        const negativeTypes = [

            "NEGATIVE",

            "SECURITY",

            "PERMISSION",

            "DATA_INTEGRITY",

            "BOUNDARY"

        ];



        if (
            negativeTypes.includes(
                scenario.type
            )
        ) {



            return [


                {

                    order: 1,

                    action:
                        "Mở chức năng",

                    expected:
                        "Màn hình hiển thị"

                },


                {

                    order: 2,

                    action:
                        `Nhập dữ liệu kiểm tra: ${scenario.title}`,

                    expected:
                        "Hệ thống thực hiện kiểm tra"

                },


                {

                    order: 3,

                    action:
                        "Thực hiện thao tác",

                    expected:
                        "Hệ thống xử lý đúng theo yêu cầu"

                }


            ];


        }





        return [


            {

                order: 1,

                action:
                    "Mở chức năng",

                expected:
                    "Màn hình hiển thị"

            },


            {

                order: 2,

                action:
                    scenario.title,

                expected:
                    "Dữ liệu được xử lý"

            },


            {

                order: 3,

                action:
                    "Kiểm tra kết quả",

                expected:
                    "Kết quả đúng yêu cầu"

            }


        ];

    }








    generateExpectedResult(scenario) {



        const negativeTypes = [

            "NEGATIVE",

            "SECURITY",

            "PERMISSION",

            "DATA_INTEGRITY",

            "BOUNDARY"

        ];



        if (
            negativeTypes.includes(
                scenario.type
            )
        ) {


            return "Hệ thống xử lý đúng theo quy tắc kiểm tra";


        }



        return "Hệ thống xử lý thành công";


    }


}


export default IntelligenceScenarioGenerator;