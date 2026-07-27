import TestCase from "../models/TestCase.js";

class TestCaseGenerator {
    constructor() {
        this.counter = 1;
    }

    generate(scenarios = []) {
        if (!Array.isArray(scenarios)) {
            return [];
        }

        return scenarios.map(scenario => {
            const testCase = new TestCase();

            const generatedId = `TC${String(this.counter++).padStart(3, "0")}`;

            testCase.id =
                scenario.id === undefined || scenario.id === null || scenario.id === ""
                    ? generatedId
                    : scenario.id;

            testCase.scenarioId = scenario.id ?? "";

            testCase.module = scenario.module === undefined ? "" : scenario.module;

            testCase.feature = scenario.feature === undefined ? "" : scenario.feature;

            testCase.title = scenario.title === undefined ? "" : scenario.title;

            testCase.testScenario = scenario.testScenario ?? scenario.title ?? "";

            testCase.type = scenario.type ?? "";

            testCase.testObjective = scenario.testObjective ?? this.buildObjective(scenario);

            testCase.requirementReference = scenario.requirementReference ?? "";

            testCase.preconditions =
                scenario.preconditions === undefined ? [] : scenario.preconditions;

            testCase.testData =
                scenario.testData === undefined ? testCase.testData : scenario.testData;

            testCase.steps = scenario.steps === undefined ? [] : scenario.steps;

            testCase.expectedResult =
                scenario.expectedResult === undefined ? "" : scenario.expectedResult;

            testCase.expectedResults =
                scenario.expectedResults !== undefined
                    ? scenario.expectedResults
                    : scenario.expectedResult !== undefined && scenario.expectedResult !== null
                      ? [scenario.expectedResult]
                      : [];

            testCase.assertions = scenario.assertions === undefined ? [] : scenario.assertions;

            if (
                scenario.automationHints &&
                typeof scenario.automationHints === "object" &&
                !Array.isArray(scenario.automationHints)
            ) {
                testCase.automationHints = this.cloneValue(scenario.automationHints);
            } else if (testCase.automationHints === undefined) {
                testCase.automationHints = {};
            }

            testCase.actualResult = "";

            testCase.status = "Not Tested";

            testCase.priority = scenario.priority ?? "MEDIUM";

            testCase.severity = scenario.severity ?? "MEDIUM";

            testCase.automation = {
                candidate: scenario.automationCandidate ?? false,

                framework: "Playwright",

                pageObject: "",

                locatorStrategy: "",

                locator: "",

                tags: [scenario.type]
            };

            testCase.intelligence = scenario.intelligence ?? null;

            testCase.traceability = {
                requirementId: scenario.requirementReference ?? "",

                scenarioId: scenario.id ?? ""
            };

            testCase.source = scenario.source ?? "Requirement Intelligence Engine";

            testCase.reason = scenario.reason ?? "";

            testCase.riskCategory = scenario.riskCategory ?? "";

            return testCase;
        });
    }

    buildObjective(scenario) {
        switch (scenario.type) {
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

    cloneValue(value) {
        if (Array.isArray(value)) {
            return value.map(item => this.cloneValue(item));
        }

        if (value && typeof value === "object") {
            const clone = {};

            Object.entries(value).forEach(([key, item]) => {
                clone[key] = this.cloneValue(item);
            });

            return clone;
        }

        return value;
    }
}

export default TestCaseGenerator;
