import TestScenario from "../models/TestScenario.js";

class IntelligenceScenarioGenerator {

    constructor() {

        this.counter = 1;

    }


    generate(recommendedScenarios, requirement) {

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
                requirement.feature;


            scenario.title =
                item.title;


            scenario.type =
                item.type;


            scenario.priority =
                item.priority;


            scenario.reason =
                item.reason;


            scenario.riskCategory =
                item.riskCategory;


            scenario.requirementReference =
                item.requirementReference;


            scenario.requirementType =
                item.type;


            // Truyền input definition từ Requirement xuống Scenario
            scenario.inputDefinitions =
                requirement.inputDefinitions || [];



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
                item.priority;


            scenario.automationCandidate =
                true;


            return scenario;

        });

    }



    generateSteps(scenario) {


        if (
            scenario.type === "NEGATIVE"
        ) {

            return [

                {
                    order: 1,
                    action: "Mở chức năng",
                    expected: "Màn hình hiển thị"
                },

                {
                    order: 2,
                    action: `Nhập dữ liệu không hợp lệ: ${scenario.title}`,
                    expected: "Hệ thống kiểm tra dữ liệu"
                },

                {
                    order: 3,
                    action: "Thực hiện lưu",
                    expected: "Hệ thống từ chối dữ liệu"
                }

            ];

        }


        return [

            {
                order: 1,
                action: "Mở chức năng",
                expected: "Màn hình hiển thị"
            },

            {
                order: 2,
                action: scenario.title,
                expected: "Dữ liệu được xử lý"
            },

            {
                order: 3,
                action: "Kiểm tra kết quả",
                expected: "Kết quả đúng yêu cầu"
            }

        ];

    }



    generateExpectedResult(scenario) {


        if (
            scenario.type === "NEGATIVE"
        ) {

            return "Hệ thống từ chối dữ liệu không hợp lệ";

        }


        return "Hệ thống xử lý thành công";


    }


}


export default IntelligenceScenarioGenerator;