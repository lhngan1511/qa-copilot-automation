import TestCase from "../models/TestCase.js";

class TestCaseGenerator {
    constructor() {
        this.counter = 1;
    }

    generate(scenarios) {
        const testCases = [];

        scenarios.forEach(scenario => {
            const testCase = new TestCase();

            testCase.id = this.generateId();

            testCase.scenarioId = scenario.id;

            testCase.feature = scenario.feature;

            testCase.title = scenario.title;

            testCase.type = scenario.type;

            testCase.severity = scenario.severity;

            testCase.priority = scenario.priority;

            testCase.preconditions = scenario.preconditions;

            testCase.steps = this.generateSteps(scenario);

            testCase.expectedResults = scenario.expectedResults;

            testCase.automationCandidate = scenario.automationCandidate;

            testCase.requirementReference = scenario.requirementReference;

            testCases.push(testCase);
        });

        return testCases;
    }

    generateSteps(scenario) {
        if (scenario.type === "NEGATIVE") {
            return [
                {
                    order: 1,
                    action: "Mở chức năng",
                    expected: "Màn hình hiển thị"
                },

                {
                    order: 2,
                    action: `Nhập dữ liệu lỗi: ${scenario.title}`,
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
                action: `Thực hiện ${scenario.title}`,
                expected: "Dữ liệu được xử lý"
            },

            {
                order: 3,
                action: "Kiểm tra kết quả",
                expected: "Kết quả đúng yêu cầu"
            }
        ];
    }

    generateId() {
        return `TC${String(this.counter++).padStart(3, "0")}`;
    }
}

export default TestCaseGenerator;
